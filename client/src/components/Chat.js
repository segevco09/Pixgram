import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Chat.css';

const Chat = () => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Join user's personal room
    if (user) {
      newSocket.emit('join-user-room', user._id);
    }

    // Listen for new messages
    newSocket.on('new-message', (messageData) => {
      setMessages(prev => [...prev, {
        ...messageData,
        isReceived: true
      }]);
    });

    // Fetch all users for chat list
    fetchUsers();

    return () => {
      newSocket.close();
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/auth/users');
      if (response.data.success) {
        // Filter out current user
        const otherUsers = response.data.users.filter(u => u._id !== user._id);
        setAllUsers(otherUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedUser || !socket) return;

    const messageData = {
      senderId: user._id,
      receiverId: selectedUser._id,
      message: newMessage.trim(),
      senderName: `${user.firstName} ${user.lastName}`
    };

    // Emit message to server
    socket.emit('send-message', messageData);

    // Add to local messages
    setMessages(prev => [...prev, {
      senderId: user._id,
      senderName: messageData.senderName,
      message: newMessage.trim(),
      timestamp: new Date(),
      isReceived: false
    }]);

    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-header">
          <h3>Messages</h3>
        </div>
        
        <div className="users-list">
          {allUsers.map(chatUser => (
            <div
              key={chatUser._id}
              className={`user-item ${selectedUser?._id === chatUser._id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedUser(chatUser);
                setMessages([]); // Clear messages when switching users (in real app, would load chat history)
              }}
            >
              <div className="user-avatar">
                {chatUser.firstName?.[0]}{chatUser.lastName?.[0]}
              </div>
              <div className="user-info">
                <div className="user-name">
                  {chatUser.firstName} {chatUser.lastName}
                </div>
                <div className="user-status">
                  {onlineUsers.includes(chatUser._id) ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <div className="user-avatar">
                  {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                </div>
                <div>
                  <div className="user-name">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </div>
                  <div className="user-status">
                    {onlineUsers.includes(selectedUser._id) ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>Start a conversation with {selectedUser.firstName}!</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`message ${message.isReceived ? 'received' : 'sent'}`}
                  >
                    <div className="message-content">
                      <div className="message-text">{message.message}</div>
                      <div className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-container">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message ${selectedUser.firstName}...`}
                rows="3"
                className="message-input"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="send-button"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <h3>Select a user to start chatting</h3>
            <p>Choose someone from the sidebar to begin a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat; 