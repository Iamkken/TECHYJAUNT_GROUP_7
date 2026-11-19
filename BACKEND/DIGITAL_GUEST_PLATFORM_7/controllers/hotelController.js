const pool = require('../config/db');

const getAllHotels = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM hotels ORDER BY id ASC'
        );

        res.status(200).json({
            message: 'Hotels retrieved successfully',
            hotels: result.rows
        });

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Internal server error'
        });
    }
};

module.exports = { getAllHotels };