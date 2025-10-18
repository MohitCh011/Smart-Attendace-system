import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { registerUser } from '../services/api';
import './RegisterUser.css';

const RegisterUser = () => {
  // Class information from logged-in user
  const [classInfo, setClassInfo] = useState({
    code: '',
    name: '',
    department: ''
  });

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    userId: '',
    department: ''
  });
  
  // Image capture state
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [webcamActive, setWebcamActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Refs
  const webcamRef = useRef(null);
  const intervalRef = useRef(null);

  // Load class information on component mount
  useEffect(() => {
    const code = localStorage.getItem('class_code') || 'UNKNOWN';
    const name = localStorage.getItem('class_name') || 'Unknown Class';
    const department = localStorage.getItem('department') || 'N/A';
    
    setClassInfo({ code, name, department });
    
    // Pre-fill department from class
    setFormData(prev => ({
      ...prev,
      department: department !== 'N/A' ? department : ''
    }));
  }, []);

  // Handle input changes
  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    
    // Clear messages when user types
    if (message) {
      setMessage('');
      setMessageType('');
    }
  };

  // Capture single image
  const captureImage = () => {
    if (!webcamRef.current) {
      setMessage('⚠️ Camera not ready. Please try again.');
      setMessageType('warning');
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setCapturedImages(prev => [...prev, imageSrc]);
      setMessage(`📸 ${capturedImages.length + 1} image(s) captured`);
      setMessageType('info');
    } else {
      setMessage('❌ Failed to capture image. Please try again.');
      setMessageType('error');
    }
  };

  // Start automatic capture
  const startAutoCapture = () => {
    if (!webcamRef.current) {
      setMessage('⚠️ Camera not ready. Please try again.');
      setMessageType('warning');
      return;
    }

    setIsCapturing(true);
    setMessage('🎬 Auto-capture started...');
    setMessageType('info');
    
    let count = 0;
    const targetCount = 20;
    
    intervalRef.current = setInterval(() => {
      if (!webcamRef.current) {
        stopAutoCapture();
        return;
      }

      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImages(prev => [...prev, imageSrc]);
        count++;
        setMessage(`📸 Capturing... ${count}/${targetCount}`);
        setMessageType('info');
        
        if (count >= targetCount) {
          stopAutoCapture();
          setMessage(`✅ Captured ${targetCount} images successfully!`);
          setMessageType('success');
        }
      }
    }, 500); // Capture every 500ms
  };

  // Stop automatic capture
  const stopAutoCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCapturing(false);
  };

  // Reset captured images
  const resetCapture = () => {
    stopAutoCapture();
    setCapturedImages([]);
    setMessage('🔄 Images cleared. Ready to capture again.');
    setMessageType('info');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (capturedImages.length < 10) {
      setMessage(`⚠️ Please capture at least 10 images (currently: ${capturedImages.length})`);
      setMessageType('error');
      return;
    }

    if (!classInfo.code || classInfo.code === 'UNKNOWN') {
      setMessage('❌ Class information missing. Please log in again.');
      setMessageType('error');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setMessage(`⏳ Registering ${formData.name} in ${classInfo.name}...`);
      setMessageType('info');
      
      // Prepare payload
      const payload = {
        ...formData,
        images: capturedImages,
        class_code: classInfo.code,
        class_name: classInfo.name
      };
      
      // Call API
      const response = await registerUser(payload);
      
      setMessage(`✅ Success! ${formData.name} registered in ${classInfo.name}`);
      setMessageType('success');
      
      // Reset form after successful registration
      setTimeout(() => {
        setFormData({
          name: '',
          email: '',
          userId: '',
          department: classInfo.department !== 'N/A' ? classInfo.department : ''
        });
        setCapturedImages([]);
        setWebcamActive(false);
        setMessage('');
        setMessageType('');
      }, 3000);
      
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Registration failed';
      setMessage(`❌ Error: ${errorMsg}`);
      setMessageType('error');
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle webcam
  const toggleWebcam = () => {
    if (webcamActive && isCapturing) {
      stopAutoCapture();
    }
    setWebcamActive(!webcamActive);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="register-container">
      {/* Class Information Banner */}
      <div className="class-info-banner">
        <div className="class-badge">
          <span className="badge-icon">🎓</span>
          <div className="badge-content">
            <h3>{classInfo.name}</h3>
            <p>Class Code: <strong>{classInfo.code}</strong> | Department: <strong>{classInfo.department}</strong></p>
          </div>
        </div>
        <div className="info-note">
          <span className="note-icon">ℹ️</span>
          <p>Students will be registered under this class</p>
        </div>
      </div>

      <div className="register-header">
        <h2>📝 Register New Student</h2>
        <p className="subtitle">Please fill in student details and capture face images</p>
      </div>
      
      <form onSubmit={handleSubmit} className="register-form">
        {/* Personal Information Section */}
        <div className="form-section">
          <h3 className="section-title">👤 Personal Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Enter student's full name"
                disabled={isSubmitting}
              />
            </div>
            
            <div className="form-group">
              <label>
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="student@college.edu"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Student ID <span className="required">*</span>
              </label>
              <input
                type="text"
                name="userId"
                value={formData.userId}
                onChange={handleInputChange}
                required
                placeholder="e.g., STU001, 2025CS001"
                disabled={isSubmitting}
              />
              <span className="helper-text">Unique identifier for the student</span>
            </div>
            
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                placeholder="Enter department"
                disabled={isSubmitting}
              />
              <span className="helper-text">Optional - defaults to class department</span>
            </div>
          </div>
        </div>

        {/* Face Capture Section */}
        <div className="form-section">
          <h3 className="section-title">📷 Face Capture</h3>
          <p className="section-desc">Capture at least 10 clear face images from different angles</p>

          <div className="webcam-section">
            <button 
              type="button" 
              onClick={toggleWebcam}
              className={`toggle-webcam-btn ${webcamActive ? 'active' : ''}`}
              disabled={isSubmitting}
            >
              {webcamActive ? '📷 Hide Camera' : '📷 Activate Camera'}
            </button>
            
            {webcamActive && (
              <div className="webcam-container">
                <div className="webcam-wrapper">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    width={640}
                    height={480}
                    videoConstraints={{
                      width: 640,
                      height: 480,
                      facingMode: "user"
                    }}
                    className="webcam-video"
                  />
                  <div className="webcam-overlay">
                    <div className="face-guide"></div>
                  </div>
                </div>
                
                <div className="capture-controls">
                  <button 
                    type="button" 
                    onClick={captureImage}
                    disabled={isCapturing || isSubmitting}
                    className="capture-btn"
                    title="Capture single image"
                  >
                    <span className="btn-icon">📸</span>
                    <span className="btn-text">Capture Single</span>
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={isCapturing ? stopAutoCapture : startAutoCapture}
                    className={`auto-capture-btn ${isCapturing ? 'active' : ''}`}
                    disabled={isSubmitting}
                    title={isCapturing ? "Stop auto capture" : "Start auto capture"}
                  >
                    <span className="btn-icon">{isCapturing ? '⏹️' : '🎬'}</span>
                    <span className="btn-text">
                      {isCapturing ? 'Stop Auto' : 'Auto Capture (20)'}
                    </span>
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={resetCapture}
                    className="reset-btn"
                    disabled={capturedImages.length === 0 || isSubmitting}
                    title="Clear all captured images"
                  >
                    <span className="btn-icon">🔄</span>
                    <span className="btn-text">Reset</span>
                  </button>
                </div>
                
                <div className="image-counter">
                  <div className="counter-content">
                    <span className="counter-icon">
                      {capturedImages.length >= 10 ? '✅' : '📊'}
                    </span>
                    <div className="counter-text">
                      <p className="counter-value">{capturedImages.length}</p>
                      <p className="counter-label">Images Captured</p>
                    </div>
                  </div>
                  <div className="counter-progress">
                    <div 
                      className="progress-bar"
                      style={{
                        width: `${Math.min((capturedImages.length / 10) * 100, 100)}%`,
                        backgroundColor: capturedImages.length >= 10 ? '#10b981' : '#f59e0b'
                      }}
                    ></div>
                  </div>
                  {capturedImages.length < 10 && (
                    <p className="counter-note">
                      {10 - capturedImages.length} more needed (minimum 10 required)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`message-box ${messageType}`}>
            <span className="message-icon">
              {messageType === 'success' ? '✅' : 
               messageType === 'error' ? '❌' : 
               messageType === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <p className="message-text">{message}</p>
          </div>
        )}

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={capturedImages.length < 10 || isSubmitting}
          className={`submit-btn ${capturedImages.length >= 10 ? 'ready' : ''}`}
        >
          {isSubmitting ? (
            <>
              <span className="spinner"></span>
              <span>Registering...</span>
            </>
          ) : capturedImages.length < 10 ? (
            <>
              <span>⚠️ Need {10 - capturedImages.length} More Images</span>
            </>
          ) : (
            <>
              <span>✅ Register Student in {classInfo.code}</span>
            </>
          )}
        </button>
      </form>

      {/* Tips Section */}
      <div className="tips-section">
        <h4>💡 Tips for Best Results</h4>
        <ul className="tips-list">
          <li>✓ Ensure good lighting on the face</li>
          <li>✓ Look directly at the camera</li>
          <li>✓ Capture from slightly different angles</li>
          <li>✓ Keep a neutral expression</li>
          <li>✓ Remove glasses if possible</li>
          <li>✓ Avoid shadows on the face</li>
        </ul>
      </div>
    </div>
  );
};

export default RegisterUser;
