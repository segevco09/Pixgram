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
        {groups.map(group => (
          <GroupCard 
            key={group._id} 
            group={group} 
            currentUser={user}
            onGroupUpdate={fetchGroups}
            onViewGroup={setSelectedGroup}
          />
        ))}
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
          onClose={() => setSelectedGroup(null)}
          onGroupUpdate={fetchGroups}
        />
      )}
    </div>
  );
};

const GroupCard = ({ group, currentUser, onGroupUpdate, onViewGroup }) => {
  const [isLoading, setIsLoading] = useState(false);

  const isMember = group.members?.some(member => 
    member.user._id === currentUser._id || member.user === currentUser._id
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
        <h3 className="group-name">{group.name}</h3>
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
          onClick={() => onViewGroup(group)}
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

const GroupDetailModal = ({ group, currentUser, onClose, onGroupUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: group.name,
    description: group.description,
    privacy: group.privacy,
    category: group.category
  });

  const isAdmin = group.admins?.includes(currentUser._id) || 
                  group.creator._id === currentUser._id;
  const isCreator = group.creator._id === currentUser._id;

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
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
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
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
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
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
                <button type="submit">Update Group</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Groups; 