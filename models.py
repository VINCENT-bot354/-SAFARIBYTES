from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pytz

db = SQLAlchemy()

def get_nairobi_time():
    return datetime.now(pytz.timezone('Africa/Nairobi'))

class PortalCredentials(db.Model):
    __tablename__ = 'portal_credentials'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)

class AdminCredentials(db.Model):
    __tablename__ = 'admin_credentials'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)

class SystemSettings(db.Model):
    __tablename__ = 'system_settings'
    id = db.Column(db.Integer, primary_key=True)
    allow_email_signin = db.Column(db.Boolean, default=True)
    allow_pay_on_delivery = db.Column(db.Boolean, default=True)
    splash_enabled = db.Column(db.Boolean, default=False)
    adverts_enabled = db.Column(db.Boolean, default=False)
    advert_frequency = db.Column(db.Integer, default=5)
    min_delivery_fee = db.Column(db.Float, default=100.0)
    delivery_per_km_rate = db.Column(db.Float, default=50.0)
    convenience_fee = db.Column(db.Float, default=0.0)
    transaction_fee_percentage = db.Column(db.Float, default=0.0)
    username_change_limit = db.Column(db.Integer, default=2)
    username_change_window_days = db.Column(db.Integer, default=3)
    staff_portal_password_hash = db.Column(db.String(255), nullable=True)
    terms_mandatory = db.Column(db.Boolean, default=True)
    customer_care_number = db.Column(db.String(20), nullable=True)
    backup_interval = db.Column(db.String(20), default='manual')
    backup_retention = db.Column(db.Integer, default=3)
    timezone = db.Column(db.String(50), default='Africa/Nairobi')
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)

class SocialLink(db.Model):
    __tablename__ = 'social_links'
    id = db.Column(db.Integer, primary_key=True)
    platform = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)

class Staff(db.Model):
    __tablename__ = 'staff'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    full_name = db.Column(db.String(255), nullable=True)
    is_approved = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    tracking_link = db.Column(db.Text, nullable=True)
    tracking_link_updated_at = db.Column(db.DateTime, nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)
    last_logout = db.Column(db.DateTime, nullable=True)
    webauthn_credential = db.Column(db.Text, nullable=True)
    pin_hash = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)

class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    username = db.Column(db.String(100), unique=True, nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    full_name = db.Column(db.String(255), nullable=True)
    username_change_count = db.Column(db.Integer, default=0)
    last_username_change = db.Column(db.DateTime, nullable=True)
    phone_verified = db.Column(db.Boolean, default=False)
    terms_accepted = db.Column(db.Boolean, default=False)
    terms_accepted_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)

class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    image_url = db.Column(db.String(500), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price_now = db.Column(db.Float, nullable=False)
    price_old = db.Column(db.Float, nullable=True)
    stock = db.Column(db.String(100), nullable=True)
    category = db.Column(db.String(100), nullable=False)
    cost_of_goods = db.Column(db.Float, nullable=True, default=0.0)
    is_combo = db.Column(db.Boolean, default=False)
    combo_items = db.Column(db.JSON, nullable=True)
    is_available = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)

class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.String(50), unique=True, nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    customer_name = db.Column(db.String(255), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    customer_email = db.Column(db.String(255), nullable=True)
    items = db.Column(db.JSON, nullable=False)
    product_total = db.Column(db.Float, nullable=False)
    delivery_fee = db.Column(db.Float, nullable=False)
    convenience_fee = db.Column(db.Float, default=0.0)
    transaction_fee = db.Column(db.Float, default=0.0)
    total_amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(50), nullable=False)
    payment_status = db.Column(db.String(50), default='Pending Payment')
    delivery_address = db.Column(db.Text, nullable=False)
    delivery_latitude = db.Column(db.Float, nullable=True)
    delivery_longitude = db.Column(db.Float, nullable=True)
    location_method = db.Column(db.String(20), nullable=True)
    staff_id = db.Column(db.Integer, db.ForeignKey('staff.id'), nullable=True)
    status = db.Column(db.String(50), default='Pending')
    payhero_reference = db.Column(db.String(255), nullable=True)
    is_archived = db.Column(db.Boolean, default=False)
    delivered_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)
    
    customer = db.relationship('Customer', backref='orders')
    staff = db.relationship('Staff', backref='orders')

class CapitalLedger(db.Model):
    __tablename__ = 'capital_ledger'
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    purpose = db.Column(db.Text, nullable=False)
    is_edited = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)

class TermsAndConditions(db.Model):
    __tablename__ = 'terms_and_conditions'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    version = db.Column(db.Integer, nullable=False)
    pdf_path = db.Column(db.String(500), nullable=True)
    is_current = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_type = db.Column(db.String(20), nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    related_order_id = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)

class BackupHistory(db.Model):
    __tablename__ = 'backup_history'
    id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.String(500), nullable=False)
    backup_type = db.Column(db.String(20), default='manual')
    file_size = db.Column(db.Integer, nullable=True)
    email_sent = db.Column(db.Boolean, default=False)
    email_status = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    action_type = db.Column(db.String(100), nullable=False)
    user_type = db.Column(db.String(20), nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text, nullable=False)
    log_metadata = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)

class OTPVerification(db.Model):
    __tablename__ = 'otp_verifications'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False)
    otp_code = db.Column(db.String(10), nullable=False)
    purpose = db.Column(db.String(50), nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)

class Cart(db.Model):
    __tablename__ = 'carts'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=get_nairobi_time)
    updated_at = db.Column(db.DateTime, default=get_nairobi_time, onupdate=get_nairobi_time)
    
    customer = db.relationship('Customer', backref='cart_items')
    product = db.relationship('Product', backref='cart_items')
