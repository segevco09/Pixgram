import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './UserProfile.css';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [userProfile, setUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userId) {
      loadUserProfile();
    }
  }, [userId]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user info
      const userResponse = await axios.get(`/api/auth/user/${userId}`);
      if (userResponse.data.success) {
        setUserProfile(userResponse.data.user);
      } else {
        setError('User not found');
        return;
      }

      // Get user posts
      const postsResponse = await axios.get(`/api/posts/user/${userId}`);
      if (postsResponse.data.success) {
        setUserPosts(postsResponse.data.posts);
      }

      // Get follower stats
      const statsResponse = await axios.get(`/api/friends/stats/${userId}`);
      if (statsResponse.data.success) {
        setFollowerCount(statsResponse.data.followerCount);
        setFollowingCount(statsResponse.data.followingCount);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleBackClick = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-header">
          <button className="back-button" onClick={handleBackClick}>
            ← Back to Dashboard
          </button>
        </div>
        <div className="loading-container">
          <div className="loading-spinner">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-header">
          <button className="back-button" onClick={handleBackClick}>
            ← Back to Dashboard
          </button>
        </div>
        <div className="error-container">
          <div className="error-message">
            <h2>Profile Not Found</h2>
            <p>{error || 'This user profile could not be found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to own profile tab if viewing own profile
  if (userProfile._id === currentUser?.id || userProfile._id === currentUser?._id) {
    navigate('/dashboard?tab=profile');
    return null;
  }

  return (
    <div className="user-profile-page">
      <div className="user-profile-header">
        <button className="back-button" onClick={handleBackClick}>
          ← Back to Dashboard
        </button>
      </div>
      
      <div className="user-profile-container">
        <div className="profile-header">
          <div className="profile-picture-wrapper">
            {userProfile.profilePicture ? (
              <img 
                src={userProfile.profilePicture} 
                alt="Profile" 
                className="profile-picture"
              />
            ) : (
              <div className="profile-picture-initials">
                {getInitials(userProfile.firstName, userProfile.lastName)}
              </div>
            )}
          </div>

          <div className="profile-info">
            <div className="profile-name">
              <h1>{userProfile.firstName} {userProfile.lastName}</h1>
              <span className="username">@{userProfile.username}</span>
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

            {userProfile.bio && (
              <div className="profile-bio">
                <p>{userProfile.bio}</p>
              </div>
            )}

            <div className="profile-metadata">
              <p>📅 Joined {formatDate(userProfile.createdAt)}</p>
              {userProfile.email && (
                <p>✉️ {userProfile.email}</p>
              )}
            </div>
          </div>
        </div>

        <div className="profile-posts">
          <h2>Posts ({userPosts.length})</h2>
          {userPosts.length === 0 ? (
            <div className="no-posts">
              <p>No posts yet</p>
            </div>
          ) : (
            <div className="posts-grid">
              {userPosts.map((post) => (
                <div key={post._id} className="post-item">
                  {post.media?.url ? (
                    post.media.type === 'image' ? (
                      <img 
                        src={post.media.url} 
                        alt="Post" 
                        className="post-image"
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
                      <p>{post.caption}</p>
                    </div>
                  )}
                  {}
                  {post.caption && post.media?.url && (
                    <div className="post-caption">
                      <p>{post.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 