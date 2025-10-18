from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta
import os

auth_bp = Blueprint('auth', __name__)

# Simulated class/department database
CLASSES = {
    'CS101': {
        'password': generate_password_hash('cs101pass'),
        'name': 'Computer Science - Year 1',
        'department': 'Computer Science',
        'role': 'class'
    },
    'CS201': {
        'password': generate_password_hash('cs201pass'),
        'name': 'Computer Science - Year 2',
        'department': 'Computer Science',
        'role': 'class'
    },
    'EE101': {
        'password': generate_password_hash('ee101pass'),
        'name': 'Electrical Engineering - Year 1',
        'department': 'Electrical Engineering',
        'role': 'class'
    },
    'ME101': {
        'password': generate_password_hash('me101pass'),
        'name': 'Mechanical Engineering - Year 1',
        'department': 'Mechanical Engineering',
        'role': 'class'
    },
    'admin': {
        'password': generate_password_hash('admin123'),
        'name': 'Administrator',
        'department': 'Administration',
        'role': 'admin'
    },
    'faculty': {
        'password': generate_password_hash('faculty123'),
        'name': 'Faculty Member',
        'department': 'Teaching Staff',
        'role': 'faculty'
    }
}

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """Class-based login"""
    try:
        data = request.get_json()
        class_code = data.get('class_code')
        password = data.get('password')
        
        if not class_code or not password:
            return jsonify({'error': 'Class code and password required'}), 400
        
        # Check credentials
        if class_code in CLASSES:
            class_data = CLASSES[class_code]
            if check_password_hash(class_data['password'], password):
                access_token = create_access_token(
                    identity=class_code,
                    expires_delta=timedelta(hours=8),
                    additional_claims={
                        'role': class_data['role'],
                        'department': class_data['department'],
                        'class_name': class_data['name']
                    }
                )
                return jsonify({
                    'access_token': access_token,
                    'class_code': class_code,
                    'class_name': class_data['name'],
                    'department': class_data['department'],
                    'role': class_data['role']
                }), 200
        
        return jsonify({'error': 'Invalid class code or password'}), 401
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/api/auth/classes', methods=['GET'])
def get_classes():
    """Get all available classes"""
    classes_list = []
    for code, data in CLASSES.items():
        if data['role'] == 'class':
            classes_list.append({
                'code': code,
                'name': data['name'],
                'department': data['department']
            })
    return jsonify({'classes': classes_list}), 200
