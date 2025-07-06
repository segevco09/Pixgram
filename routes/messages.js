const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { chatManager } = require('../models/ChatMessage');

console.log('🔄 Loading messages routes...');

const router = express.Router();

// @route   GET /api/messages/test
// @desc    Test if messages route is working
// @access  Private
router.get('/test', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Messages route is working!',
    user: req.user
  });
});

// @route   GET /api/messages/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  try {
    console.log(`📋 Getting conversations for user: ${req.user.id}`);
    
    const conversations = await chatManager.getUserConversations(req.user.id);
    
    res.json({
      success: true,
      conversations,
      total: conversations.length
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
});

// @route   GET /api/messages/conversation/:userId
// @desc    Get conversation with specific user
// @access  Private
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    
    console.log(`📖 Loading conversation between ${req.user.id} and ${userId}`);
    
    // Verify the other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get conversation history from Chats database
    const messages = await chatManager.getConversation(
      req.user.id, 
      userId, 
      parseInt(limit), 
      parseInt(skip)
    );

    // Mark messages as read (messages sent by the other user to current user)
    const readResult = await chatManager.markMessagesAsRead(userId, req.user.id);

    // Emit socket event to notify sender that their messages were read
    if (readResult.modifiedCount > 0) {
      console.log(`📤 Notifying sender ${userId} that ${readResult.modifiedCount} messages were read by ${req.user.id}`);
      
      // Get io instance from app
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${userId}`).emit('messages-read', {
          readerId: req.user.id,
          readerName: req.user.name || req.user.username,
          conversationWith: req.user.id,
          messageCount: readResult.modifiedCount,
          timestamp: new Date()
        });
        console.log(`✅ Sent messages-read event to user-${userId}`);
      } else {
        console.warn('⚠️ Socket.io instance not available for read notification');
      }
    }

    res.json({
      success: true,
      messages,
      otherUser: {
        id: otherUser._id,
        name: otherUser.name,
        username: otherUser.username
      },
      total: messages.length
    });
  } catch (error) {
    console.error('Error loading conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load conversation',
      error: error.message
    });
  }
});

// @route   POST /api/messages/send
// @desc    Send a message
// @access  Private
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, content, messageType = 'text' } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and content are required'
      });
    }

    console.log(`💬 Sending message from ${req.user.id} to ${receiverId}`);

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // Get sender info
    const sender = await User.findById(req.user.id);
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'Sender not found'
      });
    }

    // Save message to Chats database
    const message = await chatManager.sendMessage(
      req.user.id,
      sender.name,
      receiverId,
      receiver.name,
      content,
      messageType
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// @route   PUT /api/messages/read/:userId
// @desc    Mark messages as read
// @access  Private
router.put('/read/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`✅ Marking messages as read from ${userId} to ${req.user.id}`);

    const result = await chatManager.markMessagesAsRead(userId, req.user.id);

    // Emit socket event to notify sender that their messages were read
    if (result.modifiedCount > 0) {
      console.log(`📤 Notifying sender ${userId} that ${result.modifiedCount} messages were read by ${req.user.id}`);
      
      // Get io instance from app
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${userId}`).emit('messages-read', {
          readerId: req.user.id,
          readerName: req.user.name || req.user.username,
          conversationWith: req.user.id,
          messageCount: result.modifiedCount,
          timestamp: new Date()
        });
        console.log(`✅ Sent messages-read event to user-${userId}`);
      } else {
        console.warn('⚠️ Socket.io instance not available for read notification');
      }
    }

    res.json({
      success: true,
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get unread message count
// @access  Private
router.get('/unread-count', auth, async (req, res) => {
  try {
    console.log(`📊 Getting unread count for user: ${req.user.id}`);
    
    const unreadCount = await chatManager.getUnreadCount(req.user.id);

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
});

// @route   PUT /api/messages/edit/:messageId
// @desc    Edit a message
// @access  Private
router.put('/edit/:messageId', auth, async (req, res) => {
  try {
    console.log('🔍 EDIT MESSAGE REQUEST:', {
      messageId: req.params.messageId,
      body: req.body,
      userId: req.user?.id,
      headers: req.headers.authorization ? 'Present' : 'Missing'
    });

    const { messageId } = req.params;
    const { content, otherUserId } = req.body;

    if (!content || !otherUserId) {
      console.log('❌ Missing required fields:', { content: !!content, otherUserId: !!otherUserId });
      return res.status(400).json({
        success: false,
        message: 'Content and other user ID are required'
      });
    }

    console.log(`✏️ Editing message ${messageId} by user ${req.user.id}`);

    const result = await chatManager.editMessage(messageId, req.user.id, otherUserId, content.trim());

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized to edit'
      });
    }

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${otherUserId}`).emit('message-edited', {
        messageId,
        newContent: content.trim(),
        editedAt: new Date(),
        senderId: req.user.id
      });
      console.log(`✅ Sent message-edited event to user-${otherUserId}`);
    }

    res.json({
      success: true,
      message: 'Message edited successfully',
      data: result
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to edit message',
      error: error.message
    });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'Other user ID is required'
      });
    }

    console.log(`🗑️ Deleting message ${messageId} by user ${req.user.id}`);

    const result = await chatManager.deleteMessage(messageId, req.user.id, otherUserId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${otherUserId}`).emit('message-deleted', {
        messageId,
        senderId: req.user.id
      });
      console.log(`✅ Sent message-deleted event to user-${otherUserId}`);
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

// @route   GET /api/messages/stats
// @desc    Get chat statistics (for debugging/admin)
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const conversations = await chatManager.getUserConversations(req.user.id);
    const unreadCount = await chatManager.getUnreadCount(req.user.id);

    res.json({
      success: true,
      stats: {
        totalConversations: conversations.length,
        totalUnreadMessages: unreadCount,
        conversations: conversations.map(conv => ({
          otherUser: conv.otherUserName,
          lastMessageAt: conv.lastMessage.createdAt,
          unreadCount: conv.unreadCount,
          collection: conv.collectionName
        }))
      }
    });
  } catch (error) {
    console.error('Error getting chat stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat statistics',
      error: error.message
    });
  }
});

console.log('✅ Messages routes loaded successfully');
module.exports = router; 