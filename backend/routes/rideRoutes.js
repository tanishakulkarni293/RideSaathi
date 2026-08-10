// Ride Routes - Ride booking, acceptance, and management
const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');

// Ride Booking Routes
router.post('/request', rideController.requestRide);
router.get('/available', rideController.getAvailableRides);
router.post('/accept', rideController.acceptRide);
router.post('/start', rideController.startRide);
router.post('/complete', rideController.completeRide);
router.post('/cancel', rideController.cancelRide);

// Ride Sharing Routes
router.post('/share/respond', rideController.respondToShareRequest);
router.get('/share/status', rideController.getShareStatus);

// Ride Status and History Routes
router.get('/status', rideController.getRideStatus);
router.get('/user', rideController.getUserRides);
router.get('/driver', rideController.getDriverRides);

module.exports = router;
