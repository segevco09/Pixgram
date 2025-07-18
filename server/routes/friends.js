const express = require('express');
const auth = require('../middleware/auth');
const friendsController = require('../controllers/friendsController');

const router = express.Router();

router.get('/', auth, friendsController.getFriends);

router.post('/request/:userId', auth, friendsController.sendRequest);

router.post('/accept/:userId', auth, friendsController.acceptRequest);


router.post('/reject/:userId', auth, friendsController.rejectRequest);

router.delete('/:userId', auth, friendsController.removeFriend);

router.get('/search', auth, friendsController.searchUsers);

router.get('/stats/:userId', auth, friendsController.getStatsById);

router.get('/stats', auth, friendsController.getStats);

module.exports = router; 