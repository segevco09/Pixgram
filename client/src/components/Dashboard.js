import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Feed from './Feed';
import Groups from './Groups';
import Chat from './Chat';
import Friends from './Friends';
import Profile from './Profile';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');

  const handleLogout = () => {
    logout();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'feed':
        return <Feed />;
      case 'groups':
        return <Groups />;
      case 'friends':
        return <Friends />;
      case 'chat':
        return <Chat />;
      case 'profile':
        return <Profile />;
      default:
        return <Feed />;
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Pixgram</h1>
          <nav className="dashboard-nav">
            <button
              className={`nav-button ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              Feed
            </button>
            <button
              className={`nav-button ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              Groups
            </button>
            <button
              className={`nav-button ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              Friends
            </button>
            <button
              className={`nav-button ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button
              className={`nav-button ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
          </nav>
          <div className="user-info">
            <span>Welcome, {user?.firstName} {user?.lastName}!</span>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard; 