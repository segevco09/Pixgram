const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/create-users', async (req, res) => {
  try {
    const testUsers = [
      {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      },
      {
        username: 'janedoe',
        email: 'jane@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe'
      },
      {
        username: 'bobsmith',
        email: 'bob@example.com',
        password: 'password123',
        firstName: 'Bob',
        lastName: 'Smith'
      },
      {
        username: 'alicejones',
        email: 'alice@example.com',
        password: 'password123',
        firstName: 'Alice',
        lastName: 'Jones'
      },
      {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      }
    ];

    const existingUsers = await User.find({
      email: { $in: testUsers.map(u => u.email) }
    });

    if (existingUsers.length > 0) {
      return res.json({
        success: true,
        message: 'Test users already exist',
        existingCount: existingUsers.length
      });
    }

    const createdUsers = await User.insertMany(testUsers);

    res.json({
      success: true,
      message: 'Test users created successfully',
      users: createdUsers.map(u => ({
        id: u._id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName
      }))
    });
  } catch (error) {
    console.error('Create test users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

router.get('/users', async (req, res) => {
  try {
    console.log('📋 Getting all users for chat...');
    
    const users = await User.find({}, 'firstName lastName name username email createdAt')
      .select('username firstName lastName name email createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    console.log(`👥 Found ${users.length} users`);

    res.json({
      success: true,
      count: users.length,
      users,
      total: users.length
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router; 