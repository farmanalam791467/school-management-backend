const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');
const { authorize } = require('../middleware/auth');

// Employee directory
router.get('/employees', authorize(['super_admin', 'school_admin', 'hr']), hrController.getEmployees);
router.post('/employees', authorize(['super_admin', 'school_admin', 'hr']), hrController.createEmployee);

// Payroll
router.get('/payroll', authorize(['super_admin', 'school_admin', 'hr', 'accountant']), hrController.getPayroll);
router.post('/payroll/generate', authorize(['super_admin', 'school_admin', 'hr']), hrController.generatePayroll);
router.post('/payroll/pay', authorize(['super_admin', 'school_admin', 'hr', 'accountant']), hrController.paySalary);

// Leaves
router.get('/leaves', hrController.getLeaves);
router.post('/leaves', hrController.requestLeave);
router.put('/leaves/:id', authorize(['super_admin', 'school_admin', 'hr', 'principal']), hrController.updateLeaveStatus);

module.exports = router;
