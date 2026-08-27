const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  submission_date: {
    type: Date,
    default: Date.now
  },
  content: {
    type: String
  },
  file_path: {
    type: String
  },
  status: {
    type: String,
    enum: ['Submitted', 'Graded', 'Late'],
    default: 'Submitted'
  },
  feedback: {
    type: String
  },
  marks_obtained: {
    type: Number
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const assignmentSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  max_marks: {
    type: Number,
    required: true
  },
  due_date: {
    type: Date,
    required: true
  },
  attachments: {
    type: String
  },
  submissions: [assignmentSubmissionSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Assignment', assignmentSchema);
