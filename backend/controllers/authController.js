// Auth Controller - Handles registration and login logic
const User = require('../models/User');
const Driver = require('../models/Driver');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// USER REGISTRATION
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, age, gender, mobileNumber } = req.body;

    // Validate required fields
    if (!name || !email || !password || !age || !gender || !mobileNumber) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      age,
      gender,
      mobileNumber
    });

    // Save user to database
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

// DRIVER REGISTRATION
exports.registerDriver = async (req, res) => {
  try {
    const { name, email, password, age, gender, mobileNumber, vehicleType, vehicleNumber } = req.body;

    // Validate required fields
    if (!name || !email || !password || !age || !gender || !mobileNumber || !vehicleType || !vehicleNumber) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Validate vehicle type
    if (!['Auto', 'Car'].includes(vehicleType)) {
      return res.status(400).json({ message: 'Vehicle type must be Auto or Car' });
    }

    // Check if driver already exists
    const existingDriver = await Driver.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ message: 'Driver with this email already exists' });
    }

    // Create new driver
    const driver = new Driver({
      name,
      email,
      password,
      age,
      gender,
      mobileNumber,
      vehicleType,
      vehicleNumber
    });

    // Save driver to database
    await driver.save();

    // Generate token
    const token = generateToken(driver._id);

    res.status(201).json({
      message: 'Driver registered successfully',
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        vehicleType: driver.vehicleType,
        userType: driver.userType
      }
    });
  } catch (error) {
    console.error('Driver registration error:', error);
    res.status(500).json({ message: 'Error registering driver', error: error.message });
  }
};

// USER LOGIN
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

// DRIVER LOGIN
exports.loginDriver = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find driver by email
    const driver = await Driver.findOne({ email });
    if (!driver) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await driver.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(driver._id);

    res.status(200).json({
      message: 'Login successful',
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        vehicleType: driver.vehicleType,
        userType: driver.userType
      }
    });
  } catch (error) {
    console.error('Driver login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};
