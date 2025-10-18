from pymongo import MongoClient
from datetime import datetime
from config import Config
import certifi


class DatabaseManager:
    def __init__(self):
        try:
            self.client = MongoClient(
                Config.MONGODB_URI,
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000
            )
            
            self.client.admin.command('ping')
            print("✓ MongoDB Atlas connection successful!")
            
            self.db = self.client[Config.DATABASE_NAME]
            self.users = self.db['users']
            self.face_encodings = self.db['face_encodings']
            self.attendance = self.db['attendance']
            
        except Exception as e:
            print(f"❌ MongoDB connection error: {e}")
            raise
    
    def save_user(self, user_data):
        """Save new user with class assignment"""
        try:
            encodings = user_data.pop('face_encodings', [])
            
            # Check if user already exists in this class
            existing = self.users.find_one({
                'user_id': user_data['user_id'],
                'class_code': user_data.get('class_code')
            })
            if existing:
                print(f"User {user_data['user_id']} already exists in {user_data.get('class_code')}")
                return None
            
            # Add metadata
            user_data['created_at'] = datetime.now()
            user_data['is_active'] = True
            user_data['class_code'] = user_data.get('class_code', 'GENERAL')  # Required field
            
            result = self.users.insert_one(user_data)
            user_id = user_data['user_id']
            class_code = user_data['class_code']
            
            # Save face encodings with class reference
            for idx, encoding in enumerate(encodings):
                self.face_encodings.insert_one({
                    'user_id': user_id,
                    'class_code': class_code,
                    'encoding_index': idx,
                    'encoding': encoding,
                    'created_at': datetime.now()
                })
            
            print(f"✓ User {user_id} saved in class {class_code} with {len(encodings)} face encodings")
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"❌ Error saving user: {e}")
            return None
    
    def get_user_by_id(self, user_id, class_code=None):
        """Get user with optional class filter"""
        try:
            query = {'user_id': user_id, 'is_active': True}
            if class_code:
                query['class_code'] = class_code
                
            user = self.users.find_one(query)
            if user:
                encodings = list(self.face_encodings.find(
                    {'user_id': user_id, 'class_code': user.get('class_code')},
                    {'encoding': 1, '_id': 0}
                ).sort('encoding_index', 1))
                user['face_encodings'] = [e['encoding'] for e in encodings]
            return user
        except Exception as e:
            print(f"❌ Error getting user: {e}")
            return None
    
    def get_all_users(self, class_code=None):
        """Get all active users filtered by class"""
        try:
            query = {'is_active': True}
            if class_code:
                query['class_code'] = class_code
            
            users = list(self.users.find(query))
            
            for user in users:
                encodings = list(self.face_encodings.find(
                    {'user_id': user['user_id'], 'class_code': user.get('class_code')},
                    {'encoding': 1, '_id': 0}
                ).sort('encoding_index', 1))
                user['face_encodings'] = [e['encoding'] for e in encodings]
            
            print(f"✓ Retrieved {len(users)} users" + (f" from class {class_code}" if class_code else ""))
            return users
        except Exception as e:
            print(f"❌ Error getting users: {e}")
            return []
    
    def mark_attendance(self, user_id, name, class_code=None):
        """Mark attendance with class reference"""
        try:
            today = datetime.now().date()
            existing = self.attendance.find_one({
                'user_id': user_id,
                'date': str(today),
                'class_code': class_code
            })
            
            if existing:
                return {'status': 'already_marked', 'time': existing['time']}
            
            attendance_data = {
                'user_id': user_id,
                'name': name,
                'class_code': class_code,
                'date': str(today),
                'time': datetime.now().strftime('%H:%M:%S'),
                'timestamp': datetime.now()
            }
            
            self.attendance.insert_one(attendance_data)
            return {'status': 'success', 'time': attendance_data['time']}
        except Exception as e:
            print(f"❌ Error marking attendance: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def get_attendance_by_date(self, date, class_code=None):
        """Get attendance records for specific date and class"""
        try:
            query = {'date': date}
            if class_code:
                query['class_code'] = class_code
            return list(self.attendance.find(query).sort('time', 1))
        except Exception as e:
            print(f"❌ Error getting attendance: {e}")
            return []
    
    def get_all_attendance(self, class_code=None):
        """Get all attendance records filtered by class"""
        try:
            query = {}
            if class_code:
                query['class_code'] = class_code
            return list(self.attendance.find(query).sort('timestamp', -1).limit(100))
        except Exception as e:
            print(f"❌ Error getting all attendance: {e}")
            return []
    
    def delete_user(self, user_id, class_code=None):
        """Soft delete user from specific class"""
        try:
            query = {'user_id': user_id}
            if class_code:
                query['class_code'] = class_code
                
            result = self.users.update_one(
                query,
                {'$set': {'is_active': False}}
            )
            
            # Delete face encodings
            encoding_query = {'user_id': user_id}
            if class_code:
                encoding_query['class_code'] = class_code
            self.face_encodings.delete_many(encoding_query)
            
            print(f"✓ User {user_id} deleted from {class_code if class_code else 'all classes'}")
            return result
        except Exception as e:
            print(f"❌ Error deleting user: {e}")
            return None
    
    def get_class_statistics(self, class_code):
        """Get statistics for a specific class"""
        try:
            total_students = self.users.count_documents({
                'class_code': class_code,
                'is_active': True
            })
            
            today = datetime.now().strftime('%Y-%m-%d')
            today_attendance = self.attendance.count_documents({
                'class_code': class_code,
                'date': today
            })
            
            return {
                'total_students': total_students,
                'today_present': today_attendance,
                'today_absent': total_students - today_attendance,
                'attendance_rate': round((today_attendance / total_students * 100), 2) if total_students > 0 else 0
            }
        except Exception as e:
            print(f"❌ Error getting class statistics: {e}")
            return None
