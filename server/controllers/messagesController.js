const User = require('../models/User');
const { chatManager } = require('../models/ChatMessage');

exports.testMessages = (req, res) => {
  res.json({
    success: true,
    message: 'Messages route is working!',
    user: req.user
  });
};

exports.getConversations = async (req, res) => {
  try {
    
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
};

exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    
    
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const messages = await chatManager.getConversation(
      req.user.id, 
      userId, 
      parseInt(limit), 
      parseInt(skip)
    );

    const readResult = await chatManager.markMessagesAsRead(userId, req.user.id);

    if (readResult.modifiedCount > 0) {
      
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${userId}`).emit('messages-read', {
          readerId: req.user.id,
          readerName: req.user.name || req.user.username,
          conversationWith: req.user.id,
          messageCount: readResult.modifiedCount,
          timestamp: new Date()
        });
      } else {
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
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, messageType = 'text' } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and content are required'
      });
    }


    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    const sender = await User.findById(req.user.id);
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'Sender not found'
      });
    }

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
};

exports.markMessagesAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    

    const result = await chatManager.markMessagesAsRead(userId, req.user.id);

    if (result.modifiedCount > 0) {
      
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${userId}`).emit('messages-read', {
          readerId: req.user.id,
          readerName: req.user.name || req.user.username,
          conversationWith: req.user.id,
          messageCount: result.modifiedCount,
          timestamp: new Date()
        });
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
};

exports.getUnreadCount = async (req, res) => {
  try {
    
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
};

exports.editMessage = async (req, res) => {
  try {

    const { messageId } = req.params;
    const { content, otherUserId } = req.body;

    if (!content || !otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'Content and other user ID are required'
      });
    }

    const result = await chatManager.editMessage(messageId, req.user.id, otherUserId, content.trim());

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized to edit'
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user-${otherUserId}`).emit('message-edited', {
        messageId,
        newContent: content.trim(),
        editedAt: new Date(),
        senderId: req.user.id
      });
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
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'Other user ID is required'
      });
    }

    const result = await chatManager.deleteMessage(messageId, req.user.id, otherUserId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user-${otherUserId}`).emit('message-deleted', {
        messageId,
        senderId: req.user.id
      });
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
};

exports.getChatStats = async (req, res) => {
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
};
