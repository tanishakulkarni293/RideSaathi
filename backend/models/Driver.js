// Driver Model - For drivers accepting and completing rides
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const driverSchema = new mongoose.Schema({
  // Personal Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  mobileNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Vehicle Information
  vehicleType: {
    type: String,
    enum: ['Auto', 'Car'],
    required: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  vehicleModel: {
    type: String,
    default: null
  },
  vehicleColor: {
    type: String,
    default: null
  },
  
  // Account Information
  userType: {
    type: String,
    default: 'driver'
  },
  profilePicture: {
    type: String,
    default: null
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 1,
    max: 5
  },
  totalRides: {
    type: Number,
    default: 0
  },
  
  // Driver Status
  isOnline: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  licenseNumber: {
    type: String,
    default: null
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
driverSchema.pre('save', async function(next) {
  // Only hash if password is new or modified
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
driverSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Driver', driverSchema);
