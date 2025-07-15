import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Profile.css';
import Comment from './Comment';
import CommentForm from './CommentForm';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [userPosts, setUserPosts] = useState([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);

  // Add edit post states
  const [editingPost, setEditingPost] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

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

  const handlePostClick = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleCloseModal = () => {
    setSelectedPost(null);
  };

  // Add edit post handler
  const handleEditPost = (post) => {
    setEditingPost(post);
    setShowEditModal(true);
    setSelectedPost(null); // Close the view modal
  };

  // Add delete post handler
  const handleDeletePost = async (postId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this post? This action cannot be undone.');
    
    if (confirmDelete) {
      try {
        const response = await axios.delete(`/api/posts/${postId}`);
        if (response.data.success) {
          // Remove the deleted post from state
          setUserPosts(userPosts.filter(post => post._id !== postId));
          setSelectedPost(null); // Close the modal
        }
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  // Add post update handler
  const handlePostUpdated = (updatedPost) => {
    setUserPosts(userPosts.map(post => 
      post._id === updatedPost._id ? { ...post, ...updatedPost } : post
    ));
    setShowEditModal(false);
    setEditingPost(null);
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
              <div key={post._id} className="post-item" onClick={() => handlePostClick(post)}>
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

      {/* Post View Modal */}
      {showPostModal && selectedPost && (
        <PostViewModal 
          post={selectedPost} 
          onClose={handleCloseModal}
          onEditPost={handleEditPost}
          onDeletePost={handleDeletePost}
        />
      )}

      {/* Edit Post Modal */}
      {showEditModal && editingPost && (
        <EditPostModal 
          post={editingPost} 
          onClose={() => {
            setShowEditModal(false);
            setEditingPost(null);
          }}
          onPostUpdated={handlePostUpdated}
        />
      )}
    </div>
  );
};

// Post View Modal Component
const PostViewModal = ({ post, onClose, onEditPost, onDeletePost }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Check if current user owns this post
  const isOwner = post.author._id === user?.id || post.author._id === user?._id;

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
          
          <div className="modal-header-actions">
            {/* Show options menu for post owner */}
            {isOwner && (
              <div className="post-options">
                <button 
                  className="options-button" 
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                >
                  ⋯
                </button>
                
                {showOptionsMenu && (
                  <div className="options-menu">
                    <button onClick={() => {
                      onEditPost(post);
                      setShowOptionsMenu(false);
                    }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => {
                      setShowOptionsMenu(false);
                      onDeletePost(post._id);
                    }}>
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <button className="close-button" onClick={onClose}>×</button>
          </div>
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
              <CommentForm
                commentText={commentText}
                setCommentText={setCommentText}
                handleComment={handleComment}
              />
              
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

// Edit Post Modal Component
const EditPostModal = ({ post, onClose, onPostUpdated }) => {
  const [caption, setCaption] = useState(post.caption || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.put(`/api/posts/${post._id}`, {
        caption: caption.trim()
      });
      
      if (response.data.success) {
        onPostUpdated(response.data.post);
      } else {
        console.error('Failed to update post:', response.data.message);
      }
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Error updating post: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Post</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <textarea
            placeholder="What's happening?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows="4"
            maxLength="2000"
          />
          
          {/* Show current media if exists */}
          {post.media && post.media.type !== 'none' && (
            <div className="current-media">
              <p>Current media (cannot be changed):</p>
              {post.media.type === 'image' ? (
                <img src={post.media.url} alt="Current media" style={{ maxWidth: '200px', maxHeight: '200px' }} />
              ) : (
                <video src={post.media.url} controls style={{ maxWidth: '200px', maxHeight: '200px' }} />
              )}
            </div>
          )}
          
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile; 