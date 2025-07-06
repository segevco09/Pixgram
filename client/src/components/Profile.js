import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [userPosts, setUserPosts] = useState([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setEditedBio(user.bio || '');
      loadUserPosts();
      loadFollowStats();
    }
  }, [user]);

  const loadUserPosts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/user/${user.id || user._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserPosts(data.posts || []);
      } else {
        console.error('Failed to load user posts');
      }
    } catch (error) {
      console.error('Error loading user posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFollowStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/friends/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFollowerCount(data.followerCount || 0);
        setFollowingCount(data.followingCount || 0);
      }
    } catch (error) {
      console.error('Error loading follow stats:', error);
    }
  };

  const handleProfilePictureChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('profilePicture', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/profile-picture', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        updateUser(data.user);
        console.log('Profile picture updated successfully');
      } else {
        const errorData = await response.json();
        alert(`Failed to update profile picture: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      alert('Error updating profile picture');
    }
  };

  const handleBioSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/bio', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bio: editedBio })
      });

      if (response.ok) {
        const data = await response.json();
        updateUser(data.user);
        setIsEditingBio(false);
        console.log('Bio updated successfully');
      } else {
        const errorData = await response.json();
        alert(`Failed to update bio: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error updating bio:', error);
      alert('Error updating bio');
    }
  };

  const handleBioCancel = () => {
    setEditedBio(user.bio || '');
    setIsEditingBio(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last;
  };

  if (isLoading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-picture-section">
          <div className="profile-picture-wrapper">
            {user?.profilePicture ? (
              <img 
                src={user.profilePicture} 
                alt="Profile" 
                className="profile-picture"
                onError={(e) => {
                  // If image fails to load, hide it and show initials
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
            ) : null}
            
            <div 
              className={`profile-picture-initials ${user?.profilePicture ? 'hidden' : ''}`}
              style={{ display: user?.profilePicture ? 'none' : 'flex' }}
            >
              {getInitials(user?.firstName, user?.lastName)}
            </div>
            
            <div className="profile-picture-overlay">
              <input
                type="file"
                id="profilePictureInput"
                accept="image/*"
                onChange={handleProfilePictureChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="profilePictureInput" className="change-picture-btn">
                📷 Change Photo
              </label>
            </div>
            
            {/* Always visible edit button for better UX */}
            <div className="profile-picture-edit-btn">
              <input
                type="file"
                id="profilePictureInputVisible"
                accept="image/*"
                onChange={handleProfilePictureChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="profilePictureInputVisible" className="edit-btn-visible">
                ✏️
              </label>
            </div>
          </div>
        </div>

        <div className="profile-info">
          <div className="profile-name">
            <h1>{user?.firstName} {user?.lastName}</h1>
            <span className="username">@{user?.username}</span>
          </div>

          <div className="profile-stats">
            <div className="stat">
              <span className="stat-number">{userPosts.length}</span>
              <span className="stat-label">Posts</span>
            </div>
            <div className="stat">
              <span className="stat-number">{followerCount}</span>
              <span className="stat-label">Followers</span>
            </div>
            <div className="stat">
              <span className="stat-number">{followingCount}</span>
              <span className="stat-label">Following</span>
            </div>
          </div>

          <div className="profile-bio">
            {isEditingBio ? (
              <div className="bio-edit-form">
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  placeholder="Write something about yourself..."
                  maxLength={500}
                  rows={3}
                  className="bio-textarea"
                  autoFocus
                />
                <div className="bio-actions">
                  <button onClick={handleBioSave} className="save-bio-btn">
                    Save
                  </button>
                  <button onClick={handleBioCancel} className="cancel-bio-btn">
                    Cancel
                  </button>
                </div>
                <small className="char-count">
                  {editedBio.length}/500 characters
                </small>
              </div>
            ) : (
              <div className="bio-display">
                <p className="bio-text">
                  {user?.bio || 'No bio yet. Click edit to add one!'}
                </p>
                <button 
                  onClick={() => setIsEditingBio(true)}
                  className="edit-bio-btn"
                >
                  ✏️ Edit Bio
                </button>
              </div>
            )}
          </div>

          <div className="profile-metadata">
            <p className="join-date">
              📅 Joined {formatDate(user?.createdAt)}
            </p>
            <p className="email">
              📧 {user?.email}
            </p>
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="content-header">
          <h2>My Posts</h2>
          <span className="post-count">({userPosts.length} posts)</span>
        </div>

        {userPosts.length === 0 ? (
          <div className="no-posts">
            <div className="no-posts-icon">📸</div>
            <h3>No posts yet</h3>
            <p>Share your first post to get started!</p>
            <button 
              onClick={() => window.location.hash = '#feed'} 
              className="create-post-btn"
            >
              Create Your First Post
            </button>
          </div>
        ) : (
          <div className="posts-grid">
            {userPosts.map((post) => (
              <div key={post._id} className="post-item">
                <div className="post-media">
                  {post.media?.url ? (
                    post.media.type === 'image' ? (
                      <img 
                        src={post.media.url} 
                        alt="Post" 
                        className="post-image"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/300x300/e1e5e9/6c757d?text=Image+Not+Found';
                        }}
                      />
                    ) : (
                      <video 
                        src={post.media.url} 
                        className="post-video"
                        controls
                      />
                    )
                  ) : (
                    <div className="post-no-media">
                      <span>📝</span>
                      <p>Text Post</p>
                    </div>
                  )}
                </div>
                
                <div className="post-overlay">
                  <div className="post-stats">
                    <span>❤️ {post.likes?.length || 0}</span>
                    <span>💬 {post.comments?.length || 0}</span>
                  </div>
                </div>

                <div className="post-info">
                  <p className="post-caption">
                    {post.caption?.length > 60 
                      ? `${post.caption.substring(0, 60)}...` 
                      : post.caption || 'No caption'}
                  </p>
                  <span className="post-date">
                    {formatDate(post.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile; 