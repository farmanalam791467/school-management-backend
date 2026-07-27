const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authorize } = require('../middleware/auth');

router.get('/', eventController.getEvents);
router.post('/', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal']), eventController.createEvent);
router.delete('/:id', authorize(['super_admin', 'school_admin', 'principal']), eventController.deleteEvent);

module.exports = router;
