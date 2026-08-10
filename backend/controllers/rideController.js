// Ride Controller - Handles ride booking, acceptance, and completion
const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const User = require('../models/User');

// Generate unique ride ID
const generateRideId = () => {
  return 'RIDE' + Date.now() + Math.floor(Math.random() * 1000);
};

// PRICE CALCULATION HELPER
const calculatePrice = (distance, estimatedTime) => {
  const baseFare = 50;        // ₹50
  const perKmRate = 12;       // ₹12 per km
  const perMinuteRate = 2;    // ₹2 per minute
  return Math.round(baseFare + (distance * perKmRate) + (estimatedTime * perMinuteRate));
};

// FETCH ROUTE FROM OSRM API
const fetchRouteFromOSRM = async (pickupLat, pickupLon, destLat, destLon) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true&annotations=distance,duration`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distance = (route.distance / 1000).toFixed(2);
      const duration = Math.round(route.duration / 60);

      const routeCoordinates = route.geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0]
      }));

      const directions = [];
      if (route.legs && route.legs.length > 0) {
        route.legs.forEach(leg => {
          if (leg.steps && leg.steps.length > 0) {
            leg.steps.forEach(step => {
              directions.push({
                instruction: step.maneuver ? step.maneuver.instruction : 'Continue',
                distance: step.distance,
                duration: step.duration
              });
            });
          }
        });
      }

      return { distance: parseFloat(distance), duration, routeCoordinates, directions };
    }
    return null;
  } catch (error) {
    console.error('OSRM route fetch error:', error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────
// REQUEST A RIDE (User)
// ─────────────────────────────────────────────────────────────────────
exports.requestRide = async (req, res) => {
  try {
    const { userId, pickupLocation, destinationLocation, vehicleType } = req.body;

    if (!userId || !pickupLocation || !destinationLocation || !vehicleType) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    if (!pickupLocation.latitude || !pickupLocation.longitude ||
        !destinationLocation.latitude || !destinationLocation.longitude) {
      return res.status(400).json({ message: 'Please provide valid coordinates for both locations' });
    }
    if (!['Auto', 'Car'].includes(vehicleType)) {
      return res.status(400).json({ message: 'Vehicle type must be Auto or Car' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const routeData = await fetchRouteFromOSRM(
      pickupLocation.latitude, pickupLocation.longitude,
      destinationLocation.latitude, destinationLocation.longitude
    );
    if (!routeData) return res.status(400).json({ message: 'Could not calculate route. Please try again.' });

    const fare = calculatePrice(routeData.distance, routeData.duration);

    // ── CHECK FOR SHAREABLE RIDES ────────────────────────────────────
    // Look for another pending ride going to the same destination
    // that is NOT already fully shared and has not been rejected
    const destAddr = destinationLocation.address.trim().toLowerCase();
    const matchingRide = await Ride.findOne({
      status: 'pending',
      isShared: false,
      sharePending: false,
      shareAcceptedByUser1: { $ne: false },   // not already rejected
      userId: { $ne: userId },                 // different user
      $expr: {
        $eq: [
          { $toLower: { $trim: { input: '$destinationLocation.address' } } },
          destAddr
        ]
      }
    }).populate('userId', 'name mobileNumber email');

    const ride = new Ride({
      rideId: generateRideId(),
      userId,
      pickupLocation: {
        address: pickupLocation.address,
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude
      },
      destinationLocation: {
        address: destinationLocation.address,
        latitude: destinationLocation.latitude,
        longitude: destinationLocation.longitude
      },
      vehicleType,
      status: 'pending',
      distance: routeData.distance,
      estimatedTime: routeData.duration,
      fare,
      originalFare: fare,
      routeCoordinates: routeData.routeCoordinates,
      directions: routeData.directions
    });

    await ride.save();

    // If a matching ride exists, notify both users about the share option
    let shareOption = null;
    if (matchingRide) {
      const sharedFare = Math.ceil(fare / 2);

      // Mark matchingRide as share-pending and attach the new rider's details
      matchingRide.sharePending = true;
      matchingRide.sharedWithUserId = userId;
      matchingRide.sharedPassengerPickup = {
        address:   pickupLocation.address,
        latitude:  pickupLocation.latitude,
        longitude: pickupLocation.longitude
      };
      matchingRide.sharedFarePerPassenger = Math.ceil(matchingRide.originalFare / 2);
      await matchingRide.save();

      shareOption = {
        matchingRideId:   matchingRide.rideId,
        user1Name:        matchingRide.userId.name,
        sharedFare:       sharedFare,
        originalFare:     fare,
        destinationMatch: destinationLocation.address
      };
    }

    res.status(201).json({
      message: 'Ride requested successfully',
      ride: {
        rideId:              ride.rideId,
        pickupLocation:      ride.pickupLocation,
        destinationLocation: ride.destinationLocation,
        vehicleType:         ride.vehicleType,
        status:              ride.status,
        distance:            ride.distance,
        estimatedTime:       ride.estimatedTime,
        fare:                ride.fare,
        directions:          ride.directions
      },
      shareOption   // null if no match found
    });
  } catch (error) {
    console.error('Ride request error:', error);
    res.status(500).json({ message: 'Error requesting ride', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// RESPOND TO SHARE REQUEST – called by User1 (the original rider)
// Body: { rideId, accept: true|false }
// ─────────────────────────────────────────────────────────────────────
exports.respondToShareRequest = async (req, res) => {
  try {
    const { rideId, accept } = req.body;
    if (!rideId || accept === undefined) {
      return res.status(400).json({ message: 'Please provide rideId and accept (true/false)' });
    }

    const ride = await Ride.findOne({ rideId })
      .populate('userId', 'name mobileNumber email')
      .populate('sharedWithUserId', 'name mobileNumber email');

    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (!ride.sharePending) return res.status(400).json({ message: 'No pending share request for this ride' });

    if (accept) {
      const splitFare = Math.ceil(ride.originalFare / 2);
      ride.isShared              = true;
      ride.sharePending          = false;
      ride.shareAcceptedByUser1  = true;
      ride.sharedFarePerPassenger = splitFare;
      ride.fare                  = splitFare;   // User1 now pays half too
      await ride.save();

      // Update User2's ride to reflect the share
      const user2Ride = await Ride.findOne({
        userId: ride.sharedWithUserId,
        status: 'pending'
      });
      if (user2Ride) {
        user2Ride.isShared              = true;
        user2Ride.sharedWithUserId      = ride.userId;
        user2Ride.sharedFarePerPassenger = splitFare;
        user2Ride.fare                  = splitFare;
        user2Ride.shareAcceptedByUser1  = true;
        user2Ride.sharePending          = false;
        await user2Ride.save();
      }

      return res.status(200).json({
        message: 'Share accepted! Fare has been split.',
        splitFare,
        ride: {
          rideId:              ride.rideId,
          fare:                ride.fare,
          isShared:            ride.isShared,
          sharedWithUser:      ride.sharedWithUserId,
          sharedPassengerPickup: ride.sharedPassengerPickup
        }
      });
    } else {
      // Rejected
      ride.sharePending         = false;
      ride.shareAcceptedByUser1 = false;
      ride.sharedWithUserId     = null;
      ride.sharedPassengerPickup = { address: null, latitude: null, longitude: null };
      ride.sharedFarePerPassenger = 0;
      await ride.save();

      return res.status(200).json({
        message: 'Share request declined. Ride continues as solo.',
        ride: {
          rideId: ride.rideId,
          fare:   ride.originalFare
        }
      });
    }
  } catch (error) {
    console.error('Share response error:', error);
    res.status(500).json({ message: 'Error responding to share request', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// CHECK SHARE STATUS – polled by User2 to know if User1 responded
// Query: ?rideId=<user2RideId>
// ─────────────────────────────────────────────────────────────────────
exports.getShareStatus = async (req, res) => {
  try {
    const { rideId } = req.query;
    if (!rideId) return res.status(400).json({ message: 'Please provide rideId' });

    const ride = await Ride.findOne({ rideId });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    return res.status(200).json({
      isShared:             ride.isShared,
      shareAcceptedByUser1: ride.shareAcceptedByUser1,
      fare:                 ride.fare,
      sharedFarePerPassenger: ride.sharedFarePerPassenger
    });
  } catch (error) {
    console.error('Share status error:', error);
    res.status(500).json({ message: 'Error fetching share status', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET AVAILABLE RIDES (Driver)
// ─────────────────────────────────────────────────────────────────────
exports.getAvailableRides = async (req, res) => {
  try {
    const { vehicleType } = req.query;
    let query = { status: 'pending' };
    if (vehicleType) query.vehicleType = vehicleType;

    const rides = await Ride.find(query)
      .populate('userId', 'name mobileNumber email')
      .populate('sharedWithUserId', 'name mobileNumber email')
      .sort({ requestedAt: -1 });

    res.status(200).json({ message: 'Available rides retrieved', rides });
  } catch (error) {
    console.error('Get rides error:', error);
    res.status(500).json({ message: 'Error retrieving rides', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// ACCEPT RIDE (Driver)
// ─────────────────────────────────────────────────────────────────────
exports.acceptRide = async (req, res) => {
  try {
    const { rideId, driverId } = req.body;
    if (!rideId || !driverId) return res.status(400).json({ message: 'Please provide rideId and driverId' });

    const ride = await Ride.findOne({ rideId })
      .populate('userId', 'name mobileNumber email')
      .populate('sharedWithUserId', 'name mobileNumber email');
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.status !== 'pending') return res.status(400).json({ message: 'Ride is no longer available' });

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    ride.driverId   = driverId;
    ride.status     = 'accepted';
    ride.acceptedAt = new Date();
    await ride.save();

    driver.isAvailable = false;
    await driver.save();

    const updatedRide = await Ride.findOne({ rideId })
      .populate('driverId', 'name mobileNumber vehicleType vehicleNumber rating')
      .populate('userId', 'name mobileNumber email')
      .populate('sharedWithUserId', 'name mobileNumber email');

    res.status(200).json({ message: 'Ride accepted successfully', ride: updatedRide });
  } catch (error) {
    console.error('Accept ride error:', error);
    res.status(500).json({ message: 'Error accepting ride', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// START RIDE (Driver)
// ─────────────────────────────────────────────────────────────────────
exports.startRide = async (req, res) => {
  try {
    const { rideId } = req.body;
    if (!rideId) return res.status(400).json({ message: 'Please provide rideId' });

    const ride = await Ride.findOne({ rideId });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.status !== 'accepted') return res.status(400).json({ message: 'Ride status must be accepted to start' });

    ride.status    = 'started';
    ride.startedAt = new Date();
    await ride.save();

    res.status(200).json({ message: 'Ride started successfully', ride: { rideId: ride.rideId, status: ride.status } });
  } catch (error) {
    console.error('Start ride error:', error);
    res.status(500).json({ message: 'Error starting ride', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// COMPLETE RIDE (Driver)
// ─────────────────────────────────────────────────────────────────────
exports.completeRide = async (req, res) => {
  try {
    const { rideId, fare, distance, actualTime } = req.body;
    if (!rideId) return res.status(400).json({ message: 'Please provide rideId' });

    const ride = await Ride.findOne({ rideId });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.status !== 'accepted' && ride.status !== 'started') {
      return res.status(400).json({ message: 'Ride status must be accepted or started to complete' });
    }

    let calculatedActualTime = actualTime;
    if (!calculatedActualTime) {
      const startTime = ride.startedAt || ride.acceptedAt;
      calculatedActualTime = startTime
        ? Math.round((new Date() - startTime) / 60000)
        : ride.estimatedTime;
    }

    let finalFare = fare;
    if (!finalFare) {
      const rideDistance = distance || ride.distance;
      finalFare = Math.round(50 + (rideDistance * 12) + (calculatedActualTime * 2));
      if (ride.isShared) finalFare = Math.ceil(finalFare / 2);
    }

    ride.status      = 'completed';
    ride.completedAt = new Date();
    ride.fare        = finalFare;
    if (distance) ride.distance = distance;
    ride.actualTime  = calculatedActualTime;
    await ride.save();

    const driver = await Driver.findById(ride.driverId);
    if (driver) { driver.isAvailable = true; driver.totalRides += 1; await driver.save(); }

    const user = await User.findById(ride.userId);
    if (user) { user.totalRides += 1; await user.save(); }

    res.status(200).json({
      message: 'Ride completed successfully',
      ride: {
        rideId: ride.rideId, status: ride.status, fare: finalFare,
        distance: ride.distance, actualTime: calculatedActualTime, completedAt: ride.completedAt,
        isShared: ride.isShared
      }
    });
  } catch (error) {
    console.error('Complete ride error:', error);
    res.status(500).json({ message: 'Error completing ride', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// CANCEL RIDE
// ─────────────────────────────────────────────────────────────────────
exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.body;
    if (!rideId) return res.status(400).json({ message: 'Please provide rideId' });

    const ride = await Ride.findOne({ rideId });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.status === 'completed' || ride.status === 'cancelled') {
      return res.status(400).json({ message: 'This ride cannot be cancelled' });
    }

    ride.status      = 'cancelled';
    ride.cancelledAt = new Date();
    await ride.save();

    if (ride.driverId) {
      const driver = await Driver.findById(ride.driverId);
      if (driver) { driver.isAvailable = true; await driver.save(); }
    }

    res.status(200).json({ message: 'Ride cancelled successfully', ride: { rideId: ride.rideId, status: ride.status } });
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ message: 'Error cancelling ride', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET RIDE STATUS
// ─────────────────────────────────────────────────────────────────────
exports.getRideStatus = async (req, res) => {
  try {
    const { rideId } = req.query;
    if (!rideId) return res.status(400).json({ message: 'Please provide rideId' });

    const ride = await Ride.findOne({ rideId })
      .populate('userId', 'name mobileNumber')
      .populate('driverId', 'name mobileNumber vehicleType')
      .populate('sharedWithUserId', 'name mobileNumber');

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    res.status(200).json({ message: 'Ride status retrieved', ride });
  } catch (error) {
    console.error('Get ride status error:', error);
    res.status(500).json({ message: 'Error retrieving ride status', error: error.message });
  }
};

// GET USER RIDES
exports.getUserRides = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'Please provide userId' });

    const rides = await Ride.find({ userId })
      .populate('driverId', 'name mobileNumber vehicleType vehicleNumber rating')
      .populate('sharedWithUserId', 'name mobileNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ message: 'User rides retrieved', rides });
  } catch (error) {
    console.error('Get user rides error:', error);
    res.status(500).json({ message: 'Error retrieving user rides', error: error.message });
  }
};

// GET DRIVER RIDES
exports.getDriverRides = async (req, res) => {
  try {
    const { driverId } = req.query;
    if (!driverId) return res.status(400).json({ message: 'Please provide driverId' });

    const rides = await Ride.find({ driverId })
      .populate('userId', 'name mobileNumber')
      .populate('sharedWithUserId', 'name mobileNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ message: 'Driver rides retrieved', rides });
  } catch (error) {
    console.error('Get driver rides error:', error);
    res.status(500).json({ message: 'Error retrieving driver rides', error: error.message });
  }
};
