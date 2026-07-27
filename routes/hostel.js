const express = require('express');
const router = express.Router();
const hostelController = require('../controllers/hostelController');
const { authorize } = require('../middleware/auth');

router.get('/', hostelController.getHostels);
router.post('/', authorize(['super_admin', 'school_admin', 'hostel_manager']), hostelController.createHostel);
router.post('/rooms', authorize(['super_admin', 'school_admin', 'hostel_manager']), hostelController.createRoom);
router.post('/allocate', authorize(['super_admin', 'school_admin', 'hostel_manager']), hostelController.allocateBed);
router.delete('/allocate/:studentId', authorize(['super_admin', 'school_admin', 'hostel_manager']), hostelController.vacateBed);

module.exports = router;
