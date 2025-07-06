import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Friends.css';

const Friends = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingTestUsers, setCreatingTestUsers] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await axios.get('/api/friends');
      if (response.data.success) {
        setFriends(response.data.friends);
        setFriendRequests(response.data.friendRequests);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const searchUsers = async () => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    console.log('Searching for:', searchQuery);
    setLoading(true);
    try {
      // Try both search endpoints to debug
      console.log('Trying main search endpoint...');
      const response = await axios.get(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`);
      console.log('Main search response:', response.data);
      
      console.log('Trying test search endpoint...');
      const testResponse = await axios.get(`/api/friends/test-search?q=${encodeURIComponent(searchQuery)}`);
      console.log('Test search response:', testResponse.data);
      
      if (response.data.success) {
        setSearchResults(response.data.users);
        console.log('Search results:', response.data.users);
      } else if (testResponse.data.success) {
        console.log('Main search failed but test search worked, using test results');
        setSearchResults(testResponse.data.users);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      console.error('Error details:', error.response?.data);
      
      // Try test search as fallback
      try {
        console.log('Main search failed, trying test search...');
        const testResponse = await axios.get(`/api/friends/test-search?q=${encodeURIComponent(searchQuery)}`);
        console.log('Test search fallback response:', testResponse.data);
        if (testResponse.data.success) {
          setSearchResults(testResponse.data.users);
        }
      } catch (testError) {
        console.error('Test search also failed:', testError);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      const response = await axios.post(`/api/friends/request/${userId}`);
      if (response.data.success) {
        alert('Friend request sent!');
        searchUsers(); // Refresh search results
      }
    } catch (error) {
      alert('Error sending friend request: ' + (error.response?.data?.message || error.message));
    }
  };

  const acceptFriendRequest = async (userId) => {
    try {
      const response = await axios.post(`/api/friends/accept/${userId}`);
      if (response.data.success) {
        alert('Friend request accepted!');
        fetchFriends(); // Refresh friends list
      }
    } catch (error) {
      alert('Error accepting friend request: ' + (error.response?.data?.message || error.message));
    }
  };

  const rejectFriendRequest = async (userId) => {
    try {
      const response = await axios.post(`/api/friends/reject/${userId}`);
      if (response.data.success) {
        alert('Friend request rejected');
        fetchFriends(); // Refresh friends list
      }
    } catch (error) {
      alert('Error rejecting friend request: ' + (error.response?.data?.message || error.message));
    }
  };

  const removeFriend = async (userId) => {
    if (window.confirm('Are you sure you want to remove this friend?')) {
      try {
        const response = await axios.delete(`/api/friends/${userId}`);
        if (response.data.success) {
          alert('Friend removed');
          fetchFriends(); // Refresh friends list
        }
      } catch (error) {
        alert('Error removing friend: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const createTestUsers = async () => {
    setCreatingTestUsers(true);
    try {
      const response = await axios.post('/api/test/create-users');
      if (response.data.success) {
        alert('Test users created! You can now search for: John, Jane, Bob, Alice, or Test');
        if (activeTab === 'search') {
          searchUsers(); // Refresh search if we're on search tab
        }
      }
    } catch (error) {
      console.error('Error creating test users:', error);
      alert('Error creating test users: ' + (error.response?.data?.message || error.message));
    } finally {
      setCreatingTestUsers(false);
    }
  };

  const testDebugEndpoint = async () => {
    try {
      console.log('Testing debug endpoint...');
      const response = await axios.get('/api/friends/debug');
      console.log('Debug endpoint response:', response.data);
      alert(`Debug Success! Total users: ${response.data.totalUsers}, Current user: ${response.data.currentUserId}`);
    } catch (error) {
      console.error('Debug endpoint failed:', error);
      alert('Debug endpoint failed: ' + (error.response?.data?.message || error.message));
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (activeTab === 'search') {
        searchUsers();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, activeTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'friends':
        return (
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="empty-state">
                <p>You don't have any friends yet.</p>
                <p>Search for users to add as friends!</p>
              </div>
            ) : (
              friends.map(friend => (
                <UserCard
                  key={friend._id}
                  user={friend}
                  onUserClick={() => navigate(`/user/${friend._id}`)}
                  actions={
                    <button
                      className="remove-friend-btn"
                      onClick={() => removeFriend(friend._id)}
                    >
                      Remove Friend
                    </button>
                  }
                />
              ))
            )}
          </div>
        );

      case 'requests':
        return (
          <div className="friend-requests-list">
            {friendRequests.length === 0 ? (
              <div className="empty-state">
                <p>No pending friend requests</p>
              </div>
            ) : (
              friendRequests.map(request => (
                <UserCard
                  key={request.from._id}
                  user={request.from}
                  onUserClick={() => navigate(`/user/${request.from._id}`)}
                  subtitle={`Sent ${new Date(request.createdAt).toLocaleDateString()}`}
                  actions={
                    <div className="request-actions">
                      <button
                        className="accept-btn"
                        onClick={() => acceptFriendRequest(request.from._id)}
                      >
                        Accept
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => rejectFriendRequest(request.from._id)}
                      >
                        Reject
                      </button>
                    </div>
                  }
                />
              ))
            )}
          </div>
        );

      case 'search':
        return (
          <div className="search-section">
            <div className="search-controls">
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search for users by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              <button 
                onClick={createTestUsers}
                disabled={creatingTestUsers}
                className="create-test-users-btn"
              >
                {creatingTestUsers ? 'Creating...' : 'Create Test Users'}
              </button>
              <button 
                onClick={testDebugEndpoint}
                className="debug-btn"
              >
                Debug API
              </button>
            </div>

            {loading && <div className="loading">Searching...</div>}

            <div className="search-results">
              {searchResults.length === 0 && searchQuery.length >= 2 && !loading ? (
                <div className="empty-state">
                  <p>No users found matching "{searchQuery}"</p>
                </div>
              ) : (
                searchResults.map(searchUser => (
                  <UserCard
                    key={searchUser._id}
                    user={searchUser}
                    onUserClick={() => navigate(`/user/${searchUser._id}`)}
                    actions={
                      searchUser.isFriend ? (
                        <span className="friend-status">Already Friends</span>
                      ) : searchUser.hasRequestFromThem ? (
                        <span className="request-status">Request Pending</span>
                      ) : (
                        <button
                          className="add-friend-btn"
                          onClick={() => sendFriendRequest(searchUser._id)}
                        >
                          Add Friend
                        </button>
                      )
                    }
                  />
                ))
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="friends-container">
      <div className="friends-header">
        <h2>Friends</h2>
        <div className="friends-stats">
          <span>{friends.length} friends</span>
          {friendRequests.length > 0 && (
            <span className="requests-badge">{friendRequests.length} requests</span>
          )}
        </div>
      </div>

      <div className="friends-tabs">
        <button
          className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends ({friends.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests ({friendRequests.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
      </div>

      <div className="friends-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

const UserCard = ({ user, subtitle, actions, onUserClick }) => {
  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last;
  };

  return (
    <div className="user-card">
      <div className="user-avatar" onClick={onUserClick}>
        {user.profilePicture ? (
          <img 
            src={user.profilePicture} 
            alt="Profile" 
            className="avatar-image"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={`avatar-initials ${user.profilePicture ? 'hidden' : ''}`}
          style={{ display: user.profilePicture ? 'none' : 'flex' }}
        >
          {getInitials(user.firstName, user.lastName)}
        </div>
      </div>
      <div className="user-info">
        <div className="user-name clickable" onClick={onUserClick}>
          {user.firstName} {user.lastName}
        </div>
        <div className="user-username">@{user.username}</div>
        {subtitle && <div className="user-subtitle">{subtitle}</div>}
      </div>
      <div className="user-actions">
        {actions}
      </div>
    </div>
  );
};

export default Friends; 