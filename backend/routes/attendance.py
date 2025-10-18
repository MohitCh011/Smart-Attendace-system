from flask import Blueprint, request, jsonify, Response
import cv2
import base64
import numpy as np
from datetime import datetime, timedelta
from utils.face_utils import FaceUtils
from utils.db_manager import DatabaseManager
import pandas as pd
from utils.email_notifications import EmailNotifications
from utils.blink_detector import check_blink_liveness
import os
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

# Initialize Blueprint
attendance_bp = Blueprint('attendance', __name__)

# Initialize utilities
face_utils = FaceUtils()
db_manager = DatabaseManager()
email_notifier = EmailNotifications()


@attendance_bp.route('/api/mark-attendance', methods=['POST'])
@jwt_required()
def mark_attendance():
    """
    Mark attendance with automatic blink detection
    Supports two modes:
    1. blink_detection: Captures multiple frames and detects blink
    2. single: Single image capture (legacy mode)
    """
    try:
        # Get class info from JWT token
        current_user = get_jwt_identity()
        claims = get_jwt()
        class_code = current_user
        
        print(f"\n{'='*60}")
        print(f"ATTENDANCE REQUEST FROM CLASS: {class_code}")
        print(f"{'='*60}")
        
        data = request.get_json()
        mode = data.get('mode', 'single')
        
        # ===== BLINK DETECTION MODE =====
        if mode == 'blink_detection':
            images_data = data.get('images', [])
            
            if len(images_data) < 5:
                return jsonify({
                    'status': 'error',
                    'message': 'Need at least 5 frames for blink detection'
                }), 400
            
            print(f"📸 Processing {len(images_data)} frames for blink detection...")
            
            # Decode all images
            frames = []
            for idx, img_data in enumerate(images_data):
                try:
                    img_bytes = base64.b64decode(img_data.split(',')[1])
                    nparr = np.frombuffer(img_bytes, np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    frames.append(img)
                except Exception as e:
                    print(f"  Frame {idx+1}: Decode error - {e}")
                    continue
            
            if len(frames) < 5:
                return jsonify({
                    'status': 'error',
                    'message': 'Failed to decode enough frames'
                }), 400
            
            # Check blink liveness
            print("👁️ Checking for blink pattern...")
            is_live, confidence, reason = check_blink_liveness(frames)
            
            if not is_live:
                print(f"❌ BLINK CHECK FAILED: {reason}")
                return jsonify({
                    'status': 'liveness_failed',
                    'message': f'❌ {reason}',
                    'confidence': round(confidence, 2),
                    'tips': [
                        'Look directly at the camera',
                        'Blink naturally and clearly',
                        'Ensure good lighting on your face',
                        'Do not use photos or videos'
                    ]
                }), 403
            
            print(f"✅ Blink detected! Confidence: {confidence:.1f}%")
            
            # Use the clearest frame (middle frames usually best)
            img = frames[len(frames) // 2]
            
        # ===== SINGLE IMAGE MODE (Legacy) =====
        else:
            image_data = data.get('image')
            
            if not image_data:
                return jsonify({
                    'status': 'error',
                    'error': 'No image provided'
                }), 400
            
            try:
                img_bytes = base64.b64decode(image_data.split(',')[1])
                nparr = np.frombuffer(img_bytes, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception as e:
                return jsonify({
                    'status': 'error',
                    'error': 'Invalid image format'
                }), 400
        
        # ===== STEP 2: FACE DETECTION & ENCODING =====
        print("🔍 Detecting face and generating encoding...")
        face_encoding = face_utils.generate_encoding(img)
        
        if face_encoding is None:
            return jsonify({
                'status': 'error',
                'message': 'No face detected. Please ensure your face is clearly visible.'
            }), 400
        
        print("✓ Face encoding generated")
        
        # ===== STEP 3: GET USERS FROM THIS CLASS ONLY =====
        users = db_manager.get_all_users(class_code=class_code)
        print(f"✓ Retrieved {len(users)} users from class {class_code}")
        
        if len(users) == 0:
            return jsonify({
                'status': 'error',
                'message': f'No registered users found in class {class_code}'
            }), 404
        
        # ===== STEP 4: FACE MATCHING =====
        print("🔎 Matching face with registered users...")
        best_match = None
        best_distance = float('inf')
        
        for user in users:
            # Verify user belongs to this class
            if user.get('class_code') != class_code:
                continue
            
            encodings = user.get('face_encodings', [])
            if not encodings:
                continue
            
            match_index, distance = face_utils.compare_faces(
                encodings, 
                face_encoding
            )
            
            if match_index is not None and distance < best_distance:
                best_distance = distance
                best_match = user
        
        if best_match is None:
            print("❌ Face not recognized")
            return jsonify({
                'status': 'not_recognized',
                'message': f'Face not recognized in class {class_code}. Please register first.'
            }), 404
        
        # Double-check class assignment
        if best_match.get('class_code') != class_code:
            print(f"❌ User belongs to different class: {best_match.get('class_code')}")
            return jsonify({
                'status': 'wrong_class',
                'message': 'Student is not registered in this class'
            }), 403
        
        print(f"✓ Face matched: {best_match['name']} ({best_match['user_id']})")
        print(f"  Confidence: {(1 - best_distance) * 100:.2f}%")
        
        # ===== STEP 5: MARK ATTENDANCE =====
        result = db_manager.mark_attendance(
            best_match['user_id'], 
            best_match['name'],
            class_code=class_code
        )
        
        # Handle already marked case
        if result['status'] == 'already_marked':
            print(f"ℹ️ Attendance already marked at {result['time']}")
            return jsonify({
                'status': 'already_marked',
                'message': f"Attendance already marked today at {result['time']}",
                'name': best_match['name'],
                'user_id': best_match['user_id'],
                'time': result['time'],
                'email': best_match.get('email', ''),
                'department': best_match.get('department', 'N/A'),
                'class_code': class_code
            }), 200
        
        # ===== STEP 6: SEND EMAIL NOTIFICATIONS =====
        is_late = False
        if result['status'] == 'success':
            try:
                # Send confirmation email to user
                user_email = best_match.get('email', '')
                if user_email:
                    email_notifier.send_attendance_notification(
                        user_email,
                        best_match['name'],
                        result['time']
                    )
                    print(f"✓ Email sent to {user_email}")
                
                # Check if late arrival (after 9:30 AM)
                time_parts = result['time'].split(':')
                hours = int(time_parts[0])
                minutes = int(time_parts[1])
                
                is_late = hours > 9 or (hours == 9 and minutes > 30)
                
                if is_late:
                    admin_email = os.getenv('ADMIN_EMAIL')
                    if admin_email:
                        email_notifier.send_late_arrival_alert(
                            admin_email,
                            best_match['name'],
                            result['time']
                        )
                        print(f"⚠️ Late arrival alert sent to admin")
                        
            except Exception as email_error:
                print(f"❌ Email notification failed: {email_error}")
                # Continue even if email fails
        
        # ===== STEP 7: RETURN SUCCESS RESPONSE =====
        print(f"✅ Attendance marked successfully for {best_match['name']}")
        print(f"{'='*60}\n")
        
        return jsonify({
            'status': 'success',
            'message': f"✅ Attendance marked for {best_match['name']}!",
            'name': best_match['name'],
            'user_id': best_match['user_id'],
            'email': best_match.get('email', ''),
            'department': best_match.get('department', 'N/A'),
            'class_code': class_code,
            'time': result['time'],
            'date': datetime.now().strftime('%Y-%m-%d'),
            'confidence': round((1 - best_distance) * 100, 2),
            'is_late': is_late
        }), 200
        
    except Exception as e:
        print(f"❌ Error in mark_attendance: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'error': 'Internal server error',
            'details': str(e)
        }), 500


@attendance_bp.route('/api/attendance', methods=['GET'])
@jwt_required()
def get_attendance():
    """Get attendance records filtered by class"""
    try:
        current_user = get_jwt_identity()
        claims = get_jwt()
        class_code = current_user
        role = claims.get('role', 'class')
        
        date = request.args.get('date')
        user_id = request.args.get('user_id')
        
        # Admin can see all, class sees only their students
        if role == 'admin':
            if date:
                records = db_manager.get_attendance_by_date(date)
            else:
                records = db_manager.get_all_attendance()
        else:
            if date:
                records = db_manager.get_attendance_by_date(date, class_code=class_code)
            else:
                records = db_manager.get_all_attendance(class_code=class_code)
        
        # Filter by user_id if provided
        if user_id:
            records = [r for r in records if r.get('user_id') == user_id]
        
        # Format attendance list
        attendance_list = []
        for record in records:
            attendance_list.append({
                'user_id': record.get('user_id', 'N/A'),
                'name': record.get('name', 'Unknown'),
                'date': record.get('date', 'N/A'),
                'time': record.get('time', 'N/A'),
                'class_code': record.get('class_code', 'N/A'),
                'timestamp': record.get('timestamp', '')
            })
        
        return jsonify({
            'status': 'success',
            'attendance': attendance_list,
            'count': len(attendance_list),
            'date': date if date else 'all',
            'class_code': class_code if role != 'admin' else 'ALL'
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting attendance: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@attendance_bp.route('/api/attendance/stats', methods=['GET'])
@jwt_required()
def get_attendance_stats():
    """Get attendance statistics for class"""
    try:
        current_user = get_jwt_identity()
        claims = get_jwt()
        class_code = current_user
        role = claims.get('role', 'class')
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        if role == 'admin':
            today_records = db_manager.get_attendance_by_date(today)
            all_users = db_manager.get_all_users()
        else:
            today_records = db_manager.get_attendance_by_date(today, class_code=class_code)
            all_users = db_manager.get_all_users(class_code=class_code)
        
        total_users = len(all_users)
        present_today = len(today_records)
        absent_today = total_users - present_today
        attendance_rate = (present_today / total_users * 100) if total_users > 0 else 0
        
        # Count late arrivals
        late_count = 0
        for record in today_records:
            time_parts = record['time'].split(':')
            hours = int(time_parts[0])
            minutes = int(time_parts[1])
            if hours > 9 or (hours == 9 and minutes > 30):
                late_count += 1
        
        return jsonify({
            'status': 'success',
            'stats': {
                'total_users': total_users,
                'present_today': present_today,
                'absent_today': absent_today,
                'attendance_rate': round(attendance_rate, 2),
                'late_arrivals': late_count,
                'on_time': present_today - late_count
            },
            'class_code': class_code,
            'date': today
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting stats: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@attendance_bp.route('/api/attendance/export', methods=['GET'])
@jwt_required()
def export_attendance():
    """Export attendance records to CSV"""
    try:
        current_user = get_jwt_identity()
        claims = get_jwt()
        class_code = current_user
        role = claims.get('role', 'class')
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Fetch records
        if start_date and end_date:
            records = []
            current = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            
            while current <= end:
                date_str = current.strftime('%Y-%m-%d')
                if role == 'admin':
                    day_records = db_manager.get_attendance_by_date(date_str)
                else:
                    day_records = db_manager.get_attendance_by_date(date_str, class_code=class_code)
                records.extend(day_records)
                current = current + timedelta(days=1)
        else:
            if role == 'admin':
                records = db_manager.get_all_attendance()
            else:
                records = db_manager.get_all_attendance(class_code=class_code)
        
        if not records:
            return jsonify({
                'status': 'error',
                'message': 'No records found for export'
            }), 404
        
        # Create DataFrame
        df = pd.DataFrame([{
            'User ID': r.get('user_id', 'N/A'),
            'Name': r.get('name', 'Unknown'),
            'Class': r.get('class_code', 'N/A'),
            'Date': r.get('date', 'N/A'),
            'Time': r.get('time', 'N/A'),
            'Day': datetime.strptime(r.get('date', '2000-01-01'), '%Y-%m-%d').strftime('%A'),
            'Status': 'Late' if (int(r.get('time', '00:00').split(':')[0]) > 9 or 
                                 (int(r.get('time', '00:00').split(':')[0]) == 9 and 
                                  int(r.get('time', '00:00').split(':')[1]) > 30)) else 'On Time'
        } for r in records])
        
        df = df.sort_values(['Date', 'Time'], ascending=[False, True])
        csv_data = df.to_csv(index=False)
        
        filename = f'attendance_{class_code}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename={filename}',
                'Content-Type': 'text/csv; charset=utf-8'
            }
        )
        
    except Exception as e:
        print(f"❌ Error exporting attendance: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@attendance_bp.route('/api/attendance/user/<user_id>', methods=['GET'])
@jwt_required()
def get_user_attendance(user_id):
    """Get attendance history for a specific user"""
    try:
        current_user = get_jwt_identity()
        claims = get_jwt()
        class_code = current_user
        role = claims.get('role', 'class')
        
        if role == 'admin':
            all_records = db_manager.get_all_attendance()
        else:
            all_records = db_manager.get_all_attendance(class_code=class_code)
        
        user_records = [r for r in all_records if r.get('user_id') == user_id]
        
        if not user_records:
            return jsonify({
                'status': 'success',
                'message': 'No attendance records found for this user',
                'records': [],
                'count': 0
            }), 200
        
        # Calculate statistics
        total_days = len(user_records)
        late_days = sum(1 for r in user_records 
                       if int(r['time'].split(':')[0]) > 9 or 
                       (int(r['time'].split(':')[0]) == 9 and int(r['time'].split(':')[1]) > 30))
        
        return jsonify({
            'status': 'success',
            'user_id': user_id,
            'records': user_records,
            'statistics': {
                'total_days': total_days,
                'late_days': late_days,
                'on_time_days': total_days - late_days,
                'attendance_rate': round((total_days / 30) * 100, 2)
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting user attendance: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@attendance_bp.route('/api/test-blink', methods=['POST'])
@jwt_required()
def test_blink_detection():
    """Test blink detection with image sequence"""
    try:
        data = request.get_json()
        images_data = data.get('images', [])
        
        if len(images_data) < 5:
            return jsonify({
                'error': 'Need at least 5 images'
            }), 400
        
        # Decode images
        frames = []
        for img_data in images_data:
            img_bytes = base64.b64decode(img_data.split(',')[1])
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            frames.append(img)
        
        # Test blink detection
        is_live, confidence, reason = check_blink_liveness(frames)
        
        return jsonify({
            'status': 'live' if is_live else 'no_blink',
            'is_live': is_live,
            'confidence': round(confidence, 2),
            'reason': reason,
            'message': '✅ Blink detected!' if is_live else '❌ No blink detected'
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500
