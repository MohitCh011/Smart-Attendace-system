import axios from 'axios';

const API_URL = 'http://localhost:5000';

// Get JWT token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Register new user
export const registerUser = async (userData) => {
  const response = await axios.post(
    `${API_URL}/api/register`,
    userData,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// Get all users
export const getAllUsers = async () => {
  const response = await axios.get(
    `${API_URL}/api/users`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// Delete user
export const deleteUser = async (userId) => {
  const response = await axios.delete(
    `${API_URL}/api/users/${userId}`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// Mark attendance
export const markAttendance = async (imageData) => {
  const response = await axios.post(
    `${API_URL}/api/mark-attendance`,
    { image: imageData },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// Get attendance records
export const getAttendance = async (date) => {
  const url = date 
    ? `${API_URL}/api/attendance?date=${date}` 
    : `${API_URL}/api/attendance`;
  const response = await axios.get(url, { headers: getAuthHeaders() });
  return response.data;
};

// Get attendance statistics
export const getAttendanceStats = async () => {
  const response = await axios.get(
    `${API_URL}/api/attendance/stats`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// Export attendance to CSV
export const exportAttendance = async (startDate, endDate) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const url = `${API_URL}/api/attendance/export?${params.toString()}`;
    
    const response = await axios.get(url, {
      headers: getAuthHeaders(),
      responseType: 'blob'  // Important for file download
    });
    
    // Create blob link to download
    const blob = new Blob([response.data], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `attendance_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    return { success: true, message: 'Export successful' };
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
};

// Get user attendance history
export const getUserAttendance = async (userId) => {
  const response = await axios.get(
    `${API_URL}/api/attendance/user/${userId}`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// Login
export const login = async (credentials) => {
  const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
  return response.data;
};

// Get available classes
export const getClasses = async () => {
  const response = await axios.get(`${API_URL}/api/auth/classes`);
  return response.data;
};

// Verify token
export const verifyToken = async () => {
  const response = await axios.get(
    `${API_URL}/api/auth/verify`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// Test liveness detection
export const testLiveness = async (imageData) => {
  const response = await axios.post(
    `${API_URL}/api/liveness-check`,
    { image: imageData },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// Get class statistics
export const getClassStats = async () => {
  const response = await axios.get(
    `${API_URL}/api/class/stats`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};
