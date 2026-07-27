const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/contacts', chatController.getContacts);
router.get('/messages/:contactId', chatController.getMessages);
router.post('/messages', chatController.sendMessage);

module.exports = router;
