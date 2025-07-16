const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register a new user
exports.register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'User with this email already exists' 
          : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({ username, email, password, firstName, lastName });
    await user.save();

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
    // Only log errors, not sensitive data
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// Login user
exports.login = async (req, res) => {
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
};

// Get current user info (for /me endpoint)
exports.getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get user by ID (for profile viewing)
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password').lean();
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
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    });
  }
};

// (Optional) Get all users (for chat/friends list)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('firstName lastName username profilePicture')
      .sort({ firstName: 1 });
    res.json({
      success: true,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update user profile picture
exports.updateProfilePicture = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const User = require('../models/User');
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
};

// Update user bio
exports.updateBio = async (req, res) => {
  const User = require('../models/User');
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
    res.status(500).json({
      success: false,
      message: 'Error updating bio',
      error: error.message
    });
  }
};
