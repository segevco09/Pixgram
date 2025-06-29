const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

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
    const currentUserId = req.user._id;

    // Get all messages where user is sender or receiver
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: currentUserId },
            { receiver: currentUserId }
          ],
          isDeleted: false
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', currentUserId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', currentUserId] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            _id: '$user._id',
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            username: '$user.username',
            profilePicture: '$user.profilePicture'
          },
          lastMessage: '$lastMessage',
          unreadCount: '$unreadCount'
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json({
      success: true,
      conversations: messages
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/messages/conversation/:userId
// @desc    Get conversation with specific user
// @access  Private
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Get conversation messages
    const messages = await Message.getConversation(currentUserId, otherUserId, limit, skip);
    
    // Reverse to show oldest first
    messages.reverse();

    // Mark messages as read
    await Message.markConversationAsRead(otherUserId, currentUserId);

    res.json({
      success: true,
      messages,
      page,
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/messages/send
// @desc    Send a message
// @access  Private
router.post('/send', auth, async (req, res) => {
  try {
    console.log('=== MESSAGE SEND DEBUG ===');
    console.log('Request body:', req.body);
    console.log('User from auth:', req.user);
    
    const { receiverId, content, messageType = 'text' } = req.body;
    const senderId = req.user._id;

    console.log('Parsed data:', { senderId, receiverId, content, messageType });

    if (!receiverId || !content) {
      console.log('Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Receiver and content are required'
      });
    }

    // Check if receiver exists
    console.log('Checking if receiver exists...');
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      console.log('Receiver not found');
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }
    console.log('Receiver found:', receiver.firstName, receiver.lastName);

    // Create message
    console.log('Creating message...');
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      messageType
    });

    console.log('Saving message...');
    await message.save();
    console.log('Message saved with ID:', message._id);

    // Populate sender and receiver info
    console.log('Populating sender and receiver info...');
    await message.populate('sender', 'firstName lastName username profilePicture');
    await message.populate('receiver', 'firstName lastName username profilePicture');

    console.log('Message send successful, returning response');
    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('=== MESSAGE SEND ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// @route   PUT /api/messages/:messageId/read
// @desc    Mark message as read
// @access  Private
router.put('/:messageId/read', auth, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const currentUserId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      receiver: currentUserId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.markAsRead();

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const currentUserId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      sender: currentUserId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized'
      });
    }

    message.isDeleted = true;
    await message.save();

    res.json({
      success: true,
      message: 'Message deleted'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get unread message count
// @access  Private
router.get('/unread-count', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const count = await Message.getUnreadCount(currentUserId);

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

console.log('✅ Messages routes loaded successfully');
module.exports = router; 