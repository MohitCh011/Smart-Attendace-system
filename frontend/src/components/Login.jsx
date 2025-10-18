import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const Login = ({ onLogin }) => {
  const [loginType, setLoginType] = useState('class'); // 'class' or 'admin'
  const [classes, setClasses] = useState([]);
  const [credentials, setCredentials] = useState({
    class_code: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loginType === 'class') {
      fetchClasses();
    }
  }, [loginType]);

  const fetchClasses = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/classes');
      setClasses(response.data.classes);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', credentials);
      
      // Store token and user info
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('class_code', response.data.class_code);
      localStorage.setItem('class_name', response.data.class_name);
      localStorage.setItem('department', response.data.department);
      localStorage.setItem('role', response.data.role);
      
      onLogin(response.data);
      navigate('/');
      
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <h1>🎓</h1>
          <h2>College Attendance System</h2>
          <p>Secure Class-Based Access</p>
        </div>

        {/* Login Type Selector */}
        <div className="login-type-selector">
          <button
            className={`type-btn ${loginType === 'class' ? 'active' : ''}`}
            onClick={() => setLoginType('class')}
          >
            👥 Class Login
          </button>
          <button
            className={`type-btn ${loginType === 'admin' ? 'active' : ''}`}
            onClick={() => setLoginType('admin')}
          >
            🔐 Admin/Faculty
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {loginType === 'class' ? (
            <div className="form-group">
              <label>Select Your Class</label>
              <select
                name="class_code"
                value={credentials.class_code}
                onChange={handleChange}
                required
              >
                <option value="">-- Select Class --</option>
                {classes.map(cls => (
                  <option key={cls.code} value={cls.code}>
                    {cls.name} ({cls.code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="class_code"
                value={credentials.class_code}
                onChange={handleChange}
                required
                placeholder="Enter admin/faculty username"
              />
            </div>
          )}
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              placeholder="Enter password"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? '⏳ Logging in...' : '🔓 Login'}
          </button>
        </form>
        
        <div className="login-footer">
          <p><strong>Demo Credentials:</strong></p>
          <p>Class: CS101 / Password: cs101pass</p>
          <p>Admin: admin / Password: admin123</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
