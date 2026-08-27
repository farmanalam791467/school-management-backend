const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  room_no: {
    type: String
  },
  capacity: {
    type: Number,
    default: 30
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Section', sectionSchema);
