// Ride Model - For tracking ride bookings and completions
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  // Ride Information
  rideId: {
    type: String,
    unique: true,
    required: true
  },
  
  // User and Driver References
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  
  // Location Information
  pickupLocation: {
    address: { type: String, required: true },
    latitude: Number,
    longitude: Number
  },
  destinationLocation: {
    address: { type: String, required: true },
    latitude: Number,
    longitude: Number
  },
  
  // Vehicle Selection
  vehicleType: {
    type: String,
    enum: ['Auto', 'Car'],
    required: true
  },
  
  // Ride Status
  status: {
    type: String,
    enum: ['pending', 'searching', 'accepted', 'started', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // Ride Details
  fare: {
    type: Number,
    default: 0
  },
  originalFare: {
    type: Number,
    default: 0   // Full fare before any sharing split
  },
  distance: {
    type: Number, // in kilometers
    default: 0
  },
  estimatedTime: {
    type: Number, // in minutes
    default: 0
  },
  actualTime: {
    type: Number, // in minutes
    default: 0
  },
  
  // ── RIDE SHARING ──────────────────────────────────────────
  isShared: {
    type: Boolean,
    default: false    // true once a second passenger joins and User1 accepts
  },
  sharedWithUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sharedPassengerPickup: {
    address:   { type: String, default: null },
    latitude:  { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  sharedFarePerPassenger: {
    type: Number,
    default: 0
  },
  shareAcceptedByUser1: {
    type: Boolean,
    default: null   // null = awaiting decision, true = accepted, false = rejected
  },
  sharePending: {
    type: Boolean,
    default: false  // true while waiting for User1 to decide
  },
  // ──────────────────────────────────────────────────────────
  
  // Route Information
  routeCoordinates: [{
    latitude: Number,
    longitude: Number
  }],
  directions: [{
    instruction: String,
    distance: Number,
    duration: Number
  }],
  
  // Ride History
  requestedAt:  { type: Date, default: Date.now },
  acceptedAt:   { type: Date, default: null },
  startedAt:    { type: Date, default: null },
  completedAt:  { type: Date, default: null },
  cancelledAt:  { type: Date, default: null },
  
  // Ratings and Reviews
  userRating:   { type: Number, min: 1, max: 5, default: null },
  driverRating: { type: Number, min: 1, max: 5, default: null },
  userReview:   String,
  driverReview: String,
  
  // Payment Information
  paymentMethod:  { type: String, enum: ['cash', 'card', 'wallet'], default: 'cash' },
  paymentStatus:  { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ride', rideSchema);
