const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Multer configuration for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/profiles');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt received:', { username: req.body.username, email: req.body.email });
    const { username, email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'User with this email already exists' 
          : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName
    });

    await user.save();
    
    // Debug: Log database connection details
    console.log('✅ User saved successfully:', user.username);
    console.log('🎯 Database name:', user.db.name);
    console.log('🏠 Collection name:', user.collection.name);
    console.log('🌐 Connection host:', user.db.host);
    console.log('📍 Full user ID:', user._id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/auth/debug
// @desc    Debug database connection and users
// @access  Public (for debugging only)
router.get('/debug', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Get all users
    const users = await User.find({}).select('username email createdAt');
    
    // Database connection info
    const dbInfo = {
      databaseName: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      readyState: mongoose.connection.readyState,
      collections: Object.keys(mongoose.connection.collections)
    };
    
    res.json({
      success: true,
      database: dbInfo,
      totalUsers: users.length,
      users: users.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
});

// @route   GET /api/auth/fix-users
// @desc    Fix existing users without createdAt field
// @access  Public (for debugging only)
router.get('/fix-users', async (req, res) => {
  try {
    // Find users without createdAt field
    const usersWithoutCreatedAt = await User.find({ createdAt: { $exists: false } });
    
    if (usersWithoutCreatedAt.length === 0) {
      return res.json({
        success: true,
        message: 'All users already have createdAt field',
        usersUpdated: 0
      });
    }

    // Update users to add createdAt field with their _id creation time
    const updatePromises = usersWithoutCreatedAt.map(user => {
      // Extract timestamp from MongoDB ObjectId
      const createdAtFromId = user._id.getTimestamp();
      return User.findByIdAndUpdate(user._id, { 
        createdAt: createdAtFromId,
        updatedAt: new Date()
      });
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Users updated successfully',
      usersUpdated: usersWithoutCreatedAt.length,
      updatedUsers: usersWithoutCreatedAt.map(user => ({
        username: user.username,
        email: user.email,
        originalId: user._id,
        newCreatedAt: user._id.getTimestamp()
      }))
    });

  } catch (error) {
    console.error('Fix users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing users',
      error: error.message
    });
  }
});

// @route   GET /api/auth/user/:userId
// @desc    Get user by ID for profile viewing
// @access  Private
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('=== GET /api/auth/user/:userId DEBUG ===');
    console.log('Requested userId:', userId);
    console.log('userId type:', typeof userId);
    console.log('userId length:', userId.length);
    console.log('Current user making request:', req.user.id);

    const user = await User.findById(userId)
      .select('-password')
      .lean();

    console.log('Database query result:', user ? 'User found' : 'User not found');
    if (user) {
      console.log('Found user:', { id: user._id, username: user.username, firstName: user.firstName, lastName: user.lastName });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    console.log('Error details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users for chat
// @access  Private
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('firstName lastName username profilePicture')
      .sort({ firstName: 1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/profile-picture
// @desc    Update user profile picture
// @access  Private
router.put('/profile-picture', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Delete old profile picture if it exists
    const user = await User.findById(req.user.id);
    if (user.profilePicture) {
      const oldImagePath = path.join(__dirname, '../uploads/profiles', path.basename(user.profilePicture));
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Update user with new profile picture URL
    const profilePictureUrl = `/uploads/profiles/${req.file.filename}`;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: profilePictureUrl },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile picture update error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error updating profile picture',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/bio
// @desc    Update user bio
// @access  Private
router.put('/bio', auth, async (req, res) => {
  try {
    const { bio } = req.body;

    // Validate bio length
    if (bio && bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Bio cannot exceed 500 characters'
      });
    }

    // Update user bio
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { bio: bio || '' },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Bio updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Bio update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating bio',
      error: error.message
    });
  }
});

module.exports = router; 