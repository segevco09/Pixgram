const Group = require('../models/Group');
const Post = require('../models/Post');

// Get all groups with search/filter
exports.getGroups = async (req, res) => {
  try {
    const { search, category, privacy } = req.query;
    let query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category && category !== 'all') query.category = category;
    if (privacy && privacy !== 'all') query.privacy = privacy;
    const groups = await Group.find(query)
      .populate('creator', 'username firstName lastName')
      .populate('members.user', 'username firstName lastName _id')
      .sort({ createdAt: -1 });

    const userId = req.user._id.toString();
    const groupsWithMembership = groups.map(group => {
      const isMember = group.members.some(m => {
        if (typeof m.user === 'object' && m.user._id) {
          return m.user._id.toString() === userId;
        }
        return m.user.toString() === userId;
      });
      const groupObj = group.toObject({ virtuals: true });
      groupObj.isMember = isMember;
      return groupObj;
    });

    res.json({ success: true, groups: groupsWithMembership });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get single group (with access control)
exports.getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'username firstName lastName profilePicture')
      .populate('admins', 'username firstName lastName profilePicture')
      .populate('members.user', 'username firstName lastName profilePicture')
      .populate('joinRequests.user', 'username firstName lastName profilePicture');
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    const userId = req.user._id;
    const canView = group.privacy === 'public' || group.isMember(userId) || group.isAdmin(userId);
    if (!canView) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create new group
exports.createGroup = async (req, res) => {
  try {
    const { name, description, privacy, category } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    const group = new Group({
      name: name.trim(),
      description: description?.trim() || '',
      creator: req.user._id,
      admins: [req.user._id],
      privacy: privacy || 'public',
      category: category || 'other'
    });
    group.addMember(req.user._id, 'member');
    await group.save();
    await group.populate('creator', 'username firstName lastName');
    res.status(201).json({ success: true, message: 'Group created successfully', group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update group (admin only)
exports.updateGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only group admins can edit this group' });
    }
    const { name, description, privacy, category } = req.body;
    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (privacy !== undefined) group.privacy = privacy;
    if (category !== undefined) group.category = category;
    await group.save();
    res.json({ success: true, message: 'Group updated successfully', group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete group (creator only)
exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (!group.creator.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the group creator can delete this group' });
    }
    group.isActive = false;
    await group.save();
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Join a group (public or private)
exports.joinGroup = async (req, res) => {
  try {
    const { message } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const userId = req.user._id;
    if (group.isMember(userId)) {
      return res.status(400).json({ success: false, message: 'You are already a member of this group' });
    }
    if (group.hasJoinRequest(userId)) {
      return res.status(400).json({ success: false, message: 'You already have a pending join request' });
    }
    if (group.privacy === 'public') {
      group.addMember(userId);
      await group.save();
      res.json({ success: true, message: 'Successfully joined the group' });
    } else {
      group.addJoinRequest(userId, message || '');
      await group.save();
      res.json({ success: true, message: 'Join request sent successfully' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Leave a group
exports.leaveGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const userId = req.user._id;
    if (!group.isMember(userId)) {
      return res.status(400).json({ success: false, message: 'You are not a member of this group' });
    }
    if (group.creator.equals(userId)) {
      return res.status(400).json({ success: false, message: 'Group creator cannot leave the group' });
    }
    group.removeMember(userId);
    group.admins = group.admins.filter(admin => !admin.equals(userId));
    await group.save();
    res.json({ success: true, message: 'Successfully left the group' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Approve join request (admin only)
exports.approveJoinRequest = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only group admins can approve join requests' });
    }
    const userId = req.params.userId;
    if (!group.hasJoinRequest(userId)) {
      return res.status(400).json({ success: false, message: 'No pending join request found' });
    }
    group.addMember(userId);
    await group.save();
    res.json({ success: true, message: 'Join request approved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reject join request (admin only)
exports.rejectJoinRequest = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only group admins can reject join requests' });
    }
    group.rejectJoinRequest(req.params.userId);
    await group.save();
    res.json({ success: true, message: 'Join request rejected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get group posts (members only, paginated)
exports.getGroupPosts = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    const userId = req.user._id;
    if (!group.isMember(userId)) {
      return res.status(403).json({ success: false, message: 'You must be a member of this group to view posts' });
    }
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const posts = await Post.find({ group: req.params.id, privacy: { $in: ['public', 'friends'] } })
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.user', 'username firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit));
    res.json({
      success: true,
      posts,
      hasMore: posts.length === Number(limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create a post in a group
exports.createGroupPost = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const isMember = group.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You must be a member of this group to post' });
    }
    const { caption } = req.body;
    const postData = {
      author: req.user.id,
      caption: caption || '',
      group: groupId
    };
    if (req.file) {
      postData.media = {
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'video',
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename
      };
    }
    const post = new Post(postData);
    await post.save();
    const populatedPost = await Post.findById(post._id)
      .populate('author', 'username firstName lastName profilePicture')
      .populate('group', 'name');
    res.status(201).json({ success: true, post: populatedPost.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create group post', error: error.message });
  }
};

// Check if user is a member of a group
exports.isMember = async (req, res) => {
  const group = await Group.findById(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const isMember = group.members.some(m => m.user.toString() === req.user.id.toString());
  res.json({ member: isMember });
};
