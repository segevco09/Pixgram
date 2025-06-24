const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

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


// API Routes (must come before static files)
app.use('/api/auth', require('./routes/auth'));

// Serve static files from React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 