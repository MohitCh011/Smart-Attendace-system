from flask import Blueprint, request, jsonify
import cv2
import base64
import numpy as np
from utils.face_utils import FaceUtils
from utils.db_manager import DatabaseManager
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

registration_bp = Blueprint('registration', __name__)
face_utils = FaceUtils()
db_manager = DatabaseManager()


@registration_bp.route('/api/register', methods=['POST'])
@jwt_required()  # ← Make sure JWT is required
def register_user():
    """Register new user under authenticated class"""
    try:
        # ===== GET CLASS FROM JWT TOKEN =====
        current_user = get_jwt_identity()
        claims = get_jwt()
        class_code = current_user  # This is the logged-in class code
        class_name = claims.get('class_name', 'Unknown')
        role = claims.get('role', 'class')
        
        print(f"\n===== Registration Request from {class_code} ({class_name}) =====")
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'userId', 'images']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        name = data['name']
        email = data['email']
        user_id = data['userId']
        images_data = data['images']
        department = data.get('department', claims.get('department', ''))
        
        # Validate images
        if not images_data or len(images_data) < 10:
            return jsonify({
                'error': 'At least 10 face images are required'
            }), 400
        
        # Process images and generate encodings
        face_encodings = []
        processed_count = 0
        
        print(f"Processing {len(images_data)} images...")
        
        for idx, image_data in enumerate(images_data):
            try:
                # Decode base64 image
                img_bytes = base64.b64decode(image_data.split(',')[1])
                nparr = np.frombuffer(img_bytes, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                # Check if face is detected
                if not face_utils.detect_face(img):
                    print(f"  Image {idx+1}: No face detected")
                    continue
                
                # Generate encoding
                encoding = face_utils.generate_encoding(img)
                if encoding is not None:
                    face_encodings.append(encoding)
                    processed_count += 1
                    print(f"  Image {idx+1}: ✓ Processed")
                    
                    # Save image
                    face_utils.save_image(img, user_id, idx)
                else:
                    print(f"  Image {idx+1}: Failed to generate encoding")
                    
            except Exception as e:
                print(f"  Image {idx+1}: Error - {e}")
                continue
        
        # Validate minimum encodings
        if len(face_encodings) < 5:
            return jsonify({
                'error': f'Only {len(face_encodings)} valid face images found. Need at least 5.'
            }), 400
        
        # ===== SAVE USER WITH CLASS ASSIGNMENT =====
        user_data = {
            'user_id': user_id,
            'name': name,
            'email': email,
            'department': department,
            'class_code': class_code,      # ← Assign to logged-in class
            'class_name': class_name,      # ← Store class name
            'face_encodings': face_encodings
        }
        
        print(f"Saving user {user_id} to class {class_code}...")
        result = db_manager.save_user(user_data)
        
        if result is None:
            return jsonify({
                'error': f'User {user_id} already exists in class {class_code}'
            }), 409
        
        print(f"✓ User {user_id} registered successfully in {class_code}")
        
        return jsonify({
            'message': f'User registered successfully in {class_name}',
            'user_id': user_id,
            'name': name,
            'class_code': class_code,
            'class_name': class_name,
            'encodings_count': len(face_encodings),
            'images_processed': processed_count
        }), 201
        
    except Exception as e:
        print(f"❌ Registration error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@registration_bp.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users from the authenticated class ONLY"""
    try:
        # Get class from JWT
        current_user = get_jwt_identity()
        claims = get_jwt()
        class_code = current_user
        role = claims.get('role', 'class')
        
        print(f"\n===== Fetching users for class: {class_code} =====")
        
        # ONLY get users from this class (no admin override)
        users = db_manager.get_all_users(class_code=class_code)
        
        print(f"✓ Found {len(users)} users in {class_code}")
        
        # Remove sensitive data from response
        users_list = []
        for user in users:
            user_copy = user.copy()
            user_copy.pop('_id', None)
            user_copy.pop('face_encodings', None)
            user_copy['encodings_count'] = len(user.get('face_encodings', []))
            users_list.append(user_copy)
        
        return jsonify({
            'users': users_list,
            'count': len(users_list),
            'class_code': class_code
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting users: {e}")
        return jsonify({'error': str(e)}), 500


@registration_bp.route('/api/users/<user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Delete user from authenticated class"""
    try:
        current_user = get_jwt_identity()
        class_code = current_user
        
        print(f"Deleting user {user_id} from class {class_code}")
        
        result = db_manager.delete_user(user_id, class_code=class_code)
        
        if result and result.modified_count > 0:
            return jsonify({
                'message': f'User {user_id} deleted successfully',
                'deleted': True
            }), 200
        else:
            return jsonify({
                'error': 'User not found in this class',
                'deleted': False
            }), 404
            
    except Exception as e:
        print(f"❌ Error deleting user: {e}")
        return jsonify({'error': str(e)}), 500
