const pool = require('../config/db');

const getAllRooms = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM rooms ORDER BY id ASC'
        );

        res.status(200).json({
            message: 'Rooms retrieved successfully',
            rooms: result.rows
        });

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Internal server error'
        });
    }
};

module.exports = { getAllRooms };