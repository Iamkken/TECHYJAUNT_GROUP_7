# TECHYJAUNT_GROUP_7

KARAMO HOTEL – Backend API Guide

1. Project Overview

KARAMO HOTEL is a hotel booking platform built with Node.js, Express.js and PostgreSQL.

The backend provides APIs for guest authentication, hotel and room browsing, availability search, booking management, payment processing and guest reviews.

Base URL: http://localhost:5000

CORS configuration is restricted to:
http://localhost:5173


2. Technology Stack

Node.js

Express.js

PostgreSQL

JWT Authentication

Paystack (Test Mode)

Nodemailer (Email OTP)

Joi (Request Validation)

3. Hotel Information

Hotel: KARAMO HOTEL
Location: Lagos, Nigeria

Room Type

Price/Night

Capacity

Standard

₦50,000

2

Deluxe

₦100,000

4

Executive Suite

₦400,000

10

4. API Endpoints

All endpoints use JSON (Content-Type: application/json).

Method

Endpoint

Required Fields / Parameters

Description

POST

/api/auth/register

full_name, email, phone_number, password

Register guest

POST

/api/auth/verify-email

email, otp

Verify email

POST

/api/auth/resend-otp

email

Resend verification OTP

POST

/api/auth/login

email, password

Guest login

GET

/api/hotels

None

Retrieve hotels

GET

/api/rooms

None

Retrieve rooms

GET

/api/availability

check_in, check_out, guest_count (query parameters)

Search available rooms

POST

/api/bookings

room_id, check_in, check_out, guest_count

Create booking

GET

/api/bookings/my-bookings

None

Retrieve guest bookings

POST

/api/payments/initialize

booking_id

Initialize Paystack payment

POST

/api/payments/verify

reference

Verify payment

POST

/api/reviews

booking_id, rating, comment (optional)

Submit guest review

5. Authentication

Protected endpoints require a JWT Bearer Token obtained from the login response.

Include this header:

Authorization: Bearer YOUR_JWT_TOKEN

Authentication is required for:

Create Booking

Get My Bookings

Initialize Payment

Verify Payment

Submit Review

6. Important Business Logic

Guests must verify their email before logging in.

Room availability is checked before booking.

Booking prices are calculated by the backend.

New bookings have a 15-minute temporary reservation hold.

Payment is processed through Paystack Test Mode.

Bookings are confirmed only after successful payment verification.

Guests can retrieve only their own bookings.

Reviews are allowed only for paid, confirmed bookings whose checkout dates have passed.

Each booking can receive only one review.

7. Booking Workflow

Register and verify email.

Login and obtain JWT.

Browse hotels and rooms.

Search room availability.

Create booking.

Initialize payment.

Complete Paystack payment.

Verify payment.

Retrieve booking details.

Submit review after checkout.

8. Integration Notes

Use YYYY-MM-DD for booking dates.

Always attach the JWT to protected requests.

Use the payment authorization URL returned by the backend.

Always verify payment through the backend; do not rely solely on the Paystack redirect.

The backend is currently running in local development with Paystack Test Mode.