
const pool = require('../config/db');
const Joi = require('joi');

const createBooking = async (req, res) => {
    const { room_id, check_in, check_out, guest_count } = req.body;

    // 1. Validate the booking details
    const schema = Joi.object({
        room_id: Joi.number().integer().positive().required(),
        check_in: Joi.date().iso().required(),
        check_out: Joi.date().iso().greater(Joi.ref('check_in')).required(),
        guest_count: Joi.number().integer().min(1).required()
    });

    const { error, value } = schema.validate({
        room_id,
        check_in,
        check_out,
        guest_count
    });

    if (error) {
        return res.status(400).json({
            message: error.details[0].message
        });
    }

    // 2. Get the authenticated user's ID
    const userId = req.user.id;

    // Convert dates to YYYY-MM-DD format
    const checkIn = value.check_in.toISOString().slice(0, 10);
    const checkOut = value.check_out.toISOString().slice(0, 10);

    // 3. Calculate the number of nights
    const numberOfNights = Math.round(
        (value.check_out.getTime() - value.check_in.getTime()) / 86400000
    );

    // 4. Get a database client for the transaction
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        // 5. Find and lock the selected room
        const roomResult = await client.query(
            `SELECT id, price_per_night, capacity
             FROM rooms
             WHERE id = $1
             FOR UPDATE`,
            [value.room_id]
        );

        if (roomResult.rows.length === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(404).json({
                message: 'Room not found'
            });
        }

        const room = roomResult.rows[0];

        // 6. Check the room's capacity
        if (room.capacity < value.guest_count) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(400).json({
                message: 'Room capacity is insufficient for the number of guests'
            });
        }

        // 7. Check for an existing booking that overlaps
        const existingBooking = await client.query(
            `SELECT id
             FROM bookings
             WHERE room_id = $1
             AND (
                 booking_status = 'confirmed'
                 OR (
                     booking_status = 'pending'
                     AND hold_expires_at > CURRENT_TIMESTAMP
                 )
             )
             AND check_in < $3
             AND check_out > $2
             LIMIT 1`,
            [value.room_id, checkIn, checkOut]
        );

        if (existingBooking.rows.length > 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(409).json({
                message: 'Room is not available for the selected dates'
            });
        }

        // 8. Create the booking and calculate the total amount
        const bookingResult = await client.query(
            `INSERT INTO bookings (
                user_id,
                room_id,
                check_in,
                check_out,
                guest_count,
                total_amount,
                booking_status,
                hold_expires_at
            )
            VALUES (
                $1, $2, $3, $4, $5,
                (SELECT price_per_night * $6 FROM rooms WHERE id = $2),
                'pending',
                CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            )
            RETURNING *`,
            [
                userId,
                value.room_id,
                checkIn,
                checkOut,
                value.guest_count,
                numberOfNights
            ]
        );

        // 9. Save the transaction
        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(201).json({
            message: 'Booking created successfully. Complete payment within 15 minutes.',
            booking: bookingResult.rows[0]
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error(error.message);

        return res.status(500).json({
            message: 'Internal server error'
        });

    } finally {
        client.release();
    }
};

module.exports = { createBooking };

