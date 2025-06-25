const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/friends
// @desc    Get user's friends list
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'username firstName lastName profilePicture')
      .populate('friendRequests.from', 'username firstName lastName profilePicture');

    res.json({
      success: true,
      friends: user.friends,
      friendRequests: user.friendRequests
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/friends/request/:userId
// @desc    Send friend request
// @access  Private
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already friends
    if (currentUser.isFriend(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Already friends with this user'
      });
    }

    // Check if request already exists
    if (targetUser.hasFriendRequest(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already sent'
      });
    }

    // Add friend request to target user
    targetUser.addFriendRequest(currentUserId);
    await targetUser.save();

    res.json({
      success: true,
      message: 'Friend request sent successfully'
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/friends/accept/:userId
// @desc    Accept friend request
// @access  Private
router.post('/accept/:userId', auth, async (req, res) => {
  try {
    const requesterId = req.params.userId;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const requester = await User.findById(requesterId);

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if friend request exists
    if (!currentUser.hasFriendRequest(requesterId)) {
      return res.status(400).json({
        success: false,
        message: 'No friend request from this user'
      });
    }

    // Add each other as friends
    currentUser.addFriend(requesterId);
    requester.addFriend(currentUserId);

    // Save both users
    await currentUser.save();
    await requester.save();

    res.json({
      success: true,
      message: 'Friend request accepted'
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/friends/reject/:userId
// @desc    Reject friend request
// @access  Private
router.post('/reject/:userId', auth, async (req, res) => {
  try {
    const requesterId = req.params.userId;
    const currentUser = await User.findById(req.user._id);

    if (!currentUser.hasFriendRequest(requesterId)) {
      return res.status(400).json({
        success: false,
        message: 'No friend request from this user'
      });
    }

    currentUser.removeFriendRequest(requesterId);
    await currentUser.save();

    res.json({
      success: true,
      message: 'Friend request rejected'
    });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/friends/:userId
// @desc    Remove friend
// @access  Private
router.delete('/:userId', auth, async (req, res) => {
  try {
    const friendId = req.params.userId;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!currentUser.isFriend(friendId)) {
      return res.status(400).json({
        success: false,
        message: 'Not friends with this user'
      });
    }

    // Remove each other from friends lists
    currentUser.removeFriend(friendId);
    friend.removeFriend(currentUserId);

    await currentUser.save();
    await friend.save();

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/friends/search
// @desc    Search for users to add as friends
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user._id;

    console.log('=== SEARCH DEBUG ===');
    console.log('Query:', q);
    console.log('Current User ID:', currentUserId);
    console.log('Query type:', typeof q);
    console.log('Query length:', q ? q.length : 'undefined');

    if (!q || q.trim().length < 2) {
      console.log('Query too short, returning error');
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    // First, let's see all users in the database
    const allUsers = await User.find().select('_id username firstName lastName');
    console.log('All users in database:', allUsers);

    // Test the search query
    const searchRegex = new RegExp(q.trim(), 'i');
    console.log('Search regex:', searchRegex);

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { firstName: { $regex: q.trim(), $options: 'i' } },
        { lastName: { $regex: q.trim(), $options: 'i' } },
        { username: { $regex: q.trim(), $options: 'i' } },
        { 
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: q.trim(),
              options: "i"
            }
          }
        }
      ]
    })
    .select('username firstName lastName profilePicture')
    .limit(20);

    console.log('Search query executed');
    console.log('Found users count:', users.length);
    console.log('Found users:', users);

    // Get current user to check friend status
    const currentUser = await User.findById(currentUserId);
    console.log('Current user found:', currentUser ? 'Yes' : 'No');
    if (currentUser) {
      console.log('Current user friends:', currentUser.friends);
      console.log('Current user friendRequests:', currentUser.friendRequests);
    }

    // Add friend status to each user
    const usersWithStatus = users.map(user => ({
      ...user.toObject(),
      isFriend: currentUser.isFriend(user._id),
      hasRequestPending: false, // Will be updated below
      hasRequestFromThem: currentUser.hasFriendRequest(user._id)
    }));

    // Check if current user has sent requests to any of these users
    // This is more efficient than the previous version
    const userIds = usersWithStatus.map(u => u._id);
    const usersWithRequests = await User.find({
      _id: { $in: userIds },
      'friendRequests.from': currentUserId
    }).select('_id');

    const userIdsWithRequests = new Set(usersWithRequests.map(u => u._id.toString()));
    
    usersWithStatus.forEach(user => {
      if (userIdsWithRequests.has(user._id.toString())) {
        user.hasRequestPending = true;
      }
    });

    console.log('Users with status:', usersWithStatus);

    res.json({
      success: true,
      users: usersWithStatus
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/friends/debug
// @desc    Debug endpoint to check if API is working
// @access  Private
router.get('/debug', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const totalUsers = await User.countDocuments();
    const allUsers = await User.find().select('username firstName lastName');
    
    res.json({
      success: true,
      message: 'Debug endpoint working',
      currentUserId,
      totalUsers,
      allUsers
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug endpoint failed',
      error: error.message
    });
  }
});

// @route   GET /api/friends/test-search
// @desc    Test search without excluding current user
// @access  Private
router.get('/test-search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    
    console.log('=== TEST SEARCH DEBUG ===');
    console.log('Query:', q);

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    // Search without excluding current user
    const users = await User.find({
      $or: [
        { firstName: { $regex: q.trim(), $options: 'i' } },
        { lastName: { $regex: q.trim(), $options: 'i' } },
        { username: { $regex: q.trim(), $options: 'i' } }
      ]
    })
    .select('username firstName lastName profilePicture')
    .limit(20);

    console.log('Test search found:', users.length, 'users');
    console.log('Users found:', users);

    res.json({
      success: true,
      users: users.map(user => ({
        ...user.toObject(),
        isFriend: false,
        hasRequestPending: false,
        hasRequestFromThem: false
      }))
    });
  } catch (error) {
    console.error('Test search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 