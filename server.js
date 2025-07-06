const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Make io instance available to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
console.log('🔍 Attempting to connect to:', process.env.MONGODB_URI ? 'MongoDB Atlas' : 'Local MongoDB');
console.log('🔍 Connection string starts with:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'mongodb://localhost...');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pixgram', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});


// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers.authorization ? 'Auth header present' : 'No auth header');
  
  // Special logging for messages API
  if (req.url.startsWith('/api/messages')) {
    console.log('🔔 MESSAGES API REQUEST:', req.method, req.url);
    console.log('🔔 Request body:', req.body);
    console.log('🔔 Auth header:', req.headers.authorization ? 'Present' : 'Missing');
  }
  
  next();
});

// API Routes (must come before static files)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/test', require('./routes/test'));

// Serve static files from React app (only if build directory exists)
const buildPath = path.join(__dirname, 'client/build');
const fs = require('fs');

if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  
  // Catch all handler: send back React's index.html file for any non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  console.log('⚠️  React build not found. API-only mode. React dev server should be running on port 3000.');
  
  // Fallback for non-API routes in development
  app.get('*', (req, res) => {
    res.json({
      message: 'Pixgram API Server',
      note: 'React app should be running on http://localhost:3000',
      availableRoutes: [
        '/api/auth/*',
        '/api/posts/*',
        '/api/friends/*',
        '/api/groups/*',
        '/api/messages/*',
        '/api/test/*'
      ]
    });
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 New socket connection established:', socket.id);
  console.log('🔌 Socket handshake:', socket.handshake.address);

  // Join user to their personal room
  socket.on('join-user-room', (userId) => {
    const roomName = `user-${userId}`;
    socket.join(roomName);
    console.log(`🏠 User ${userId} joined room: ${roomName} (Socket: ${socket.id})`);
    
    // Confirm room joining
    socket.emit('room-joined', { 
      userId, 
      roomName,
      message: `Successfully joined room ${roomName}` 
    });
  });

  // Handle private messages (saves to Chats database)
  socket.on('send-message', async (data) => {
    console.log('🔍 RAW SOCKET DATA:', data);
    const { senderId, receiverId, message, senderName, receiverName } = data;
    
    console.log('🔍 EXTRACTED VALUES:', {
      senderId,
      receiverId,
      message,
      senderName,
      receiverName,
      senderIdType: typeof senderId,
      receiverIdType: typeof receiverId
    });
    
    try {
      console.log(`💬 Socket saving message from ${senderName} to ${receiverName || receiverId}: ${message}`);
      
      // Save message to Chats database using ChatManager
      const { chatManager } = require('./models/ChatMessage');
      
      // Get receiver name if not provided
      let finalReceiverName = receiverName;
      if (!finalReceiverName) {
        const User = require('./models/User');
        const receiver = await User.findById(receiverId);
        finalReceiverName = receiver ? receiver.name : 'Unknown User';
      }
      
      const savedMessage = await chatManager.sendMessage(
        senderId,
        senderName,
        receiverId,
        finalReceiverName,
        message,
        'text'
      );
      
      // Prepare message data with consistent structure
      const messageData = {
        _id: savedMessage._id,
        senderId: savedMessage.senderId,
        senderName: savedMessage.senderName,
        receiverId: savedMessage.receiverId,
        receiverName: savedMessage.receiverName,
        message: savedMessage.content,
        content: savedMessage.content, // Add both for compatibility
        timestamp: savedMessage.createdAt,
        createdAt: savedMessage.createdAt, // Add both for compatibility
        isRead: savedMessage.isRead
      };

      console.log(`📤 Broadcasting message to receiver room: user-${receiverId}`);
      console.log(`📤 Broadcasting message to sender room: user-${senderId}`);

      // Emit to receiver's room (other users connected as this receiver)
      io.to(`user-${receiverId}`).emit('new-message', messageData);
      
      // Emit to sender's socket directly (current socket that sent the message)
      socket.emit('new-message', messageData);
      
      // Also broadcast to sender's room (in case sender has multiple tabs open)
      socket.to(`user-${senderId}`).emit('new-message', messageData);
      
      // Confirm to sender with additional details
      socket.emit('message-confirmed', {
        _id: savedMessage._id,
        timestamp: savedMessage.createdAt,
        success: true
      });
      
      console.log(`✅ Message saved to Chats DB and broadcast from ${senderName} to ${finalReceiverName}: ${message}`);
    } catch (error) {
      console.error('❌ Error saving message to Chats DB:', error);
      
      // Send error to sender
      socket.emit('message-error', {
        error: 'Failed to save message to database',
        details: error.message
      });
    }
  });

  // Handle real-time message delivery (already saved via API)
  socket.on('send-message-realtime', (data) => {
    const { _id, senderId, receiverId, message, senderName, timestamp, alreadySaved } = data;
    
    console.log(`Real-time delivery from ${senderName} to user ${receiverId}: ${message} (already saved: ${alreadySaved})`);
    
    // Just emit to receiver - don't save to database again
    socket.to(`user-${receiverId}`).emit('new-message', {
      _id,
      senderId,
      senderName,
      message,
      timestamp,
      isRead: false
    });
  });

  // Handle group messages
  socket.on('join-group', (groupId) => {
    socket.join(`group-${groupId}`);
    console.log(`User joined group ${groupId}`);
  });

  socket.on('send-group-message', (data) => {
    const { groupId, senderId, senderName, message } = data;
    
    socket.to(`group-${groupId}`).emit('new-group-message', {
      senderId,
      senderName,
      message,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 