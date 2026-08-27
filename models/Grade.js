const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  point: {
    type: Number,
    required: true
  },
  mark_from: {
    type: Number,
    required: true
  },
  mark_upto: {
    type: Number,
    required: true
  },
  comment: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Grade', gradeSchema);
