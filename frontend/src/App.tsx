import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import ReportForm from './components/ReportForm';
import MapView from './components/MapView';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import PredictiveAnalytics from './components/PredictiveAnalytics';
import './App.css';

function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminToken, setAdminToken] = useState('');

  // Check if user is already logged in on app start
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      // In a real app, you would verify the token with the server
      // For this demo, we'll just check if it exists and has the right format
      if (token.startsWith('admin-token-')) {
        setIsAdminLoggedIn(true);
        setAdminToken(token);
      } else {
        // Invalid token, remove it
        localStorage.removeItem('adminToken');
      }
    }
  }, []);

  const handleLoginSuccess = (token: string) => {
    setIsAdminLoggedIn(true);
    setAdminToken(token);
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setAdminToken('');
    localStorage.removeItem('adminToken');
  };

  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo">
              <span className="logo-neuro">Neuro</span>
              <span className="logo-city">City</span>
            </Link>
            <ul className="nav-links">
              <li><Link to="/" className="nav-link">Report Issue</Link></li>
              <li><Link to="/map" className="nav-link">Live Map</Link></li>
              {isAdminLoggedIn ? (
                <>
                  <li><Link to="/admin" className="nav-link">Dashboard</Link></li>
                  <li><Link to="/analytics" className="nav-link">Analytics</Link></li>
                  <li>
                    <button 
                      onClick={handleLogout}
                      className="nav-link-button"
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'white', 
                        cursor: 'pointer',
                        padding: '0.5rem 1rem'
                      }}
                    >
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <li><Link to="/admin" className="nav-link">Admin Login</Link></li>
              )}
            </ul>
          </div>
        </nav>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ReportForm />} />
            <Route path="/map" element={<MapView />} />
            <Route 
              path="/admin" 
              element={
                isAdminLoggedIn ? 
                <AdminDashboard /> : 
                <AdminLogin onLoginSuccess={handleLoginSuccess} />
              } 
            />
            <Route 
              path="/analytics" 
              element={
                isAdminLoggedIn ? 
                <PredictiveAnalytics /> : 
                <AdminLogin onLoginSuccess={handleLoginSuccess} />
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
