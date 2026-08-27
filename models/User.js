const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: [
      'school_admin', 'student', 'teacher', 'parent', 
      'accountant', 'librarian', 'receptionist', 'hr', 
      'transport_manager', 'hostel_manager'
    ]
  },
  phone: {
    type: String
  },
  avatar: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  refresh_token: {
    type: String
  },
  otp_code: {
    type: String
  },
  otp_expires_at: {
    type: Date
  },
  is_two_factor_enabled: {
    type: Boolean,
    default: false
  },
  two_factor_secret: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('User', userSchema);
