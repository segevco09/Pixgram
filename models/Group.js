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
  // Fix: Check if this.members is an array before accessing .length
  // This prevents errors if the members field is missing or undefined
  return Array.isArray(this.members) ? this.members.length : 0;
});

// Virtual for join request count
groupSchema.virtual('joinRequestCount').get(function() {
  // Fix: Check if this.joinRequests is an array before accessing .length
  // This prevents errors if the joinRequests field is missing or undefined
  return Array.isArray(this.joinRequests) ? this.joinRequests.length : 0;
});

// Method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  const userIdString = userId.toString();
  // Fix: Ensure this.admins is an array
  if (!Array.isArray(this.admins)) {
    this.admins = [];
  }
  return this.admins.some(admin => admin.toString() === userIdString) || 
         this.creator.toString() === userIdString;
};

// Method to check if user is member
groupSchema.methods.isMember = function(userId) {
  const userIdString = userId.toString();
  // Fix: Check if this.members is an array before using .some()
  if (!Array.isArray(this.members)) {
    return false;
  }
  return this.members.some(member => member.user.toString() === userIdString);
};

// Method to check if user has join request pending
groupSchema.methods.hasJoinRequest = function(userId) {
  const userIdString = userId.toString();
  // Fix: Check if this.joinRequests is an array before using .some()
  if (!Array.isArray(this.joinRequests)) {
    return false;
  }
  return this.joinRequests.some(request => request.user.toString() === userIdString);
};

// Method to add member
groupSchema.methods.addMember = function(userId, role = 'member') {
  const userIdString = userId.toString();
  // Fix: Ensure this.members is an array
  if (!Array.isArray(this.members)) {
    this.members = [];
  }
  // Fix: Ensure this.joinRequests is an array
  if (!Array.isArray(this.joinRequests)) {
    this.joinRequests = [];
  }
  
  if (!this.isMember(userId)) {
    this.members.push({
      user: userId,
      role: role
    });
    // Remove from join requests if exists
    this.joinRequests = this.joinRequests.filter(req => req.user.toString() !== userIdString);
  }
};

// Method to remove member
groupSchema.methods.removeMember = function(userId) {
  const userIdString = userId.toString();
  // Fix: Ensure this.members is an array
  if (!Array.isArray(this.members)) {
    this.members = [];
    return;
  }
  this.members = this.members.filter(member => member.user.toString() !== userIdString);
};

// Method to add join request
groupSchema.methods.addJoinRequest = function(userId, message = '') {
  const userIdString = userId.toString();
  // Fix: Ensure this.joinRequests is an array
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

// Method to reject join request
groupSchema.methods.rejectJoinRequest = function(userId) {
  const userIdString = userId.toString();
  // Fix: Ensure this.joinRequests is an array
  if (!Array.isArray(this.joinRequests)) {
    this.joinRequests = [];
    return;
  }
  this.joinRequests = this.joinRequests.filter(req => req.user.toString() !== userIdString);
};

// Ensure virtuals are included in JSON
groupSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Group', groupSchema); 