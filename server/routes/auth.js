const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');

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
router.post('/register', authController.register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authController.login);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, authController.getMe);

// @route   GET /api/auth/user/:userId
// @desc    Get user by ID for profile viewing
// @access  Private
router.get('/user/:userId', auth, authController.getUserById);

// @route   GET /api/auth/users
// @desc    Get all users for chat
// @access  Private
router.get('/users', auth, authController.getAllUsers);

module.exports = router; 