const Post = require('../models/Post');
const Group = require('../models/Group');
const User = require('../models/User');

// GET /api/feed
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('friends');
    const friendIds = user.friends || [];

    // Get group IDs the user is a member of
    const groups = await Group.find({ 'members.user': userId }).select('_id');
    const groupIds = groups.map(g => g._id);

    // Build strict query
    const query = {
      $or: [
        {
          $and: [
            { group: null },
            { $or: [ { author: userId }, { author: { $in: friendIds } } ] }
          ]
        },
        { group: { $in: groupIds } }
      ]
    };

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch posts
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
