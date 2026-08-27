const mongoose = require('mongoose');

const hostelRoomSchema = new mongoose.Schema({
  room_no: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Single', 'Double', 'Triple', 'Dormitory'], 
    default: 'Double' 
  },
  no_of_beds: { type: Number, required: true },
  cost_per_bed: { type: Number, required: true },
  status: { type: String, enum: ['available', 'full'], default: 'available' }
});

const hostelSchema = new mongoose.Schema({
  hostel_name: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['Boys', 'Girls', 'Mixed'],
    required: true
  },
  address: {
    type: String
  },
  description: {
    type: String
  },
  rooms: [hostelRoomSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Hostel', hostelSchema);
