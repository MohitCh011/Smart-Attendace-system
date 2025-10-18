import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
    DATABASE_NAME = 'attendance_system'
    
    # Directories
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    FACES_DIR = os.path.join(BASE_DIR, '..', 'data', 'faces')
    ATTENDANCE_DIR = os.path.join(BASE_DIR, '..', 'data', 'attendance')
    
    # Face Recognition Settings
    FACE_RECOGNITION_TOLERANCE = 0.6
    MIN_IMAGES_FOR_REGISTRATION = 10
    MAX_IMAGES_FOR_REGISTRATION = 30
    
    # Create directories if they don't exist
    os.makedirs(FACES_DIR, exist_ok=True)
    os.makedirs(ATTENDANCE_DIR, exist_ok=True)
