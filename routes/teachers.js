const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authorize } = require('../middleware/auth');

router.get('/', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal', 'hr']), teacherController.getTeachers);
router.get('/:id', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal', 'hr', 'teacher', 'student']), teacherController.getTeacherById);
router.post('/', authorize(['super_admin', 'school_admin', 'principal', 'hr']), teacherController.createTeacher);
router.put('/:id', authorize(['super_admin', 'school_admin', 'principal', 'hr']), teacherController.updateTeacher);
router.delete('/:id', authorize(['super_admin', 'school_admin']), teacherController.deleteTeacher);

module.exports = router;
