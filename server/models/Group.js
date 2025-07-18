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
    enum: ['public', 'private'],
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

groupSchema.virtual('memberCount').get(function() {
  return Array.isArray(this.members) ? this.members.length : 0;
});

groupSchema.virtual('joinRequestCount').get(function() {
  return Array.isArray(this.joinRequests) ? this.joinRequests.length : 0;
});

groupSchema.methods.isAdmin = function(userId) {
  const userIdString = userId.toString();
  if (!Array.isArray(this.admins)) {
    this.admins = [];
  }
  return this.admins.some(admin => admin.toString() === userIdString) || 
         this.creator.toString() === userIdString;
};

groupSchema.methods.isMember = function(userId) {
  const userIdString = userId.toString();
  if (!Array.isArray(this.members)) {
    return false;
  }
  return this.members.some(member => {
    if (typeof member.user === 'object' && member.user._id) {
      return member.user._id.toString() === userIdString;
    }
    return member.user.toString() === userIdString;
  });
};

groupSchema.methods.hasJoinRequest = function(userId) {
  const userIdString = userId.toString();
  if (!Array.isArray(this.joinRequests)) {
    return false;
  }
  return this.joinRequests.some(request => request.user.toString() === userIdString);
};

groupSchema.methods.addMember = function(userId, role = 'member') {
  const userIdString = userId.toString();
  if (!Array.isArray(this.members)) {
    this.members = [];
  }
  if (!Array.isArray(this.joinRequests)) {
    this.joinRequests = [];
  }
  
  if (!this.isMember(userId)) {
    this.members.push({
      user: userId,
      role: role
    });
    this.joinRequests = this.joinRequests.filter(req => req.user.toString() !== userIdString);
  }
};

groupSchema.methods.removeMember = function(userId) {
  const userIdString = userId.toString();
  if (!Array.isArray(this.members)) {
    this.members = [];
    return;
  }
  this.members = this.members.filter(member => member.user.toString() !== userIdString);
};

groupSchema.methods.addJoinRequest = function(userId, message = '') {
  const userIdString = userId.toString();
  if (!Array.isArray(this.joinRequests)) {
    this.joinRequests = [];
  }
  if (!this.isMember(userId) && !this.hasJoinRequest(userId)) {
    this.joinRequests.push({
      user: userId,
      message: message
    });
  }
};

groupSchema.methods.rejectJoinRequest = function(userId) {
  const userIdString = userId.toString();
  if (!Array.isArray(this.joinRequests)) {
    this.joinRequests = [];
    return;
  }
  this.joinRequests = this.joinRequests.filter(req => req.user.toString() !== userIdString);
};

groupSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Group', groupSchema); 