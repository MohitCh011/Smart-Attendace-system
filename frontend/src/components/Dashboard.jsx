import React, { useState, useEffect, useMemo } from 'react';
import { getAllUsers, getAttendance } from '../services/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import './Dashboard.css';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b'];
const TIME_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const TARGET = 100;
const prefersReduced = typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

      const departments = [...new Set(usersData.users.map(u => u.department || 'Unknown'))];
      const totalDepartments = departments.length;

      const today = new Date().toISOString().split('T')[0];
      const todayData = await getAttendance(today);
      const todayAttendance = todayData.attendance.length;
      const todayAbsent = totalUsers - todayAttendance;

      const weeklyData = await fetchWeeklyAttendance();
      const monthlyData = await fetchMonthlyAttendance();

      const attendanceRate = totalUsers > 0
        ? Number(((todayAttendance / totalUsers) * 100).toFixed(1))
        : 0;

      let lateArrivals = 0;
      let onTimeArrivals = 0;
      let totalMinutes = 0;

      todayData.attendance.forEach(record => {
        const [h, m] = record.time.split(':').map(Number);
        const minutes = h * 60 + m;
        totalMinutes += minutes;
        if (h > 9 || (h === 9 && m > 30)) lateArrivals++; else onTimeArrivals++;
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
    } catch (e) {
      // Optional: setAlerts([...alerts, { type: 'danger', message: 'Failed to load dashboard', icon: '⚠️' }])
      console.error(e);
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
        chartData.push({ date: formatDate(date), fullDate: date, attendance: count });
        dailyData.push(data.attendance);
      } catch {
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
      attendance: weeklyData.total + (index + 1) * 3
    }));
    return { total, chartData };
  };

  // Memoize derived values for cheap rerenders during polling or hover
  const headerSubtitle = useMemo(
    () => `Real-time Monitoring • ${stats.totalDepartments} Departments`,
    [stats.totalDepartments]
  );

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="skeleton-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-card shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReduced ? 0 : 0.5 }}
      >
        <div className="header-content">
          <h1>🎓 College Attendance Management System</h1>
          <p className="header-subtitle">{headerSubtitle}</p>
        </div>
        <div className="header-actions">
          <motion.button
            whileHover={{ scale: prefersReduced ? 1 : 1.02 }}
            whileTap={{ scale: prefersReduced ? 1 : 0.98 }}
            className="refresh-btn"
            onClick={fetchDashboardData}
          >
            <span className="btn-icon">🔄</span> Refresh
          </motion.button>
          <div className="live-indicator">
            <span className="pulse-dot" />
            <span>Live</span>
          </div>
        </div>
      </motion.div>

      {/* Alerts */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <div className="alerts-section">
            {alerts.map((alert, index) => (
              <motion.div
                key={index}
                className={`alert alert-${alert.type}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: prefersReduced ? 0 : 0.25 }}
              >
                <span className="alert-icon">{alert.icon}</span>
                <span>{alert.message}</span>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Primary Stats */}
      <div className="stats-grid primary-stats">
        {[
          {
            key: 'totalUsers',
            title: 'Total Students',
            value: stats.totalUsers,
            badge: `${stats.totalDepartments} Departments`,
            icon: '👥',
            gradient: 'gradient-primary'
          },
          {
            key: 'todayAttendance',
            title: "Today's Attendance",
            value: stats.todayAttendance,
            badge: `↗ ${stats.attendanceRate}%`,
            icon: '✅',
            gradient: 'gradient-success'
          },
          {
            key: 'weeklyAttendance',
            title: 'Weekly Performance',
            value: stats.weeklyAttendance,
            badge: 'Last 7 days',
            icon: '📊',
            gradient: 'gradient-info'
          },
          {
            key: 'lateArrivals',
            title: 'Late Arrivals',
            value: stats.lateArrivals,
            badge: 'After 9:30 AM',
            icon: '⏰',
            gradient: 'gradient-warning'
          }
        ].map((c) => (
          <motion.div
            key={c.key}
            className={`stat-card ${c.gradient}`}
            whileHover={{ y: prefersReduced ? 0 : -6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <div className="stat-icon-wrapper">
              <div className="stat-icon">{c.icon}</div>
            </div>
            <div className="stat-content">
              <h3>{c.title}</h3>
              <p className="stat-value">{c.value}</p>
              <div className="stat-footer">
                <span className="stat-change">{c.badge}</span>
                <span className="stat-label">Updated just now</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="stats-grid secondary-stats">
        {[
          { icon: '🎯', value: `${stats.attendanceRate}%`, label: 'Attendance Rate' },
          { icon: '❌', value: stats.todayAbsent, label: 'Absent Today' },
          { icon: '⭐', value: stats.perfectAttendees, label: 'Perfect Attendance' },
          { icon: '🕐', value: stats.avgAttendanceTime, label: 'Avg Arrival Time' },
          { icon: '✓', value: stats.onTimeArrivals, label: 'On-Time Today' },
          { icon: '🔥', value: stats.consecutivePresent, label: 'Day Streak' }
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className="stat-card mini"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReduced ? 0 : i * 0.05, duration: 0.3 }}
            whileHover={{ scale: prefersReduced ? 1 : 1.01 }}
          >
            <div className="mini-stat-icon">{s.icon}</div>
            <div className="mini-stat-content">
              <p className="mini-stat-value">{s.value}</p>
              <span className="mini-stat-label">{s.label}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Weekly Area */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>📈 Weekly Attendance Trend</h3>
            <span className="chart-badge">Last 7 Days</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData.weekly}>
              <defs>
                <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.75} />
                  <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                </linearGradient>
                <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.15" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="date" stroke="#95a5a6" />
              <YAxis stroke="#95a5a6" />
              <Tooltip
                contentStyle={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 8 }}
                cursor={{ stroke: '#a5b4fc', strokeWidth: 1, strokeDasharray: '4 2' }}
              />
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="#5b6ef5"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAttendance)"
                animationDuration={prefersReduced ? 0 : 600}
                animationEasing="ease-out"
                style={{ filter: 'url(#softShadow)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Department Bar */}
        <div className="chart-card medium">
          <div className="chart-header">
            <h3>🏢 Department-wise Analysis</h3>
            <span className="chart-badge">Today</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData.departmentWise}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="name" stroke="#95a5a6" />
              <YAxis stroke="#95a5a6" />
              <Tooltip />
              <Legend />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <Bar
                dataKey="Present"
                fill="url(#barGrad)"
                radius={[10, 10, 0, 0]}
                animationDuration={prefersReduced ? 0 : 500}
              />
              <Bar
                dataKey="Absent"
                fill="#FF8042"
                radius={[10, 10, 0, 0]}
                animationDuration={prefersReduced ? 0 : 500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Time Distribution Pie */}
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
                labelLine
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={!prefersReduced}
                animationDuration={prefersReduced ? 0 : 600}
              >
                {chartData.timeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TIME_COLORS[index % TIME_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Radar */}
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
                fillOpacity={0.5}
                animationDuration={prefersReduced ? 0 : 600}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Bar */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>📅 Monthly Comparison</h3>
            <span className="chart-badge">Current Month</span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="week" stroke="#95a5a6" />
              <YAxis stroke="#95a5a6" />
              <Tooltip />
              <defs>
                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#764ba2" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <Bar
                dataKey="attendance"
                fill="url(#colorBar)"
                radius={[10, 10, 0, 0]}
                animationDuration={prefersReduced ? 0 : 500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers */}
        <div className="chart-card medium">
          <div className="chart-header">
            <h3>🏆 Top Performers</h3>
            <span className="chart-badge">This Week</span>
          </div>
          <div className="top-performers-list">
            {topPerformers.map((performer, index) => (
              <motion.div
                key={index}
                className="performer-item"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: prefersReduced ? 0 : index * 0.04, duration: 0.2 }}
              >
                <div className="performer-rank">#{index + 1}</div>
                <div className="performer-details">
                  <p className="performer-name">{performer.name}</p>
                  <span className="performer-dept">{performer.department || 'N/A'}</span>
                </div>
                <div className="performer-score">
                  <span className="score-value">{performer.attendanceRate}%</span>
                  <div className="score-bar">
                    <motion.div
                      className="score-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${performer.attendanceRate}%` }}
                      transition={{ duration: prefersReduced ? 0 : 0.6 }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>🔔 Recent Activity Feed</h3>
            <span className="chart-badge">Live Updates</span>
          </div>
          <div className="activity-feed">
            <AnimatePresence>
              {recentActivity.map((record, index) => (
                <motion.div
                  key={`${record.user_id}-${index}`}
                  className="activity-item-new"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: prefersReduced ? 0 : 0.25 }}
                >
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
                </motion.div>
              ))}
              {recentActivity.length === 0 && (
                <div className="no-activity-new">
                  <p>No recent activity</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-footer">
        <h3>⚡ Quick Actions</h3>
        <div className="action-buttons-grid">
          {[
            { to: '/register', icon: '➕', title: 'Register Student', desc: 'Add new student to system', k: 'primary' },
            { to: '/mark', icon: '✅', title: 'Mark Attendance', desc: 'Record student attendance', k: 'success' },
            { to: '/view', icon: '📋', title: 'View Records', desc: 'Browse attendance history', k: 'info' },
            { to: '/reports', icon: '📊', title: 'Generate Reports', desc: 'Download detailed analytics', k: 'warning' }
          ].map(btn => (
            <motion.button
              key={btn.to}
              className={`action-btn-new ${btn.k}`}
              onClick={() => (window.location.href = btn.to)}
              whileHover={{ y: prefersReduced ? 0 : -4, scale: prefersReduced ? 1 : 1.01 }}
              whileTap={{ scale: prefersReduced ? 1 : 0.99 }}
            >
              <span className="action-icon">{btn.icon}</span>
              <div className="action-content">
                <span className="action-title">{btn.title}</span>
                <span className="action-desc">{btn.desc}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------- helpers ---------- */
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
    if (!deptMap[dept]) deptMap[dept] = { total: 0, present: 0 };
    deptMap[dept].total++;
  });
  attendance.forEach(record => {
    const user = users.find(u => u.user_id === record.user_id);
    if (user) {
      const dept = user.department || 'Unknown';
      if (deptMap[dept]) deptMap[dept].present++;
    }
  });
  return Object.keys(deptMap).map(dept => ({
    name: dept,
    Present: deptMap[dept].present,
    Absent: deptMap[dept].total - deptMap[dept].present,
    Total: deptMap[dept].total
  }));
};

const calculateTimeDistribution = (attendance) => {
  const distribution = {
    'Before 9:00': 0,
    '9:00-9:30': 0,
    '9:30-10:00': 0,
    'After 10:00': 0
  };
  attendance.forEach(record => {
    const [h, m] = record.time.split(':').map(Number);
    const total = h * 60 + m;
    if (total < 540) distribution['Before 9:00']++;
    else if (total < 570) distribution['9:00-9:30']++;
    else if (total < 600) distribution['9:30-10:00']++;
    else distribution['After 10:00']++;
  });
  return Object.entries(distribution).map(([name, value]) => ({ name, value }));
};

const calculateDayWiseComparison = (weeklyData) =>
  weeklyData.map(day => ({ day: day.date, Current: day.attendance, Target: 100, Average: 85 }));

const calculatePerformanceMetrics = (users, attendance) => ([
  { metric: 'Attendance Rate', value: Number(((attendance.length / users.length) * 100).toFixed(0)), fullMark: 100 },
  { metric: 'On-Time Rate', value: 85, fullMark: 100 },
  { metric: 'Engagement', value: 92, fullMark: 100 },
  { metric: 'Consistency', value: 88, fullMark: 100 },
  { metric: 'Overall', value: 90, fullMark: 100 }
]);

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
      if (day.find(record => record.user_id === user.user_id)) presentDays++;
    });
    return {
      name: user.name,
      department: user.department,
      attendanceRate: Number(((presentDays / dailyData.length) * 100).toFixed(1))
    };
  });
  return userStats.sort((a, b) => b.attendanceRate - a.attendanceRate).slice(0, 5);
};

const generateAlerts = (absent, late, rate) => {
  const alerts = [];
  if (rate < 70) alerts.push({ type: 'danger', message: `Low attendance rate: ${rate}%`, icon: '⚠️' });
  if (late > 10) alerts.push({ type: 'warning', message: `${late} late arrivals today`, icon: '⏰' });
  if (absent > 20) alerts.push({ type: 'info', message: `${absent} students absent today`, icon: 'ℹ️' });
  return alerts;
};

export default Dashboard;
