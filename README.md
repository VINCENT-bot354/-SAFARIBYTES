# SAFARI BYTES 🍔 - Food Delivery PWA

A production-ready, mobile-first Progressive Web App for food delivery with three portals: Admin, Staff, and Customer.

## Features

### Admin Panel
- **Dashboard**: Live orders feed, real-time analytics with totals (Product Sales, Delivery Fees, Revenue, Capital, Profit)
- **Product Management**: Add/Edit/Delete products with image URL validation, stock tracking, combo items
- **Capital Ledger**: Add/Edit capital entries (no deletes), running totals for profit calculation
- **Staff Management**: Approve/reject staff registrations with email notifications
- **System Settings**: Configure payment options, delivery fees, customer care number, social links
- **Terms & Conditions**: Update T&C with auto-PDF generation and version history
- **Backup System**: Scheduled/manual backups with email delivery

### Staff Portal
- **Registration & Login**: Email/password with admin approval flow, WebAuthn biometric support
- **Order Management**: Claim orders, real-time order feed
- **Live Tracking**: Mandatory tracking link entry on login (auto-extracted, deleted 5 min after logout)
- **Customer Contact**: Call via WhatsApp (wa.me/254...) or normal call (tel:)
- **Payment**: Request M-Pesa STK Push, mark cash payments
- **Delivery Confirmation**: Mandatory "Confirm Product Delivered" action
- **Analytics**: Today's deliveries, completed/pending orders, cash vs M-Pesa counts

### Customer Portal
- **Menu Dashboard**: Jumia-style product grid with search, category filter
- **Shopping Cart**: +/- controls, persistent storage (5-hour retention), pinned bottom bar
- **Account Management**: Register/Login, edit username (2 changes per 3 days), phone verification
- **Checkout**: Device location or manual pin, phone normalization (0XXX/254XXX/+254XXX → 254XXX)
- **Payment Options**: Pay Now (M-Pesa STK Push) or Pay on Delivery (if enabled)
- **Order Tracking**: View delivery via iframe (staff's live link)
- **Order Status**: Automated email and in-app notifications
- **Customer Support**: Call customer care, view social links
- **Terms & Conditions**: Mandatory acceptance, version history with download

## Technology Stack

### Backend
- Python 3.11
- Flask + Flask-SocketIO (WebSocket real-time updates)
- PostgreSQL (Neon)
- SQLAlchemy ORM
- Bcrypt (password hashing)
- JWT (authentication)

### Frontend
- HTML5, CSS3, Vanilla JavaScript
- PWA (manifest + service worker)
- Mobile-first responsive design
- Dark theme default

### APIs & Services
- PayHero M-Pesa STK Push
- SendGrid Email API
- Browser Geolocation API

### PDF & Exports
- ReportLab (PDF generation)
- Pandas + Openpyxl (CSV/Excel exports)
- WeasyPrint (HTML to PDF)

## Environment Variables

Create a `.env` file with these required variables:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Website
WEBSITE_URL=https://yourdomain.com

# PayHero M-Pesa
PAYHERO_STK_PUSH_ENDPOINT=https://backend.payhero.co.ke/api/v2/payments
PAYHERO_BASIC_AUTH_TOKEN=your_base64_token
PAYHERO_CHANNEL_ID=your_channel_id
PAYHERO_PROVIDER=m-pesa
PAYHERO_CALLBACK_PATH=/api/callbacks/payhero/stk

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_SENDER_EMAIL=noreply@yourdomain.com

# Security
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret

# Storage
PDF_STORAGE_BUCKET=./backups
```

## Installation & Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd safari-bytes
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Setup
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Database Initialization
```bash
python app.py
# Database tables will be created automatically on first run
```

### 5. Run Application
```bash
# Development
python app.py

# Production with Gunicorn
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 app:app
```

### 6. Docker Deployment (Optional)
```bash
docker-compose up -d
```

## First-Time Setup

### Portal Access
1. Navigate to `/portals` 
2. On first visit, set portal credentials (email + password)
3. These credentials protect the portal selector page

### Admin Bootstrap
1. From portals page, click "Admin"
2. On first run, create admin credentials (email + password)
3. These are stored in database and can be changed later

### Staff Registration
1. Staff register via staff portal
2. Admin receives email notification
3. Admin approves/rejects from admin panel
4. Staff receives approval email

## Routes & Access

- **`/`** - Customer portal (public homepage with menu)
- **`/portals`** - Portal selector (protected by portal credentials)
- **`/admin`** - Admin panel (requires admin login)
- **`/staff`** - Staff portal (requires staff login)

## Phone Number Normalization

All phone numbers are normalized to `254XXXXXXXXX` format:
- Input: `0712345678` → `254712345678`
- Input: `254712345678` → `254712345678`
- Input: `+254712345678` → `254712345678`

For PayHero STK Push: Use `254XXXXXXXXX` (no +)
For wa.me links: Use `254XXXXXXXXX` (no +)
For tel: links: Use `+254XXXXXXXXX` or `254XXXXXXXXX`

## API Endpoints

### Public Endpoints
- `GET /api/products` - Get all active products
- `POST /api/customer/register` - Customer registration
- `POST /api/customer/login` - Customer login

### Protected Endpoints (Require JWT)
- `POST /api/orders` - Create order
- `POST /api/orders/:id/claim` - Claim order (staff)
- `POST /api/orders/:id/deliver` - Mark delivered (staff)
- `GET /api/capital` - Get capital ledger (admin)
- `PUT /api/admin/settings` - Update settings (admin)

### Webhook
- `POST /api/callbacks/payhero/stk` - PayHero payment callback

## Real-Time Features

WebSocket events for live updates:
- `new_order` - New order placed
- `order_update` - Order status changed
- `payment_update` - Payment status changed
- `product_update` - Product added/updated/deleted

## Database Schema

Main tables:
- `portal_credentials` - Portal selector access
- `admin_credentials` - Admin account
- `system_settings` - Configuration
- `staff` - Staff accounts with approval status
- `customers` - Customer accounts
- `products` - Menu items
- `orders` - Order records with payment/delivery status
- `capital_ledger` - Capital entries (edit-only, no deletes)
- `terms_and_conditions` - T&C versions with PDF paths
- `notifications` - In-app notifications
- `backup_history` - Backup records
- `audit_logs` - System activity logs
- `carts` - Shopping cart items
- `social_links` - Customer support social media

## Security Features

- Bcrypt password hashing
- JWT token authentication
- CORS protection
- Environment-based secrets
- SQL injection prevention (SQLAlchemy ORM)
- Phone number validation
- Image URL validation

## Production Deployment

### Recommended Stack
- Gunicorn with Eventlet worker (WebSocket support)
- PostgreSQL database
- HTTPS/TLS certificate
- Environment variables via secrets manager
- File storage for backups/PDFs

### Performance
- Database connection pooling
- Static file caching
- Gzip compression
- CDN for images (optional)

## Backup & Restore

### Manual Backup
Admin Panel → Backup → Create Backup Now

### Scheduled Backups
Admin Panel → Backup → Set Schedule (daily/weekly/monthly/yearly)

Backups are:
- Generated as PDF
- Emailed to admin
- Stored in `PDF_STORAGE_BUCKET`
- Listed in Backup History

## Troubleshooting

### Server won't start
- Check DATABASE_URL is correct
- Verify all environment variables are set
- Check port 5000 is not in use

### Payments failing
- Verify PayHero credentials
- Check phone number format (254XXXXXXXXX)
- Review callback URL is accessible

### Emails not sending
- Verify SendGrid API key
- Check sender email is verified in SendGrid
- Review email quota/limits

## Development

### Project Structure
```
safari-bytes/
├── app.py                 # Main Flask application
├── models.py              # Database models
├── utils.py               # Utility functions
├── email_service.py       # SendGrid integration
├── pdf_service.py         # PDF generation
├── payment_service.py     # PayHero integration
├── requirements.txt       # Python dependencies
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker Compose setup
├── templates/             # HTML templates
│   ├── portals.html
│   ├── admin.html
│   ├── staff.html
│   └── customer.html
└── static/                # Static assets
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── customer.js
    │   ├── staff.js
    │   └── admin.js
    ├── manifest.json
    └── sw.js              # Service worker
```

## Support & Contact

For issues, feature requests, or contributions, please contact the development team.

## License

Proprietary - All Rights Reserved

---

**Built with ❤️ for SAFARI BYTES 🍔**
