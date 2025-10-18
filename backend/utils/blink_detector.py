import cv2
import numpy as np
from scipy.spatial import distance as dist


class BlinkDetector:
    """
    Real-time blink detection for liveness verification
    Detects eye blinks to ensure it's a real person
    """
    
    def __init__(self):
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )
        self.EYE_AR_THRESH = 0.25  # Eye aspect ratio threshold for blink
        self.EYE_AR_CONSEC_FRAMES = 2  # Consecutive frames for blink
    
    def eye_aspect_ratio(self, eye):
        """Calculate eye aspect ratio (EAR)"""
        # Compute euclidean distances between vertical eye landmarks
        A = dist.euclidean(eye[1], eye[5])
        B = dist.euclidean(eye[2], eye[4])
        # Compute euclidean distance between horizontal eye landmarks
        C = dist.euclidean(eye[0], eye[3])
        # Eye aspect ratio
        ear = (A + B) / (2.0 * C)
        return ear
    
    def detect_eyes_simple(self, image):
        """
        Simple eye detection to check for eye presence
        Returns: (has_eyes, eye_count, eye_regions)
        """
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect eyes
            eyes = self.eye_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(20, 20)
            )
            
            has_eyes = len(eyes) >= 2
            return has_eyes, len(eyes), eyes
            
        except Exception as e:
            print(f"Eye detection error: {e}")
            return False, 0, []
    
    def calculate_simple_ear(self, eye_region):
        """
        Calculate simplified Eye Aspect Ratio
        Used for blink detection
        """
        try:
            height, width = eye_region.shape[:2]
            
            # Simple ratio: if eye is closed, height/width is smaller
            aspect_ratio = height / (width + 1e-6)
            
            return aspect_ratio
        except:
            return 0.3  # Default value
    
    def is_blink_detected(self, frame_sequence):
        """
        Analyze sequence of frames to detect blink
        frame_sequence: list of images captured over time
        Returns: (blink_detected, confidence)
        """
        try:
            if len(frame_sequence) < 3:
                return False, 0, "Need at least 3 frames"
            
            eye_states = []
            
            for frame in frame_sequence:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                eyes = self.eye_cascade.detectMultiScale(
                    gray, 1.1, 5, minSize=(20, 20)
                )
                
                if len(eyes) >= 2:
                    # Get largest two eyes
                    sorted_eyes = sorted(eyes, key=lambda x: x[2] * x[3], reverse=True)[:2]
                    
                    # Calculate aspect ratio for both eyes
                    ratios = []
                    for (ex, ey, ew, eh) in sorted_eyes:
                        eye_roi = gray[ey:ey+eh, ex:ex+ew]
                        ear = self.calculate_simple_ear(eye_roi)
                        ratios.append(ear)
                    
                    avg_ratio = np.mean(ratios) if ratios else 0
                    eye_states.append(avg_ratio)
                else:
                    eye_states.append(0)  # No eyes detected
            
            if len(eye_states) < 3:
                return False, 0, "Insufficient eye data"
            
            # Check for blink pattern: open -> closed -> open
            # Look for a dip in the eye aspect ratio
            mean_ratio = np.mean(eye_states)
            min_ratio = np.min(eye_states)
            
            # Blink detected if there's a significant drop
            blink_detected = (mean_ratio - min_ratio) > 0.05
            confidence = min(((mean_ratio - min_ratio) / 0.15) * 100, 100)
            
            print(f"  Eye states: {[f'{x:.3f}' for x in eye_states]}")
            print(f"  Mean: {mean_ratio:.3f}, Min: {min_ratio:.3f}, Drop: {mean_ratio - min_ratio:.3f}")
            
            if blink_detected:
                return True, confidence, "Blink pattern detected"
            else:
                return False, confidence, "No blink detected - please blink"
                
        except Exception as e:
            print(f"Blink detection error: {e}")
            return False, 0, str(e)


def check_blink_liveness(images_sequence):
    """
    Main function to check liveness via blink detection
    images_sequence: list of at least 5 images captured in sequence
    """
    detector = BlinkDetector()
    
    if len(images_sequence) < 5:
        return False, 0, "Need at least 5 frames for blink detection"
    
    # Check if eyes are present in most frames
    eye_detections = []
    for img in images_sequence:
        has_eyes, count, _ = detector.detect_eyes_simple(img)
        eye_detections.append(has_eyes)
    
    eyes_present_rate = sum(eye_detections) / len(eye_detections)
    
    if eyes_present_rate < 0.6:  # Eyes should be present in 60%+ frames
        return False, 0, "Eyes not consistently detected"
    
    # Detect blink
    blink_detected, confidence, reason = detector.is_blink_detected(images_sequence)
    
    return blink_detected, confidence, reason
