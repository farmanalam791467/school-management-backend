const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const { authorize } = require('../middleware/auth');

router.get('/', noticeController.getNotices);
router.post('/', authorize(['super_admin', 'school_admin', 'principal', 'vice_principal']), noticeController.createNotice);
router.delete('/:id', authorize(['super_admin', 'school_admin', 'principal']), noticeController.deleteNotice);

module.exports = router;
