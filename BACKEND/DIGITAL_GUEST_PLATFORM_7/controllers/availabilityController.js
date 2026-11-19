const pool = require('../config/db');
const Joi = require('joi');

const checkRoomAvailability = async (req, res) => {
    try {
        const { check_in, check_out, guest_count } = req.query;

        // 2. Define validation rules
        const schema = Joi.object({
            check_in: Joi.date().iso().required(),
            check_out: Joi.date().iso().greater(Joi.ref('check_in')).required(),
            guest_count: Joi.number().integer().min(1).required()
        });

        // 3. Validate the search parameters
        const { error, value } = schema.validate({
            check_in,
            check_out,
            guest_count
        });

        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }

        const {
            check_in: checkIn,
            check_out: checkOut,
            guest_count: guestCount
        } = value;

        // We'll add the availability query here next.

      const result = await pool.query(
    `SELECT * FROM rooms
     WHERE capacity >= $1
     AND NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE bookings.room_id = rooms.id
         AND (
             booking_status = 'confirmed'
             OR (
                 booking_status = 'pending'
                 AND hold_expires_at > CURRENT_TIMESTAMP
             )
         )
         AND check_in < $3
         AND check_out > $2
     )
     ORDER BY id ASC`,
    [guestCount, checkIn, checkOut]
);


res.status(200).json({
    message: 'Available rooms retrieved successfully',
    rooms: result.rows
});

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Internal server error'
        });
    }
};

module.exports = { checkRoomAvailability };