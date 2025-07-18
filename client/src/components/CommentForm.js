import React from 'react';
import './Comment.css';

const CommentForm = ({ commentText, setCommentText, handleComment }) => (
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
);

export default CommentForm;
