const mongoose = require('mongoose');

const bookIssueSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  issue_date: {
    type: Date,
    required: true,
    default: Date.now
  },
  due_date: {
    type: Date,
    required: true
  },
  return_date: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Issued', 'Returned', 'Overdue'],
    default: 'Issued'
  },
  fine_amount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const libraryBookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  isbn: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  publisher: {
    type: String
  },
  subject: {
    type: String
  },
  quantity: {
    type: Number,
    default: 1
  },
  rack_number: {
    type: String
  },
  price: {
    type: Number,
    default: 0
  },
  barcode: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['Available', 'Out of Stock', 'Lost', 'Damaged'],
    default: 'Available'
  },
  issues: [bookIssueSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('LibraryBook', libraryBookSchema);
