const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout, forgotPassword, resetPassword } = require('../controllers/authController');

// Register new user
router.post('/register', register);

// Login user
router.post('/login', login);

// Refresh access token
router.post('/refresh', refreshToken);

// Logout user
router.post('/logout', logout);

// Forgot password - request password reset
router.post('/forgot-password', forgotPassword);

// Reset password - validate token and update password
router.post('/reset-password', resetPassword);

module.exports = router;

