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

  const loadConversation = async (userId) => {
    try {
      console.log('Loading conversation with user:', userId);
      const response = await axios.get(`/api/messages/conversation/${userId}`);
      console.log('Conversation response:', response.data);
      if (response.data.success) {
        const formattedMessages = response.data.messages.map(msg => ({
          _id: msg._id,
          senderId: msg.sender._id,
          senderName: `${msg.sender.firstName} ${msg.sender.lastName}`,
          message: msg.content,
          timestamp: msg.createdAt,
          isReceived: msg.sender._id !== user._id
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      console.error('Error details:', error.response?.data);
      setMessages([]); // Clear messages on error
    }
  };

  const testMessagesAPI = async () => {
    try {
      console.log('Testing messages API...');
      const response = await axios.get('/api/messages/test');
      console.log('Messages API test response:', response.data);
      alert('Messages API is working! Check console for details.');
    } catch (error) {
      console.error('Messages API test failed:', error);
      console.error('Error details:', error.response?.data);
      alert('Messages API test failed. Check console for details.');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    console.log('Attempting to send message:', {
      receiverId: selectedUser._id,
      content: newMessage.trim(),
      user: user
    });

    try {
      // Save message to database via API
      console.log('Making API call to /api/messages/send...');
      const response = await axios.post('/api/messages/send', {
        receiverId: selectedUser._id,
        content: newMessage.trim()
      });

      console.log('API response:', response.data);

      if (response.data.success) {
        const savedMessage = response.data.message;
        
        // Add to local messages
        setMessages(prev => [...prev, {
          _id: savedMessage._id,
          senderId: user._id,
          senderName: `${user.firstName} ${user.lastName}`,
          message: newMessage.trim(),
          timestamp: savedMessage.createdAt,
          isReceived: false
        }]);

        // Only emit via socket for real-time delivery to OTHER users
        // Don't save again in socket handler since we already saved via API
        if (socket) {
          console.log('Emitting via socket for real-time delivery...');
          socket.emit('send-message-realtime', {
            _id: savedMessage._id,
            senderId: user._id,
            receiverId: selectedUser._id,
            message: newMessage.trim(),
            senderName: `${user.firstName} ${user.lastName}`,
            timestamp: savedMessage.createdAt,
            alreadySaved: true // Flag to indicate this is already saved
          });
        }

        setNewMessage('');
        console.log('Message sent successfully!');
      } else {
        console.error('API returned success=false:', response.data);
        alert('Failed to send message: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Try fallback to socket-only if API fails
      if (socket) {
        console.log('API failed, trying socket-only fallback...');
        socket.emit('send-message', {
          senderId: user._id,
          receiverId: selectedUser._id,
          message: newMessage.trim(),
          senderName: `${user.firstName} ${user.lastName}`
        });
        
        // Add to local messages even if API failed
        setMessages(prev => [...prev, {
          _id: Date.now().toString(), // Temporary ID
          senderId: user._id,
          senderName: `${user.firstName} ${user.lastName}`,
          message: newMessage.trim(),
          timestamp: new Date(),
          isReceived: false,
          unsaved: true // Mark as unsaved
        }]);
        
        setNewMessage('');
        alert('Message sent via real-time only (not saved to database)');
      } else {
        alert('Failed to send message. Please try again.');
      }
    }
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
          <button 
            onClick={testMessagesAPI}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test API
          </button>
        </div>
        
        <div className="users-list">
          {allUsers.map(chatUser => (
            <div
              key={chatUser._id}
              className={`user-item ${selectedUser?._id === chatUser._id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedUser(chatUser);
                loadConversation(chatUser._id); // Load actual chat history
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