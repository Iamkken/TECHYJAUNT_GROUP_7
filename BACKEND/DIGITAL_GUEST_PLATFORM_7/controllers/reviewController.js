
const pool = require('../config/db');
const Joi = require('joi');

// Validation rules for a review
const reviewSchema = Joi.object({
    booking_id: Joi.number().integer().positive().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().trim().max(1000).allow('').optional()
});

// Create a review
const createReview = async (req, res) => {
    try {
        // Validate the information submitted by the guest
        const { error, value } = reviewSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }

        const { booking_id, rating, comment } = value;

        // Check whether the booking belongs to the logged-in guest,
        // is confirmed, has successful payment, and has passed its checkout date
        const bookingResult = await pool.query(
            `SELECT b.id
             FROM bookings b
             WHERE b.id = $1
             AND b.user_id = $2
             AND b.booking_status = 'confirmed'
             AND b.check_out <= CURRENT_DATE
             AND EXISTS (
                 SELECT 1
                 FROM payments p
                 WHERE p.booking_id = b.id
                 AND p.payment_status = 'success'
             )`,
            [booking_id, req.user.id]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(400).json({
                message: 'Booking is not eligible for a review.'
            });
        }

        // Save the review in the database
        const reviewResult = await pool.query(
            `INSERT INTO reviews (booking_id, user_id, rating, comment)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [booking_id, req.user.id, rating, comment || null]
        );

        return res.status(201).json({
            message: 'Review submitted successfully.',
            review: reviewResult.rows[0]
        });

    } catch (error) {
        // Handle attempts to review the same booking more than once
        if (error.code === '23505') {
            return res.status(409).json({
                message: 'A review has already been submitted for this booking.'
            });
        }

        console.error('Review creation error:', error);

        return res.status(500).json({
            message: 'An error occurred while submitting the review.'
        });
    }
};

module.exports = {
    createReview
};
