const mongoose = require('mongoose');

const studentTransportSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    unique: true
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransportRoute',
    required: true
  },
  pickup_point_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  start_date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('StudentTransport', studentTransportSchema);
