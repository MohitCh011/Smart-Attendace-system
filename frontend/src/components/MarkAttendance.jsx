import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { markAttendance } from '../services/api';
import './MarkAttendance.css';

const MarkAttendance = () => {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [blinkStatus, setBlinkStatus] = useState('Waiting...');
  
  const webcamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const framesRef = useRef([]);

  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  const startBlinkDetection = () => {
    if (!webcamRef.current) {
      setMessage('⚠️ Camera not ready');
      setMessageType('error');
      return;
    }

    setIsDetecting(true);
    setMessage('👁️ Look at the camera and blink naturally...');
    setMessageType('info');
    setBlinkStatus('Detecting...');
    framesRef.current = [];
    
    let frameCount = 0;
    const maxFrames = 15;  // Capture 15 frames (about 3 seconds at 5fps)
    
    setCountdown(3);
    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          startCapturing();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startCapturing = () => {
    let frameCount = 0;
    const maxFrames = 15;
    
    detectionIntervalRef.current = setInterval(() => {
      if (!webcamRef.current) {
        stopDetection();
        return;
      }

      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        framesRef.current.push(imageSrc);
        frameCount++;
        
        setBlinkStatus(`Capturing... ${frameCount}/${maxFrames}`);
        
        if (frameCount >= maxFrames) {
          stopDetection();
          processBlinkDetection();
        }
      }
    }, 200); // Capture every 200ms
  };

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsDetecting(false);
  };

  const processBlinkDetection = async () => {
    setBlinkStatus('Analyzing blink...');
    setMessage('🔍 Analyzing your blink pattern...');
    setMessageType('info');

    try {
      // Send frames to backend for blink detection
      const response = await markAttendance({
        images: framesRef.current,
        mode: 'blink_detection'
      });

      if (response.status === 'success') {
        setMessage(`✅ ${response.message}`);
        setMessageType('success');
        setBlinkStatus('Blink Confirmed!');
        
        // Show success for 3 seconds
        setTimeout(() => {
          setMessage('');
          setBlinkStatus('Ready for next person');
          framesRef.current = [];
        }, 3000);
      } else if (response.status === 'liveness_failed') {
        setMessage(`⚠️ ${response.message}`);
        setMessageType('error');
        setBlinkStatus('No blink detected');
        framesRef.current = [];
      } else if (response.status === 'already_marked') {
        setMessage(`ℹ️ ${response.message}`);
        setMessageType('warning');
        setBlinkStatus('Already marked');
        framesRef.current = [];
      } else {
        setMessage(`❌ ${response.message || 'Failed to mark attendance'}`);
        setMessageType('error');
        setBlinkStatus('Failed');
        framesRef.current = [];
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to process';
      setMessage(`❌ Error: ${errorMsg}`);
      setMessageType('error');
      setBlinkStatus('Error occurred');
      framesRef.current = [];
    }
  };

  const resetDetection = () => {
    stopDetection();
    framesRef.current = [];
    setMessage('');
    setMessageType('');
    setBlinkStatus('Waiting...');
    setCountdown(0);
  };

  return (
    <div className="attendance-container">
      <div className="attendance-header">
        <h2>👁️ Blink to Mark Attendance</h2>
        <p className="subtitle">Look at the camera and blink naturally - no button needed!</p>
      </div>

      <div className="webcam-section">
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
            className="webcam-display"
          />
          
          {countdown > 0 && (
            <div className="countdown-overlay">
              <div className="countdown-number">{countdown}</div>
              <p>Get ready to blink...</p>
            </div>
          )}

          {isDetecting && countdown === 0 && (
            <div className="detection-overlay">
              <div className="blink-indicator">
                <div className="eye-icon">👁️</div>
                <p className="blink-text">{blinkStatus}</p>
              </div>
            </div>
          )}
        </div>

        <div className="control-buttons">
          {!isDetecting ? (
            <button 
              onClick={startBlinkDetection}
              className="start-btn"
              disabled={countdown > 0}
            >
              👁️ Start Blink Detection
            </button>
          ) : (
            <button 
              onClick={resetDetection}
              className="stop-btn"
            >
              ⏹️ Stop Detection
            </button>
          )}
        </div>

        {message && (
          <div className={`message-box ${messageType}`}>
            <p>{message}</p>
          </div>
        )}
      </div>

      <div className="instructions-box">
        <h3>📋 Instructions</h3>
        <ul>
          <li>✓ Click "Start Blink Detection" button</li>
          <li>✓ Look directly at the camera</li>
          <li>✓ Blink naturally when prompted</li>
          <li>✓ System will automatically detect and mark attendance</li>
          <li>✗ Do not use photos or videos - blink must be real</li>
        </ul>
      </div>
    </div>
  );
};

export default MarkAttendance;
