// Auth Routes - User and Driver registration and login
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// User Routes
router.post('/register/user', authController.registerUser);
router.post('/login/user', authController.loginUser);

// Driver Routes
router.post('/register/driver', authController.registerDriver);
router.post('/login/driver', authController.loginDriver);

module.exports = router;
