const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const groupController = require('../controllers/groupsController');

const router = express.Router();

// Multer config for file uploads
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
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'), false);
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Group routes using controller functions
router.get('/', auth, groupController.getGroups);
router.get('/:id', auth, groupController.getGroup);
router.post('/', auth, groupController.createGroup);
router.put('/:id', auth, groupController.updateGroup);
router.delete('/:id', auth, groupController.deleteGroup);

// Join/leave/approve/reject group membership
router.post('/:id/join', auth, groupController.joinGroup);
router.post('/:id/leave', auth, groupController.leaveGroup);
router.post('/:id/approve/:userId', auth, groupController.approveJoinRequest);
router.post('/:id/reject/:userId', auth, groupController.rejectJoinRequest);

// Group posts (members only, paginated)
router.get('/:id/posts', auth, groupController.getGroupPosts);
router.post('/:groupId/posts', auth, upload.single('media'), groupController.createGroupPost);

// Group membership check
router.get('/:groupId/isMember', auth, groupController.isMember);

module.exports = router; 