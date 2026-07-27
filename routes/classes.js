const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { authorize } = require('../middleware/auth');

router.get('/', classController.getClasses);
router.post('/', authorize(['super_admin', 'school_admin', 'principal']), classController.createClass);

router.get('/sections', classController.getSections);
router.post('/sections', authorize(['super_admin', 'school_admin', 'principal']), classController.createSection);

router.get('/subjects', classController.getSubjects);
router.post('/subjects', authorize(['super_admin', 'school_admin', 'principal']), classController.createSubject);

router.get('/mappings', classController.getClassSubjects);
router.post('/mappings', authorize(['super_admin', 'school_admin', 'principal']), classController.assignSubjectTeacher);

router.get('/timetable', classController.getTimetable);
router.post('/timetable', authorize(['super_admin', 'school_admin', 'principal']), classController.createTimetableSlot);

module.exports = router;
