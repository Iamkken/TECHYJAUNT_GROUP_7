const express = require('express');
const router = express.Router();

const {
    initializePayment,
    verifyPayment
} = require('../controllers/paymentController');

const authenticateUser = require('../middleware/authMiddleware');

// Initialize payment
router.post('/initialize', authenticateUser, initializePayment);

// Verify payment
router.post('/verify', authenticateUser, verifyPayment);

module.exports = router;