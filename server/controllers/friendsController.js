const User = require('../models/User');

// Get user's friends and friend requests
exports.getFriends = async (req, res) => {
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Send friend request
exports.sendRequest = async (req, res) => {
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

    if (currentUser.isFriend(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Already friends with this user'
      });
    }

    if (targetUser.hasFriendRequest(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already sent'
      });
    }

    targetUser.addFriendRequest(currentUserId);
    await targetUser.save();

    res.json({
      success: true,
      message: 'Friend request sent successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Accept friend request
exports.acceptRequest = async (req, res) => {
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

    if (!currentUser.hasFriendRequest(requesterId)) {
      return res.status(400).json({
        success: false,
        message: 'No friend request from this user'
      });
    }

    currentUser.addFriend(requesterId);
    requester.addFriend(currentUserId);
    await currentUser.save();
    await requester.save();

    res.json({
      success: true,
      message: 'Friend request accepted'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reject friend request
exports.rejectRequest = async (req, res) => {
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Remove friend
exports.removeFriend = async (req, res) => {
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

    currentUser.removeFriend(friendId);
    friend.removeFriend(currentUserId);
    await currentUser.save();
    await friend.save();

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Search for users to add as friends
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user._id;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const searchRegex = new RegExp(q.trim(), 'i');
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

    const currentUser = await User.findById(currentUserId);

    const usersWithStatus = users.map(user => ({
      ...user.toObject(),
      isFriend: currentUser.isFriend(user._id),
      hasRequestPending: false, // Will be updated below
      hasRequestFromThem: currentUser.hasFriendRequest(user._id)
    }));

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

    res.json({
      success: true,
      users: usersWithStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get follower/following stats for a specific user
exports.getStatsById = async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    const followingCount = targetUser.friends.length;
    const followerCount = await User.countDocuments({ friends: userId });
    res.json({
      success: true,
      followerCount,
      followingCount,
      totalConnections: followerCount + followingCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get follower/following stats for current user
exports.getStats = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    const followingCount = currentUser.friends.length;
    const followerCount = await User.countDocuments({ friends: currentUserId });
    res.json({
      success: true,
      followerCount,
      followingCount,
      totalConnections: followerCount + followingCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
