const Hostel = require('../models/Hostel');
const StudentHostel = require('../models/StudentHostel');

// Get all hostels
exports.getHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find().sort({ created_at: -1 });
    
    const formattedHostels = hostels.map(h => ({
      id: h._id.toString(),
      name: h.hostel_name,
      type: h.type,
      address: h.address || '',
      description: h.description || '',
      rooms: h.rooms.map(room => ({
        id: room._id.toString(),
        hostel_id: h._id.toString(),
        room_no: room.room_no,
        room_type: room.type,
        capacity: room.no_of_beds,
        no_of_beds: room.no_of_beds,
        cost_per_bed: room.cost_per_bed
      }))
    }));

    res.json({ hostels: formattedHostels });
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
    const newHostel = new Hostel({
      hostel_name: name,
      type,
      address: address || '',
      description: description || ''
    });
    await newHostel.save();
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
    const hostel = await Hostel.findById(hostel_id);
    if (!hostel) {
      return res.status(404).json({ message: 'Hostel not found' });
    }

    hostel.rooms.push({
      room_no,
      type: room_type,
      no_of_beds: parseInt(capacity, 10),
      cost_per_bed: parseFloat(cost_per_bed)
    });
    await hostel.save();

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

  try {
    // 1. Fetch room details
    const hostel = await Hostel.findOne({ 'rooms._id': room_id });
    if (!hostel) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const room = hostel.rooms.id(room_id);
    const allocatedCount = await StudentHostel.countDocuments({ room_id: room_id });

    if (allocatedCount >= room.no_of_beds) {
      return res.status(400).json({ message: 'No vacant beds in this room' });
    }

    // 2. Allocate
    await StudentHostel.findOneAndUpdate(
      { student: student_id },
      {
        student: student_id,
        hostel: hostel._id,
        room_id: room_id,
        bed_no: parseInt(bed_no, 10),
        allocate_date: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Bed allocated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error allocating bed: ' + err.message });
  }
};

// Vacate room/bed (we delete the allocation to vacate the bed)
exports.vacateBed = async (req, res) => {
  const { studentId } = req.params;
  try {
    await StudentHostel.findOneAndDelete({ student: studentId });
    res.json({ message: 'Student vacated from hostel successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error vacating student' });
  }
};
