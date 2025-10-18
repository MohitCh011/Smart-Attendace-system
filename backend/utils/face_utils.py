import cv2
import numpy as np
import os
from config import Config
import urllib.request


class FaceUtils:
    def __init__(self):
        # Load Deep Learning face detector
        self.face_net = self.load_face_detector()
    
    def load_face_detector(self):
        """Load OpenCV DNN face detector (Deep Learning - SSD with ResNet-10)"""
        try:
            model_dir = os.path.join(Config.BASE_DIR, 'models')
            os.makedirs(model_dir, exist_ok=True)
            
            prototxt_path = os.path.join(model_dir, 'deploy.prototxt')
            caffemodel_path = os.path.join(model_dir, 'res10_300x300_ssd_iter_140000.caffemodel')
            
            # Download models if not present
            if not os.path.exists(prototxt_path):
                print("Downloading face detection model (prototxt)...")
                urllib.request.urlretrieve(
                    'https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt',
                    prototxt_path
                )
                print("✓ Prototxt downloaded")
            
            if not os.path.exists(caffemodel_path):
                print("Downloading face detection model (caffemodel - may take a minute)...")
                urllib.request.urlretrieve(
                    'https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel',
                    caffemodel_path
                )
                print("✓ Caffemodel downloaded")
            
            # Load Deep Learning model
            net = cv2.dnn.readNetFromCaffe(prototxt_path, caffemodel_path)
            print("✓ Deep Learning face detector (SSD ResNet-10) loaded successfully!")
            return net
            
        except Exception as e:
            print(f"⚠️ Warning: Could not load DNN model: {e}")
            print("Falling back to Haar Cascade...")
            return cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
    
    def detect_face(self, image):
        """Detect faces using Deep Learning"""
        try:
            if isinstance(self.face_net, cv2.dnn_Net):
                # Deep Learning detection
                (h, w) = image.shape[:2]
                blob = cv2.dnn.blobFromImage(
                    cv2.resize(image, (300, 300)), 
                    1.0,
                    (300, 300), 
                    (104.0, 177.0, 123.0)
                )
                
                self.face_net.setInput(blob)
                detections = self.face_net.forward()
                
                for i in range(0, detections.shape[2]):
                    confidence = detections[0, 0, i, 2]
                    if confidence > 0.5:
                        return True
                return False
            else:
                # Fallback to Haar Cascade
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                faces = self.face_net.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
                return len(faces) > 0
                
        except Exception as e:
            print(f"Error detecting face: {e}")
            return False
    
    def extract_face_region(self, image):
        """Extract face region using Deep Learning"""
        try:
            if isinstance(self.face_net, cv2.dnn_Net):
                (h, w) = image.shape[:2]
                blob = cv2.dnn.blobFromImage(
                    cv2.resize(image, (300, 300)), 
                    1.0,
                    (300, 300), 
                    (104.0, 177.0, 123.0)
                )
                
                self.face_net.setInput(blob)
                detections = self.face_net.forward()
                
                best_confidence = 0
                best_box = None
                
                for i in range(0, detections.shape[2]):
                    confidence = detections[0, 0, i, 2]
                    if confidence > best_confidence and confidence > 0.5:
                        best_confidence = confidence
                        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                        best_box = box.astype("int")
                
                if best_box is not None:
                    (startX, startY, endX, endY) = best_box
                    # Add padding and boundary checks
                    startX = max(0, startX)
                    startY = max(0, startY)
                    endX = min(w, endX)
                    endY = min(h, endY)
                    
                    face = image[startY:endY, startX:endX]
                    if face.size > 0:
                        face = cv2.resize(face, (160, 160))
                        return face
                return None
            else:
                # Fallback to Haar Cascade
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                faces = self.face_net.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
                if len(faces) > 0:
                    (x, y, w, h) = faces[0]
                    face = gray[y:y+h, x:x+w]
                    return cv2.resize(face, (160, 160))
                return None
                
        except Exception as e:
            print(f"Error extracting face: {e}")
            return None
    
    def generate_encoding(self, image):
        """Generate compact face embedding (128 dimensions)"""
        try:
            face = self.extract_face_region(image)
            if face is None:
                return None
            
            # Convert to grayscale if needed
            if len(face.shape) == 3:
                gray_face = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
            else:
                gray_face = face
            
            # Normalize
            gray_face = gray_face.astype('float32')
            mean, std = gray_face.mean(), gray_face.std()
            if std > 0:
                gray_face = (gray_face - mean) / std
            
            # Generate compact 128-dimensional feature vector
            hist = cv2.calcHist([gray_face], [0], None, [128], [-3, 3])
            hist = cv2.normalize(hist, hist).flatten()
            
            return hist.tolist()
            
        except Exception as e:
            print(f"Error generating encoding: {e}")
            return None
    
    def compare_faces(self, known_encodings, face_encoding, tolerance=None):
        """Compare face encodings using cosine similarity"""
        if tolerance is None:
            tolerance = Config.FACE_RECOGNITION_TOLERANCE
        
        best_match_index = None
        best_similarity = -1
        
        face_enc = np.array(face_encoding, dtype=np.float32)
        
        for idx, known_enc in enumerate(known_encodings):
            try:
                known = np.array(known_enc, dtype=np.float32)
                
                # Ensure same length
                min_len = min(len(face_enc), len(known))
                face_enc_norm = face_enc[:min_len]
                known_norm = known[:min_len]
                
                # Normalize vectors
                face_norm = face_enc_norm / (np.linalg.norm(face_enc_norm) + 1e-10)
                known_norm_vec = known_norm / (np.linalg.norm(known_norm) + 1e-10)
                
                # Cosine similarity
                similarity = np.dot(face_norm, known_norm_vec)
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match_index = idx
                    
            except Exception as e:
                print(f"Error comparing face {idx}: {e}")
                continue
        
        if best_match_index is not None and best_similarity > tolerance:
            distance = 1 - best_similarity
            return best_match_index, distance
        
        return None, None
    
    def save_image(self, image_data, user_id, index):
        """Save face image to disk"""
        try:
            user_folder = os.path.join(Config.FACES_DIR, user_id)
            os.makedirs(user_folder, exist_ok=True)
            img_path = os.path.join(user_folder, f'{user_id}_{index}.jpg')
            cv2.imwrite(img_path, image_data)
            return img_path
        except Exception as e:
            print(f"Error saving image: {e}")
            return None
