from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from routes.registration import registration_bp
from routes.attendance import attendance_bp
from routes.auth import auth_bp  # NEW
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
app.config['JWT_SECRET_KEY'] = Config.SECRET_KEY  # NEW
CORS(app)

# Initialize JWT
jwt = JWTManager(app)  # NEW

# Register blueprints
app.register_blueprint(registration_bp)
app.register_blueprint(attendance_bp)
app.register_blueprint(auth_bp)  # NEW

@app.route('/')
def index():
    return {
        'message': 'Smart Attendance System API',
        'status': 'running',
        'version': '2.0.0'
    }

@app.route('/health')
def health():
    return {'status': 'healthy'}

if __name__ == '__main__':
    print("=" * 50)
    print("🚀 Starting Smart Attendance System Backend v2.0")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
