import React, { useState, useEffect } from 'react';
import { getAttendance, exportAttendance } from '../services/api';
import './ViewAttendance.css';

const ViewAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async (date = null) => {
    try {
      setLoading(true);
      const response = await getAttendance(date);
      setAttendance(response.attendance);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilter = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    fetchAttendance(date || null);
  };

  const handleExport = async () => {
    try {
      const blob = await exportAttendance();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting attendance:', error);
      alert('Failed to export attendance');
    }
  };

  return (
    <div className="view-attendance-container">
      <h2>Attendance Records</h2>
      
      <div className="controls">
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateFilter}
          className="date-filter"
        />
        
        <button onClick={handleExport} className="export-btn">
          📥 Export to CSV
        </button>
        
        <button onClick={() => fetchAttendance()} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>
      
      {loading ? (
        <p className="loading">Loading records...</p>
      ) : (
        <div className="table-wrapper">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Date</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length > 0 ? (
                attendance.map((record, index) => (
                  <tr key={index}>
                    <td>{record.user_id}</td>
                    <td>{record.name}</td>
                    <td>{record.date}</td>
                    <td>{record.time}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{textAlign: 'center', padding: '2rem'}}>
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ViewAttendance;
