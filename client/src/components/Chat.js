import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import './Chat.css';

function Chat() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const messagesEndRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (user) {
      console.log('🔌 Initializing socket connection for user:', user.id);
      const newSocket = io('http://localhost:5000');
      
      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id);
        newSocket.emit('join-user-room', user._id || user.id);
      });

      newSocket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
      });

      // Listen for new messages from Chats database
      newSocket.on('new-message', (messageData) => {
        console.log('📨 Received new message via socket:', messageData);
        console.log('📨 Current user ID:', user._id || user.id);
        console.log('📨 Selected friend ID:', selectedFriend?.id);
        console.log('📨 Message senderId:', messageData.senderId);
        console.log('📨 Message receiverId:', messageData.receiverId);
        
        // Add message to current conversation if it's related to the current user
        const currentUserId = user._id || user.id;
        const isForCurrentUser = messageData.receiverId === currentUserId || messageData.senderId === currentUserId;
        
        if (isForCurrentUser) {
          // Update the messages state if this is the active conversation
          setMessages(prev => {
            // Check if message already exists (to prevent duplicates)
            const messageExists = prev.some(msg => msg._id === messageData._id);
            if (messageExists) {
              console.log('📨 Message already exists, skipping');
              return prev;
            }
            
            console.log('📨 Adding new message to conversation');
            return [...prev, {
              _id: messageData._id,
              senderId: messageData.senderId,
              senderName: messageData.senderName,
              receiverId: messageData.receiverId,
              receiverName: messageData.receiverName,
              content: messageData.message,
              createdAt: messageData.timestamp,
              isRead: messageData.isRead
            }];
          });
        }

        // Update conversations list
        loadConversations();
      });

      newSocket.on('message-confirmed', (data) => {
        console.log('✅ Message confirmed:', data);
      });

      newSocket.on('message-error', (error) => {
        console.error('❌ Socket message error:', error);
        alert('Failed to send message: ' + error.error);
      });

      setSocket(newSocket);

      return () => {
        console.log('🔌 Cleaning up socket connection');
        newSocket.disconnect();
      };
    }
  }, [user]);

  // Load friends list
  useEffect(() => {
    console.log('🔄 Chat component effect triggered');
    console.log('👤 User state:', user);
    
    if (user) {
      console.log('🔄 User is available, loading friends and conversations...');
      console.log('👤 Current user details:', {
        id: user.id,
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        fullName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username
      });
      
      loadFriends();
      loadConversations();
    } else {
      console.log('⚠️ User not available yet');
    }
  }, [user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Loading friends for chat...');
      
      // First try to load friends
      const friendsResponse = await fetch('http://localhost:5000/api/friends', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      let friendsList = [];
      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        console.log('👥 Loaded friends:', friendsData.friends);
        friendsList = friendsData.friends || [];
      }
      
      // Always load all users as well (for chat purposes)
      console.log('👥 Loading all registered users for chat...');
      await loadAllUsers();
      
      // If we have friends, we could prioritize them later
      if (friendsList.length > 0) {
        console.log(`✅ Found ${friendsList.length} friends`);
      }
      
    } catch (error) {
      console.error('Error loading friends:', error);
      // Fallback to loading all users
      await loadAllUsers();
    }
  };

  const loadAllUsers = async () => {
    try {
      console.log('👥 Loading all registered users...');
      console.log('👤 Current user ID:', user?.id);
      
      // Get users from the test endpoint (no auth needed)
      const response = await fetch('http://localhost:5000/api/test/users');
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('👥 Raw API response:', data);
        console.log('👥 Users count:', data.users?.length);
        
        if (data.users && data.users.length > 0) {
          // Convert users to friends format and exclude current user
          const usersAsFriends = data.users
            .filter(u => {
              const currentUserId = user?._id || user?.id;
              const isCurrentUser = u._id === currentUserId;
              console.log(`🔍 User ${u.username} (${u._id}) - Current user: ${isCurrentUser} (comparing with ${currentUserId})`);
              return !isCurrentUser;
            })
            .map(u => ({
              id: u._id,
              name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
              username: u.username,
              firstName: u.firstName,
              lastName: u.lastName
            }));
          
          console.log('✅ Final users for chat:', usersAsFriends);
          console.log(`📊 Setting ${usersAsFriends.length} users in chat list`);
          setFriends(usersAsFriends);
          
          if (usersAsFriends.length === 0) {
            console.log('⚠️ No other users found to chat with');
          }
        } else {
          console.log('⚠️ No users array in response or empty array');
        }
      } else {
        console.error('❌ Failed to load users, status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error loading all users:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Stack trace:', error.stack);
    }
  };

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/messages/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('💬 Loaded conversations from Chats DB:', data.conversations);
        setConversations(data.conversations || []);
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
      console.log(`📖 Loading conversation with user ${friendId} from Chats DB`);
      
      const response = await fetch(`http://localhost:5000/api/messages/conversation/${friendId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📖 Loaded ${data.messages.length} messages from Chats DB:`, data.messages);
        
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
    console.log('👤 Selected friend:', friend);
    setSelectedFriend(friend);
    loadConversation(friend.id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedFriend || !socket) return;

    console.log('🔍 DEBUG - User object:', user);
    console.log('🔍 DEBUG - User ID:', user.id);
    console.log('🔍 DEBUG - User _ID:', user._id);
    console.log('🔍 DEBUG - Selected friend:', selectedFriend);
    console.log('🔍 DEBUG - Selected friend ID:', selectedFriend.id);

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

    console.log('📤 Sending message via socket to Chats DB:', messageData);
    console.log('🔍 DEBUG - Message data types:', {
      senderIdType: typeof messageData.senderId,
      receiverIdType: typeof messageData.receiverId,
      senderId: messageData.senderId,
      receiverId: messageData.receiverId
    });

    try {
      // Send via socket (will save to Chats database)
      socket.emit('send-message', messageData);

      // Clear the input immediately
      setNewMessage('');
      
      // Don't add temporary message - wait for real-time update via socket
      console.log('📤 Message sent, waiting for real-time update...');
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDisplayList = () => {
    // Combine friends and conversations, prioritizing conversations
    const conversationUserIds = new Set(conversations.map(conv => conv.otherUserId));
    const friendsNotInConversations = friends.filter(friend => !conversationUserIds.has(friend.id));
    
    const conversationItems = conversations.map(conv => ({
      id: conv.otherUserId,
      name: conv.otherUserName,
      lastMessage: conv.lastMessage.content,
      lastMessageTime: conv.lastMessage.createdAt,
      unreadCount: conv.unreadCount,
      isConversation: true
    }));

    const friendItems = friendsNotInConversations.map(friend => ({
      id: friend.id,
      name: friend.name,
      lastMessage: 'No messages yet',
      lastMessageTime: null,
      unreadCount: 0,
      isConversation: false
    }));

    return [...conversationItems, ...friendItems];
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-header">
          <h3>💬 Chats</h3>
          <small>Powered by Chats Database</small>
        </div>
        
        <div className="friends-list">
          {getDisplayList().map((item) => (
            <div
              key={item.id}
              className={`friend-item ${selectedFriend?.id === item.id ? 'active' : ''}`}
              onClick={() => selectFriend(item)}
            >
              <div className="friend-info">
                <div className="friend-name">
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
              <div className="conversation-indicator">
                {item.isConversation ? '💾' : '👤'}
              </div>
            </div>
          ))}
          
          {getDisplayList().length === 0 && (
            <div className="no-friends">
              <p>No users loaded yet</p>
              <small>Registered users should appear here</small>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <button 
                  onClick={() => {
                    console.log('🔄 Debug - Current state:');
                    console.log('Friends array:', friends);
                    console.log('Friends length:', friends.length);
                    console.log('Conversations:', conversations);
                    console.log('User:', user);
                    console.log('User ID:', user?.id);
                    loadFriends();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Reload Users
                </button>
                
                <button 
                  onClick={() => {
                    console.log('👥 Force loading all users...');
                    console.log('Current user ID:', user?.id);
                    loadAllUsers();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  👥 Force Load Users
                </button>
                
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(255,255,255,0.8)', 
                  marginTop: '10px',
                  textAlign: 'center'
                }}>
                  Friends: {friends.length} | User: {user?.username || 'Not loaded'}
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
              <small>Messages stored in Chats Database</small>
            </div>

            <div className="messages-container">
              {isLoading ? (
                <div className="loading">Loading messages from Chats DB...</div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message._id}
                      className={`message ${message.senderId === (user._id || user.id) ? 'sent' : 'received'}`}
                    >
                      <div className="message-content">
                        <div className="message-text">{message.content}</div>
                        <div className="message-time">
                          {formatTime(message.createdAt)}
                          {message.senderId === (user._id || user.id) && (
                            <span className={`message-status ${message.isRead ? 'read' : 'sent'}`}>
                              {message.isRead ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

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
                Send to Chats DB 📤
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <h3>Select a friend to start chatting</h3>
            <p>Your messages will be stored in the Chats database</p>
            <div className="chat-features">
              <div className="feature">
                <span className="feature-icon">💾</span>
                <span>Persistent Storage</span>
              </div>
              <div className="feature">
                <span className="feature-icon">⚡</span>
                <span>Real-time Messaging</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🔒</span>
                <span>Secure & Private</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat; 