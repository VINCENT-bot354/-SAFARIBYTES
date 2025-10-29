import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, Attachment, FileContent, FileName, FileType, Disposition
import base64

class EmailService:
    def __init__(self):
        self.api_key = os.getenv('SENDGRID_API_KEY')
        self.sender_email = os.getenv('SENDGRID_SENDER_EMAIL')
        self.sg = SendGridAPIClient(self.api_key) if self.api_key else None
    
    def send_email(self, to_email, subject, html_content, attachments=None):
        """Send email with optional attachments"""
        if not self.sg or not self.sender_email:
            print(f"SendGrid not configured. Email to {to_email}: {subject}")
            return False, "SendGrid not configured"
        
        try:
            message = Mail(
                from_email=Email(self.sender_email),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            if attachments:
                for attachment_data in attachments:
                    with open(attachment_data['path'], 'rb') as f:
                        file_data = f.read()
                    encoded = base64.b64encode(file_data).decode()
                    
                    attachment = Attachment(
                        FileContent(encoded),
                        FileName(attachment_data['filename']),
                        FileType(attachment_data.get('type', 'application/pdf')),
                        Disposition('attachment')
                    )
                    message.add_attachment(attachment)
            
            response = self.sg.send(message)
            return True, f"Email sent successfully (Status: {response.status_code})"
        except Exception as e:
            print(f"Failed to send email: {str(e)}")
            return False, str(e)
    
    def send_staff_registration_notification(self, admin_email, staff_email, staff_name):
        """Notify admin of new staff registration"""
        subject = "New Staff Registration - SAFARI BYTES"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>New Staff Registration</h2>
            <p>A new staff member has registered and is awaiting approval:</p>
            <ul>
                <li><strong>Name:</strong> {staff_name}</li>
                <li><strong>Email:</strong> {staff_email}</li>
            </ul>
            <p>Please log in to the admin panel to approve or reject this registration.</p>
        </body>
        </html>
        """
        return self.send_email(admin_email, subject, html_content)
    
    def send_staff_approval_notification(self, staff_email, staff_name, approved):
        """Notify staff of approval/rejection"""
        if approved:
            subject = "Registration Approved - SAFARI BYTES"
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Registration Approved!</h2>
                <p>Hi {staff_name},</p>
                <p>Your registration has been approved. You can now log in to the staff portal.</p>
                <p>Welcome to the SAFARI BYTES team!</p>
            </body>
            </html>
            """
        else:
            subject = "Registration Status - SAFARI BYTES"
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Registration Update</h2>
                <p>Hi {staff_name},</p>
                <p>Unfortunately, your registration was not approved at this time.</p>
                <p>If you believe this is an error, please contact support.</p>
            </body>
            </html>
            """
        return self.send_email(staff_email, subject, html_content)
    
    def send_order_notification(self, customer_email, customer_name, order_id, status):
        """Send order status notification to customer"""
        status_messages = {
            'received': {
                'subject': 'Order Received - SAFARI BYTES',
                'message': 'Your order has been received and is pending delivery.'
            },
            'on_the_way': {
                'subject': 'Order On The Way - SAFARI BYTES',
                'message': 'Your order is on the way! Our delivery staff is heading to you.'
            },
            'delivered': {
                'subject': 'Order Delivered - SAFARI BYTES',
                'message': 'Your order has been successfully delivered. Thank you for choosing SAFARI BYTES!'
            }
        }
        
        msg_data = status_messages.get(status, status_messages['received'])
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>{msg_data['subject']}</h2>
            <p>Hi {customer_name},</p>
            <p>Order ID: <strong>{order_id}</strong></p>
            <p>{msg_data['message']}</p>
        </body>
        </html>
        """
        
        return self.send_email(customer_email, msg_data['subject'], html_content)
    
    def send_otp_email(self, to_email, otp_code, purpose='verification'):
        """Send OTP verification email"""
        subject = f"Your Verification Code - SAFARI BYTES"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Verification Code</h2>
            <p>Your verification code for {purpose} is:</p>
            <h1 style="background: #f0f0f0; padding: 20px; text-align: center; letter-spacing: 5px;">{otp_code}</h1>
            <p>This code will remain valid until a new code is requested.</p>
            <p>If you didn't request this code, please ignore this email.</p>
        </body>
        </html>
        """
        return self.send_email(to_email, subject, html_content)
    
    def send_backup_email(self, admin_email, backup_path, backup_type):
        """Send backup file to admin email"""
        subject = f"Database Backup - {backup_type.upper()} - SAFARI BYTES"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Automated Backup</h2>
            <p>Your {backup_type} backup has been generated successfully.</p>
            <p>Please find the backup file attached.</p>
            <p>Timestamp: {get_nairobi_time().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </body>
        </html>
        """
        
        import os
        filename = os.path.basename(backup_path)
        attachments = [{
            'path': backup_path,
            'filename': filename,
            'type': 'application/pdf'
        }]
        
        return self.send_email(admin_email, subject, html_content, attachments)

def get_nairobi_time():
    """Get current time in Africa/Nairobi timezone"""
    import pytz
    from datetime import datetime
    return datetime.now(pytz.timezone('Africa/Nairobi'))
