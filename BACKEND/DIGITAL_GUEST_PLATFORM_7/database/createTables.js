const pool = require('../config/db');

const createUsersTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Users table created successfully!');
    } catch (error) {
        console.error('Error creating users table:', error.message);
    }
};



const createHotelsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS hotels (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                location VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Hotels table created successfully!');
    } catch (error) {
        console.error('Error creating hotels table:', error.message);
    }
};


const createRoomsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
                room_type VARCHAR(100) NOT NULL,
                price_per_night DECIMAL(10, 2) NOT NULL,
                capacity INTEGER NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Rooms table created successfully!');
    } catch (error) {
        console.error('Error creating rooms table:', error.message);
    }
};

createUsersTable();
createHotelsTable();
createRoomsTable();
