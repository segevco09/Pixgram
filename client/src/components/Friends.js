import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Friends.css';
import Comment from './Comment';
import './Comment.css';

const Friends = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // User profile viewing states
  const [viewingUserId, setViewingUserId] = useState(null);
  const [viewingUserProfile, setViewingUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [userStats, setUserStats] = useState({ followerCount: 0, followingCount: 0 });
  const [profileLoading, setProfileLoading] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);

  useEffect(() => {
    fetchFriends();
    
    // Check for userId in URL parameters
    const userId = searchParams.get('userId');
    if (userId) {
      handleViewUserProfile(userId);
    }
  }, [searchParams]);

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
        if (viewingUserId === userId) {
          checkFriendshipStatus(userId); // Update friendship status
        }
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
        if (viewingUserId === userId) {
          checkFriendshipStatus(userId); // Update friendship status
        }
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
        if (viewingUserId === userId) {
          checkFriendshipStatus(userId); // Update friendship status
        }
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
          if (viewingUserId === userId) {
            checkFriendshipStatus(userId); // Update friendship status
          }
        }
      } catch (error) {
        alert('Error removing friend: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  // User Profile Functions
  const handleViewUserProfile = async (userId) => {
    if (userId === user?.id || userId === user?._id) {
      // Don't show own profile in friends tab
      setSearchParams({ tab: 'profile' });
      return;
    }

    setViewingUserId(userId);
    setActiveTab('profile'); // Switch to profile view
    await loadUserProfile(userId);
  };

  const loadUserProfile = async (userId) => {
    setProfileLoading(true);
    try {
      // Load user info
      const userResponse = await axios.get(`/api/auth/user/${userId}`);
      if (userResponse.data.success) {
        setViewingUserProfile(userResponse.data.user);
      }

      // Load user posts
      const postsResponse = await axios.get(`/api/posts/user/${userId}`);
      if (postsResponse.data.success) {
        setUserPosts(postsResponse.data.posts);
      }

      // Load user stats
      const statsResponse = await axios.get(`/api/friends/stats/${userId}`);
      if (statsResponse.data.success) {
        setUserStats({
          followerCount: statsResponse.data.followerCount,
          followingCount: statsResponse.data.followingCount
        });
      }

      // Check friendship status
      await checkFriendshipStatus(userId);
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const checkFriendshipStatus = async (userId) => {
    try {
      const response = await axios.get('/api/friends');
      if (response.data.success) {
        const isFriend = response.data.friends.some(friend => friend._id === userId);
        const hasPendingRequest = response.data.friendRequests.some(request => request.from._id === userId);
        
        if (isFriend) {
          setFriendshipStatus('friends');
        } else if (hasPendingRequest) {
          setFriendshipStatus('pending');
        } else {
          setFriendshipStatus('none');
        }
      }
    } catch (error) {
      console.error('Error checking friendship status:', error);
    }
  };

  const handleBackToFriends = () => {
    setViewingUserId(null);
    setViewingUserProfile(null);
    setUserPosts([]);
    setActiveTab('friends');
    setSearchParams({});
  };

  const handleStartChat = (userId) => {
    // Navigate to chat tab with the specific user
    console.log('🚀 Starting chat with user:', userId);
    navigate(`/dashboard?tab=chat&userId=${userId}`);
  };

  const handlePostClick = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleCloseModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
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
    // Show user profile if viewing someone
    if (viewingUserId && viewingUserProfile) {
      return <UserProfileView />;
    }

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
                  onUserClick={() => handleViewUserProfile(friend._id)}
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
                  onUserClick={() => handleViewUserProfile(request.from._id)}
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
                    onUserClick={() => handleViewUserProfile(searchUser._id)}
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

  const UserProfileView = () => {
    const getInitials = (firstName, lastName) => {
      const first = firstName?.charAt(0)?.toUpperCase() || '';
      const last = lastName?.charAt(0)?.toUpperCase() || '';
      return first + last;
    };

    const renderFriendshipActions = () => {
      switch (friendshipStatus) {
        case 'friends':
          return (
            <div className="profile-actions">
              <button 
                className="unfriend-btn"
                onClick={() => removeFriend(viewingUserId)}
              >
                🚫 Unfriend
              </button>
              <button 
                className="chat-btn"
                onClick={() => {
                  console.log('💬 Message button clicked for user:', viewingUserId);
                  handleStartChat(viewingUserId);
                }}
              >
                💬 Message
              </button>
            </div>
          );
        case 'pending':
          return (
            <div className="profile-actions">
              <span className="pending-status">Friend Request Pending</span>
              <button 
                className="chat-btn"
                onClick={() => {
                  console.log('💬 Message button clicked for user:', viewingUserId);
                  handleStartChat(viewingUserId);
                }}
              >
                💬 Message
              </button>
            </div>
          );
        case 'none':
          return (
            <div className="profile-actions">
              <button 
                className="add-friend-btn"
                onClick={() => sendFriendRequest(viewingUserId)}
              >
                ➕ Add Friend
              </button>
              <button 
                className="chat-btn"
                onClick={() => {
                  console.log('💬 Message button clicked for user:', viewingUserId);
                  handleStartChat(viewingUserId);
                }}
              >
                💬 Message
              </button>
            </div>
          );
        default:
          return null;
      }
    };

    if (profileLoading) {
      return <div className="loading">Loading profile...</div>;
    }

    return (
      <div className="user-profile-view">
        <div className="profile-header">
          <button className="back-button" onClick={handleBackToFriends}>
            ← Back to Friends
          </button>
        </div>

        <div className="profile-content">
          <div className="profile-info">
            <div className="profile-picture-wrapper">
              {viewingUserProfile.profilePicture ? (
                <img 
                  src={viewingUserProfile.profilePicture} 
                  alt="Profile" 
                  className="profile-picture"
                />
              ) : (
                <div className="profile-picture-initials">
                  {getInitials(viewingUserProfile.firstName, viewingUserProfile.lastName)}
                </div>
              )}
            </div>

            <div className="profile-details">
              <h2>{viewingUserProfile.firstName} {viewingUserProfile.lastName}</h2>
              <p className="username">@{viewingUserProfile.username}</p>
              
              {viewingUserProfile.bio && (
                <p className="bio">{viewingUserProfile.bio}</p>
              )}

              <div className="profile-stats">
                <div className="stat">
                  <span className="stat-number">{userPosts.length}</span>
                  <span className="stat-label">Posts</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{userStats.followerCount}</span>
                  <span className="stat-label">Followers</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{userStats.followingCount}</span>
                  <span className="stat-label">Following</span>
                </div>
              </div>

              {renderFriendshipActions()}
            </div>
          </div>

          <div className="profile-posts">
            <h3>Posts ({userPosts.length})</h3>
            {userPosts.length === 0 ? (
              <div className="no-posts">
                <p>No posts yet</p>
              </div>
            ) : (
              <div className="posts-grid">
                {userPosts.map((post) => (
                  <div key={post._id} className="post-item" onClick={() => handlePostClick(post)}>
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
                      <div className="text-post">
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

  return (
    <div className="friends-container">
      {!viewingUserId ? (
        <>
          <div className="friends-header">
            <h2>Find Friends</h2>
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
        </>
      ) : null}

      <div className="friends-content">
        {renderTabContent()}
      </div>

      {/* Post View Modal */}
      {showPostModal && selectedPost && (
        <PostViewModal 
          post={selectedPost} 
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

// Post View Modal Component (same as in Profile.js)
const PostViewModal = ({ post, onClose }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  // Check if current user has liked this post
  useEffect(() => {
    if (post.likes && user) {
      const currentUserId = (user.id || user._id).toString();
      const userLiked = post.likes.some(likeId => {
        // Convert ObjectId to string for comparison
        return likeId.toString() === currentUserId;
      });
      setIsLiked(userLiked);
    }
  }, [post.likes, user]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last;
  };

  const handleLike = async () => {
    try {
      const response = await axios.post(`/api/posts/${post._id}/like`);
      if (response.data.success) {
        setIsLiked(response.data.isLiked);
        setLikeCount(response.data.likeCount);
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const response = await axios.post(`/api/posts/${post._id}/comments`, {
        content: commentText.trim()
      });
      
      if (response.data.success) {
        setComments([...comments, response.data.comment]);
        setCommentText('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this comment?');
    if (!confirmDelete) return;

    try {
      const response = await axios.delete(`/api/posts/${post._id}/comments/${commentId}`);
      
      if (response.data.success) {
        setComments(comments.filter(comment => comment._id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Error deleting comment: ' + (error.response?.data?.message || error.message));
    }
  };

  const canDeleteComment = (comment) => {
    // User can delete their own comment or if they're the post author
    return comment.user._id === user?.id || comment.user._id === user?._id ||

           post.author._id === user?.id || post.author._id === user?._id;
  };

  return (
    <div className="post-modal-overlay" onClick={onClose}>
      <div className="post-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="post-modal-header">
          <div className="post-author-info">
            <div className="author-avatar">
              {post.author?.profilePicture ? (
                <img 
                  src={post.author.profilePicture} 
                  alt={`${post.author.firstName} ${post.author.lastName}`}
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-initials">
                  {getInitials(post.author?.firstName, post.author?.lastName)}
                </div>
              )}
            </div>
            <div className="author-details">
              <h4>{post.author?.firstName} {post.author?.lastName}</h4>
              <span className="post-modal-date">{formatDate(post.createdAt)}</span>
            </div>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="post-modal-body">
          {post.media?.url && (
            <div className="post-modal-media">
              {post.media.type === 'image' ? (
                <img 
                  src={post.media.url} 
                  alt="Post content" 
                  className="modal-media-content"
                />
              ) : (
                <video 
                  src={post.media.url} 
                  className="modal-media-content"
                  controls
                  autoPlay={false}
                />
              )}
            </div>
          )}

          {post.caption && (
            <div className="post-modal-caption">
              <p>{post.caption}</p>
            </div>
          )}

          <div className="post-modal-actions">
            <button 
              className={`like-button ${isLiked ? 'liked' : ''}`}
              onClick={handleLike}
            >
              {isLiked ? '❤️' : '🤍'} {likeCount}
            </button>
            
            <button 
              className="comment-button"
              onClick={() => setShowComments(!showComments)}
            >
              💬 {comments.length}
            </button>
          </div>

          {showComments && (
            <div className="post-modal-comments">
              <form onSubmit={handleComment} className="comment-form">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="comment-input"
                />
                <button type="submit" className="comment-submit">Post</button>
              </form>
              
              <div className="comments-list">
                {comments.map(comment => (
                  <Comment
                    key={comment._id}
                    comment={comment}
                    user={user}
                    canDelete={canDeleteComment(comment)}
                    handleDelete={handleDeleteComment}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
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