const express = require('express');
const auth = require('../middleware/auth');
const messagesController = require('../controllers/messagesController');

console.log('🔄 Loading messages routes...');

const router = express.Router();

router.get('/test', auth, messagesController.testMessages);

router.get('/conversations', auth, messagesController.getConversations);

router.get('/conversation/:userId', auth, messagesController.getConversation);

router.post('/send', auth, messagesController.sendMessage);

router.put('/read/:userId', auth, messagesController.markMessagesAsRead);

router.get('/unread-count', auth, messagesController.getUnreadCount);

router.put('/edit/:messageId', auth, messagesController.editMessage);

router.delete('/:messageId', auth, messagesController.deleteMessage);

router.get('/stats', auth, messagesController.getChatStats);

console.log('✅ Messages routes loaded successfully');
module.exports = router; 