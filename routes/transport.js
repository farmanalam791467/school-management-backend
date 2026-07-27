const express = require('express');
const router = express.Router();
const transportController = require('../controllers/transportController');
const { authorize } = require('../middleware/auth');

router.get('/routes', transportController.getRoutes);
router.post('/routes', authorize(['super_admin', 'school_admin', 'transport_manager']), transportController.createRoute);
router.post('/pickup-points', authorize(['super_admin', 'school_admin', 'transport_manager']), transportController.createPickupPoint);

router.get('/vehicles', authorize(['super_admin', 'school_admin', 'transport_manager']), transportController.getVehicles);
router.post('/vehicles', authorize(['super_admin', 'school_admin', 'transport_manager']), transportController.createVehicle);

router.post('/allocate', authorize(['super_admin', 'school_admin', 'transport_manager']), transportController.allocateStudent);
router.delete('/allocate/:studentId', authorize(['super_admin', 'school_admin', 'transport_manager']), transportController.deallocateStudent);

module.exports = router;
