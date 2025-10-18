import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import RegisterUser from './components/RegisterUser';
import MarkAttendance from './components/MarkAttendance';
import ViewAttendance from './components/ViewAttendance';
import Login from './components/Login';
import Reports from './components/Reports';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    
    if (token && username) {
      setIsAuthenticated(true);
      setUser({ username, role });
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser({ username: userData.username, role: userData.role });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-content">
            <h1>🎓 Smart Attendance System</h1>
            <div className="user-info">
              <span>Welcome, {user?.username}</span>
              <button onClick={handleLogout} className="logout-btn">
                🚪 Logout
              </button>
            </div>
          </div>
          <ul className="nav-links">
            <li><Link to="/">📊 Dashboard</Link></li>
            <li><Link to="/register">➕ Register User</Link></li>
            <li><Link to="/mark">✅ Mark Attendance</Link></li>
            <li><Link to="/view">📋 View Attendance</Link></li>
            <li><Link to="/reports">📈 Reports</Link></li>
            <li><Link to="/admin">⚙️ Admin Panel</Link></li>
          </ul>
        </nav>
        
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/register" element={<RegisterUser />} />
            <Route path="/mark" element={<MarkAttendance />} />
            <Route path="/view" element={<ViewAttendance />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        
        <footer className="footer">
          <p>© 2025 Smart Attendance System | Powered by Deep Learning & React</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
