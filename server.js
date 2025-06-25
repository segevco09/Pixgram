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
  next();
});

// API Routes (must come before static files)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/friends', require('./routes/friends'));
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
        '/api/test/*'
      ]
    });
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their personal room
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Handle private messages
  socket.on('send-message', (data) => {
    const { senderId, receiverId, message, senderName } = data;
    
    // Emit to receiver's room
    socket.to(`user-${receiverId}`).emit('new-message', {
      senderId,
      senderName,
      message,
      timestamp: new Date()
    });
    
    console.log(`Message from ${senderName} to user ${receiverId}: ${message}`);
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