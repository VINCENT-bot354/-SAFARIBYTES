const API_BASE = '';
let authToken = localStorage.getItem('staff_token');
let currentOrders = [];
let currentStaff = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeStaffPortal();
});

async function initializeStaffPortal() {
    setupEventListeners();
    injectStyles();
    
    if (authToken) {
        await loadStaffProfile();
        if (currentStaff) {
            if (!currentStaff.tracking_link) {
                showPage('tracking-link-page');
            } else {
                showPage('dashboard-page');
                loadDashboard();
            }
        } else {
            logout();
        }
    }
}

function setupEventListeners() {
    const loginForm = document.getElementById('staff-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const registerForm = document.getElementById('staff-register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    const trackingForm = document.getElementById('tracking-link-form');
    if (trackingForm) {
        trackingForm.addEventListener('submit', handleTrackingLink);
    }
    
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('order-detail-modal');
        if (e.target === modal) {
            closeModal();
        }
    });
}

function injectStyles() {
    if (document.querySelector('#staff-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'staff-styles';
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        @keyframes slideUp {
            from {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            to {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
        }
        .flash-message {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 500;
            max-width: 90%;
            text-align: center;
            animation: slideDown 0.3s ease-out;
        }
        .flash-success {
            background: #FF8C42;
        }
        .flash-error {
            background: #E63946;
        }
        .order-card {
            background: #2a2a2a;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 4px solid #FF8C42;
            transition: all 0.3s ease;
        }
        .order-card:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 12px rgba(255, 140, 66, 0.3);
        }
        .order-items-list {
            margin: 10px 0;
            padding: 10px;
            background: #1a1a1a;
            border-radius: 5px;
        }
        .order-item {
            display: flex;
            align-items: center;
            margin: 8px 0;
            padding: 5px;
        }
        .order-item-image {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 5px;
            margin-right: 10px;
        }
        .order-item-details {
            flex: 1;
        }
        .order-item-name {
            font-weight: bold;
            color: #FF8C42;
        }
        .order-item-price {
            font-size: 12px;
            color: #888;
        }
        .order-status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin: 5px 5px 5px 0;
        }
        .status-pending {
            background: #FFA500;
            color: white;
        }
        .status-progress {
            background: #118AB2;
            color: white;
        }
        .status-complete {
            background: #06D6A0;
            color: white;
        }
        .status-failed {
            background: #E63946;
            color: white;
        }
        .status-delivered {
            background: #4A4A4A;
            color: white;
        }
        .btn-primary {
            background: #FF8C42;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .btn-primary:hover {
            background: #FF7722;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(255, 140, 66, 0.4);
        }
        .btn-secondary {
            background: #444;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .btn-secondary:hover {
            background: #555;
        }
        .btn-danger {
            background: #E63946;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .btn-danger:hover {
            background: #D62936;
        }
        .btn-success {
            background: #06D6A0;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .btn-success:hover {
            background: #05C690;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.7);
        }
        .modal-content {
            background-color: #2a2a2a;
            margin: 5% auto;
            padding: 30px;
            border: 1px solid #444;
            border-radius: 10px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }
        .close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            transition: color 0.3s ease;
        }
        .close:hover,
        .close:focus {
            color: #FF8C42;
        }
        .action-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin: 15px 0;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: #2a2a2a;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #FF8C42;
            transition: all 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 4px 12px rgba(255, 140, 66, 0.3);
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #FF8C42;
        }
        .stat-label {
            font-size: 14px;
            color: #888;
            margin-top: 5px;
        }
        .profile-view {
            background: #2a2a2a;
            padding: 20px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .profile-field {
            margin: 15px 0;
        }
        .profile-field label {
            display: block;
            margin-bottom: 5px;
            color: #FF8C42;
            font-weight: 500;
        }
        .profile-field input,
        .profile-field textarea {
            width: 100%;
            padding: 10px;
            border-radius: 5px;
            background: #1a1a1a;
            color: white;
            border: 1px solid #444;
            box-sizing: border-box;
        }
        .profile-field input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .orders-section {
            margin: 30px 0;
        }
        .orders-section h3 {
            color: #FF8C42;
            margin-bottom: 15px;
        }
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #888;
        }
        @media (max-width: 768px) {
            .stats-grid {
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            }
            .modal-content {
                width: 95%;
                margin: 10% auto;
                padding: 20px;
            }
            .action-buttons {
                flex-direction: column;
            }
            .action-buttons button {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
}

function showFlashMessage(message, type = 'success') {
    const existingFlash = document.querySelector('.flash-message');
    if (existingFlash) {
        existingFlash.remove();
    }
    
    const flash = document.createElement('div');
    flash.className = `flash-message flash-${type}`;
    flash.textContent = message;
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => flash.remove(), 300);
    }, 4000);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('staff-email').value;
    const password = document.getElementById('staff-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/staff/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('staff_token', authToken);
            
            await loadStaffProfile();
            
            if (data.needs_tracking_link) {
                showFlashMessage('Please set your tracking link to continue');
                showPage('tracking-link-page');
            } else {
                showFlashMessage('Login successful!');
                showPage('dashboard-page');
                loadDashboard();
            }
        } else {
            showFlashMessage(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/staff/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: name, email, phone, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFlashMessage(data.message || 'Registration successful! Awaiting admin approval.');
            showLogin();
        } else {
            showFlashMessage(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function handleTrackingLink(e) {
    e.preventDefault();
    
    const link = document.getElementById('tracking-link-input').value;
    
    if (!link.trim()) {
        showFlashMessage('Please enter a valid tracking link', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/staff/tracking-link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ link })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadStaffProfile();
            showFlashMessage('Tracking link saved successfully!');
            showPage('dashboard-page');
            loadDashboard();
        } else {
            showFlashMessage(data.message || 'Failed to save tracking link', 'error');
        }
    } catch (error) {
        console.error('Tracking link error:', error);
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function loadStaffProfile() {
    try {
        const response = await fetch(`${API_BASE}/api/staff/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentStaff = data.staff;
            return true;
        } else {
            currentStaff = null;
            return false;
        }
    } catch (error) {
        console.error('Error loading staff profile:', error);
        currentStaff = null;
        return false;
    }
}

async function loadDashboard() {
    await loadOrders();
    await loadStats();
    renderDashboardHeader();
    setInterval(() => loadOrders(true), 15000);
}

function renderDashboardHeader() {
    const header = document.querySelector('#dashboard-page .app-header');
    if (header && currentStaff) {
        const userName = currentStaff.full_name || currentStaff.email;
        header.innerHTML = `
            <div>
                <h1>Staff Dashboard</h1>
                <p style="font-size: 14px; color: #888; margin-top: 5px;">Welcome, ${userName}</p>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-secondary" onclick="showProfileEdit()">Profile</button>
                <button class="btn-danger" onclick="logout()">Logout</button>
            </div>
        `;
    }
}

async function loadOrders(silent = false) {
    try {
        const response = await fetch(`${API_BASE}/api/orders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            currentOrders = await response.json();
            renderOrders();
        } else {
            if (!silent) {
                showFlashMessage('Failed to load orders', 'error');
            }
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        if (!silent) {
            showFlashMessage('Error loading orders: ' + error.message, 'error');
        }
    }
}

function renderOrders() {
    const availableDiv = document.getElementById('available-orders');
    const myOrdersDiv = document.getElementById('my-orders');
    
    if (!availableDiv || !myOrdersDiv) return;
    
    const available = currentOrders.filter(o => !o.staff_id && !o.is_archived);
    const myOrders = currentOrders.filter(o => o.staff_id && !o.is_archived);
    
    if (available.length === 0) {
        availableDiv.innerHTML = '<div class="empty-state">No available orders at the moment</div>';
    } else {
        availableDiv.innerHTML = available.map(order => createOrderCard(order, 'available')).join('');
    }
    
    if (myOrders.length === 0) {
        myOrdersDiv.innerHTML = '<div class="empty-state">No active orders</div>';
    } else {
        myOrdersDiv.innerHTML = myOrders.map(order => createOrderCard(order, 'my-order')).join('');
    }
}

function createOrderCard(order, type) {
    const paymentStatusClass = getPaymentStatusClass(order.payment_status);
    const deliveryStatusClass = getDeliveryStatusClass(order.status);
    
    let itemsPreview = '';
    if (order.items && order.items.length > 0) {
        const firstTwo = order.items.slice(0, 2);
        itemsPreview = firstTwo.map(item => `${item.name} (${item.quantity})`).join(', ');
        if (order.items.length > 2) {
            itemsPreview += ` +${order.items.length - 2} more`;
        }
    }
    
    if (type === 'available') {
        return `
            <div class="order-card">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <h4 style="color: #FF8C42; margin: 0 0 5px 0;">Order #${order.order_id}</h4>
                        <div style="font-size: 12px; color: #888;">${new Date(order.created_at).toLocaleString()}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; font-size: 18px; color: #FF8C42;">KES ${order.total_amount}</div>
                    </div>
                </div>
                <div style="margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>Customer:</strong> ${order.customer_name}</p>
                    <p style="margin: 5px 0;"><strong>Phone:</strong> ${order.customer_phone}</p>
                    <p style="margin: 5px 0;"><strong>Address:</strong> ${order.delivery_address}</p>
                    ${itemsPreview ? `<p style="margin: 5px 0; font-size: 13px; color: #888;"><strong>Items:</strong> ${itemsPreview}</p>` : ''}
                </div>
                <div style="margin-top: 10px;">
                    <span class="order-status-badge ${paymentStatusClass}">${order.payment_status}</span>
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn-primary" onclick="claimOrder(${order.id})">Accept Order</button>
                    <button class="btn-secondary" onclick="viewOrderDetail(${order.id})">View Details</button>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="order-card">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <h4 style="color: #FF8C42; margin: 0 0 5px 0;">Order #${order.order_id}</h4>
                        <div style="font-size: 12px; color: #888;">${new Date(order.created_at).toLocaleString()}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; font-size: 18px; color: #FF8C42;">KES ${order.total_amount}</div>
                    </div>
                </div>
                <div style="margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>Customer:</strong> ${order.customer_name}</p>
                    <p style="margin: 5px 0;"><strong>Phone:</strong> ${order.customer_phone}</p>
                    <p style="margin: 5px 0;"><strong>Address:</strong> ${order.delivery_address}</p>
                    ${itemsPreview ? `<p style="margin: 5px 0; font-size: 13px; color: #888;"><strong>Items:</strong> ${itemsPreview}</p>` : ''}
                </div>
                <div style="margin-top: 10px;">
                    <span class="order-status-badge ${paymentStatusClass}">${order.payment_status}</span>
                    <span class="order-status-badge ${deliveryStatusClass}">${order.status || 'Pending'}</span>
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn-primary" onclick="viewOrderDetail(${order.id})">View Details</button>
                    <button class="btn-secondary" onclick="unclaimOrder(${order.id})">Unclaim</button>
                </div>
            </div>
        `;
    }
}

function getPaymentStatusClass(status) {
    if (!status) return 'status-pending';
    if (status.toLowerCase().includes('complete')) return 'status-complete';
    if (status.toLowerCase().includes('progress')) return 'status-progress';
    if (status.toLowerCase().includes('failed')) return 'status-failed';
    return 'status-pending';
}

function getDeliveryStatusClass(status) {
    if (!status) return 'status-pending';
    if (status === 'Delivered') return 'status-delivered';
    if (status === 'Out for Delivery') return 'status-progress';
    return 'status-pending';
}

async function claimOrder(orderId) {
    try {
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/claim`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFlashMessage('Order claimed successfully!');
            await loadOrders();
            await loadStats();
        } else {
            showFlashMessage(data.message || 'Failed to claim order', 'error');
        }
    } catch (error) {
        console.error('Error claiming order:', error);
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function unclaimOrder(orderId) {
    if (!confirm('Are you sure you want to unclaim this order?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/unclaim`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFlashMessage('Order unclaimed successfully');
            await loadOrders();
            await loadStats();
        } else {
            showFlashMessage(data.message || 'Failed to unclaim order', 'error');
        }
    } catch (error) {
        console.error('Error unclaiming order:', error);
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function viewOrderDetail(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) {
        showFlashMessage('Order not found', 'error');
        return;
    }
    
    let productsMap = {};
    try {
        const response = await fetch(`${API_BASE}/api/products`);
        const products = await response.json();
        products.forEach(p => {
            productsMap[p.id] = p;
        });
    } catch (error) {
        console.error('Error loading products:', error);
    }
    
    const modal = document.getElementById('order-detail-modal');
    const content = document.getElementById('order-detail-content');
    
    let itemsHTML = '';
    if (order.items && order.items.length > 0) {
        itemsHTML = '<div class="order-items-list">';
        order.items.forEach(item => {
            const product = productsMap[item.product_id];
            const imageUrl = product?.image_url || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27%3E%3Crect fill=%27%23444%27 width=%2750%27 height=%2750%27/%3E%3Ctext x=%2750%25%27 y=%2750%25%27 font-size=%2710%27 text-anchor=%27middle%27 fill=%27%23fff%27%3ENo Image%3C/text%3E%3C/svg%3E';
            
            itemsHTML += `
                <div class="order-item">
                    <img src="${imageUrl}" alt="${item.name}" class="order-item-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27%3E%3Crect fill=%27%23444%27 width=%2750%27 height=%2750%27/%3E%3C/svg%3E'">
                    <div class="order-item-details">
                        <div class="order-item-name">${item.name}</div>
                        <div class="order-item-price">KES ${item.price} × ${item.quantity} = KES ${(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                </div>
            `;
        });
        itemsHTML += '</div>';
    }
    
    const paymentStatusClass = getPaymentStatusClass(order.payment_status);
    const deliveryStatusClass = getDeliveryStatusClass(order.status);
    
    content.innerHTML = `
        <h3 style="color: #FF8C42; margin-bottom: 20px;">Order #${order.order_id}</h3>
        
        <div style="background: #1a1a1a; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <h4 style="color: #FF8C42; margin-bottom: 10px;">Customer Information</h4>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${order.customer_name}</p>
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${order.customer_phone}</p>
            ${order.customer_email ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${order.customer_email}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Address:</strong> ${order.delivery_address}</p>
        </div>
        
        <div style="background: #1a1a1a; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <h4 style="color: #FF8C42; margin-bottom: 10px;">Order Items</h4>
            ${itemsHTML}
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #444;">
                <p style="margin: 5px 0;"><strong>Product Total:</strong> KES ${order.product_total.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Delivery Fee:</strong> KES ${order.delivery_fee.toFixed(2)}</p>
                <p style="margin: 10px 0 0 0; font-size: 18px; color: #FF8C42;"><strong>Total Amount:</strong> KES ${order.total_amount.toFixed(2)}</p>
            </div>
        </div>
        
        <div style="background: #1a1a1a; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <h4 style="color: #FF8C42; margin-bottom: 10px;">Status</h4>
            <div style="margin: 10px 0;">
                <span class="order-status-badge ${paymentStatusClass}">${order.payment_status}</span>
                <span class="order-status-badge ${deliveryStatusClass}">${order.status || 'Pending'}</span>
            </div>
            <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${order.payment_method}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #888;"><strong>Created:</strong> ${new Date(order.created_at).toLocaleString()}</p>
        </div>
        
        <div class="action-buttons">
            <button class="btn-primary" onclick="callCustomer('${order.customer_phone}')">📞 Call Customer</button>
            ${order.payment_status !== 'Payment Complete' ? 
                `<button class="btn-success" onclick="requestPayment(${order.id})">💳 Request Payment (STK Push)</button>
                 <button class="btn-success" onclick="markPaid(${order.id})">✓ Mark as Paid (Cash)</button>` : ''}
            ${order.status !== 'Delivered' ? 
                `<button class="btn-primary" onclick="deliverOrder(${order.id})">✓ Confirm Delivered</button>` : ''}
            <button class="btn-secondary" onclick="closeModal()">Close</button>
        </div>
    `;
    
    modal.style.display = 'block';
}

function callCustomer(phone) {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    
    const choice = confirm('Call via WhatsApp?\n\nOK = WhatsApp\nCancel = Normal Call');
    if (choice) {
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    } else {
        window.location.href = `tel:${cleanPhone}`;
    }
}

async function requestPayment(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) {
        showFlashMessage('Order not found', 'error');
        return;
    }
    
    const phone = prompt('Enter phone number for M-Pesa payment:', order.customer_phone);
    
    if (!phone) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ phone })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFlashMessage('Payment request sent successfully!');
            await loadOrders();
            closeModal();
            setTimeout(() => viewOrderDetail(orderId), 500);
        } else {
            showFlashMessage(data.message || 'Failed to send payment request', 'error');
        }
    } catch (error) {
        console.error('Error requesting payment:', error);
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function markPaid(orderId) {
    if (!confirm('Mark this order as paid (Cash payment)?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/mark-paid`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFlashMessage('Order marked as paid!');
            await loadOrders();
            closeModal();
            setTimeout(() => viewOrderDetail(orderId), 500);
        } else {
            showFlashMessage(data.message || 'Failed to mark as paid', 'error');
        }
    } catch (error) {
        console.error('Error marking as paid:', error);
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function deliverOrder(orderId) {
    if (!confirm('Confirm that this order has been delivered to the customer?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/deliver`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFlashMessage('Order marked as delivered!');
            closeModal();
            await loadOrders();
            await loadStats();
        } else {
            showFlashMessage(data.message || 'Failed to mark as delivered', 'error');
        }
    } catch (error) {
        console.error('Error delivering order:', error);
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function loadStats() {
    const statsDiv = document.getElementById('staff-stats');
    if (!statsDiv) return;
    
    const today = new Date().toDateString();
    
    const myOrders = currentOrders.filter(o => o.staff_id);
    const todayDeliveries = myOrders.filter(o => {
        return o.status === 'Delivered' && 
               o.delivered_at && 
               new Date(o.delivered_at).toDateString() === today;
    }).length;
    
    const completedOrders = myOrders.filter(o => o.is_archived).length;
    const pendingOrders = myOrders.filter(o => !o.is_archived).length;
    const cashPayments = myOrders.filter(o => o.payment_method === 'Cash').length;
    const mpesaPayments = myOrders.filter(o => o.payment_method === 'Pay Now').length;
    
    statsDiv.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${todayDeliveries}</div>
            <div class="stat-label">Today's Deliveries</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${completedOrders}</div>
            <div class="stat-label">Completed Orders</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${pendingOrders}</div>
            <div class="stat-label">Active Orders</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${cashPayments}</div>
            <div class="stat-label">Cash Payments</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${mpesaPayments}</div>
            <div class="stat-label">M-Pesa Payments</div>
        </div>
    `;
}

function showProfileEdit() {
    if (!currentStaff) {
        showFlashMessage('Please login to edit profile', 'error');
        return;
    }
    
    const modal = document.getElementById('order-detail-modal');
    const content = document.getElementById('order-detail-content');
    
    content.innerHTML = `
        <h3 style="color: #FF8C42; margin-bottom: 20px;">Edit Profile</h3>
        <form id="edit-staff-profile-form">
            <div class="profile-field">
                <label>Full Name</label>
                <input type="text" id="edit-full-name" value="${currentStaff.full_name || ''}" placeholder="Enter your full name">
            </div>
            <div class="profile-field">
                <label>Email (cannot be changed)</label>
                <input type="email" value="${currentStaff.email}" disabled>
            </div>
            <div class="profile-field">
                <label>Phone</label>
                <input type="tel" id="edit-phone" value="${currentStaff.phone || ''}" placeholder="0712345678">
            </div>
            <div class="profile-field">
                <label>Tracking Link</label>
                <textarea id="edit-tracking-link" rows="3" placeholder="Paste your live tracking link here">${currentStaff.tracking_link || ''}</textarea>
                <small style="color: #888; display: block; margin-top: 5px;">This link will be shared with customers to track their orders</small>
            </div>
            <div class="action-buttons" style="margin-top: 20px;">
                <button type="submit" class="btn-primary">Save Changes</button>
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    modal.style.display = 'block';
    
    const editForm = document.getElementById('edit-staff-profile-form');
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('edit-full-name').value;
        const phone = document.getElementById('edit-phone').value;
        const trackingLink = document.getElementById('edit-tracking-link').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/staff/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ full_name: fullName, phone, tracking_link: trackingLink })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await loadStaffProfile();
                renderDashboardHeader();
                closeModal();
                showFlashMessage('Profile updated successfully!');
            } else {
                showFlashMessage(data.message || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showFlashMessage('Error: ' + error.message, 'error');
        }
    });
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
    });
    
    const page = document.getElementById(pageId);
    if (page) {
        page.style.display = 'block';
        page.classList.add('active');
    }
}

function showLogin() {
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('register-view').style.display = 'none';
    
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function showForgotPassword() {
    const loginView = document.getElementById('login-view');
    
    loginView.innerHTML = `
        <h2>Forgot Password</h2>
        <form id="staff-forgot-form">
            <input type="email" id="forgot-email" placeholder="Enter your email" required>
            <button type="submit">Send Reset Code</button>
            <button type="button" onclick="showLogin()">Back to Login</button>
        </form>
    `;
    
    const forgotForm = document.getElementById('staff-forgot-form');
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/staff/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showFlashMessage('Reset code sent to your email!', 'success');
                showStaffPasswordReset(email);
            } else {
                showFlashMessage(data.message || 'Failed to send reset code', 'error');
            }
        } catch (error) {
            showFlashMessage('Error: ' + error.message, 'error');
        }
    });
}

function showStaffPasswordReset(email) {
    const loginView = document.getElementById('login-view');
    
    loginView.innerHTML = `
        <h2>Reset Password</h2>
        <p style="color: #888; margin-bottom: 20px;">Enter the code sent to ${email}</p>
        <form id="staff-reset-form">
            <div class="otp-input-container">
                <input type="text" id="reset-otp" class="otp-input" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code">
            </div>
            <input type="password" id="new-password" placeholder="New Password" required>
            <button type="submit">Reset Password</button>
            <button type="button" onclick="showLogin()">Cancel</button>
        </form>
    `;
    
    const resetForm = document.getElementById('staff-reset-form');
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const otpCode = document.getElementById('reset-otp').value;
        const newPassword = document.getElementById('new-password').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/staff/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    otp_code: otpCode,
                    new_password: newPassword
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showFlashMessage('Password reset successfully!', 'success');
                location.reload();
            } else {
                showFlashMessage(data.message || 'Reset failed', 'error');
            }
        } catch (error) {
            showFlashMessage('Error: ' + error.message, 'error');
        }
    });
}

function showRegister() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('register-view').style.display = 'block';
    
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function closeModal() {
    const modal = document.getElementById('order-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('staff_token');
        authToken = null;
        currentStaff = null;
        currentOrders = [];
        showFlashMessage('Logged out successfully');
        setTimeout(() => location.reload(), 1000);
    }
}
