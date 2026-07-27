const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { authorize } = require('../middleware/auth');

router.get('/types', authorize(['super_admin', 'school_admin', 'accountant']), feeController.getFeeTypes);
router.post('/types', authorize(['super_admin', 'school_admin', 'accountant']), feeController.createFeeType);

router.get('/invoices', authorize(['super_admin', 'school_admin', 'accountant', 'parent', 'student']), feeController.getInvoices);
router.get('/invoices/:id', authorize(['super_admin', 'school_admin', 'accountant', 'parent', 'student']), feeController.getInvoiceById);
router.post('/invoices', authorize(['super_admin', 'school_admin', 'accountant']), feeController.createInvoice);
router.post('/invoices/bulk', authorize(['super_admin', 'school_admin', 'accountant']), feeController.bulkGenerateInvoices);

router.post('/collect', authorize(['super_admin', 'school_admin', 'accountant', 'parent', 'student']), feeController.collectFee);

module.exports = router;
