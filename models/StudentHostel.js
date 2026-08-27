const mongoose = require('mongoose');

const studentHostelSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    unique: true
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true
  },
  room_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  bed_no: {
    type: Number
  },
  allocate_date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('StudentHostel', studentHostelSchema);
