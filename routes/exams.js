const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { authorize } = require('../middleware/auth');

// Online & general exams
router.get('/', examController.getExams);
router.post('/', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal', 'teacher']), examController.createExam);
router.post('/questions', authorize(['super_admin', 'school_admin', 'principal', 'teacher']), examController.addQuestions);
router.get('/:examId/questions', examController.getExamQuestions);
router.post('/submit', authorize(['student']), examController.submitExam);
router.get('/:examId/results', authorize(['super_admin', 'school_admin', 'principal', 'teacher']), examController.getExamResults);

// Offline exams
router.post('/marks', authorize(['super_admin', 'school_admin', 'principal', 'teacher']), examController.enterMarks);
router.get('/report-card', examController.getReportCard);

module.exports = router;
