import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Groups.css';

const Groups = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    category: 'all',
    privacy: 'all'
  });
  const [isMember, setIsMember] = useState(false);
  const [groupPosts, setGroupPosts] = useState([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    fetchGroups();
  }, [searchFilters]);

  const fetchGroups = async () => {
    try {
      const params = new URLSearchParams();
      if (searchFilters.search) params.append('search', searchFilters.search);
      if (searchFilters.category !== 'all') params.append('category', searchFilters.category);
      if (searchFilters.privacy !== 'all') params.append('privacy', searchFilters.privacy);

      const response = await axios.get(`/api/groups?${params.toString()}`);
      if (response.data.success) {
        setGroups(response.data.groups);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleGroupClick = async (groupId, isMemberLocal) => {
    setIsMember(isMemberLocal); // Set immediately!
    setGroupPosts([]);
    setSelectedGroup(null);

    // Fetch group details
    const groupRes = await axios.get(`/api/groups/${groupId}`);
    const group = groupRes.data.group;
    setSelectedGroup(group);

    // Optionally, you can still verify membership with the API in the background
    // but for instant UI, use the local value

    // Only fetch posts if member
    if (isMemberLocal) {
      const postsRes = await axios.get(`/api/groups/${groupId}/posts`, { withCredentials: true });
      const posts = postsRes.data.posts;
      setGroupPosts(posts);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    // Add your logic to post the comment to the backend here
    // Example:
    // await axios.post(`/api/groups/${groupId}/posts/${postId}/comments`, { content: commentText });
    setCommentText('');
    // Optionally refresh comments here
  };

  return (
    <div className="groups-container">
      <div className="groups-header">
        <h2>Groups</h2>
        <button 
          className="create-group-btn"
          onClick={() => setShowCreateModal(true)}
        >
          Create Group
        </button>
      </div>

      {/* Advanced Search */}
      <div className="search-section">
        <div className="search-filters">
          <input
            type="text"
            placeholder="Search groups by name or description..."
            value={searchFilters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
          
          <select
            value={searchFilters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            <option value="technology">Technology</option>
            <option value="sports">Sports</option>
            <option value="music">Music</option>
            <option value="art">Art</option>
            <option value="education">Education</option>
            <option value="business">Business</option>
            <option value="gaming">Gaming</option>
            <option value="other">Other</option>
          </select>

          <select
            value={searchFilters.privacy}
            onChange={(e) => handleFilterChange('privacy', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Privacy Types</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="groups-grid">
        {groups.map(group => {
          const isMember = group.members?.some(
            m => (m.user?._id || m.user) === user._id
          );
          return (
            <GroupCard 
              key={group._id} 
              group={group} 
              currentUser={user}
              onGroupUpdate={fetchGroups}
              onViewGroup={() => handleGroupClick(group._id, isMember)}
            />
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="no-groups">
          <p>No groups found matching your criteria.</p>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal 
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={fetchGroups}
        />
      )}

      {/* Group Detail Modal */}
      {selectedGroup && (
        <GroupDetailModal 
          group={selectedGroup}
          currentUser={user}
          isMember={isMember}
          onClose={() => setSelectedGroup(null)}
          onGroupUpdate={fetchGroups}
        />
      )}
    </div>
  );
};

const GroupCard = ({ group, currentUser, onGroupUpdate, onViewGroup }) => {
  const [isLoading, setIsLoading] = useState(false);

  const isMember = group.members?.some(
    m => (m.user?._id || m.user) === currentUser._id
  );
  
  const isAdmin = group.admins?.includes(currentUser._id) || 
                  group.creator._id === currentUser._id;

  const handleJoinGroup = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post(`/api/groups/${group._id}/join`);
      if (response.data.success) {
        alert(response.data.message);
        onGroupUpdate();
      }
    } catch (error) {
      alert('Error joining group: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (window.confirm('Are you sure you want to leave this group?')) {
      setIsLoading(true);
      try {
        const response = await axios.post(`/api/groups/${group._id}/leave`);
        if (response.data.success) {
          alert(response.data.message);
          onGroupUpdate();
        }
      } catch (error) {
        alert('Error leaving group: ' + (error.response?.data?.message || error.message));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getPrivacyIcon = () => {
    switch (group.privacy) {
      case 'public': return '🌍';
      case 'private': return '🔒';
      case 'closed': return '🚫';
      default: return '🌍';
    }
  };

  return (
    <div className="group-card">
      <div className="group-card-header">
        <h3 className="group-name" style={{ color: '#fff' }}>{group.name}</h3>
        <div className="group-privacy">
          {getPrivacyIcon()} {group.privacy}
        </div>
      </div>

      <div className="group-meta">
        <span className="group-category">{group.category}</span>
        <span className="group-members">{group.memberCount || 0} members</span>
      </div>

      {group.description && (
        <p className="group-description">{group.description}</p>
      )}

      <div className="group-creator">
        Created by {group.creator.firstName} {group.creator.lastName}
      </div>

      <div className="group-actions">
        <button 
          className="view-group-btn"
          onClick={onViewGroup}
        >
          View Details
        </button>

        {!isMember ? (
          <button 
            className="join-group-btn"
            onClick={handleJoinGroup}
            disabled={isLoading}
          >
            {isLoading ? 'Joining...' : 'Join Group'}
          </button>
        ) : (
          <button 
            className="leave-group-btn"
            onClick={handleLeaveGroup}
            disabled={isLoading || group.creator._id === currentUser._id}
          >
            {isLoading ? 'Leaving...' : 'Leave Group'}
          </button>
        )}
      </div>
    </div>
  );
};

const CreateGroupModal = ({ onClose, onGroupCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    category: 'other'
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Group name is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('/api/groups', formData);
      if (response.data.success) {
        alert('Group created successfully!');
        onGroupCreated();
        onClose();
      }
    } catch (error) {
      alert('Error creating group: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Group</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Group Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter group name"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe your group..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              <option value="technology">Technology</option>
              <option value="sports">Sports</option>
              <option value="music">Music</option>
              <option value="art">Art</option>
              <option value="education">Education</option>
              <option value="business">Business</option>
              <option value="gaming">Gaming</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Privacy</label>
            <select
              value={formData.privacy}
              onChange={(e) => handleChange('privacy', e.target.value)}
            >
              <option value="public">Public - Anyone can join</option>
              <option value="private">Private - Requires approval</option>
              <option value="closed">Closed - Invite only</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const GroupDetailModal = ({ group, currentUser, isMember, onClose, onGroupUpdate }) => {
  console.log('GroupDetailModal isMember:', isMember);
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [groupPosts, setGroupPosts] = useState([]);
  const [posting, setPosting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: group.name,
    description: group.description,
    privacy: group.privacy,
    category: group.category
  });

  const isAdmin = group.admins?.includes(currentUser._id) || group.creator._id === currentUser._id;
  const isCreator = group.creator._id === currentUser._id;

  useEffect(() => {
    // This useEffect is removed as per the edit hint.
    // fetchGroupPosts(); 
  }, [group._id]);

  const fetchGroupPosts = async () => {
    try {
      const response = await axios.get(`/api/groups/${group._id}/posts`);
      if (response.data.success) setGroupPosts(response.data.posts);
    } catch (error) {
      console.error('Error fetching group posts:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview({
          url: e.target.result,
          type: file.type.startsWith('image/') ? 'image' : 'video'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !selectedFile) {
      alert('Please add a caption or select a file to share');
      return;
    }
    setPosting(true);
    const formData = new FormData();
    formData.append('caption', caption);
    if (selectedFile) formData.append('media', selectedFile);

    try {
      const response = await axios.post(`/api/groups/${group._id}/posts`, formData);
      if (response.data.success) {
        setGroupPosts([response.data.post, ...groupPosts]);
        setCaption('');
        setSelectedFile(null);
        setFilePreview(null);
        alert('Post shared successfully!');
      } else {
        alert('Failed to share post: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creating group post:', error);
      alert('Error sharing post: ' + (error.response?.data?.message || error.message));
    } finally {
      setPosting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put(`/api/groups/${group._id}`, editData);
      if (response.data.success) {
        alert('Group updated successfully!');
        onGroupUpdate();
        setIsEditing(false);
      }
    } catch (error) {
      alert('Error updating group: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      try {
        const response = await axios.delete(`/api/groups/${group._id}`);
        if (response.data.success) {
          alert('Group deleted successfully!');
          onGroupUpdate();
          onClose();
        }
      } catch (error) {
        alert('Error deleting group: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{group.name}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="group-detail-content">
          {!isEditing ? (
            <div className="group-info">
              <div className="group-stats">
                <div className="stat-item">
                  <span className="stat-label">Members:</span>
                  <span className="stat-value">{group.memberCount || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Category:</span>
                  <span className="stat-value">{group.category}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Privacy:</span>
                  <span className="stat-value">{group.privacy}</span>
                </div>
              </div>
              {group.description && (
                <div className="group-description-full">
                  <h4>Description</h4>
                  <p>{group.description}</p>
                </div>
              )}
              <div className="group-creator-info">
                <h4>Creator</h4>
                <p>{group.creator.firstName} {group.creator.lastName}</p>
              </div>
              {isAdmin && (
                <div className="admin-actions">
                  <button onClick={() => setIsEditing(true)}>Edit Group</button>
                  {isCreator && (
                    <button className="delete-btn" onClick={handleDelete}>
                      Delete Group
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="edit-form">
              {/* ...edit form fields as before... */}
            </form>
          )}

          {isMember ? (
            <>
              {/* Post form */}
              <form onSubmit={handlePostSubmit} className="group-post-form">
                <textarea
                  placeholder="What's happening in this group?"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows="3"
                  disabled={posting}
                />
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,video/*"
                  disabled={posting}
                />
                {filePreview && (
                  <div className="file-preview">
                    {filePreview.type === 'image' ? (
                      <img src={filePreview.url} alt="Preview" />
                    ) : (
                      <video src={filePreview.url} controls />
                    )}
                  </div>
                )}
                <button type="submit" disabled={posting}>
                  {posting ? 'Posting...' : 'Share Post'}
                </button>
              </form>

              {/* Feed */}
              <div className="group-posts-feed">
                {groupPosts.length === 0 ? (
                  <p>No posts in this group yet.</p>
                ) : (
                  groupPosts.map(post => (
                    <div key={post._id} className="group-post-card">
                      <h4>{post.author?.username}</h4>
                      <p className="feed-post-caption">{post.caption}</p>
                      {post.media?.url && (
                        post.media.type === 'image' ? (
                          <img src={post.media.url} alt="Group Post" />
                        ) : (
                          <video src={post.media.url} controls />
                        )
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="not-member-message">
              <p>You must join this group to see and post content.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Groups;