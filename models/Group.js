const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['member', 'moderator'],
      default: 'member'
    }
  }],
  joinRequests: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    message: {
      type: String,
      maxlength: [200, 'Request message cannot exceed 200 characters'],
      default: ''
    }
  }],
  privacy: {
    type: String,
    enum: ['public', 'private', 'closed'],
    default: 'public'
  },
  category: {
    type: String,
    enum: ['technology', 'sports', 'music', 'art', 'education', 'business', 'gaming', 'other'],
    default: 'other'
  },
  rules: [{
    type: String,
    maxlength: [200, 'Rule cannot exceed 200 characters']
  }],
  coverImage: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for join request count
groupSchema.virtual('joinRequestCount').get(function() {
  return this.joinRequests.length;
});

// Method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  return this.admins.includes(userId) || this.creator.equals(userId);
};

// Method to check if user is member
groupSchema.methods.isMember = function(userId) {
  return this.members.some(member => member.user.equals(userId));
};

// Method to check if user has join request pending
groupSchema.methods.hasJoinRequest = function(userId) {
  return this.joinRequests.some(request => request.user.equals(userId));
};

// Method to add member
groupSchema.methods.addMember = function(userId, role = 'member') {
  if (!this.isMember(userId)) {
    this.members.push({
      user: userId,
      role: role
    });
    // Remove from join requests if exists
    this.joinRequests = this.joinRequests.filter(req => !req.user.equals(userId));
  }
};

// Method to remove member
groupSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(member => !member.user.equals(userId));
};

// Method to add join request
groupSchema.methods.addJoinRequest = function(userId, message = '') {
  if (!this.isMember(userId) && !this.hasJoinRequest(userId)) {
    this.joinRequests.push({
      user: userId,
      message: message
    });
  }
};

// Method to reject join request
groupSchema.methods.rejectJoinRequest = function(userId) {
  this.joinRequests = this.joinRequests.filter(req => !req.user.equals(userId));
};

// Ensure virtuals are included in JSON
groupSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Group', groupSchema); 