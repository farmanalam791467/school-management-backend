const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authorize } = require('../middleware/auth');

router.get('/students', authorize(['super_admin', 'school_admin', 'principal', 'receptionist']), reportController.getStudentsReport);
router.get('/ledger', authorize(['super_admin', 'school_admin', 'accountant']), reportController.getLedgerReport);
router.get('/students/excel', authorize(['super_admin', 'school_admin', 'principal', 'receptionist']), reportController.exportStudentsExcel);
router.get('/ledger/excel', authorize(['super_admin', 'school_admin', 'accountant']), reportController.exportLedgerExcel);
router.get('/invoices/:invoiceId/pdf', reportController.exportInvoicePDF);

module.exports = router;
