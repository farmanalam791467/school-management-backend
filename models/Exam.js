const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question_text: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['MCQ', 'Short Answer', 'True/False'], 
    default: 'MCQ' 
  },
  option_a: { type: String },
  option_b: { type: String },
  option_c: { type: String },
  option_d: { type: String },
  correct_option: { type: String },
  marks: { type: Number, default: 1 },
  negative_marks: { type: Number, default: 0 }
});

const studentAnswerSchema = new mongoose.Schema({
  question_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  student_answer: { type: String },
  marks_obtained: { type: Number, default: 0 }
});

const examSubmissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  end_time: { type: Date, default: Date.now },
  status: { type: String, default: 'Submitted' },
  total_score: { type: Number, default: 0 },
  answers: [studentAnswerSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const examSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },
  total_marks: {
    type: Number,
    required: true
  },
  passing_marks: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed'],
    default: 'scheduled'
  },
  questions: [questionSchema],
  submissions: [examSubmissionSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Exam', examSchema);
