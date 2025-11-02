import os
import json
import bcrypt
import jwt
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from models import db, get_nairobi_time, PortalCredentials, AdminCredentials, SystemSettings, SocialLink, Staff, Customer, Product, Order, CapitalLedger, TermsAndConditions, Notification, BackupHistory, AuditLog, OTPVerification, Cart
from utils import normalize_phone_number, generate_order_id, validate_image_url, extract_tracking_link, calculate_delivery_fee, generate_otp
from email_service import EmailService
from pdf_service import PDFService
from payment_service import PaymentService
from apscheduler.schedulers.background import BackgroundScheduler
import pytz

load_dotenv()

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        RotatingFileHandler('safari_bytes.log', maxBytes=10485760, backupCount=5),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SESSION_SECRET', 'dev-secret-key')

CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")
db.init_app(app)

email_service = EmailService()
pdf_service = PDFService(os.getenv('PDF_STORAGE_BUCKET', './backups'))
payment_service = PaymentService()

JWT_SECRET = os.getenv('JWT_SECRET', 'jwt-secret-key')

with app.app_context():
    db.create_all()
    settings = SystemSettings.query.first()
    if not settings:
        settings = SystemSettings()
        db.session.add(settings)
        db.session.commit()

def create_token(user_id, user_type):
    payload = {
        'user_id': user_id,
        'user_type': user_type,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        logger.debug(f"Token verified successfully for user_id={payload.get('user_id')}, user_type={payload.get('user_type')}")
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token verification failed: Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Token verification failed: Invalid token - {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Token verification failed: Unexpected error - {str(e)}")
        return None

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

@app.route('/')
def index():
    return render_template('customer.html')

@app.route('/portals')
def portals():
    return render_template('portals.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/staff')
def staff():
    return render_template('staff.html')

@app.route('/api/portals/login', methods=['POST'])
def portals_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    portal_creds = PortalCredentials.query.first()
    
    if not portal_creds:
        portal_creds = PortalCredentials(
            email=email,
            password_hash=hash_password(password)
        )
        db.session.add(portal_creds)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Portal credentials set'}), 200
    
    if portal_creds.email == email and check_password(password, portal_creds.password_hash):
        return jsonify({'success': True}), 200
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/admin/check-bootstrap', methods=['GET'])
def check_admin_bootstrap():
    admin = AdminCredentials.query.first()
    return jsonify({'needs_bootstrap': admin is None})

@app.route('/api/admin/bootstrap', methods=['POST'])
def admin_bootstrap():
    admin = AdminCredentials.query.first()
    if admin:
        return jsonify({'success': False, 'message': 'Admin already exists'}), 400
    
    data = request.json
    admin = AdminCredentials(
        email=data['email'],
        password_hash=hash_password(data['password'])
    )
    db.session.add(admin)
    db.session.commit()
    
    token = create_token(admin.id, 'admin')
    return jsonify({'success': True, 'token': token})

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    admin = AdminCredentials.query.filter_by(email=data['email']).first()
    
    if admin and check_password(data['password'], admin.password_hash):
        token = create_token(admin.id, 'admin')
        return jsonify({'success': True, 'token': token})
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/admin/forgot-password', methods=['POST'])
def admin_forgot_password():
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'success': False, 'message': 'Email is required'}), 400
    
    admin = AdminCredentials.query.filter_by(email=email).first()
    if not admin:
        return jsonify({'success': False, 'message': 'No admin account found with this email'}), 404
    
    try:
        OTPVerification.query.filter_by(email=email, is_used=False).delete()
        
        otp_code = generate_otp()
        
        otp = OTPVerification(
            email=email,
            otp_code=otp_code,
            purpose='admin_password_reset'
        )
        db.session.add(otp)
        db.session.flush()
        
        success, message = email_service.send_otp_email(email, otp_code, 'admin password reset')
        
        if not success:
            db.session.rollback()
            return jsonify({'success': False, 'message': 'Failed to send OTP email. Please try again.'}), 500
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'OTP sent to your email'})
    
    except Exception as e:
        logger.exception(f"Admin forgot password failed: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'message': 'An error occurred. Please try again.'}), 500

@app.route('/api/admin/reset-password', methods=['POST'])
def admin_reset_password():
    data = request.json
    email = data.get('email')
    otp_code = data.get('otp_code')
    new_password = data.get('new_password')
    
    if not all([email, otp_code, new_password]):
        return jsonify({'success': False, 'message': 'All fields are required'}), 400
    
    if len(new_password) < 5:
        return jsonify({'success': False, 'message': 'Password must be at least 5 characters long'}), 400
    
    otp = OTPVerification.query.filter_by(
        email=email,
        otp_code=otp_code,
        is_used=False,
        purpose='admin_password_reset'
    ).first()
    
    if not otp:
        return jsonify({'success': False, 'message': 'Invalid OTP code'}), 400
    
    try:
        admin = AdminCredentials.query.filter_by(email=email).first()
        if admin:
            admin.password_hash = hash_password(new_password)
            otp.is_used = True
            db.session.commit()
            return jsonify({'success': True, 'message': 'Password reset successfully'})
        else:
            return jsonify({'success': False, 'message': 'Admin not found'}), 404
    except Exception as e:
        logger.exception(f"Admin password reset failed: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'message': 'An error occurred. Please try again.'}), 500

@app.route('/api/admin/settings', methods=['GET', 'PUT'])
def admin_settings():
    settings = SystemSettings.query.first()
    
    if request.method == 'GET':
        return jsonify({
            'allow_email_signin': settings.allow_email_signin,
            'allow_pay_on_delivery': settings.allow_pay_on_delivery,
            'splash_enabled': settings.splash_enabled,
            'adverts_enabled': settings.adverts_enabled,
            'advert_frequency': settings.advert_frequency,
            'min_delivery_fee': settings.min_delivery_fee,
            'delivery_per_km_rate': settings.delivery_per_km_rate,
            'convenience_fee': settings.convenience_fee,
            'transaction_fee_percentage': settings.transaction_fee_percentage,
            'username_change_limit': settings.username_change_limit,
            'username_change_window_days': settings.username_change_window_days,
            'terms_mandatory': settings.terms_mandatory,
            'customer_care_number': settings.customer_care_number,
            'backup_interval': settings.backup_interval,
            'backup_retention': settings.backup_retention,
            'timezone': settings.timezone
        })
    
    data = request.json
    for key, value in data.items():
        if hasattr(settings, key):
            if key == 'staff_portal_password' and value:
                settings.staff_portal_password_hash = hash_password(value)
            else:
                setattr(settings, key, value)
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/products', methods=['GET', 'POST'])
def products():
    if request.method == 'GET':
        products = Product.query.filter_by(is_active=True).all()
        return jsonify([{
            'id': p.id,
            'image_url': p.image_url,
            'name': p.name,
            'description': p.description,
            'price_now': p.price_now,
            'price_old': p.price_old,
            'stock': p.stock,
            'category': p.category,
            'is_combo': p.is_combo,
            'combo_items': p.combo_items,
            'is_available': p.is_available
        } for p in products])
    
    data = request.json
    
    is_valid, message = validate_image_url(data['image_url'])
    if not is_valid:
        return jsonify({'success': False, 'message': message}), 400
    
    product = Product(
        image_url=data['image_url'],
        name=data['name'],
        description=data.get('description', ''),
        price_now=data['price_now'],
        price_old=data.get('price_old'),
        stock=data.get('stock', ''),
        category=data['category'],
        cost_of_goods=data.get('cost_of_goods', 0),
        is_combo=data.get('is_combo', False),
        combo_items=data.get('combo_items')
    )
    db.session.add(product)
    db.session.commit()
    
    socketio.emit('product_update', {'action': 'add', 'product_id': product.id})
    
    return jsonify({'success': True, 'id': product.id})

@app.route('/api/products/<int:product_id>', methods=['PUT', 'DELETE'])
def product_detail(product_id):
    product = Product.query.get_or_404(product_id)
    
    if request.method == 'DELETE':
        product.is_active = False
        db.session.commit()
        socketio.emit('product_update', {'action': 'delete', 'product_id': product_id})
        return jsonify({'success': True})
    
    data = request.json
    
    if 'image_url' in data and data['image_url'] != product.image_url:
        is_valid, message = validate_image_url(data['image_url'])
        if not is_valid:
            return jsonify({'success': False, 'message': message}), 400
    
    for key, value in data.items():
        if hasattr(product, key):
            setattr(product, key, value)
    
    db.session.commit()
    socketio.emit('product_update', {'action': 'update', 'product_id': product_id})
    
    return jsonify({'success': True})

@app.route('/api/capital', methods=['GET', 'POST'])
def capital():
    if request.method == 'GET':
        entries = CapitalLedger.query.order_by(CapitalLedger.created_at.desc()).all()
        total = sum(e.amount for e in entries)
        return jsonify({
            'entries': [{
                'id': e.id,
                'amount': e.amount,
                'purpose': e.purpose,
                'is_edited': e.is_edited,
                'created_at': e.created_at.isoformat(),
                'updated_at': e.updated_at.isoformat()
            } for e in entries],
            'total': total
        })
    
    data = request.json
    entry = CapitalLedger(
        amount=data['amount'],
        purpose=data['purpose']
    )
    db.session.add(entry)
    db.session.commit()
    
    return jsonify({'success': True, 'id': entry.id})

@app.route('/api/capital/<int:entry_id>', methods=['PUT'])
def capital_entry(entry_id):
    entry = CapitalLedger.query.get_or_404(entry_id)
    data = request.json
    
    entry.amount = data.get('amount', entry.amount)
    entry.purpose = data.get('purpose', entry.purpose)
    entry.is_edited = True
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/staff/register', methods=['POST'])
def staff_register():
    data = request.json
    
    if Staff.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'message': 'Email already registered'}), 400
    
    normalized_phone = normalize_phone_number(data['phone'])
    if not normalized_phone:
        return jsonify({'success': False, 'message': 'Invalid phone number'}), 400
    
    staff = Staff(
        email=data['email'],
        password_hash=hash_password(data['password']),
        phone=normalized_phone,
        full_name=data.get('full_name', '')
    )
    db.session.add(staff)
    db.session.commit()
    
    admin = AdminCredentials.query.first()
    if admin:
        email_service.send_staff_registration_notification(admin.email, staff.email, staff.full_name or staff.email)
    
    return jsonify({'success': True, 'message': 'Registration successful - pending admin approval'})

@app.route('/api/staff/pending', methods=['GET'])
def staff_pending():
    pending = Staff.query.filter_by(is_approved=False).all()
    return jsonify([{
        'id': s.id,
        'email': s.email,
        'phone': s.phone,
        'full_name': s.full_name,
        'created_at': s.created_at.isoformat()
    } for s in pending])

@app.route('/api/staff/<int:staff_id>/approve', methods=['POST'])
def staff_approve(staff_id):
    staff = Staff.query.get_or_404(staff_id)
    data = request.json
    approved = data.get('approved', True)
    
    if approved:
        staff.is_approved = True
        db.session.commit()
        email_service.send_staff_approval_notification(staff.email, staff.full_name or 'Staff Member', True)
        return jsonify({'success': True, 'message': 'Staff approved'})
    else:
        email_service.send_staff_approval_notification(staff.email, staff.full_name or 'Staff Member', False)
        db.session.delete(staff)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Staff rejected'})

@app.route('/api/staff/login', methods=['POST'])
def staff_login():
    data = request.json
    staff = Staff.query.filter_by(email=data['email']).first()
    
    if not staff:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    
    if not staff.is_approved:
        return jsonify({'success': False, 'message': 'Account pending approval'}), 403
    
    if check_password(data['password'], staff.password_hash):
        staff.last_login = get_nairobi_time()
        db.session.commit()
        
        token = create_token(staff.id, 'staff')
        return jsonify({'success': True, 'token': token, 'needs_tracking_link': not staff.tracking_link})
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/staff/tracking-link', methods=['POST'])
def staff_tracking_link():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'staff':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    staff = Staff.query.get(payload['user_id'])
    data = request.json
    
    link = extract_tracking_link(data.get('link', ''))
    if not link:
        return jsonify({'success': False, 'message': 'No valid tracking link found'}), 400
    
    staff.tracking_link = link
    staff.tracking_link_updated_at = get_nairobi_time()
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/api/staff/profile', methods=['GET', 'PUT'])
def staff_profile():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'staff':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    staff = Staff.query.get(payload['user_id'])
    
    if not staff:
        return jsonify({'success': False, 'message': 'Staff not found'}), 404
    
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'staff': {
                'id': staff.id,
                'email': staff.email,
                'full_name': staff.full_name,
                'phone': staff.phone,
                'tracking_link': staff.tracking_link,
                'is_approved': staff.is_approved,
                'last_login': staff.last_login.isoformat() if staff.last_login else None,
                'tracking_link_updated_at': staff.tracking_link_updated_at.isoformat() if staff.tracking_link_updated_at else None
            }
        })
    
    data = request.json
    
    if 'full_name' in data:
        staff.full_name = data['full_name']
    
    if 'phone' in data:
        normalized_phone = normalize_phone_number(data['phone'])
        if normalized_phone:
            staff.phone = normalized_phone
        elif data['phone']:
            return jsonify({'success': False, 'message': 'Invalid phone number'}), 400
    
    if 'tracking_link' in data:
        link = extract_tracking_link(data['tracking_link'])
        if link:
            staff.tracking_link = link
            staff.tracking_link_updated_at = get_nairobi_time()
        elif data['tracking_link']:
            return jsonify({'success': False, 'message': 'Invalid tracking link'}), 400
        else:
            staff.tracking_link = None
    
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/api/orders', methods=['GET', 'POST'])
def orders():
    if request.method == 'GET':
        orders_list = Order.query.filter_by(is_archived=False).order_by(Order.created_at.desc()).all()
        return jsonify([{
            'id': o.id,
            'order_id': o.order_id,
            'customer_name': o.customer_name,
            'customer_phone': o.customer_phone,
            'customer_email': o.customer_email,
            'items': o.items,
            'product_total': o.product_total,
            'delivery_fee': o.delivery_fee,
            'total_amount': o.total_amount,
            'payment_method': o.payment_method,
            'payment_status': o.payment_status,
            'delivery_address': o.delivery_address,
            'staff_id': o.staff_id,
            'staff_name': o.staff.full_name if o.staff else 'Unassigned',
            'status': o.status,
            'created_at': o.created_at.isoformat()
        } for o in orders_list])
    
    data = request.json
    
    normalized_phone = normalize_phone_number(data['customer_phone'])
    if not normalized_phone:
        return jsonify({'success': False, 'message': 'Invalid phone number'}), 400
    
    settings = SystemSettings.query.first()
    
    order = Order(
        order_id=generate_order_id(),
        customer_id=data.get('customer_id'),
        customer_name=data['customer_name'],
        customer_phone=normalized_phone,
        customer_email=data.get('customer_email'),
        items=data['items'],
        product_total=data['product_total'],
        delivery_fee=data.get('delivery_fee', settings.min_delivery_fee),
        convenience_fee=data.get('convenience_fee', 0),
        transaction_fee=data.get('transaction_fee', 0),
        total_amount=data['total_amount'],
        payment_method=data['payment_method'],
        delivery_address=data['delivery_address'],
        delivery_latitude=data.get('delivery_latitude'),
        delivery_longitude=data.get('delivery_longitude'),
        location_method=data.get('location_method')
    )
    
    if data['payment_method'] == 'Pay Now':
        success, response, message = payment_service.initiate_stk_push(
            normalized_phone,
            data['total_amount'],
            order.order_id
        )
        
        if success:
            order.payment_status = 'Pending Payment'
            order.payhero_reference = response.get('reference')
        else:
            order.payment_status = 'Pending Payment'
    else:
        order.payment_status = 'Pending Payment'
    
    db.session.add(order)
    db.session.commit()
    
    if data.get('customer_email'):
        email_service.send_order_notification(
            data['customer_email'],
            data['customer_name'],
            order.order_id,
            'received'
        )
    
    notif = Notification(
        user_type='customer',
        user_id=data.get('customer_id', 0),
        title='Order Received',
        message=f'Your order {order.order_id} has been received and is pending delivery.',
        related_order_id=order.order_id
    )
    db.session.add(notif)
    db.session.commit()
    
    socketio.emit('new_order', {'order_id': order.order_id})
    
    return jsonify({'success': True, 'order_id': order.order_id})

@app.route('/api/orders/<int:order_id>/claim', methods=['POST'])
def claim_order(order_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'staff':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    order = Order.query.get_or_404(order_id)
    
    if order.staff_id:
        return jsonify({'success': False, 'message': 'Order already claimed'}), 400
    
    order.staff_id = payload['user_id']
    order.status = 'Out for Delivery'
    db.session.commit()
    
    if order.customer_email:
        email_service.send_order_notification(
            order.customer_email,
            order.customer_name,
            order.order_id,
            'on_the_way'
        )
    
    socketio.emit('order_update', {'order_id': order.order_id, 'status': 'claimed'})
    
    return jsonify({'success': True})

@app.route('/api/orders/<int:order_id>/unclaim', methods=['POST'])
def unclaim_order(order_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'staff':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    order = Order.query.get_or_404(order_id)
    
    if order.staff_id != payload['user_id']:
        return jsonify({'success': False, 'message': 'Not your order'}), 403
    
    order.staff_id = None
    order.status = 'Pending'
    db.session.commit()
    
    socketio.emit('order_update', {'order_id': order.order_id, 'status': 'unclaimed'})
    
    return jsonify({'success': True})

@app.route('/api/orders/<int:order_id>/payment', methods=['POST'])
def request_payment(order_id):
    order = Order.query.get_or_404(order_id)
    
    data = request.json or {}
    phone = data.get('phone', order.customer_phone)
    
    normalized_phone = normalize_phone_number(phone)
    if not normalized_phone:
        normalized_phone = order.customer_phone
    
    success, response, message = payment_service.initiate_stk_push(
        normalized_phone,
        order.total_amount,
        order.order_id
    )
    
    if success:
        order.payment_status = 'Pending Payment'
        order.payhero_reference = response.get('reference')
        db.session.commit()
        return jsonify({'success': True, 'message': message})
    
    return jsonify({'success': False, 'message': message}), 400

@app.route('/api/orders/<int:order_id>/mark-paid', methods=['POST'])
def mark_paid(order_id):
    order = Order.query.get_or_404(order_id)
    order.payment_status = 'Payment Complete'
    order.payment_method = 'Cash'
    db.session.commit()
    
    socketio.emit('order_update', {'order_id': order.order_id, 'status': 'paid'})
    
    return jsonify({'success': True})

@app.route('/api/orders/<int:order_id>/deliver', methods=['POST'])
def deliver_order(order_id):
    order = Order.query.get_or_404(order_id)
    order.status = 'Delivered'
    order.is_archived = True
    order.delivered_at = get_nairobi_time()
    db.session.commit()
    
    staff = Staff.query.get(order.staff_id)
    if staff:
        staff.tracking_link = None
        db.session.commit()
    
    if order.customer_email:
        email_service.send_order_notification(
            order.customer_email,
            order.customer_name,
            order.order_id,
            'delivered'
        )
    
    socketio.emit('order_update', {'order_id': order.order_id, 'status': 'delivered'})
    
    return jsonify({'success': True})

@app.route('/api/orders/<string:order_id>/tracking', methods=['GET'])
def get_tracking(order_id):
    order = Order.query.filter_by(order_id=order_id).first_or_404()
    
    if not order.staff_id:
        return jsonify({'tracking_available': False})
    
    staff = Staff.query.get(order.staff_id)
    
    if staff and staff.tracking_link:
        return jsonify({
            'tracking_available': True,
            'tracking_link': staff.tracking_link
        })
    
    return jsonify({'tracking_available': False})

@app.route('/api/customer/register', methods=['POST'])
def customer_register():
    data = request.json
    
    settings = SystemSettings.query.first()
    if settings.terms_mandatory and not data.get('terms_accepted'):
        return jsonify({'success': False, 'message': 'You must accept terms and conditions'}), 400
    
    if Customer.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'message': 'Email already registered'}), 400
    
    normalized_phone = normalize_phone_number(data.get('phone'))
    
    customer = Customer(
        email=data['email'],
        password_hash=hash_password(data['password']),
        username=data.get('username'),
        phone=normalized_phone,
        full_name=data.get('full_name'),
        terms_accepted=data.get('terms_accepted', False),
        terms_accepted_at=get_nairobi_time() if data.get('terms_accepted') else None
    )
    db.session.add(customer)
    db.session.commit()
    
    token = create_token(customer.id, 'customer')
    return jsonify({'success': True, 'token': token})

@app.route('/api/customer/login', methods=['POST'])
def customer_login():
    data = request.json
    customer = Customer.query.filter_by(email=data['email']).first()
    
    if customer and check_password(data['password'], customer.password_hash):
        token = create_token(customer.id, 'customer')
        return jsonify({'success': True, 'token': token})
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/customer/cart', methods=['GET', 'POST', 'PUT', 'DELETE'])
def customer_cart():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'customer':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    customer_id = payload['user_id']
    
    if request.method == 'GET':
        cart_items = Cart.query.filter_by(customer_id=customer_id).all()
        return jsonify([{
            'id': c.id,
            'product_id': c.product_id,
            'quantity': c.quantity,
            'product': {
                'name': c.product.name,
                'price_now': c.product.price_now,
                'image_url': c.product.image_url
            }
        } for c in cart_items])
    
    if request.method == 'POST':
        data = request.json
        cart_item = Cart.query.filter_by(
            customer_id=customer_id,
            product_id=data['product_id']
        ).first()
        
        if cart_item:
            cart_item.quantity += data.get('quantity', 1)
        else:
            cart_item = Cart(
                customer_id=customer_id,
                product_id=data['product_id'],
                quantity=data.get('quantity', 1)
            )
            db.session.add(cart_item)
        
        db.session.commit()
        return jsonify({'success': True})
    
    if request.method == 'PUT':
        data = request.json
        cart_item = Cart.query.get(data['cart_id'])
        if cart_item and cart_item.customer_id == customer_id:
            cart_item.quantity = data['quantity']
            if cart_item.quantity <= 0:
                db.session.delete(cart_item)
            db.session.commit()
            return jsonify({'success': True})
        return jsonify({'success': False}), 404
    
    if request.method == 'DELETE':
        Cart.query.filter_by(customer_id=customer_id).delete()
        db.session.commit()
        return jsonify({'success': True})

@app.route('/api/customer/send-otp', methods=['POST'])
def customer_send_otp():
    logger.info("=" * 80)
    logger.info("OTP SEND REQUEST")
    
    data = request.json
    email = data.get('email')
    logger.info(f"Email: {email}")
    
    if not email:
        logger.warning("OTP send failed: Email is required")
        return jsonify({'success': False, 'message': 'Email is required'}), 400
    
    if Customer.query.filter_by(email=email).first():
        logger.warning(f"OTP send failed: Email {email} already registered")
        return jsonify({'success': False, 'message': 'Email already registered'}), 400
    
    try:
        OTPVerification.query.filter_by(email=email, is_used=False).delete()
        logger.info(f"Deleted previous unused OTP records for {email}")
        
        otp_code = generate_otp()
        logger.info(f"Generated OTP: {otp_code}")
        
        otp = OTPVerification(
            email=email,
            otp_code=otp_code,
            purpose='registration'
        )
        db.session.add(otp)
        db.session.flush()
        logger.info("OTP record created (not yet committed)")
        
        success, message = email_service.send_otp_email(email, otp_code)
        
        if not success:
            logger.error(f"Email send failed: {message}")
            db.session.rollback()
            return jsonify({'success': False, 'message': 'Failed to send OTP email. Please try again.'}), 500
        
        db.session.commit()
        logger.info(f"OTP sent successfully to {email} and committed to database")
        logger.info("=" * 80)
        
        return jsonify({'success': True, 'message': 'OTP sent to your email'})
    
    except Exception as e:
        logger.exception(f"OTP send failed with exception: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'message': 'An error occurred. Please try again.'}), 500

@app.route('/api/customer/verify-otp', methods=['POST'])
def customer_verify_otp():
    logger.info("=" * 80)
    logger.info("OTP VERIFICATION REQUEST")
    
    data = request.json
    email = data.get('email')
    otp_code = data.get('otp_code')
    username = data.get('username')
    password = data.get('password')
    phone = data.get('phone')
    terms_accepted = data.get('terms_accepted', False)
    purpose = data.get('purpose', 'registration')
    
    logger.info(f"Email: {email}, Username: {username}, Phone: {phone}, Terms Accepted: {terms_accepted}, Purpose: {purpose}")
    
    otp = OTPVerification.query.filter_by(
        email=email,
        otp_code=otp_code,
        is_used=False,
        purpose=purpose
    ).first()
    
    if not otp:
        logger.warning(f"OTP verification failed: Invalid OTP code for {email}")
        return jsonify({'success': False, 'message': 'Invalid OTP code'}), 400
    
    try:
        if purpose == 'registration':
            if not all([email, otp_code, password, terms_accepted]):
                logger.warning("OTP verification failed: Missing required fields")
                return jsonify({'success': False, 'message': 'Missing required fields'}), 400
            
            if len(password) < 5:
                logger.warning("OTP verification failed: Password too short")
                return jsonify({'success': False, 'message': 'Password must be at least 5 characters long'}), 400
            
            settings = SystemSettings.query.first()
            if settings.terms_mandatory and not terms_accepted:
                logger.warning("OTP verification failed: Terms not accepted")
                return jsonify({'success': False, 'message': 'You must accept terms and conditions'}), 400
            
            normalized_phone = normalize_phone_number(phone) if phone else None
            logger.info(f"Creating customer account for {email} with username {username}")
            
            customer = Customer(
                email=email,
                password_hash=hash_password(password),
                username=username,
                phone=normalized_phone,
                terms_accepted=terms_accepted,
                terms_accepted_at=get_nairobi_time() if terms_accepted else None
            )
            db.session.add(customer)
            
            otp.is_used = True
            db.session.commit()
            
            token = create_token(customer.id, 'customer')
            logger.info(f"Customer {email} registered successfully with ID {customer.id}")
            logger.info("=" * 80)
            
            return jsonify({'success': True, 'token': token})
        
        elif purpose == 'password_reset':
            new_password = data.get('new_password')
            if not new_password:
                return jsonify({'success': False, 'message': 'New password is required'}), 400
            
            if len(new_password) < 5:
                return jsonify({'success': False, 'message': 'Password must be at least 5 characters long'}), 400
            
            customer = Customer.query.filter_by(email=email).first()
            if customer:
                customer.password_hash = hash_password(new_password)
                otp.is_used = True
                db.session.commit()
                logger.info(f"Customer {email} password reset successfully")
                return jsonify({'success': True, 'message': 'Password reset successfully'})
            else:
                return jsonify({'success': False, 'message': 'Customer not found'}), 404
        
    except Exception as e:
        logger.exception(f"OTP verification failed with exception: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'message': 'An error occurred. Please try again.'}), 500

@app.route('/api/customer/forgot-password', methods=['POST'])
def customer_forgot_password():
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'success': False, 'message': 'Email is required'}), 400
    
    customer = Customer.query.filter_by(email=email).first()
    if not customer:
        return jsonify({'success': False, 'message': 'No account found with this email'}), 404
    
    try:
        OTPVerification.query.filter_by(email=email, is_used=False).delete()
        
        otp_code = generate_otp()
        
        otp = OTPVerification(
            email=email,
            otp_code=otp_code,
            purpose='password_reset'
        )
        db.session.add(otp)
        db.session.flush()
        
        success, message = email_service.send_otp_email(email, otp_code, 'password reset')
        
        if not success:
            db.session.rollback()
            return jsonify({'success': False, 'message': 'Failed to send OTP email. Please try again.'}), 500
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'OTP sent to your email'})
    
    except Exception as e:
        logger.exception(f"Forgot password failed: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'message': 'An error occurred. Please try again.'}), 500

@app.route('/api/staff/forgot-password', methods=['POST'])
def staff_forgot_password():
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'success': False, 'message': 'Email is required'}), 400
    
    staff = Staff.query.filter_by(email=email).first()
    if not staff:
        return jsonify({'success': False, 'message': 'No staff account found with this email'}), 404
    
    try:
        OTPVerification.query.filter_by(email=email, is_used=False).delete()
        
        otp_code = generate_otp()
        
        otp = OTPVerification(
            email=email,
            otp_code=otp_code,
            purpose='staff_password_reset'
        )
        db.session.add(otp)
        db.session.flush()
        
        success, message = email_service.send_otp_email(email, otp_code, 'password reset')
        
        if not success:
            db.session.rollback()
            return jsonify({'success': False, 'message': 'Failed to send OTP email. Please try again.'}), 500
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'OTP sent to your email'})
    
    except Exception as e:
        logger.exception(f"Staff forgot password failed: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'message': 'An error occurred. Please try again.'}), 500

@app.route('/api/staff/reset-password', methods=['POST'])
def staff_reset_password():
    data = request.json
    email = data.get('email')
    otp_code = data.get('otp_code')
    new_password = data.get('new_password')
    
    if not all([email, otp_code, new_password]):
        return jsonify({'success': False, 'message': 'All fields are required'}), 400
    
    if len(new_password) < 5:
        return jsonify({'success': False, 'message': 'Password must be at least 5 characters long'}), 400
    
    otp = OTPVerification.query.filter_by(
        email=email,
        otp_code=otp_code,
        is_used=False,
        purpose='staff_password_reset'
    ).first()
    
    if not otp:
        return jsonify({'success': False, 'message': 'Invalid OTP code'}), 400
    
    try:
        staff = Staff.query.filter_by(email=email).first()
        if staff:
            staff.password_hash = hash_password(new_password)
            otp.is_used = True
            db.session.commit()
            return jsonify({'success': True, 'message': 'Password reset successfully'})
        else:
            return jsonify({'success': False, 'message': 'Staff not found'}), 404
    except Exception as e:
        logger.exception(f"Staff password reset failed: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'message': 'An error occurred. Please try again.'}), 500

@app.route('/api/customer/profile', methods=['GET', 'PUT'])
def customer_profile():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'customer':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    customer = Customer.query.get(payload['user_id'])
    
    if not customer:
        return jsonify({'success': False, 'message': 'Customer not found'}), 404
    
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'customer': {
                'id': customer.id,
                'username': customer.username,
                'email': customer.email,
                'phone': customer.phone,
                'full_name': customer.full_name
            }
        })
    
    data = request.json
    
    if 'username' in data:
        customer.username = data['username']
    if 'phone' in data:
        normalized_phone = normalize_phone_number(data['phone'])
        if normalized_phone:
            customer.phone = normalized_phone
    if 'full_name' in data:
        customer.full_name = data['full_name']
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Profile updated successfully'})

@app.route('/api/customer/orders', methods=['GET'])
def customer_orders():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'customer':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    customer_id = payload['user_id']
    orders = Order.query.filter_by(customer_id=customer_id, is_archived=False).order_by(Order.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'orders': [{
            'id': o.id,
            'order_id': o.order_id,
            'items': o.items,
            'product_total': o.product_total,
            'delivery_fee': o.delivery_fee,
            'total_amount': o.total_amount,
            'payment_method': o.payment_method,
            'payment_status': o.payment_status,
            'status': o.status,
            'delivery_address': o.delivery_address,
            'created_at': o.created_at.isoformat()
        } for o in orders]
    })

@app.route('/api/terms', methods=['GET', 'POST'])
def terms():
    if request.method == 'GET':
        current = TermsAndConditions.query.filter_by(is_current=True).first()
        previous = TermsAndConditions.query.filter_by(is_current=False).order_by(TermsAndConditions.created_at.desc()).all()
        
        result = {}
        if current:
            result['current'] = {
                'content': current.content,
                'version': current.version,
                'created_at': current.created_at.isoformat()
            }
        
        result['previous'] = [{
            'version': t.version,
            'created_at': t.created_at.isoformat(),
            'pdf_path': t.pdf_path
        } for t in previous]
        
        return jsonify(result)
    
    data = request.json
    
    current = TermsAndConditions.query.filter_by(is_current=True).first()
    if current:
        current.is_current = False
        pdf_path = pdf_service.generate_terms_pdf(current.content, current.version)
        current.pdf_path = pdf_path
    
    new_version = (current.version + 1) if current else 1
    
    new_terms = TermsAndConditions(
        content=data['content'],
        version=new_version,
        is_current=True
    )
    db.session.add(new_terms)
    db.session.commit()
    
    return jsonify({'success': True, 'version': new_version})

@app.route('/api/analytics/dashboard', methods=['GET'])
def analytics_dashboard():
    confirmed_orders = Order.query.filter_by(payment_status='Payment Complete').all()
    
    product_sales = sum(o.product_total for o in confirmed_orders)
    delivery_fees = sum(o.delivery_fee for o in confirmed_orders)
    total_revenue = sum(o.total_amount for o in confirmed_orders)
    
    capital_entries = CapitalLedger.query.all()
    total_capital = sum(e.amount for e in capital_entries)
    
    total_profit = total_revenue - total_capital
    
    return jsonify({
        'product_sales': product_sales,
        'delivery_fees': delivery_fees,
        'total_revenue': total_revenue,
        'total_capital': total_capital,
        'total_profit': total_profit,
        'total_orders': len(confirmed_orders)
    })

@app.route('/api/callbacks/payhero/stk', methods=['POST'])
def payhero_callback():
    data = request.json
    logger.info("=" * 80)
    logger.info(f"PayHero Callback Received: {json.dumps(data, indent=2)}")
    logger.info("=" * 80)
    
    success, reference, message = payment_service.verify_callback(data)
    logger.info(f"Callback verification: success={success}, reference={reference}, message={message}")
    
    if reference:
        order = Order.query.filter_by(order_id=reference).first()
        if order:
            logger.info(f"Found order {order.order_id}, current payment_status: {order.payment_status}")
            
            if success:
                order.payment_status = 'Payment Complete'
                logger.info(f"Setting order {order.order_id} payment_status to 'Payment Complete'")
                
                if order.customer_id:
                    notif = Notification(
                        user_type='customer',
                        user_id=order.customer_id,
                        title='Payment Successful',
                        message=f'Your payment for order {order.order_id} has been confirmed. Thank you!',
                        related_order_id=order.order_id
                    )
                    db.session.add(notif)
                    logger.info(f"Created success notification for customer {order.customer_id}")
            else:
                order.payment_status = 'Payment Failed'
                logger.info(f"Setting order {order.order_id} payment_status to 'Payment Failed'")
                
                if order.customer_id:
                    notif = Notification(
                        user_type='customer',
                        user_id=order.customer_id,
                        title='Payment Failed',
                        message=f'Payment for order {order.order_id} failed. Please try again or contact support.',
                        related_order_id=order.order_id
                    )
                    db.session.add(notif)
                    logger.info(f"Created failure notification for customer {order.customer_id}")
            
            db.session.commit()
            logger.info(f"Order {order.order_id} payment status committed to database: {order.payment_status}")
            
            socketio.emit('payment_update', {
                'order_id': order.order_id,
                'status': order.payment_status
            })
        else:
            logger.error(f"Order not found for reference: {reference}")
    else:
        logger.error(f"No reference found in callback data")
    
    logger.info("=" * 80)
    return jsonify({'success': True})

@app.route('/api/customer/notifications', methods=['GET'])
def customer_notifications():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'customer':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    customer_id = payload['user_id']
    notifications = Notification.query.filter_by(
        user_type='customer',
        user_id=customer_id
    ).order_by(Notification.created_at.desc()).limit(20).all()
    
    return jsonify({
        'success': True,
        'notifications': [{
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'is_read': n.is_read,
            'related_order_id': n.related_order_id,
            'created_at': n.created_at.isoformat()
        } for n in notifications]
    })

@app.route('/api/customer/notifications/<int:notif_id>/read', methods=['POST'])
def mark_notification_read(notif_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload or payload.get('user_type') != 'customer':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    notif = Notification.query.get(notif_id)
    if notif and notif.user_id == payload['user_id']:
        notif.is_read = True
        db.session.commit()
        return jsonify({'success': True})
    
    return jsonify({'success': False}), 404

@app.route('/api/backup/create', methods=['POST'])
def create_backup():
    orders = Order.query.all()
    products = Product.query.all()
    customers = Customer.query.all()
    staff_list = Staff.query.all()
    capital = CapitalLedger.query.all()
    
    backup_data = {
        'orders': [{'id': o.id, 'order_id': o.order_id} for o in orders],
        'products': [{'id': p.id, 'name': p.name} for p in products],
        'customers': [{'id': c.id, 'email': c.email} for c in customers],
        'staff': [{'id': s.id, 'email': s.email} for s in staff_list],
        'capital': [{'id': c.id, 'amount': c.amount} for c in capital]
    }
    
    filepath = pdf_service.generate_backup_pdf(backup_data)
    
    admin = AdminCredentials.query.first()
    if admin:
        email_service.send_backup_email(admin.email, filepath, 'manual')
    
    backup_record = BackupHistory(
        file_path=filepath,
        backup_type='manual',
        email_sent=True
    )
    db.session.add(backup_record)
    db.session.commit()
    
    return jsonify({'success': True, 'filepath': filepath})

@app.route('/api/social-links', methods=['GET', 'POST'])
def social_links():
    if request.method == 'GET':
        links = SocialLink.query.filter_by(is_active=True).all()
        return jsonify([{
            'id': l.id,
            'platform': l.platform,
            'username': l.username,
            'url': l.url,
            'is_primary': l.is_primary
        } for l in links])
    
    data = request.json
    link = SocialLink(
        platform=data['platform'],
        username=data.get('username', ''),
        url=data['url'],
        is_primary=data.get('is_primary', False)
    )
    db.session.add(link)
    db.session.commit()
    
    return jsonify({'success': True, 'id': link.id})

@app.route('/api/social-links/<int:link_id>', methods=['PUT', 'DELETE'])
def social_link_detail(link_id):
    link = SocialLink.query.get_or_404(link_id)
    
    if request.method == 'DELETE':
        link.is_active = False
        db.session.commit()
        return jsonify({'success': True})
    
    data = request.json
    link.platform = data.get('platform', link.platform)
    link.username = data.get('username', link.username)
    link.url = data.get('url', link.url)
    link.is_primary = data.get('is_primary', link.is_primary)
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/backup/history', methods=['GET'])
def backup_history():
    history = BackupHistory.query.order_by(BackupHistory.created_at.desc()).limit(20).all()
    return jsonify([{
        'id': h.id,
        'filename': h.file_path.split('/')[-1] if h.file_path else 'Unknown',
        'file_size': h.file_size or 0,
        'created_at': h.created_at.isoformat()
    } for h in history])

@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'Connected to SAFARI BYTES'})

@socketio.on('disconnect')
def handle_disconnect():
    pass

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
