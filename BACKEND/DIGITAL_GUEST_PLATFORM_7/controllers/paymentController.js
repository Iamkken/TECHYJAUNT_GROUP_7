
const pool = require('../config/db');
const axios = require('axios');
const Joi = require('joi');
const crypto = require('crypto');

// 1. Initialize payment
const initializePayment = async (req, res) => {
    const schema = Joi.object({
        booking_id: Joi.number().integer().positive().required()
    });

    const { error, value } = schema.validate(req.body);

    if (error) {
        return res.status(400).json({
            message: error.details[0].message
        });
    }

    try {
        // 2. Retrieve the booking and guest's email
        const bookingResult = await pool.query(
            `SELECT bookings.*, users.email
             FROM bookings
             JOIN users ON bookings.user_id = users.id
             WHERE bookings.id = $1
             AND bookings.user_id = $2`,
            [value.booking_id, req.user.id]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(404).json({
                message: 'Booking not found'
            });
        }

        const booking = bookingResult.rows[0];

        // 3. Check booking status and temporary hold
        if (
            booking.booking_status !== 'pending' ||
            !booking.hold_expires_at ||
            new Date(booking.hold_expires_at) <= new Date()
        ) {
            return res.status(400).json({
                message: 'Booking is no longer eligible for payment'
            });
        }

        // 4. Convert the booking amount from naira to kobo
        const amountInKobo = Math.round(
            Number(booking.total_amount) * 100
        );

        // 5. Generate a unique payment reference
        const reference = `booking-${booking.id}-${crypto.randomUUID()}`;

        // 6. Save the payment record
        await pool.query(
            `INSERT INTO payments (
                booking_id,
                payment_reference,
                amount,
                payment_status
            )
            VALUES ($1, $2, $3, 'pending')`,
            [booking.id, reference, booking.total_amount]
        );

        // 7. Initialize the transaction with Paystack
        const paystackResponse = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email: booking.email,
                amount: amountInKobo,
                reference: reference,
                currency: 'NGN'
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!paystackResponse.data.status) {
            throw new Error('Paystack could not initialize payment');
        }

        // 8. Return the payment link to the frontend
        return res.status(200).json({
            message: 'Payment initialized successfully',
            authorization_url: paystackResponse.data.data.authorization_url,
            reference: reference
        });

    } catch (error) {
        console.error(error.response?.data || error.message);

        return res.status(500).json({
            message: 'Unable to initialize payment'
        });
    }
};


// 9. Verify payment
const verifyPayment = async (req, res) => {
    const schema = Joi.object({
        reference: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);

    if (error) {
        return res.status(400).json({
            message: error.details[0].message
        });
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        // 10. Find the payment belonging to the authenticated user
        const paymentResult = await client.query(
            `SELECT payments.*, bookings.user_id,
                    bookings.booking_status,
                    bookings.hold_expires_at
             FROM payments
             JOIN bookings ON payments.booking_id = bookings.id
             WHERE payments.payment_reference = $1
             AND bookings.user_id = $2`,
            [value.reference, req.user.id]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                message: 'Payment reference not found'
            });
        }

        const payment = paymentResult.rows[0];

        if (
            payment.payment_status === 'success' &&
            payment.booking_status === 'confirmed'
        ) {
            return res.status(200).json({
                message: 'Payment has already been verified. Booking is confirmed.',
                booking_id: payment.booking_id,
                payment_status: 'success',
                booking_status: 'confirmed'
            });
        }

        // 11. Verify the transaction directly with Paystack
        const paystackResponse = await axios.get(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(value.reference)}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const transaction = paystackResponse.data.data;

        // 12. Check payment status and amount
        if (
            !paystackResponse.data.status ||
            transaction.status !== 'success' ||
            transaction.amount !== Math.round(Number(payment.amount) * 100) ||
            transaction.currency !== 'NGN' ||
            transaction.reference !== value.reference
        ) {
            return res.status(400).json({
                message: 'Payment verification failed'
            });
        }

        // 13. Start a transaction to update payment and booking
        await client.query('BEGIN');
        transactionStarted = true;

        const lockedBooking = await client.query(
            `SELECT *
             FROM bookings
             WHERE id = $1
             FOR UPDATE`,
            [payment.booking_id]
        );

        const booking = lockedBooking.rows[0];

        // 14. Check whether the booking is still eligible for confirmation
        if (
            booking.booking_status !== 'pending' ||
            !booking.hold_expires_at ||
            new Date(booking.hold_expires_at) <= new Date()
        ) {
            await client.query(
                `UPDATE payments
                 SET payment_status = 'success',
                     confirmed_at = CURRENT_TIMESTAMP
                 WHERE payment_reference = $1`,
                [value.reference]
            );

            await client.query('COMMIT');
            transactionStarted = false;

            return res.status(409).json({
                message: 'Payment was received, but the booking hold has expired. Manual resolution is required.'
            });
        }

        // 15. Update payment status
        await client.query(
            `UPDATE payments
             SET payment_status = 'success',
                 confirmed_at = CURRENT_TIMESTAMP
             WHERE payment_reference = $1`,
            [value.reference]
        );

        // 16. Confirm the booking
        await client.query(
            `UPDATE bookings
             SET booking_status = 'confirmed'
             WHERE id = $1`,
            [payment.booking_id]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(200).json({
            message: 'Payment verified successfully. Booking confirmed.',
            booking_id: payment.booking_id,
            payment_reference: value.reference,
            booking_status: 'confirmed',
            payment_status: 'success'
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error(error.response?.data || error.message);

        return res.status(500).json({
            message: 'Unable to verify payment'
        });

    } finally {
        client.release();
    }
};

module.exports = {
    initializePayment,
    verifyPayment
};
