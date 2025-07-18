import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import './Chat.css';
import axios from 'axios';

function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const messagesEndRef = useRef(null);
  const selectedFriendRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');

  // Initialize socket connection
  useEffect(() => {
    if (user) {
      const newSocket = io('http://localhost:5000', {
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000,
        forceNew: true
      });
      
      newSocket.on('connect', () => {
        const userId = user._id || user.id;
        newSocket.emit('join-user-room', userId);
      });

      newSocket.on('disconnect', (reason) => {
      });

      newSocket.on('connect_error', (error) => {
      });

      newSocket.on('reconnect', (attemptNumber) => {
      });

      newSocket.on('reconnect_error', (error) => {
      });

      newSocket.on('room-joined', (data) => {
      });

      newSocket.on('new-message', (messageData) => {
        
        const currentUserId = (user._id || user.id).toString();
        const messageSenderId = messageData.senderId.toString();
        const messageReceiverId = messageData.receiverId.toString();
        
        const isForCurrentUser = messageReceiverId === currentUserId || messageSenderId === currentUserId;
        
        if (isForCurrentUser) {
          
          const currentSelectedFriend = selectedFriendRef.current;
          const selectedFriendId = currentSelectedFriend?.id?.toString();
          const isForActiveConversation = selectedFriendId && (
            (messageSenderId === currentUserId && messageReceiverId === selectedFriendId) ||
            (messageSenderId === selectedFriendId && messageReceiverId === currentUserId)
          );
          
          if (isForActiveConversation || !currentSelectedFriend) {
          setMessages(prev => {
              const messageExists = prev.some(msg => 
                msg._id && messageData._id && msg._id.toString() === messageData._id.toString()
              );
              
            if (messageExists) {
              return prev;
            }
            
              const newMessage = {
              _id: messageData._id,
              senderId: messageData.senderId,
              senderName: messageData.senderName,
              receiverId: messageData.receiverId,
              receiverName: messageData.receiverName,
                content: messageData.message || messageData.content,
                createdAt: messageData.timestamp || messageData.createdAt,
              isRead: messageData.isRead
              };
              
              const optimisticIndex = prev.findIndex(msg => 
                msg.isOptimistic && 
                msg.senderId === newMessage.senderId && 
                msg.content === newMessage.content
              );
              
              if (optimisticIndex !== -1) {
                const updatedMessages = [...prev];
                updatedMessages[optimisticIndex] = newMessage;
                return updatedMessages;
              } else {
                return [...prev, newMessage];
              }
            });
          } else {
        }

          setTimeout(() => {
            loadConversations();
          }, 100);
        } else {
        }
      });

      newSocket.on('message-confirmed', (data) => {
      });

      newSocket.on('message-error', (error) => {
        alert('Failed to send message: ' + error.error);
      });

      // Listen for message edits
      newSocket.on('message-edited', (data) => {
        const { messageId, newContent, editedAt } = data;
        
        setMessages(prev => prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, content: newContent, editedAt: editedAt }
            : msg
        ));
      });

      // Listen for message deletions
      newSocket.on('message-deleted', (data) => {
        const { messageId } = data;
        
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
      });



      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  useEffect(() => {
    const userId = searchParams.get('userId');
    
    if (userId && friends.length > 0) {
      const friendToSelect = friends.find(friend => friend.id === userId);
      
      if (friendToSelect && (!selectedFriend || selectedFriend.id !== userId)) {
        selectFriend(friendToSelect);
        setSearchParams({});
      }
    }
   }, [searchParams, friends, selectedFriend]);

  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [user]);

  useEffect(() => {
    if (user && friends.length > 0) {
      loadConversations();
    }
  }, [user, friends]);

  const getDisplayList = () => {
    return friends.map(friend => {
      const conv = conversations.find(c => c.otherUserId === friend.id);
      return {
        id: friend.id,
        name: friend.name,
        lastMessage: conv ? conv.lastMessage.content : 'No messages yet',
        lastMessageTime: conv ? conv.lastMessage.createdAt : null,
        unreadCount: conv ? conv.unreadCount : 0,
        isConversation: !!conv
      };
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/friends', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setFriends(
          (response.data.friends || []).map(u => ({
            id: u._id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
            username: u.username,
            firstName: u.firstName,
            lastName: u.lastName
          }))
        );
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/messages/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setConversations(response.data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversation = async (friendId) => {
    if (!friendId) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`/api/messages/conversation/${friendId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const data = response.data;
        
        // Convert messages to expected format
        const formattedMessages = data.messages.map(msg => ({
          _id: msg._id,
          senderId: msg.senderId,
          senderName: msg.senderName,
          receiverId: msg.receiverId,
          receiverName: msg.receiverName,
          content: msg.content,
          createdAt: msg.createdAt,
          isRead: msg.isRead
        }));
        
        setMessages(formattedMessages);
      } else {
        console.error('Failed to load conversation');
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectFriend = (friend) => {
    setSelectedFriend(friend);
    selectedFriendRef.current = friend; // Update ref as well
    loadConversation(friend.id);
    // Note: Messages are automatically marked as read in loadConversation server endpoint
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) {
      console.warn('⚠️ Empty message, not sending');
      return;
    }
    
    if (!selectedFriend) {
      console.warn('⚠️ No friend selected, not sending');
      return;
    }
    
    if (!socket) {
      console.error('Socket not connected, cannot send message');
      alert('Not connected to chat server. Please refresh the page.');
      return;
    }

    if (!socket.connected) {
      console.error('Socket disconnected, cannot send message');
      alert('Disconnected from chat server. Please refresh the page.');
      return;
    }

    // Construct full name from firstName and lastName
    const senderName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.username || 'Unknown User';

    const messageData = {
      senderId: user._id || user.id,
      receiverId: selectedFriend.id,
      message: newMessage.trim(),
      senderName: senderName,
      receiverName: selectedFriend.name
    };

    try {
      const optimisticMessage = {
        _id: `temp_${Date.now()}`,
        senderId: messageData.senderId,
        senderName: messageData.senderName,
        receiverId: messageData.receiverId,
        receiverName: messageData.receiverName,
        content: messageData.message,
        createdAt: new Date(),
        isRead: false,
        isOptimistic: true
      };

      setMessages(prev => [...prev, optimisticMessage]);

      socket.emit('send-message', messageData);

      setNewMessage('');
      
      
    } catch (error) {
      console.error('Error sending message:', error);
      alert(`Failed to send message: ${error.message}`);
      
      setMessages(prev => prev.filter(msg => !msg.isOptimistic || msg.content !== messageData.message));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleMessageLongPress = (message, event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const currentUserId = (user._id || user.id).toString();
    if (message.senderId.toString() !== currentUserId) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX || rect.right;
    const clickY = event.clientY || rect.top;

    const menuWidth = 200; 
    const menuHeight = 120; 
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let adjustedX = clickX;
    if (clickX + menuWidth > viewportWidth) {
      adjustedX = clickX - menuWidth;
    }
    
    let adjustedY = clickY;
    if (clickY + menuHeight > viewportHeight) {
      adjustedY = clickY - menuHeight;
    }
    
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    setContextMenu({
      message,
      x: adjustedX,
      y: adjustedY
    });
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message._id);
    setEditText(message.content);
    setContextMenu(null);
  };

  const saveEditedMessage = async (messageId) => {
    if (!editText.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const requestData = {
        content: editText.trim(),
        otherUserId: selectedFriend.id
      };
      
      
      const response = await axios.put(`/api/messages/edit/${messageId}`, requestData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setMessages(prev => prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, content: editText.trim(), editedAt: new Date() }
            : msg
        ));
        
        if (socket) {
          socket.emit('message-edited', {
            messageId,
            newContent: editText.trim(),
            senderId: user._id || user.id,
            receiverId: selectedFriend.id,
            editedAt: new Date()
          });
        }
        
      } else {
        const errorData = response.data;
        console.error('Failed to edit message:', response.status, errorData);
        alert(`Failed to edit message: ${response.status} ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Error editing message');
    }

    setEditingMessage(null);
    setEditText('');
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleDeleteMessage = async (message) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/messages/${message._id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        data: {
          otherUserId: selectedFriend.id
        }
      });

      if (response.data.success) {
        setMessages(prev => prev.filter(msg => msg._id !== message._id));
        
        if (socket) {
          socket.emit('message-deleted', {
            messageId: message._id,
            senderId: user._id || user.id,
            receiverId: selectedFriend.id
          });
        }
        
      } else {
        console.error('Failed to delete message');
        alert('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Error deleting message');
    }

    setContextMenu(null);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-header">
          <h3>💬 Chats</h3>
        </div>
        
        <div className="friends-list">
          {getDisplayList().map((item) => (
            <div
              key={item.id}
              className={`friend-item ${selectedFriend?.id === item.id ? 'active' : ''}`}
              onClick={() => selectFriend(item)}
            >
              <div className="friend-info">
                <div 
                  className="friend-name clickable" 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/dashboard?tab=friends&userId=${item.id}`);
                  }}
                >
                  {item.name}
                  {item.unreadCount > 0 && (
                    <span className="unread-badge">{item.unreadCount}</span>
                  )}
                </div>
                <div className="friend-last-message">
                  {item.lastMessage}
                </div>
                {item.lastMessageTime && (
                  <div className="friend-last-time">
                    {formatTime(item.lastMessageTime)}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {getDisplayList().length === 0 && (
            <div className="no-friends">
              <p>Loading friends...</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              
                
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(255,255,255,0.8)', 
                  marginTop: '10px',
                  textAlign: 'center'
                }}>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-main">
        {selectedFriend ? (
          <>
            <div className="chat-header">
              <h3>💬 {selectedFriend.name}</h3>
            </div>

            <div className="messages-container">
              {isLoading ? (
                <div className="loading">Loading messages from Chats DB...</div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message._id}
                      className={`message ${message.senderId === (user._id || user.id) ? 'sent' : 'received'} ${message.isOptimistic ? 'optimistic' : ''}`}
                      onContextMenu={(e) => handleMessageLongPress(message, e)}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        const longPressTimer = setTimeout(() => {
                          handleMessageLongPress(message, {
                            preventDefault: () => {},
                            stopPropagation: () => {},
                            currentTarget: e.currentTarget,
                            clientX: touch.clientX,
                            clientY: touch.clientY
                          });
                        }, 500);
                        
                        const handleTouchEnd = () => {
                          clearTimeout(longPressTimer);
                          document.removeEventListener('touchend', handleTouchEnd);
                        };
                        
                        document.addEventListener('touchend', handleTouchEnd);
                      }}
                    >
                      <div className="message-content">
                        {editingMessage === message._id ? (
                          <div className="message-edit-container">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="message-edit-input"
                              autoFocus
                            />
                            <div className="message-edit-actions">
                              <button 
                                onClick={() => saveEditedMessage(message._id)}
                                className="edit-save-btn"
                              >
                                Save
                              </button>
                              <button 
                                onClick={cancelEditing}
                                className="edit-cancel-btn"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="message-text">
                              {message.content}
                              {message.editedAt && (
                                <span className="edited-indicator"> (edited)</span>
                              )}
                            </div>
                        <div className="message-time">
                          {formatTime(message.createdAt)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {}
            {contextMenu && (
              <div 
                className="message-context-menu"
                style={{
                  position: 'fixed',
                  top: contextMenu.y,
                  left: contextMenu.x,
                  zIndex: 1000
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="context-menu-item" onClick={() => handleEditMessage(contextMenu.message)}>
                  <span className="context-menu-icon">✏️</span>
                  Edit Message
                </div>
                <div className="context-menu-item" onClick={() => handleDeleteMessage(contextMenu.message)}>
                  <span className="context-menu-icon">🗑️</span>
                  Delete Message
                </div>
                <div className="context-menu-item" onClick={() => {
                  navigator.clipboard.writeText(contextMenu.message.content);
                  setContextMenu(null);
                }}>
                  <span className="context-menu-icon">📋</span>
                  Copy Text
                </div>
              </div>
            )}

            <div className="message-input-container">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message ${selectedFriend.name}...`}
                className="message-input"
                rows="2"
              />
              <button 
                onClick={sendMessage} 
                className="send-button"
                disabled={!newMessage.trim()}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <h3>Select a friend to start chatting</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat; 