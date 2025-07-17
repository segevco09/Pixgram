import React, { useState, useEffect, useCallback } from 'react';
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
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState('groups'); // 'groups', 'requests', 'search'

  // Best practice: useCallback for fetchGroups
  const fetchGroups = useCallback(async () => {
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
  }, [searchFilters]);

  useEffect(() => {
    fetchGroups();
  }, [searchFilters, fetchGroups]);

  const handleFilterChange = (key, value) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
  };

  // Remove unused groupPosts, handleComment
  const handleGroupClick = async (groupId, isMemberLocal) => {
    setSelectedGroup(null);
    try {
      const groupRes = await axios.get(`/api/groups/${groupId}`);
      const group = groupRes.data.group;
      setSelectedGroup(group);
    } catch (error) {
      if (error.response && error.response.status === 403) {
        alert('You do not have permission to view this group. Join the group to see its details.');
      } else {
        alert('Error loading group details.');
      }
    }
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

      <div className="groups-tabs">
        <button
          className={activeTab === 'groups' ? 'active' : ''}
          onClick={() => setActiveTab('groups')}
        >
          Groups
        </button>
        <button
          className={activeTab === 'requests' ? 'active' : ''}
          onClick={() => setActiveTab('requests')}
        >
          Requests
        </button>
      </div>

      {activeTab === 'groups' && (
        <div>
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
              </select>
            </div>
          </div>

          {/* Groups Grid */}
          <div className="groups-grid">
            {groups.map(group => (
                <GroupCard 
                  key={group._id} 
                  group={group} 
                  currentUser={user}
                isMember={group.isMember} // pass as prop
                  onGroupUpdate={fetchGroups}
                onViewGroup={() => handleGroupClick(group._id, group.isMember)}
                />
            ))}
          </div>

          {groups.length === 0 && (
            <div className="no-groups">
              <p>No groups found matching your criteria.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div>
          {/* Render join requests for groups the user created */}
          {groups
            .filter(group => String(group.creator._id) === String(user._id || user.id))
            .map(group => (
              <div key={group._id} className="group-requests-section">
                <h4>{group.name} – Join Requests</h4>
                {group.joinRequests && group.joinRequests.length > 0 ? (
                  <ul className="group-requests-list">
                    {group.joinRequests.map(req => (
                      <li key={req.user._id}>
                        <span>
                          {req.user && typeof req.user === 'object'
                            ? `${req.user.firstName} ${req.user.lastName} (${req.user.username})`
                            : req.user}
                          {req.message && <> – <em>{req.message}</em></>}
                        </span>
                        <span className="group-requests-actions">
                          <button onClick={async () => {
                            await axios.post(`/api/groups/${group._id}/approve/${req.user._id}`);
                            fetchGroups();
                          }}>Approve</button>
                          <button onClick={async () => {
                            await axios.post(`/api/groups/${group._id}/reject/${req.user._id}`);
                            fetchGroups();
                          }}>Reject</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No join requests for this group.</p>
                )}
              </div>
            ))
          }
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
          isMember={selectedGroup.isMember} // Use selectedGroup.isMember
          onClose={() => setSelectedGroup(null)}
          onGroupUpdate={fetchGroups}
        />
      )}
    </div>
  );
};

const GroupCard = ({ group, currentUser, isMember, onGroupUpdate, onViewGroup }) => {
  const [isLoading, setIsLoading] = useState(false);
  // Use isMember from parent, do not redeclare
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
              className="filter-select"
            >
              <option value="public">Public - Anyone can join</option>
              <option value="private">Private - Requires approval</option>
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

const GroupDetailModal = (props) => {
  // All hooks at the top
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [groupPosts, setGroupPosts] = useState([]);
  const [posting, setPosting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: props.group.name,
    description: props.group.description,
    privacy: props.group.privacy,
    category: props.group.category
  });

  const currentUserId = props.currentUser._id || props.currentUser.id;
  const isAdmin = props.group.admins?.map(a => String(a)).includes(String(currentUserId)) ||
                String(props.group.creator._id) === String(currentUserId);
  const isCreator = String(props.group.creator._id) === String(currentUserId);



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
      const response = await axios.post(`/api/groups/${props.group._id}/posts`, formData);
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
      const response = await axios.put(`/api/groups/${props.group._id}`, editData);
      if (response.data.success) {
        alert('Group updated successfully!');
        props.onGroupUpdate();
        setIsEditing(false);
      }
    } catch (error) {
      alert('Error updating group: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      try {
        const response = await axios.delete(`/api/groups/${props.group._id}`);
        if (response.data.success) {
          alert('Group deleted successfully!');
          props.onGroupUpdate();
          props.onClose();
        }
      } catch (error) {
        alert('Error deleting group: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{props.group.name}</h3>
          <button className="close-button" onClick={props.onClose}>×</button>
        </div>

        <div className="group-detail-content">
          {!isEditing ? (
            <div className="group-info">
              <div className="group-stats">
                <div className="stat-item">
                  <span className="stat-label">Members:</span>
                  <span className="stat-value">{props.group.memberCount || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Category:</span>
                  <span className="stat-value">{props.group.category}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Privacy:</span>
                  <span className="stat-value">{props.group.privacy}</span>
                </div>
              </div>
              {props.group.description && (
                <div className="group-description-full">
                  <h4>Description</h4>
                  <p>{props.group.description}</p>
                </div>
              )}
              <div className="group-creator-info">
                <h4>Creator</h4>
                <p>{props.group.creator.firstName} {props.group.creator.lastName}</p>
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
              <div className="form-group">
                <label>Group Name *</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter group name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your group..."
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={editData.category}
                  onChange={(e) => setEditData(prev => ({ ...prev, category: e.target.value }))}
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
                  value={editData.privacy}
                  onChange={(e) => setEditData(prev => ({ ...prev, privacy: e.target.value }))}
                  className="filter-select"
                >
                  <option value="public">Public - Anyone can join</option>
                  <option value="private">Private - Requires approval</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
                <button type="submit" disabled={posting}>
                  {posting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Groups;