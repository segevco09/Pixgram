const express = require('express');
const auth = require('../middleware/auth');
const messagesController = require('../controllers/messagesController');

console.log('🔄 Loading messages routes...');

const router = express.Router();

// @route   GET /api/messages/test
// @desc    Test if messages route is working
// @access  Private
router.get('/test', auth, messagesController.testMessages);

// @route   GET /api/messages/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', auth, messagesController.getConversations);

// @route   GET /api/messages/conversation/:userId
// @desc    Get conversation with specific user
// @access  Private
router.get('/conversation/:userId', auth, messagesController.getConversation);

// @route   POST /api/messages/send
// @desc    Send a message
// @access  Private
router.post('/send', auth, messagesController.sendMessage);

// @route   PUT /api/messages/read/:userId
// @desc    Mark messages as read
// @access  Private
router.put('/read/:userId', auth, messagesController.markMessagesAsRead);

// @route   GET /api/messages/unread-count
// @desc    Get unread message count
// @access  Private
router.get('/unread-count', auth, messagesController.getUnreadCount);

// @route   PUT /api/messages/edit/:messageId
// @desc    Edit a message
// @access  Private
router.put('/edit/:messageId', auth, messagesController.editMessage);

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', auth, messagesController.deleteMessage);

// @route   GET /api/messages/stats
// @desc    Get chat statistics (for debugging/admin)
// @access  Private
router.get('/stats', auth, messagesController.getChatStats);

console.log('✅ Messages routes loaded successfully');
module.exports = router; 