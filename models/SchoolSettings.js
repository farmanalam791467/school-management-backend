const mongoose = require('mongoose');

const schoolSettingsSchema = new mongoose.Schema({
  school_name: {
    type: String,
    required: true,
    default: "Secondary School of Modern Education"
  },
  email: {
    type: String
  },
  phone: {
    type: String
  },
  address: {
    type: String
  },
  logo: {
    type: String
  },
  academic_year_start: {
    type: String
  },
  academic_year_end: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('SchoolSettings', schoolSettingsSchema);
