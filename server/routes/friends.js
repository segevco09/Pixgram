const express = require('express');
const auth = require('../middleware/auth');
const friendsController = require('../controllers/friendsController');

const router = express.Router();

// Get user's friends list and friend requests
router.get('/', auth, friendsController.getFriends);

// Send a friend request
router.post('/request/:userId', auth, friendsController.sendRequest);

// Accept a friend request
router.post('/accept/:userId', auth, friendsController.acceptRequest);

// Reject a friend request
router.post('/reject/:userId', auth, friendsController.rejectRequest);

// Remove a friend
router.delete('/:userId', auth, friendsController.removeFriend);

// Search for users to add as friends
router.get('/search', auth, friendsController.searchUsers);

// Get follower/following stats for a specific user
router.get('/stats/:userId', auth, friendsController.getStatsById);

// Get follower/following stats for current user
router.get('/stats', auth, friendsController.getStats);

module.exports = router; 