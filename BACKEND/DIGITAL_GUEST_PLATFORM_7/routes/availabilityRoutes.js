const express = require('express');
const router = express.Router();

const { checkRoomAvailability } = require('../controllers/availabilityController');

router.get('/', checkRoomAvailability);

module.exports = router;