import React from 'react';
import './LivenessWarning.css';

const LivenessWarning = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="liveness-overlay">
      <div className="liveness-modal">
        <div className="liveness-header">
          <h2>⚠️ Liveness Detection Failed</h2>
        </div>
        <div className="liveness-content">
          <p>The system detected that you might be using a photo or video instead of live camera.</p>
          
          <div className="liveness-tips">
            <h3>📋 Tips for Successful Verification:</h3>
            <ul>
              <li>✓ Use a live camera, not a photo or screenshot</li>
              <li>✓ Ensure good lighting on your face</li>
              <li>✓ Look directly at the camera</li>
              <li>✓ Remove glasses or face coverings if possible</li>
              <li>✓ Keep your face steady and centered</li>
            </ul>
          </div>
          
          <button onClick={onClose} className="liveness-btn">
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default LivenessWarning;
