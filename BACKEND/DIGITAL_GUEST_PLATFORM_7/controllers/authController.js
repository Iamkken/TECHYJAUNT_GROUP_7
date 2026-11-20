const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../config/email');


const registerUser = async (req, res) => {
    try {
        const { full_name, email, phone_number, password } = req.body;

        if (!full_name || !email || !phone_number || !password) {
            return res.status(400).json({
                message: 'All fields are required'
            });
        }

        // Generate a 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();

        // Hash the OTP before storing it
        const otpHash = crypto.createHash('sha256')
            .update(otp)
            .digest('hex');

        // Hash the user's password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user and save the OTP hash
        const result = await pool.query(
            `INSERT INTO users (
                full_name,
                email,
                phone_number,
                password,
                email_verification_otp_hash,
                email_verification_expires_at
            )
            VALUES (
                $1, $2, $3, $4, $5,
                CURRENT_TIMESTAMP + INTERVAL '10 minutes'
            )
            RETURNING id, full_name, email, phone_number`,
            [full_name, email, phone_number, hashedPassword, otpHash]
        );

        // Send the OTP to the user's email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'KARAMO HOTEL - Email Verification',
            text: `Your email verification OTP is ${otp}. It expires in 10 minutes.`
        });

        return res.status(201).json({
            message: 'Registration successful. Please check your email for the verification OTP.',
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error.message);

        if (error.code === '23505') {
            return res.status(409).json({
                message: 'Email or phone number already registered'
            });
        }

        return res.status(500).json({
            message: 'Registration failed. Please try again.'
        });
    }
};




const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                message: 'A valid email and 6-digit OTP are required'
            });
        }

        const result = await pool.query(
            `SELECT id, email_verified,
                    email_verification_otp_hash,
                    email_verification_attempts,
                    email_verification_expires_at > CURRENT_TIMESTAMP AS otp_not_expired
             FROM users
             WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const user = result.rows[0];

        if (user.email_verified) {
            return res.status(400).json({
                message: 'Email is already verified'
            });
        }

        if (user.email_verification_attempts >= 5) {
            return res.status(429).json({
                message: 'Too many attempts. Request a new OTP.'
            });
        }

        if (!user.otp_not_expired || !user.email_verification_otp_hash) {
            return res.status(400).json({
                message: 'OTP has expired. Request a new one.'
            });
        }

        const otpHash = crypto.createHash('sha256')
            .update(otp)
            .digest('hex');

        const isValid = crypto.timingSafeEqual(
            Buffer.from(otpHash, 'hex'),
            Buffer.from(user.email_verification_otp_hash, 'hex')
        );

        if (!isValid) {
            await pool.query(
                `UPDATE users
                 SET email_verification_attempts = email_verification_attempts + 1
                 WHERE id = $1`,
                [user.id]
            );

            return res.status(400).json({
                message: 'Incorrect OTP'
            });
        }

        await pool.query(
            `UPDATE users
             SET email_verified = TRUE,
                 email_verification_otp_hash = NULL,
                 email_verification_expires_at = NULL,
                 email_verification_attempts = 0
             WHERE id = $1`,
            [user.id]
        );

        return res.status(200).json({
            message: 'Email verified successfully'
        });

    } catch (error) {
        console.error(error.message);

        return res.status(500).json({
            message: 'Email verification failed'
        });
    }
};



const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'Email is required'
            });
        }

        // Generate a new 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();

        // Hash the OTP
        const otpHash = crypto.createHash('sha256')
            .update(otp)
            .digest('hex');

        // Update the OTP if the user is unverified
        // and the 60-second cooldown has passed
        const result = await pool.query(
            `UPDATE users
             SET email_verification_otp_hash = $1,
                 email_verification_expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes',
                 email_verification_otp_sent_at = CURRENT_TIMESTAMP,
                 email_verification_attempts = 0
             WHERE email = $2
             AND email_verified = FALSE
             AND (
                 email_verification_otp_sent_at IS NULL
                 OR email_verification_otp_sent_at <= CURRENT_TIMESTAMP - INTERVAL '60 seconds'
             )
             RETURNING id`,
            [otpHash, email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                message: 'Email not found, already verified, or OTP resend cooldown is active.'
            });
        }

        // Send the new OTP
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'KARAMO HOTEL - New Verification OTP',
            text: `Your new email verification OTP is ${otp}. It expires in 10 minutes.`
        });

        return res.status(200).json({
            message: 'A new verification OTP has been sent to your email.'
        });

    } catch (error) {
        console.error(error.message);

        return res.status(500).json({
            message: 'Unable to resend OTP. Please try again.'
        });
    }
};



const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        // 1. Find user by email
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        // 2. Compare supplied password with stored hash
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        // 3. Check email verification status
        if (!user.email_verified) {
            return res.status(403).json({
                message: 'Please verify your email before logging in.'
            });
        }

        // 4. Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // 5. Return successful login response
        return res.status(200).json({
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone_number: user.phone_number
            }
        });

    } catch (error) {
        console.error(error.message);

        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};



module.exports = {
    registerUser,
    verifyEmail,
    resendOTP,
    loginUser
};