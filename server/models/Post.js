const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    maxlength: [2000, 'Caption cannot exceed 2000 characters'],
    default: ''
  },
  media: {
    type: {
      type: String,
      enum: ['image', 'video', 'none'],
      default: 'none'
    },
    url: {
      type: String,
      default: ''
    },
    filename: {
      type: String,
      default: ''
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  location: {
    type: String,
    maxlength: [100, 'Location cannot exceed 100 characters'],
    default: ''
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    editedAt: Date,
    oldCaption: String,
    oldTags: [String]
  }],
  privacy: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  group: {
    type: mongoose.Schema.Types.ObjectId, // This means the value is an ID from another collection
    ref: 'Group',                        // This tells Mongoose this ID refers to a Group document
    default: null                        // If the post is not for a group, this will be null
  }
}, { timestamps: true });

// Virtual for like count
postSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
postSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Method to check if user liked the post
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.includes(userId);
};

// Method to add like
postSchema.methods.addLike = function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push(userId);
  }
};

// Method to remove like
postSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(id => !id.equals(userId));
};

// Ensure virtuals are included in JSON
postSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Post', postSchema); 