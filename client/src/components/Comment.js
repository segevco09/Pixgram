import React from 'react';
import './Comment.css';

const Comment = ({ comment, user, canDelete, handleDelete }) => {
  // Helper to get initials if no profile picture
  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last;
  };

  return (
    <div className="comment">
      <div className="comment-avatar">
        {comment.user?.profilePicture ? (
          <img
            src={comment.user.profilePicture}
            alt={`${comment.user.firstName} ${comment.user.lastName}`}
            className="comment-avatar-image"
          />
        ) : (
          <div className="comment-avatar-initials">
            {getInitials(comment.user?.firstName, comment.user?.lastName)}
          </div>
        )}
      </div>
      <div className="comment-content">
        <span className="comment-username">
          {comment.user?.firstName} {comment.user?.lastName}:
        </span>
        <span className="comment-text">{comment.content}</span>
        {canDelete && (
          <button
            className="delete-comment-btn"
            onClick={() => handleDelete(comment._id)}
            title="Delete comment"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
};

export default Comment;
