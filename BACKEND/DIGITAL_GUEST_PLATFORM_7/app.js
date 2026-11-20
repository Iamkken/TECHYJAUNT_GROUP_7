const express = require('express');
const authRoutes = require('./routes/authRoutes');
const authenticateUser = require('./middleware/authMiddleware');
const hotelRoutes = require('./routes/hotelRoutes');
const roomRoutes = require('./routes/roomRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

const app = express();

app.use(express.json());



app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);




const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


app.get('/api/protected', authenticateUser, (req, res) => {
    res.json({
        message: 'Access granted',
        user: req.user
    });
});