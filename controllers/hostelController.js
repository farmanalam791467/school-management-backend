const db = require('../config/db');

// Get all hostels
exports.getHostels = async (req, res) => {
  try {
    const [hostels] = await db.query('SELECT * FROM hostels ORDER BY id DESC');
    
    // Fetch rooms for each hostel
    const hostelsWithRooms = await Promise.all(
      hostels.map(async (hostel) => {
        const [rooms] = await db.query('SELECT * FROM hostel_rooms WHERE hostel_id = ? ORDER BY room_no ASC', [hostel.id]);
        return { ...hostel, rooms };
      })
    );

    res.json({ hostels: hostelsWithRooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching hostels' });
  }
};

// Create hostel
exports.createHostel = async (req, res) => {
  const { name, type, address, description } = req.body;
  if (!name || !type) {
    return res.status(400).json({ message: 'Hostel name and type are required' });
  }

  try {
    await db.query(
      'INSERT INTO hostels (name, type, address, description) VALUES (?, ?, ?, ?)',
      [name, type, address || '', description || '']
    );
    res.status(201).json({ message: 'Hostel created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating hostel' });
  }
};

// Create room
exports.createRoom = async (req, res) => {
  const { hostel_id, room_no, room_type, capacity, cost_per_bed } = req.body;
  if (!hostel_id || !room_no || !room_type || !capacity || !cost_per_bed) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    await db.query(
      `INSERT INTO hostel_rooms (hostel_id, room_no, room_type, capacity, no_of_beds, cost_per_bed) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hostel_id, room_no, room_type, capacity, capacity, cost_per_bed]
    );
    res.status(201).json({ message: 'Hostel room created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating room: ' + err.message });
  }
};

// Allocate room/bed to student
exports.allocateBed = async (req, res) => {
  const { student_id, room_id, bed_no } = req.body;
  if (!student_id || !room_id || !bed_no) {
    return res.status(400).json({ message: 'Student, room, and bed number are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check room capacity
    const [rooms] = await conn.query('SELECT capacity, (SELECT COUNT(*) FROM student_hostel WHERE room_id = ? AND status = "Allocated") as allocated FROM hostel_rooms WHERE id = ?', [room_id, room_id]);
    if (rooms.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const room = rooms[0];
    if (room.allocated >= room.capacity) {
      return res.status(400).json({ message: 'No vacant beds in this room' });
    }

    // 2. Allocate
    const joinDate = new Date().toISOString().slice(0, 10);
    await conn.query(
      `INSERT INTO student_hostel (student_id, room_id, bed_no, join_date, status) 
       VALUES (?, ?, ?, ?, 'Allocated')
       ON DUPLICATE KEY UPDATE room_id = VALUES(room_id), bed_no = VALUES(bed_no), status = 'Allocated'`,
      [student_id, room_id, bed_no, joinDate]
    );

    await conn.commit();
    res.json({ message: 'Bed allocated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error allocating bed: ' + err.message });
  } finally {
    conn.release();
  }
};

// Vacate room/bed
exports.vacateBed = async (req, res) => {
  const { studentId } = req.params;
  try {
    await db.query('UPDATE student_hostel SET status = "Vacated" WHERE student_id = ?', [studentId]);
    res.json({ message: 'Student vacated from hostel successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error vacating student' });
  }
};
