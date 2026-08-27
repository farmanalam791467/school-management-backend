const mongoose = require('mongoose');

const pickupPointSchema = new mongoose.Schema({
  point_name: { type: String, required: true },
  pickup_time: { type: String, required: true },
  monthly_fee: { type: Number, required: true }
});

const transportRouteSchema = new mongoose.Schema({
  route_name: {
    type: String,
    required: true
  },
  start_point: {
    type: String,
    required: true
  },
  end_point: {
    type: String,
    required: true
  },
  fare: {
    type: Number,
    required: true
  },
  pickup_points: [pickupPointSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('TransportRoute', transportRouteSchema);
