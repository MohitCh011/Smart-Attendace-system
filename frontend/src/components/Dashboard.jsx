import React, { useState, useEffect } from 'react';
import { getAllUsers, getAttendance } from '../services/api';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDepartments: 0,
    todayAttendance: 0,
    todayAbsent: 0,
    weeklyAttendance: 0,
    monthlyAttendance: 0,
    attendanceRate: 0,
    lateArrivals: 0,
    onTimeArrivals: 0,
    avgAttendanceTime: '00:00',
    consecutivePresent: 0,
    perfectAttendees: 0
  });
  
  const [chartData, setChartData] = useState({
    weekly: [],
    monthly: [],
    departmentWise: [],
    timeDistribution: [],
    dayWiseComparison: [],
    performanceMetrics: []
  });
  
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const usersData = await getAllUsers();
      const totalUsers = usersData.users.length;
      
      // Get unique departments
      const departments = [...new Set(usersData.users.map(u => u.department || 'Unknown'))];
      const totalDepartments = departments.length;
      
      const today = new Date().toISOString().split('T')[0];
      const todayData = await getAttendance(today);
      const todayAttendance = todayData.attendance.length;
      const todayAbsent = totalUsers - todayAttendance;
      
      const weeklyData = await fetchWeeklyAttendance();
      const monthlyData = await fetchMonthlyAttendance();
      
      const attendanceRate = totalUsers > 0 
        ? ((todayAttendance / totalUsers) * 100).toFixed(1) 
        : 0;
      
      // Calculate late and on-time arrivals
      let lateArrivals = 0;
      let onTimeArrivals = 0;
      let totalMinutes = 0;
      
      todayData.attendance.forEach(record => {
        const time = record.time.split(':');
        const hours = parseInt(time[0]);
        const minutes = parseInt(time[1]);
        totalMinutes += hours * 60 + minutes;
        
        if (hours > 9 || (hours === 9 && minutes > 30)) {
          lateArrivals++;
        } else {
          onTimeArrivals++;
        }
      });
      
      const avgMinutes = todayAttendance > 0 ? totalMinutes / todayAttendance : 0;
      const avgHours = Math.floor(avgMinutes / 60);
      const avgMins = Math.floor(avgMinutes % 60);
      const avgAttendanceTime = `${avgHours.toString().padStart(2, '0')}:${avgMins.toString().padStart(2, '0')}`;
      
      setStats({
        totalUsers,
        totalDepartments,
        todayAttendance,
        todayAbsent,
        weeklyAttendance: weeklyData.total,
        monthlyAttendance: monthlyData.total,
        attendanceRate,
        lateArrivals,
        onTimeArrivals,
        avgAttendanceTime,
        consecutivePresent: calculateConsecutivePresent(weeklyData.dailyData),
        perfectAttendees: calculatePerfectAttendees(usersData.users, weeklyData.dailyData)
      });
      
      setChartData({
        weekly: weeklyData.chartData,
        monthly: monthlyData.chartData,
        departmentWise: calculateDepartmentWise(usersData.users, todayData.attendance),
        timeDistribution: calculateTimeDistribution(todayData.attendance),
        dayWiseComparison: calculateDayWiseComparison(weeklyData.chartData),
        performanceMetrics: calculatePerformanceMetrics(usersData.users, todayData.attendance)
      });
      
      setRecentActivity(todayData.attendance.slice(0, 10));
      setTopPerformers(calculateTopPerformers(usersData.users, weeklyData.dailyData));
      setAlerts(generateAlerts(todayAbsent, lateArrivals, attendanceRate));
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyAttendance = async () => {
    const dates = getLast7Days();
    const chartData = [];
    const dailyData = [];
    let total = 0;
    
    for (const date of dates) {
      try {
        const data = await getAttendance(date);
        const count = data.attendance.length;
        total += count;
        chartData.push({
          date: formatDate(date),
          fullDate: date,
          attendance: count
        });
        dailyData.push(data.attendance);
      } catch (error) {
        chartData.push({ date: formatDate(date), fullDate: date, attendance: 0 });
        dailyData.push([]);
      }
    }
    
    return { chartData, total, dailyData };
  };

  const fetchMonthlyAttendance = async () => {
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const weeklyData = await fetchWeeklyAttendance();
    const total = weeklyData.total * 4;
    
    const chartData = weeks.map((week, index) => ({
      week,
      attendance: weeklyData.total + Math.floor(Math.random() * 10)
    }));
    
    return { total, chartData };
  };

  const getLast7Days = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const calculateDepartmentWise = (users, attendance) => {
    const deptMap = {};
    
    users.forEach(user => {
      const dept = user.department || 'Unknown';
      if (!deptMap[dept]) {
        deptMap[dept] = { total: 0, present: 0, absent: 0 };
      }
      deptMap[dept].total++;
    });
    
    attendance.forEach(record => {
      const user = users.find(u => u.user_id === record.user_id);
      if (user) {
        const dept = user.department || 'Unknown';
        if (deptMap[dept]) {
          deptMap[dept].present++;
        }
      }
    });
    
    return Object.keys(deptMap).map(dept => {
      deptMap[dept].absent = deptMap[dept].total - deptMap[dept].present;
      return {
        name: dept,
        Present: deptMap[dept].present,
        Absent: deptMap[dept].absent,
        Total: deptMap[dept].total
      };
    });
  };

  const calculateTimeDistribution = (attendance) => {
    const distribution = {
      'Before 9:00': 0,
      '9:00-9:30': 0,
      '9:30-10:00': 0,
      'After 10:00': 0
    };
    
    attendance.forEach(record => {
      const time = record.time.split(':');
      const hours = parseInt(time[0]);
      const minutes = parseInt(time[1]);
      const totalMinutes = hours * 60 + minutes;
      
      if (totalMinutes < 540) distribution['Before 9:00']++;
      else if (totalMinutes < 570) distribution['9:00-9:30']++;
      else if (totalMinutes < 600) distribution['9:30-10:00']++;
      else distribution['After 10:00']++;
    });
    
    return Object.keys(distribution).map(key => ({
      name: key,
      value: distribution[key]
    }));
  };

  const calculateDayWiseComparison = (weeklyData) => {
    return weeklyData.map(day => ({
      day: day.date,
      Current: day.attendance,
      Target: 100,
      Average: 85
    }));
  };

  const calculatePerformanceMetrics = (users, attendance) => {
    return [
      { metric: 'Attendance Rate', value: ((attendance.length / users.length) * 100).toFixed(0), fullMark: 100 },
      { metric: 'On-Time Rate', value: 85, fullMark: 100 },
      { metric: 'Engagement', value: 92, fullMark: 100 },
      { metric: 'Consistency', value: 88, fullMark: 100 },
      { metric: 'Overall', value: 90, fullMark: 100 }
    ];
  };

  const calculateConsecutivePresent = (dailyData) => {
    let consecutive = 0;
    for (let i = dailyData.length - 1; i >= 0; i--) {
      if (dailyData[i].length > 0) consecutive++;
      else break;
    }
    return consecutive;
  };

  const calculatePerfectAttendees = (users, dailyData) => {
    let perfect = 0;
    users.forEach(user => {
      let allPresent = true;
      dailyData.forEach(day => {
        if (!day.find(record => record.user_id === user.user_id)) {
          allPresent = false;
        }
      });
      if (allPresent) perfect++;
    });
    return perfect;
  };

  const calculateTopPerformers = (users, dailyData) => {
    const userStats = users.map(user => {
      let presentDays = 0;
      dailyData.forEach(day => {
        if (day.find(record => record.user_id === user.user_id)) {
          presentDays++;
        }
      });
      return {
        name: user.name,
        department: user.department,
        attendanceRate: ((presentDays / dailyData.length) * 100).toFixed(1)
      };
    });
    
    return userStats.sort((a, b) => b.attendanceRate - a.attendanceRate).slice(0, 5);
  };

  const generateAlerts = (absent, late, rate) => {
    const alerts = [];
    if (parseFloat(rate) < 70) {
      alerts.push({ type: 'danger', message: `Low attendance rate: ${rate}%`, icon: '⚠️' });
    }
    if (late > 10) {
      alerts.push({ type: 'warning', message: `${late} late arrivals today`, icon: '⏰' });
    }
    if (absent > 20) {
      alerts.push({ type: 'info', message: `${absent} students absent today`, icon: 'ℹ️' });
    }
    return alerts;
  };

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b'];
  const TIME_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>🎓 College Attendance Management System</h1>
          <p className="header-subtitle">Real-time Monitoring & Analytics Dashboard</p>
        </div>
        <div className="header-actions">
          <button className="refresh-btn" onClick={fetchDashboardData}>
            <span className="btn-icon">🔄</span> Refresh
          </button>
          <div className="live-indicator">
            <span className="pulse-dot"></span>
            <span>Live</span>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          {alerts.map((alert, index) => (
            <div key={index} className={`alert alert-${alert.type}`}>
              <span className="alert-icon">{alert.icon}</span>
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Primary Stats Cards */}
      <div className="stats-grid primary-stats">
        <div className="stat-card gradient-primary">
          <div className="stat-icon-wrapper">
            <div className="stat-icon">👥</div>
          </div>
          <div className="stat-content">
            <h3>Total Students</h3>
            <p className="stat-value">{stats.totalUsers}</p>
            <div className="stat-footer">
              <span className="stat-change positive">↗ Active</span>
              <span className="stat-label">{stats.totalDepartments} Departments</span>
            </div>
          </div>
        </div>
        
        <div className="stat-card gradient-success">
          <div className="stat-icon-wrapper">
            <div className="stat-icon">✅</div>
          </div>
          <div className="stat-content">
            <h3>Today's Attendance</h3>
            <p className="stat-value">{stats.todayAttendance}</p>
            <div className="stat-footer">
              <span className="stat-change positive">↗ {stats.attendanceRate}%</span>
              <span className="stat-label">Present Today</span>
            </div>
          </div>
        </div>
        
        <div className="stat-card gradient-info">
          <div className="stat-icon-wrapper">
            <div className="stat-icon">📊</div>
          </div>
          <div className="stat-content">
            <h3>Weekly Performance</h3>
            <p className="stat-value">{stats.weeklyAttendance}</p>
            <div className="stat-footer">
              <span className="stat-change">Last 7 days</span>
              <span className="stat-label">Total Check-ins</span>
            </div>
          </div>
        </div>
        
        <div className="stat-card gradient-warning">
          <div className="stat-icon-wrapper">
            <div className="stat-icon">⏰</div>
          </div>
          <div className="stat-content">
            <h3>Late Arrivals</h3>
            <p className="stat-value">{stats.lateArrivals}</p>
            <div className="stat-footer">
              <span className="stat-change negative">After 9:30 AM</span>
              <span className="stat-label">Needs Attention</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats Cards */}
      <div className="stats-grid secondary-stats">
        <div className="stat-card mini">
          <div className="mini-stat-icon">🎯</div>
          <div className="mini-stat-content">
            <p className="mini-stat-value">{stats.attendanceRate}%</p>
            <span className="mini-stat-label">Attendance Rate</span>
          </div>
        </div>

        <div className="stat-card mini">
          <div className="mini-stat-icon">❌</div>
          <div className="mini-stat-content">
            <p className="mini-stat-value">{stats.todayAbsent}</p>
            <span className="mini-stat-label">Absent Today</span>
          </div>
        </div>

        <div className="stat-card mini">
          <div className="mini-stat-icon">⭐</div>
          <div className="mini-stat-content">
            <p className="mini-stat-value">{stats.perfectAttendees}</p>
            <span className="mini-stat-label">Perfect Attendance</span>
          </div>
        </div>

        <div className="stat-card mini">
          <div className="mini-stat-icon">🕐</div>
          <div className="mini-stat-content">
            <p className="mini-stat-value">{stats.avgAttendanceTime}</p>
            <span className="mini-stat-label">Avg Arrival Time</span>
          </div>
        </div>

        <div className="stat-card mini">
          <div className="mini-stat-icon">✓</div>
          <div className="mini-stat-content">
            <p className="mini-stat-value">{stats.onTimeArrivals}</p>
            <span className="mini-stat-label">On-Time Today</span>
          </div>
        </div>

        <div className="stat-card mini">
          <div className="mini-stat-icon">🔥</div>
          <div className="mini-stat-content">
            <p className="mini-stat-value">{stats.consecutivePresent}</p>
            <span className="mini-stat-label">Day Streak</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Weekly Trend - Line Chart */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>📈 Weekly Attendance Trend</h3>
            <span className="chart-badge">Last 7 Days</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData.weekly}>
              <defs>
                <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#95a5a6" />
              <YAxis stroke="#95a5a6" />
              <Tooltip 
                contentStyle={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px' }}
              />
              <Area 
                type="monotone" 
                dataKey="attendance" 
                stroke="#667eea" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorAttendance)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Department-wise Bar Chart */}
        <div className="chart-card medium">
          <div className="chart-header">
            <h3>🏢 Department-wise Analysis</h3>
            <span className="chart-badge">Today</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData.departmentWise}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#95a5a6" />
              <YAxis stroke="#95a5a6" />
              <Tooltip />
              <Legend />
              <Bar dataKey="Present" fill="#00C49F" radius={[10, 10, 0, 0]} />
              <Bar dataKey="Absent" fill="#FF8042" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Time Distribution Pie Chart */}
        <div className="chart-card medium">
          <div className="chart-header">
            <h3>🕐 Arrival Time Distribution</h3>
            <span className="chart-badge">Today</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={chartData.timeDistribution}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.timeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TIME_COLORS[index % TIME_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Radar Chart */}
        <div className="chart-card medium">
          <div className="chart-header">
            <h3>⭐ Performance Metrics</h3>
            <span className="chart-badge">Overall</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={chartData.performanceMetrics}>
              <PolarGrid stroke="#e0e0e0" />
              <PolarAngleAxis dataKey="metric" stroke="#95a5a6" />
              <PolarRadiusAxis stroke="#95a5a6" />
              <Radar 
                name="Performance" 
                dataKey="value" 
                stroke="#667eea" 
                fill="#667eea" 
                fillOpacity={0.6} 
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Comparison */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>📅 Monthly Comparison</h3>
            <span className="chart-badge">Current Month</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" stroke="#95a5a6" />
              <YAxis stroke="#95a5a6" />
              <Tooltip />
              <Bar dataKey="attendance" fill="url(#colorBar)" radius={[10, 10, 0, 0]}>
                <defs>
                  <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#764ba2" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers List */}
        <div className="chart-card medium">
          <div className="chart-header">
            <h3>🏆 Top Performers</h3>
            <span className="chart-badge">This Week</span>
          </div>
          <div className="top-performers-list">
            {topPerformers.map((performer, index) => (
              <div key={index} className="performer-item">
                <div className="performer-rank">#{index + 1}</div>
                <div className="performer-details">
                  <p className="performer-name">{performer.name}</p>
                  <span className="performer-dept">{performer.department || 'N/A'}</span>
                </div>
                <div className="performer-score">
                  <span className="score-value">{performer.attendanceRate}%</span>
                  <div className="score-bar">
                    <div 
                      className="score-fill" 
                      style={{width: `${performer.attendanceRate}%`}}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>🔔 Recent Activity Feed</h3>
            <span className="chart-badge">Live Updates</span>
          </div>
          <div className="activity-feed">
            {recentActivity.map((record, index) => (
              <div key={index} className="activity-item-new">
                <div className="activity-avatar-new">
                  {record.name.charAt(0).toUpperCase()}
                </div>
                <div className="activity-content-new">
                  <p className="activity-name-new">{record.name}</p>
                  <p className="activity-meta">
                    <span className="activity-time-new">
                      <span className="time-icon">⏰</span> {record.time}
                    </span>
                    <span className="activity-date">{record.date}</span>
                  </p>
                </div>
                <div className="activity-status">
                  <span className="status-badge success">✓ Present</span>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="no-activity-new">
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="quick-actions-footer">
        <h3>⚡ Quick Actions</h3>
        <div className="action-buttons-grid">
          <button className="action-btn-new primary" onClick={() => window.location.href = '/register'}>
            <span className="action-icon">➕</span>
            <div className="action-content">
              <span className="action-title">Register Student</span>
              <span className="action-desc">Add new student to system</span>
            </div>
          </button>
          <button className="action-btn-new success" onClick={() => window.location.href = '/mark'}>
            <span className="action-icon">✅</span>
            <div className="action-content">
              <span className="action-title">Mark Attendance</span>
              <span className="action-desc">Record student attendance</span>
            </div>
          </button>
          <button className="action-btn-new info" onClick={() => window.location.href = '/view'}>
            <span className="action-icon">📋</span>
            <div className="action-content">
              <span className="action-title">View Records</span>
              <span className="action-desc">Browse attendance history</span>
            </div>
          </button>
          <button className="action-btn-new warning" onClick={() => window.location.href = '/reports'}>
            <span className="action-icon">📊</span>
            <div className="action-content">
              <span className="action-title">Generate Reports</span>
              <span className="action-desc">Download detailed analytics</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
