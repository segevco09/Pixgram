# Pixgram - Social Media Platform

A minimal social media platform built with React, Node.js, Express, and MongoDB for a Computer Science final project.

## Features

- User authentication (login/register)
- JWT-based authentication
- Input validation and error handling
- Responsive design with CSS3 features
- Modern React with hooks and context

## Tech Stack

- **Frontend**: React 19, React Router DOM, Axios
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Styling**: CSS3 with features like border-radius, transitions, text-shadow

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or MongoDB Atlas connection string)
- npm or yarn

### Installation

1. **Clone the repository** (if applicable)
   ```bash
   git clone <repository-url>
   cd pixgram
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```
   MONGODB_URI=mongodb://localhost:27017/pixgram
   JWT_SECRET=your-secret-key-here
   PORT=5000
   ```

5. **Start MongoDB**
   - If using local MongoDB: Make sure MongoDB is running on your system
   - If using MongoDB Atlas: Use your connection string in the MONGODB_URI

6. **Run the application**
   ```bash
   npm run dev
   ```
   This will start both the backend server (port 5000) and React frontend (port 3000)

### Alternative: Run separately

- **Backend only**: `npm start`
- **Frontend only**: `cd client && npm start`

## Usage

1. Open your browser and go to `http://localhost:3000`
2. You'll be redirected to the login page
3. Click "Sign up here" to create a new account
4. Fill in the registration form with:
   - First Name
   - Last Name
   - Username (must be unique)
   - Email (must be unique and valid)
   - Password (minimum 6 characters)
   - Confirm Password
5. After successful registration, you'll be automatically logged in and redirected to the dashboard
6. To test login functionality, logout and login again with your credentials

## Project Structure

```
pixgram/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Auth.css
│   │   │   └── Dashboard.css
│   │   ├── contexts/       # React contexts
│   │   │   └── AuthContext.js
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── models/                 # Database models
│   └── User.js
├── routes/                 # API routes
│   └── auth.js
├── middleware/             # Custom middleware
│   └── auth.js
├── server.js              # Express server
├── package.json
└── README.md
```

## API Endpoints

### Authentication Routes (`/api/auth`)

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

## CSS3 Features Used

- **border-radius**: Rounded corners on cards, buttons, and form elements
- **transition**: Smooth hover effects and animations
- **text-shadow**: Subtle shadows on headings and text

## Future Enhancements

This is a minimal implementation focusing on authentication. Future features planned:
- Posts and feeds
- Groups and group management
- Real-time chat with Socket.io
- Media upload functionality
- User profiles and followers
- Search functionality

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check your connection string in `.env`
   - For MongoDB Atlas, ensure your IP is whitelisted

2. **Port Already in Use**
   - Change the PORT in `.env` file
   - Kill any processes using ports 3000 or 5000

3. **CORS Issues**
   - Ensure the proxy is set in `client/package.json`
   - Check that both servers are running

4. **JWT Errors**
   - Ensure JWT_SECRET is set in `.env`
   - Clear localStorage and try logging in again

## License

This project is for educational purposes as part of a Computer Science final project. 