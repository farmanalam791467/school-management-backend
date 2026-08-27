const mongoose = require('mongoose');

const transportVehicleSchema = new mongoose.Schema({
  vehicle_no: {
    type: String,
    required: true,
    unique: true
  },
  model: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  driver_name: {
    type: String,
    required: true
  },
  driver_phone: {
    type: String,
    required: true
  },
  driver_license: {
    type: String,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('TransportVehicle', transportVehicleSchema);
