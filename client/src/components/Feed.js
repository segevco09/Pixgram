import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Feed.css';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axios.get('/api/posts');
      if (response.data.success) {
        setPosts(response.data.posts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
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

      <div className="posts-container">
        {posts.map(post => (
          <PostCard key={post._id} post={post} />
        ))}
      </div>
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

const PostCard = ({ post }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

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
    navigate(`/user/${post.author._id}`);
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
          </div>
        </div>

      <div className="post-content">
        {post.caption && <p>{post.caption}</p>}
        
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
          <form onSubmit={handleComment}>
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit">Post</button>
          </form>
          
          {comments.map(comment => (
            <div key={comment._id} className="comment">
              <strong>{comment.user.firstName} {comment.user.lastName}:</strong>
              <span>{comment.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};



export default Feed; 