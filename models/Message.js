const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient querying
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });

// Method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to get conversation between two users
messageSchema.statics.getConversation = function(userId1, userId2, limit = 50, skip = 0) {
  return this.find({
    $or: [
      { sender: userId1, receiver: userId2 },
      { sender: userId2, receiver: userId1 }
    ],
    isDeleted: false
  })
  .populate('sender', 'firstName lastName username profilePicture')
  .populate('receiver', 'firstName lastName username profilePicture')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip);
};

// Static method to get unread message count
messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false,
    isDeleted: false
  });
};

// Static method to mark all messages in conversation as read
messageSchema.statics.markConversationAsRead = function(senderId, receiverId) {
  return this.updateMany(
    {
      sender: senderId,
      receiver: receiverId,
      isRead: false,
      isDeleted: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

module.exports = mongoose.model('Message', messageSchema); 