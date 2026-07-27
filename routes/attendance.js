const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authorize } = require('../middleware/auth');

router.get('/', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal', 'teacher', 'receptionist']), attendanceController.getAttendance);
router.post('/', authorize(['super_admin', 'school_admin', 'principal', 'teacher']), attendanceController.saveAttendance);
router.post('/scan-qr', authorize(['super_admin', 'school_admin', 'principal', 'teacher', 'receptionist']), attendanceController.scanQRAttendance);
router.get('/my-attendance', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal', 'teacher', 'student', 'parent', 'accountant', 'librarian', 'receptionist', 'hr', 'transport_manager', 'hostel_manager']), attendanceController.getMyAttendance);
router.get('/monthly-report', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal', 'teacher']), attendanceController.getMonthlyReport);

module.exports = router;
