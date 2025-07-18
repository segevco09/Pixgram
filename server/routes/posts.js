const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const postsController = require('../controllers/postsController');

const router = express.Router();

router.get('/test', postsController.testPosts);

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
  limits: {
    fileSize: 50 * 1024 * 1024 
  }
});

router.get('/', auth, postsController.getPosts);

router.post('/', auth, upload.single('media'), postsController.createPost);

router.put('/:id', auth, postsController.updatePost);

router.delete('/:id', auth, postsController.deletePost);

router.post('/:id/like', auth, postsController.toggleLike);

router.post('/:id/comments', auth, postsController.addComment);

router.delete('/:postId/comments/:commentId', auth, postsController.deleteComment);

router.get('/user/:userId', auth, postsController.getUserPosts);

router.get('/:id', auth, postsController.getPostById);

module.exports = router; 