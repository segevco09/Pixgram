const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Group = require('../models/Group');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   GET /api/feed
// @desc    Get main feed: posts from user, friends, and groups
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Get user's friends (array of user IDs)
    const user = await User.findById(userId).select('friends');
    const friendIds = user.friends || [];

    // 2. Get group IDs the user is a member of
    const userGroups = await Group.find({ 'members.user': userId }).select('_id');
    const groupIds = userGroups.map(g => g._id);

    // 3. Pagination: get page and limit from query params (default: page 1, 10 posts per page)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 4. Find posts:
    // - authored by the user
    // - authored by a friend
    // - or in a group the user is a member of
    const posts = await Post.find({
      $or: [
        { author: userId },
        { author: { $in: friendIds } },
        { group: { $in: groupIds } }
      ]
    })
      .populate('author', 'username firstName lastName profilePicture')
      .populate('group', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 5. Return the posts
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch feed', error: error.message });
  }
});

module.exports = router; 