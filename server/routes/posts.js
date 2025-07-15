const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Posts routes working!', timestamp: new Date() });
});

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

// @route   GET /api/posts
// @desc    Get posts for feed (user's posts + friends' posts)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get current user with friends
    const User = require('../models/User');
    const currentUser = await User.findById(req.user._id);
    
    // Include posts from user and their friends
    const authorIds = [req.user._id, ...currentUser.friends];

    const posts = await Post.find({ 
      author: { $in: authorIds },
      privacy: { $in: ['public', 'friends'] }
    })
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.user', 'username firstName lastName profilePicture')
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
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', (req, res, next) => {
  console.log('=== POST /api/posts HIT ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  console.log('Headers:', req.headers);
  next();
}, auth, upload.single('media'), async (req, res) => {
  try {
    console.log('POST /api/posts - Request received');
    console.log('User:', req.user ? req.user._id : 'No user');
    console.log('Body:', req.body);
    console.log('File:', req.file ? req.file.filename : 'No file');
    
    const { caption, tags, location, privacy } = req.body;
    
    const postData = {
      author: req.user._id,
      caption: caption || '',
      location: location || '',
      privacy: privacy || 'public'
    };

    // Handle tags
    if (tags) {
      postData.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // Handle media upload
    if (req.file) {
      postData.media = {
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'video',
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename
      };
    }

    const post = new Post(postData);
    await post.save();
    
    await post.populate('author', 'username firstName lastName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update post
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { caption, tags, location, privacy } = req.body;
    
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user owns the post
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this post'
      });
    }

    // Save edit history
    if (caption !== post.caption || tags !== post.tags.join(',')) {
      post.editHistory.push({
        editedAt: new Date(),
        oldCaption: post.caption,
        oldTags: [...post.tags]
      });
      post.isEdited = true;
    }

    // Update fields
    if (caption !== undefined) post.caption = caption;
    if (location !== undefined) post.location = location;
    if (privacy !== undefined) post.privacy = privacy;
    
    if (tags !== undefined) {
      post.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    await post.save();
    await post.populate('author', 'username firstName lastName profilePicture');

    res.json({
      success: true,
      message: 'Post updated successfully',
      post
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete post
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user owns the post
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    // Delete associated media file
    if (post.media.filename) {
      const filePath = path.join(__dirname, '../uploads', post.media.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Post.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/unlike post
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const userId = req.user._id;
    const isLiked = post.isLikedBy(userId);

    if (isLiked) {
      post.removeLike(userId);
    } else {
      post.addLike(userId);
    }

    await post.save();

    res.json({
      success: true,
      message: isLiked ? 'Post unliked' : 'Post liked',
      isLiked: !isLiked,
      likeCount: post.likeCount
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/posts/:id/comments
// @desc    Add comment to post
// @access  Private
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const newComment = {
      user: req.user._id,
      content: content.trim()
    };

    post.comments.push(newComment);
    await post.save();

    const user = await User.findById(newComment.user).select('username firstName lastName profilePicture');
    const commentWithUser = {
      ...newComment.toObject(),
      user
    };
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: commentWithUser
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/posts/:postId/comments/:commentId
// @desc    Delete comment
// @access  Private
router.delete('/:postId/comments/:commentId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const comment = post.comments.id(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user owns the comment or the post
    if (comment.user.toString() !== req.user._id.toString() && 
        post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment'
      });
    }

    comment.deleteOne();
    await post.save();

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/posts/user/:userId
// @desc    Get posts by specific user
// @access  Private
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get posts by the specified user
    const posts = await Post.find({ 
      author: userId,
      privacy: { $in: ['public', 'friends'] } // Only show public and friends posts
    })
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.user', 'username firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      posts,
      page,
      totalPosts: posts.length,
      hasMore: posts.length === limit
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 