const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

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

// @route   GET /api/auth/users
// @desc    Get all users for chat
// @access  Private
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find({}, 'firstName lastName username')
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

module.exports = router; 