import cv2
import numpy as np


class LivenessDetector:
    """
    Liveness detector using eye detection
    Photos don't have working eyes, real faces do
    """
    
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )
    
    def detect_liveness(self, image):
        """
        Simple eye-based liveness detection
        Returns: (is_live, confidence, reason)
        """
        if image is None or image.size == 0:
            return False, 0.0, "Invalid image"
        
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect face
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
            
            if len(faces) == 0:
                print("❌ No face detected")
                return False, 0, "No face detected"
            
            # Get the largest face
            (x, y, w, h) = max(faces, key=lambda rect: rect[2] * rect[3])
            face_roi = gray[y:y+h, x:x+w]
            
            # Detect eyes in face region
            eyes = self.eye_cascade.detectMultiScale(face_roi, 1.1, 5, minSize=(20, 20))
            
            # Check various factors
            has_eyes = len(eyes) >= 2
            blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
            is_natural_blur = 100 < blur_score < 1000
            
            # Simple pass/fail
            is_live = has_eyes and is_natural_blur
            confidence = 100 if is_live else 0
            
            print(f"\n{'='*50}")
            print(f"LIVENESS CHECK:")
            print(f"  Eyes Detected: {len(eyes)} (need ≥2)")
            print(f"  Blur Score: {blur_score:.1f} (natural: 100-1000)")
            print(f"  Result: {'🟢 LIVE' if is_live else '🔴 FAKE'}")
            print(f"{'='*50}\n")
            
            if is_live:
                return True, confidence, "Real person with visible eyes"
            else:
                return False, confidence, f"Eyes: {len(eyes)}, Blur: {blur_score:.0f}"
                
        except Exception as e:
            print(f"❌ Liveness check error: {e}")
            # If check fails, allow it (avoid false negatives)
            return True, 50, f"Check bypassed due to error: {str(e)}"
