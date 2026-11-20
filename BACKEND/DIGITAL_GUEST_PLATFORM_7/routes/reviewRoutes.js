
const express = require('express');
const router = express.Router();

const { createReview } = require('../controllers/reviewController');
const authenticateUser = require('../middleware/authMiddleware');

// Submit a review
router.post('/', authenticateUser, createReview);

module.exports = router;
