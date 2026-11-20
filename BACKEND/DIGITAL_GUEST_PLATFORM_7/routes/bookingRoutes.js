const express = require('express');
const router = express.Router();

const { createBooking, getMyBookings } = require('../controllers/bookingController');
const authenticateUser = require('../middleware/authMiddleware');

router.post('/', authenticateUser, createBooking);
router.get('/my-bookings', authenticateUser, getMyBookings);

module.exports = router;