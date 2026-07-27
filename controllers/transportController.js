const db = require('../config/db');

// Get all routes
exports.getRoutes = async (req, res) => {
  try {
    const [routes] = await db.query('SELECT * FROM transport_routes ORDER BY id DESC');
    
    // For each route, fetch its pickup points
    const routesWithPoints = await Promise.all(
      routes.map(async (route) => {
        const [points] = await db.query('SELECT * FROM transport_pickup_points WHERE route_id = ? ORDER BY pickup_time ASC', [route.id]);
        return { ...route, pickupPoints: points };
      })
    );

    res.json({ routes: routesWithPoints });
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
    await db.query(
      'INSERT INTO transport_routes (route_name, start_point, end_point, fare) VALUES (?, ?, ?, ?)',
      [route_name, start_point, end_point, fare]
    );
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
    await db.query(
      'INSERT INTO transport_pickup_points (route_id, point_name, pickup_time, monthly_fee) VALUES (?, ?, ?, ?)',
      [route_id, point_name, pickup_time, monthly_fee]
    );
    res.status(201).json({ message: 'Pickup point added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error adding pickup point' });
  }
};

// Get all vehicles
exports.getVehicles = async (req, res) => {
  try {
    const [vehicles] = await db.query('SELECT * FROM transport_vehicles ORDER BY id DESC');
    res.json({ vehicles });
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
    await db.query(
      `INSERT INTO transport_vehicles (vehicle_no, model, capacity, driver_name, driver_phone, driver_license) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [vehicle_no, model, capacity, driver_name, driver_phone, driver_license]
    );
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
    const startDate = new Date().toISOString().slice(0, 10);
    await db.query(
      `INSERT INTO student_transport (student_id, route_id, pickup_point_id, start_date) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE route_id = VALUES(route_id), pickup_point_id = VALUES(pickup_point_id)`,
      [student_id, route_id, pickup_point_id, startDate]
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
    await db.query('DELETE FROM student_transport WHERE student_id = ?', [studentId]);
    res.json({ message: 'Student removed from transport successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error removing student from transport' });
  }
};
