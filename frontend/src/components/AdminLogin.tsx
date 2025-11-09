import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

interface AdminLoginProps {
  onLoginSuccess: (token: string) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/admin/login`, {
        username,
        password
      });

      if (response.data.success) {
        // Save token to localStorage
        localStorage.setItem('adminToken', response.data.token);
        onLoginSuccess(response.data.token);
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Invalid credentials');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '80vh',
      padding: '2rem'
    }}>
      <div className="form-container" style={{ maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="form-title">Admin Login</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Enter your credentials to access the dashboard</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              placeholder="Enter username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="Enter password"
              required
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>

          <div style={{
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginTop: '1rem'
          }}>
            <p style={{ margin: '0.25rem 0' }}>Demo credentials:</p>
            <p style={{ margin: '0.25rem 0' }}>Username: <strong style={{ color: 'var(--cyber-blue)' }}>admin</strong></p>
            <p style={{ margin: '0.25rem 0' }}>Password: <strong style={{ color: 'var(--cyber-blue)' }}>admin</strong></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;