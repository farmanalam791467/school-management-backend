const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authorize } = require('../middleware/auth');

// Only admins, principals, and receptionists can manage admissions or promotions
router.get('/', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal', 'receptionist']), studentController.getStudents);
router.get('/:id', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal', 'receptionist', 'teacher', 'parent', 'student']), studentController.getStudentById);
router.post('/', authorize(['super_admin', 'school_admin', 'principal', 'receptionist']), studentController.createStudent);
router.put('/:id', authorize(['super_admin', 'school_admin', 'principal']), studentController.updateStudent);
router.delete('/:id', authorize(['super_admin', 'school_admin']), studentController.deleteStudent);
router.post('/promote', authorize(['super_admin', 'school_admin', 'principal']), studentController.promoteStudents);

module.exports = router;
