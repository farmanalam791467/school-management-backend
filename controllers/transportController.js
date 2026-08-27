const TransportRoute = require('../models/TransportRoute');
const TransportVehicle = require('../models/TransportVehicle');
const StudentTransport = require('../models/StudentTransport');

// Get all routes
exports.getRoutes = async (req, res) => {
  try {
    const routes = await TransportRoute.find().sort({ created_at: -1 });
    
    const formattedRoutes = routes.map(route => ({
      id: route._id.toString(),
      route_name: route.route_name,
      start_point: route.start_point,
      end_point: route.end_point,
      fare: route.fare,
      pickupPoints: route.pickup_points.map(pt => ({
        id: pt._id.toString(),
        route_id: route._id.toString(),
        point_name: pt.point_name,
        pickup_time: pt.pickup_time,
        monthly_fee: pt.monthly_fee
      }))
    }));

    res.json({ routes: formattedRoutes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching routes' });
  }
};

// Create route
exports.createRoute = async (req, res) => {
  const { route_name, start_point, end_point, fare } = req.body;
  if (!route_name || !start_point || !end_point || !fare) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newRoute = new TransportRoute({
      route_name,
      start_point,
      end_point,
      fare: parseFloat(fare)
    });
    await newRoute.save();
    res.status(201).json({ message: 'Transport route created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating route' });
  }
};

// Create pickup point
exports.createPickupPoint = async (req, res) => {
  const { route_id, point_name, pickup_time, monthly_fee } = req.body;
  if (!route_id || !point_name || !pickup_time || !monthly_fee) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const route = await TransportRoute.findById(route_id);
    if (!route) {
      return res.status(404).json({ message: 'Transport route not found' });
    }

    route.pickup_points.push({
      point_name,
      pickup_time,
      monthly_fee: parseFloat(monthly_fee)
    });
    await route.save();

    res.status(201).json({ message: 'Pickup point added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error adding pickup point' });
  }
};

// Get all vehicles
exports.getVehicles = async (req, res) => {
  try {
    const vehicles = await TransportVehicle.find().sort({ created_at: -1 });
    const formattedVehicles = vehicles.map(v => ({
      id: v._id.toString(),
      vehicle_no: v.vehicle_no,
      model: v.model,
      capacity: v.capacity,
      driver_name: v.driver_name,
      driver_phone: v.driver_phone,
      driver_license: v.driver_license
    }));
    res.json({ vehicles: formattedVehicles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching vehicles' });
  }
};

// Create vehicle
exports.createVehicle = async (req, res) => {
  const { vehicle_no, model, capacity, driver_name, driver_phone, driver_license } = req.body;
  if (!vehicle_no || !model || !capacity || !driver_name || !driver_phone || !driver_license) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newVehicle = new TransportVehicle({
      vehicle_no,
      model,
      capacity: parseInt(capacity, 10),
      driver_name,
      driver_phone,
      driver_license
    });
    await newVehicle.save();
    res.status(201).json({ message: 'Vehicle added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error adding vehicle: ' + err.message });
  }
};

// Allocate transport to student
exports.allocateStudent = async (req, res) => {
  const { student_id, route_id, pickup_point_id } = req.body;
  if (!student_id || !route_id || !pickup_point_id) {
    return res.status(400).json({ message: 'Student, route, and pickup point are required' });
  }

  try {
    await StudentTransport.findOneAndUpdate(
      { student: student_id },
      {
        student: student_id,
        route: route_id,
        pickup_point_id,
        start_date: new Date()
      },
      { upsert: true, new: true }
    );
    res.json({ message: 'Student allocated to transport successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error allocating transport' });
  }
};

// Remove student from transport
exports.deallocateStudent = async (req, res) => {
  const { studentId } = req.params;
  try {
    await StudentTransport.findOneAndDelete({ student: studentId });
    res.json({ message: 'Student removed from transport successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error removing student from transport' });
  }
};
