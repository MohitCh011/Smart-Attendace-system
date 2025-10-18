import React, { useState } from 'react';
import { getAttendance, getAllUsers } from '../services/api';
import './Reports.css';

const Reports = () => {
  const [reportType, setReportType] = useState('daily');
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const users = await getAllUsers();
      let attendanceData = [];

      if (reportType === 'daily') {
        const data = await getAttendance(dateRange.startDate);
        attendanceData = data.attendance;
      } else if (reportType === 'weekly' || reportType === 'monthly') {
        // Fetch data for date range
        const dates = getDateRange(dateRange.startDate, dateRange.endDate);
        for (const date of dates) {
          const data = await getAttendance(date);
          attendanceData = [...attendanceData, ...data.attendance];
        }
      }

      // Process data
      const processedData = processReportData(users.users, attendanceData);
      setReportData(processedData);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (start, end) => {
    const dates = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    while (startDate <= endDate) {
      dates.push(startDate.toISOString().split('T')[0]);
      startDate.setDate(startDate.getDate() + 1);
    }
    return dates;
  };

  const processReportData = (users, attendance) => {
    const userMap = {};
    
    users.forEach(user => {
      userMap[user.user_id] = {
        name: user.name,
        email: user.email,
        department: user.department,
        totalDays: 0,
        presentDays: 0,
        lateDays: 0,
        attendanceRate: 0
      };
    });

    attendance.forEach(record => {
      if (userMap[record.user_id]) {
        userMap[record.user_id].presentDays++;
        
        // Check if late (after 9:30 AM)
        const time = record.time.split(':');
        const hours = parseInt(time[0]);
        const minutes = parseInt(time[1]);
        if (hours > 9 || (hours === 9 && minutes > 30)) {
          userMap[record.user_id].lateDays++;
        }
      }
    });

    // Calculate total days and attendance rate
    const totalDays = getDateRange(dateRange.startDate, dateRange.endDate).length;
    Object.keys(userMap).forEach(userId => {
      userMap[userId].totalDays = totalDays;
      userMap[userId].attendanceRate = totalDays > 0
        ? ((userMap[userId].presentDays / totalDays) * 100).toFixed(1)
        : 0;
    });

    return Object.values(userMap);
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const headers = ['Name', 'Email', 'Department', 'Total Days', 'Present', 'Late', 'Attendance %'];
    const rows = reportData.map(user => [
      user.name,
      user.email,
      user.department,
      user.totalDays,
      user.presentDays,
      user.lateDays,
      user.attendanceRate
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="reports-container">
      <h2>📈 Attendance Reports</h2>

      <div className="report-controls">
        <div className="control-group">
          <label>Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="daily">Daily Report</option>
            <option value="weekly">Weekly Report</option>
            <option value="monthly">Monthly Report</option>
          </select>
        </div>

        <div className="control-group">
          <label>Start Date</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
          />
        </div>

        {(reportType === 'weekly' || reportType === 'monthly') && (
          <div className="control-group">
            <label>End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
            />
          </div>
        )}

        <button onClick={generateReport} disabled={loading} className="generate-btn">
          {loading ? '⏳ Generating...' : '📊 Generate Report'}
        </button>
      </div>

      {reportData && (
        <>
          <div className="report-actions">
            <button onClick={exportToCSV} className="export-btn csv">
              📥 Export CSV
            </button>
            <button onClick={exportToPDF} className="export-btn pdf">
              📄 Export PDF
            </button>
          </div>

          <div className="report-summary">
            <div className="summary-card">
              <h4>Total Employees</h4>
              <p>{reportData.length}</p>
            </div>
            <div className="summary-card">
              <h4>Avg Attendance</h4>
              <p>
                {(reportData.reduce((sum, u) => sum + parseFloat(u.attendanceRate), 0) / reportData.length).toFixed(1)}%
              </p>
            </div>
            <div className="summary-card">
              <h4>Total Late</h4>
              <p>{reportData.reduce((sum, u) => sum + u.lateDays, 0)}</p>
            </div>
          </div>

          <div className="report-table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Total Days</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((user, index) => (
                  <tr key={index}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.department || 'N/A'}</td>
                    <td>{user.totalDays}</td>
                    <td>{user.presentDays}</td>
                    <td>{user.lateDays}</td>
                    <td>
                      <span className={`attendance-badge ${
                        user.attendanceRate >= 90 ? 'excellent' :
                        user.attendanceRate >= 75 ? 'good' :
                        user.attendanceRate >= 60 ? 'average' : 'poor'
                      }`}>
                        {user.attendanceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
