const Post = require('../models/Post');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Test endpoint
exports.testPosts = (req, res) => {
  res.json({ 
    message: 'Posts routes working!', 
    timestamp: new Date() 
  });
};

// Get posts for feed (user's posts + friends' posts)
exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

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
};

// Create a new post
exports.createPost = async (req, res) => {
  try {
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
};

// Update post
exports.updatePost = async (req, res) => {
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
};

// Delete post
exports.deletePost = async (req, res) => {
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
};

// Like/unlike post
exports.toggleLike = async (req, res) => {
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
};

// Add comment to post
exports.addComment = async (req, res) => {
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

    // Get the last comment (the one just added)
    const savedComment = post.comments[post.comments.length - 1];
    const user = await User.findById(savedComment.user).select('username firstName lastName profilePicture');
    const commentWithUser = {
      ...savedComment.toObject(),
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
};

// Delete comment
exports.deleteComment = async (req, res) => {
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
};

// Get posts by specific user
exports.getUserPosts = async (req, res) => {
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
};

// Get a single post by ID
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.user', 'username firstName lastName profilePicture');
      
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }
    
    res.json({ 
      success: true, 
      post 
    });
  } catch (error) {
    console.error('Get post by ID error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
