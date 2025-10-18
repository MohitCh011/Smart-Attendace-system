import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

class EmailNotifications:
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', 587))
        self.sender_email = os.getenv('SENDER_EMAIL', 'your-email@gmail.com')
        self.sender_password = os.getenv('SENDER_PASSWORD', 'your-app-password')
    
    def send_attendance_notification(self, user_email, user_name, time):
        """Send email when attendance is marked"""
        try:
            subject = f"Attendance Marked - {datetime.now().strftime('%Y-%m-%d')}"
            
            body = f"""
            <html>
                <body>
                    <h2>Attendance Confirmation</h2>
                    <p>Hi {user_name},</p>
                    <p>Your attendance has been successfully marked at <strong>{time}</strong>.</p>
                    <p>Date: {datetime.now().strftime('%B %d, %Y')}</p>
                    <br>
                    <p>Best regards,<br>Smart Attendance System</p>
                </body>
            </html>
            """
            
            self._send_email(user_email, subject, body)
            return True
        except Exception as e:
            print(f"Email notification failed: {e}")
            return False
    
    def send_late_arrival_alert(self, admin_email, user_name, time):
        """Send alert to admin for late arrivals"""
        try:
            subject = f"Late Arrival Alert - {user_name}"
            
            body = f"""
            <html>
                <body>
                    <h2>Late Arrival Notification</h2>
                    <p><strong>{user_name}</strong> arrived late at <strong>{time}</strong>.</p>
                    <p>Date: {datetime.now().strftime('%B %d, %Y')}</p>
                </body>
            </html>
            """
            
            self._send_email(admin_email, subject, body)
            return True
        except Exception as e:
            print(f"Late alert failed: {e}")
            return False
    
    def _send_email(self, to_email, subject, html_body):
        """Internal method to send email"""
        msg = MIMEMultipart('alternative')
        msg['From'] = self.sender_email
        msg['To'] = to_email
        msg['Subject'] = subject
        
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
            server.starttls()
            server.login(self.sender_email, self.sender_password)
            server.send_message(msg)
