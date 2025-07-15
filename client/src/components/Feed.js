import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Feed.css';
import Comment from './Comment';
import InfiniteScroll from 'react-infinite-scroll-component';
import CommentForm from './CommentForm';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const hasInitialFetch = useRef(false);

  useEffect(() => {
    if (!hasInitialFetch.current) {
      console.log('Feed component mounted, fetching initial posts...');
      hasInitialFetch.current = true;
      fetchMorePosts();
    }
  }, []);

  const fetchMorePosts = async () => {
    if (isFetching) {
      console.log('Already fetching, skipping...');
      return;
    }
    
    try {
      setIsFetching(true);
      const currentPage = page;
      console.log('Fetching page:', currentPage);
      const response = await axios.get(`/api/feed?page=${currentPage}&limit=10`);
      console.log('Feed response for page', currentPage, ':', response.data);
      if (response.data.success) {
        setPosts(prev => {
          console.log('Current posts count:', prev.length);
          console.log('New posts count:', response.data.posts.length);
          
          // Filter out duplicates based on post ID
          const existingIds = new Set(prev.map(post => post._id));
          const newPosts = response.data.posts.filter(post => !existingIds.has(post._id));
          
          console.log('Filtered new posts count:', newPosts.length);
          return [...prev, ...newPosts];
        });
        setPage(currentPage + 1);
        if (response.data.posts.length < 10) setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading posts...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <div className="create-post-prompt">
        <button 
          className="create-post-button"
          onClick={() => setShowCreatePost(true)}
        >
          What's on your mind, {user?.firstName}?
        </button>
      </div>

      {showCreatePost && (
        <CreatePostModal 
          onClose={() => setShowCreatePost(false)}
          onPostCreated={(newPost) => {
            setPosts([newPost, ...posts]);
            setShowCreatePost(false);
          }}
        />
      )}

      {editingPost && (
        <EditPostModal 
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onPostUpdated={(updatedPost) => {
            setPosts(posts.map(p => p._id === updatedPost._id ? updatedPost : p));
            setEditingPost(null);
          }}
        />
      )}

      <InfiniteScroll
        dataLength={posts.length}
        next={fetchMorePosts}
        hasMore={hasMore}
        loader={<h4>Loading...</h4>}
        endMessage={<p>No more posts to load.</p>}
      >
        <div className="posts-container">
          {posts.map(post => (
            <PostCard 
              key={post._id} 
              post={post} 
              onPostUpdated={(updatedPost) => {
                setPosts(posts.map(p => p._id === updatedPost._id ? updatedPost : p));
              }}
              onPostDeleted={(deletedPostId) => {
                setPosts(posts.filter(p => p._id !== deletedPostId));
              }}
              onEditPost={(post) => setEditingPost(post)}
            />
          ))}
        </div>
      </InfiniteScroll>
    </div>
  );
};

const CreatePostModal = ({ onClose, onPostCreated }) => {
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate input
    if (!caption.trim() && !selectedFile) {
      alert('Please add a caption or select a file to share');
      return;
    }
    
    const formData = new FormData();
    formData.append('caption', caption);
    if (selectedFile) {
      formData.append('media', selectedFile);
    }

    try {
      console.log('Submitting post with caption:', caption);
      console.log('Making request to:', '/api/posts');
      console.log('Auth header:', axios.defaults.headers.common['Authorization']);
      
      const response = await axios.post('/api/posts', formData);
      
      console.log('Post response:', response.data);
      
      if (response.data.success) {
        onPostCreated(response.data.post);
        alert('Post shared successfully!');
      } else {
        alert('Failed to share post: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Error sharing post: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Post</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <textarea
            placeholder="What's happening?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows="4"
          />
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*"
            style={{ display: 'none' }}
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            📷 Add Photo/Video
          </button>
          
          {filePreview && (
            <div className="file-preview">
              {filePreview.type === 'image' ? (
                <img src={filePreview.url} alt="Preview" />
              ) : (
                <video src={filePreview.url} controls />
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          )}
          
          <button type="submit">Share Post</button>
        </form>
      </div>
    </div>
  );
};

const PostCard = ({ post, onPostUpdated, onPostDeleted, onEditPost }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(post.likes?.includes(user._id));
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

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showOptionsMenu && !event.target.closest('.post-options')) {
        setShowOptionsMenu(false);
      }
    };

    if (showOptionsMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showOptionsMenu]);

  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last;
  };

  const handleUserClick = () => {
    if (post.author._id === user?.id || post.author._id === user?._id) {
      // If clicking on own post, don't navigate, let them use the Profile tab
      return;
    }
    navigate(`/dashboard?tab=friends&userId=${post.author._id}`);
  };

  const handleLike = async () => {
    // Optimistically update UI
    setIsLiked(prev => !prev);
    setLikeCount(prev => prev + (isLiked ? -1 : 1));

    try {
      await axios.post(`/api/posts/${post._id}/like`);
      console.log("blablabla")
      // Optionally, you can update state again if server returns new values
    } catch (error) {
      // If error, revert UI
      setIsLiked(prev => !prev);
      setLikeCount(prev => prev + (isLiked ? 1 : -1));
      alert('Failed to like post');
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

  const handleDeletePost = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete this post? This action cannot be undone.');
    
    if (confirmDelete) {
      try {
        const response = await axios.delete(`/api/posts/${post._id}`);
        if (response.data.success) {
          onPostDeleted(post._id);
        }
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post: ' + (error.response?.data?.message || error.message));
      }
    }
  };



  return (
    <div className="post-card">
        <div className="post-header">
          <div className="user-avatar" onClick={handleUserClick}>
            {post.author.profilePicture ? (
              <img 
                src={post.author.profilePicture} 
                alt="Profile" 
                className="avatar-image"
                onError={(e) => {
                  // If image fails to load, hide it and show initials
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
            ) : null}
            
            <div 
              className={`avatar-initials ${post.author.profilePicture ? 'hidden' : ''}`}
              style={{ display: post.author.profilePicture ? 'none' : 'flex' }}
            >
              {getInitials(post.author.firstName, post.author.lastName)}
            </div>
          </div>
          <div className="user-info">
            <div 
              className="user-name clickable" 
              onClick={handleUserClick}
            >
              {post.author.firstName} {post.author.lastName}
            </div>
            <div className="post-time">
              {new Date(post.createdAt).toLocaleDateString()}
            </div>
            {/* Add group information display */}
            {post.group && (
              <div className="post-group">
                Posted in <span className="group-name">{post.group.name}</span>
              </div>
            )}
          </div>
          
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
                    handleDeletePost();
                  }}>
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      <div className="post-content">
        {post.caption && <p className="feed-post-caption">{post.caption}</p>}
        
        {post.media && post.media.type !== 'none' && (
          <div className="post-media">
            {post.media.type === 'image' ? (
              <img src={post.media.url} alt="Post media" />
            ) : (
              <video src={post.media.url} controls />
            )}
          </div>
        )}
      </div>

      <div className="post-actions">
        <button 
          className={`like-button ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          {isLiked ? '❤️' : '🤍'} {likeCount}
        </button>
        
        <button onClick={() => setShowComments(!showComments)}>
          💬 {comments.length}
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          {comments.map(comment => (
            <Comment
              key={comment._id}
              comment={comment}
              user={user}
              canDelete={canDeleteComment(comment)}
              handleDelete={handleDeleteComment}
            />
          ))}
          <CommentForm
            commentText={commentText}
            setCommentText={setCommentText}
            handleComment={handleComment}
          />
        </div>
      )}

    </div>
  );
};

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



export default Feed; 