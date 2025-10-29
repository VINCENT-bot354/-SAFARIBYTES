import re
import random
import string
from datetime import datetime
import pytz
import requests

def normalize_phone_number(phone):
    """
    Normalize phone number to 254XXXXXXXXX format
    Accepts: 0XXXXXXXXX, 254XXXXXXXXX, +254XXXXXXXXX
    Returns: 254XXXXXXXXX or None if invalid
    """
    if not phone:
        return None
    
    phone = str(phone).strip().replace(' ', '').replace('-', '')
    
    if phone.startswith('+254'):
        phone = phone[1:]
    elif phone.startswith('0'):
        phone = '254' + phone[1:]
    elif phone.startswith('254'):
        pass
    else:
        return None
    
    if len(phone) == 12 and phone.startswith('254'):
        return phone
    
    return None

def validate_kenyan_phone(phone):
    """Validate if phone number is in valid Kenyan format"""
    normalized = normalize_phone_number(phone)
    return normalized is not None

def generate_order_id():
    """
    Generate order ID in format: {YYYY}{encodedMonthDayTime}{4randomLower}
    Example: 2025OC12dbfw
    """
    now = datetime.now(pytz.timezone('Africa/Nairobi'))
    year = now.strftime('%Y')
    
    month_map = {
        1: 'JA', 2: 'FB', 3: 'MR', 4: 'AP', 5: 'MY', 6: 'JN',
        7: 'JL', 8: 'AU', 9: 'SE', 10: 'OC', 11: 'NV', 12: 'DC'
    }
    
    month_code = month_map[now.month]
    day = now.strftime('%d')
    
    random_suffix = ''.join(random.choices(string.ascii_lowercase, k=4))
    
    order_id = f"{year}{month_code}{day}{random_suffix}"
    return order_id

def validate_image_url(url):
    """
    Validate image URL by making HEAD request and checking MIME type
    Returns: (is_valid: bool, message: str)
    """
    try:
        response = requests.head(url, timeout=5, allow_redirects=True)
        if response.status_code != 200:
            return False, f"URL returned status code {response.status_code}"
        
        content_type = response.headers.get('Content-Type', '')
        if not content_type.startswith('image/'):
            return False, f"URL is not an image (Content-Type: {content_type})"
        
        return True, "Valid image URL"
    except requests.RequestException as e:
        return False, f"Failed to validate URL: {str(e)}"

def extract_tracking_link(text):
    """
    Extract first https://... URL from text
    Returns: URL string or None
    """
    if not text:
        return None
    
    pattern = r'https://[^\s]+'
    match = re.search(pattern, text)
    
    if match:
        return match.group(0)
    
    return None

def calculate_delivery_fee(distance_km, min_fee, per_km_rate):
    """
    Calculate delivery fee based on distance
    Returns max of (distance * rate, min_fee)
    """
    if distance_km is None:
        return min_fee
    
    calculated_fee = distance_km * per_km_rate
    return max(calculated_fee, min_fee)

def get_nairobi_time():
    """Get current time in Africa/Nairobi timezone"""
    return datetime.now(pytz.timezone('Africa/Nairobi'))

def encode_month_day_time():
    """Encode current month/day/time for order ID"""
    now = get_nairobi_time()
    month_map = {
        1: 'JA', 2: 'FB', 3: 'MR', 4: 'AP', 5: 'MY', 6: 'JN',
        7: 'JL', 8: 'AU', 9: 'SE', 10: 'OC', 11: 'NV', 12: 'DC'
    }
    return f"{month_map[now.month]}{now.strftime('%d')}"

def generate_otp():
    """Generate 6-digit OTP code"""
    return ''.join(random.choices(string.digits, k=6))
