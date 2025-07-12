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
    console.log('🔍 Feed Debug: User ID =', userId);

    // 1. Get user's friends (array of user IDs)
    const user = await User.findById(userId).select('friends');
    const friendIds = user.friends || [];
    console.log('🔍 Feed Debug: Friend IDs =', friendIds);

    // 2. Get group IDs the user is a member of - FIXED VERSION
    // First, get all groups and check membership manually to avoid ObjectId comparison issues
    const allGroups = await Group.find({}).select('_id members');
    const groupIds = [];
    
    for (const group of allGroups) {
      if (group.isMember(userId)) {
        groupIds.push(group._id);
      }
    }
    
    console.log('🔍 Feed Debug: Group IDs user is member of =', groupIds);

    // 3. Pagination: get page and limit from query params (default: page 1, 10 posts per page)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    console.log('🔍 Feed Debug: Page =', page, 'Limit =', limit, 'Skip =', skip);

    // 4. Build query - handle case where user has no groups
    let query;
    if (groupIds.length > 0) {
      query = {
        $or: [
          { author: userId },
          { author: { $in: friendIds } },
          { group: { $in: groupIds } }
        ]
      };
    } else {
      // If user is not in any groups, only show their posts and friends' posts
      query = {
        $or: [
          { author: userId },
          { author: { $in: friendIds } }
        ]
      };
    }
    
    console.log('🔍 Feed Debug: Query =', JSON.stringify(query, null, 2));

    const posts = await Post.find(query)
      .populate('author', 'username firstName lastName profilePicture')
      .populate('group', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    console.log('🔍 Feed Debug: Found posts count =', posts.length);
    console.log('🔍 Feed Debug: Posts =', posts.map(p => ({
      id: p._id,
      author: p.author?.username || 'Unknown',
      group: p.group?.name || 'No group',
      caption: p.caption ? (p.caption.substring(0, 50) + '...') : 'No caption'
    })));

    // 5. Return the posts
    res.json({ success: true, posts });
  } catch (error) {
    console.error('🔍 Feed Debug: Error =', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feed', error: error.message });
  }
});

module.exports = router; 