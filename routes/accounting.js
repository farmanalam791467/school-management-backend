const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const { authorize } = require('../middleware/auth');

router.get('/ledger', authorize(['super_admin', 'school_admin', 'accountant']), accountingController.getLedger);
router.post('/ledger', authorize(['super_admin', 'school_admin', 'accountant']), accountingController.createLedgerEntry);
router.get('/summary', authorize(['super_admin', 'school_admin', 'accountant']), accountingController.getFinancialSummary);

module.exports = router;
