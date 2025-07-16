const Post = require('../models/Post');
const Group = require('../models/Group');
const User = require('../models/User');

// GET /api/feed
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user._id;
    // 1. Get user's friends
    const user = await User.findById(userId).select('friends');
    const friendIds = user.friends || [];

    // 2. Get group IDs the user is a member of
    const allGroups = await Group.find({}).select('_id members');
    const groupIds = [];
    for (const group of allGroups) {
      if (group.isMember(userId)) {
        groupIds.push(group._id);
      }
    }

    // 3. Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 4. Build query
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
      query = {
        $or: [
          { author: userId },
          { author: { $in: friendIds } }
        ]
      };
    }

    // 5. Fetch posts
    const posts = await Post.find(query)
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.user', 'username firstName lastName profilePicture')
      .populate('group', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      posts,
      page,
      hasMore: posts.length === limit
    });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
