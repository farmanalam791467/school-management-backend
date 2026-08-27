const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  father_name: {
    type: String
  },
  father_phone: {
    type: String
  },
  mother_name: {
    type: String
  },
  mother_phone: {
    type: String
  },
  address: {
    type: String
  },
  profession: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Parent', parentSchema);
