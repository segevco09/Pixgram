const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Group = require('../models/Group');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// @route   GET /api/groups
// @desc    Get all groups with search parameters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { search, category, privacy } = req.query;

    // Build search query
    let query = { isActive: true };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (privacy && privacy !== 'all') {
      query.privacy = privacy;
    }

    const groups = await Group.find(query)
      .populate('creator', 'username firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      groups
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/groups/:id
// @desc    Get single group
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'username firstName lastName profilePicture')
      .populate('admins', 'username firstName lastName profilePicture')
      .populate('members.user', 'username firstName lastName profilePicture')
      .populate('joinRequests.user', 'username firstName lastName profilePicture');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user can view this group
    const userId = req.user._id;
    const canView = group.privacy === 'public' || 
                   group.isMember(userId) || 
                   group.isAdmin(userId);

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/groups
// @desc    Create new group
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, privacy, category } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }

    const group = new Group({
      name: name.trim(),
      description: description?.trim() || '',
      creator: req.user._id,
      admins: [req.user._id],
      privacy: privacy || 'public',
      category: category || 'other'
    });

    // Add creator as first member
    group.addMember(req.user._id, 'member');

    await group.save();
    await group.populate('creator', 'username firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/groups/:id
// @desc    Update group
// @access  Private (Admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can edit this group'
      });
    }

    const { name, description, privacy, category } = req.body;

    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (privacy !== undefined) group.privacy = privacy;
    if (category !== undefined) group.category = category;

    await group.save();

    res.json({
      success: true,
      message: 'Group updated successfully',
      group
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/groups/:id
// @desc    Delete group
// @access  Private (Creator only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.creator.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the group creator can delete this group'
      });
    }

    group.isActive = false;
    await group.save();

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/groups/:id/join
// @desc    Join group or request to join
// @access  Private
router.post('/:id/join', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const userId = req.user._id;

    // Check if already a member
    if (group.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group'
      });
    }

    // Check if already has pending request
    if (group.hasJoinRequest(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending join request'
      });
    }

    if (group.privacy === 'public') {
      // Add directly to group
      group.addMember(userId);
      await group.save();
      
      res.json({
        success: true,
        message: 'Successfully joined the group'
      });
    } else {
      // Add join request
      group.addJoinRequest(userId, message || '');
      await group.save();
      
      res.json({
        success: true,
        message: 'Join request sent successfully'
      });
    }
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/groups/:id/leave
// @desc    Leave group
// @access  Private
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const userId = req.user._id;

    // Check if user is a member
    if (!group.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Prevent creator from leaving
    if (group.creator.equals(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Group creator cannot leave the group'
      });
    }

    group.removeMember(userId);
    // Remove from admins if applicable
    group.admins = group.admins.filter(admin => !admin.equals(userId));
    
    await group.save();

    res.json({
      success: true,
      message: 'Successfully left the group'
    });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/groups/:id/approve/:userId
// @desc    Approve join request
// @access  Private (Admin only)
router.post('/:id/approve/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can approve join requests'
      });
    }

    const userId = req.params.userId;
    
    // Check if join request exists
    if (!group.hasJoinRequest(userId)) {
      return res.status(400).json({
        success: false,
        message: 'No pending join request found'
      });
    }

    group.addMember(userId);
    await group.save();

    res.json({
      success: true,
      message: 'Join request approved successfully'
    });
  } catch (error) {
    console.error('Approve join request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/groups/:id/reject/:userId
// @desc    Reject join request
// @access  Private (Admin only)
router.post('/:id/reject/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can reject join requests'
      });
    }

    group.rejectJoinRequest(req.params.userId);
    await group.save();

    res.json({
      success: true,
      message: 'Join request rejected successfully'
    });
  } catch (error) {
    console.error('Reject join request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/groups/:id/posts
// @desc    Get group posts
// @access  Private (Members only)
router.get('/:id/posts', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user can view posts
    const userId = req.user._id;
    const canView = group.privacy === 'public' || 
                   group.isMember(userId) || 
                   group.isAdmin(userId);

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ 
      group: req.params.id,
      privacy: { $in: ['public', 'friends'] }
    })
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.user', 'username firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      posts,
      hasMore: posts.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Get group posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create a post in a group
router.post('/:groupId/posts', auth, upload.single('media'), async (req, res) => {
  try {
    // 1. Get group ID from URL
    const groupId = req.params.groupId;
    console.log('🔍 Group Post Debug: Group ID =', groupId);
    console.log('🔍 Group Post Debug: User ID =', req.user.id);

    // 2. Get post data from request body (now properly parsed by multer)
    const { caption } = req.body;
    console.log('🔍 Group Post Debug: Caption =', caption);
    console.log('🔍 Group Post Debug: File =', req.file ? req.file.filename : 'No file');

    // 3. Check if user is member of the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    
    const isMember = group.isMember(req.user.id);
    console.log('🔍 Group Post Debug: Is user member of group? =', isMember);
    console.log('🔍 Group Post Debug: Group members =', group.members.map(m => m.user.toString()));

    // SECURITY CHECK: Only allow members to post
    if (!isMember) {
      console.log('🔍 Group Post Debug: User is not a member, denying post');
      return res.status(403).json({ 
        success: false, 
        message: 'You must be a member of this group to post' 
      });
    }

    // 4. Build post data object
    const postData = {
      author: req.user.id,
      caption: caption || '',
      group: groupId
    };

    // 5. Handle media upload if file was provided
    if (req.file) {
      postData.media = {
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'video',
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename
      };
    }

    console.log('🔍 Group Post Debug: Post object before save =', {
      author: postData.author,
      group: postData.group,
      caption: postData.caption,
      media: postData.media
    });

    // 6. Create and save the post
    const post = new Post(postData);
    await post.save();
    console.log('🔍 Group Post Debug: Post saved successfully with ID =', post._id);

    // 7. Populate author information for the response
    await post.populate('author', 'username firstName lastName profilePicture');

    // 8. Return the new post
    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error('🔍 Group Post Debug: Error =', error);
    res.status(500).json({ success: false, message: 'Failed to create group post', error: error.message });
  }
});

// Get all posts for a group
router.get('/:groupId/posts', auth, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    // Find posts where the group field matches the groupId
    const posts = await Post.find({ group: groupId })
      .populate('author', 'username firstName lastName profilePicture');
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch group posts', error: error.message });
  }
});

// Get feed for all groups the user is a member of
router.get('/my-feed', auth, async (req, res) => {
  try {
    // 1. Find all groups the user is a member of
    const userGroups = await Group.find({ members: req.user.id }).select('_id');
    const groupIds = userGroups.map(g => g._id);

    // 2. Find all posts in those groups
    const posts = await Post.find({ group: { $in: groupIds } }).populate('author group');

    // 3. Return the posts
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch group feed', error: error.message });
  }
});

module.exports = router; 