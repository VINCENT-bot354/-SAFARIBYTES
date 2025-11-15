const API_BASE = '';
let currentPage = 'menu';
let cart = JSON.parse(localStorage.getItem('cart') || '{}');
let products = [];
let authToken = localStorage.getItem('customer_token');
let settings = {};
let currentUser = null;
let minPrice = 0;
let maxPrice = 10000;
let currentCategory = 'all';
let notificationCheckInterval = null;

async function checkNotifications() {
    if (!authToken || !currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/customer/notifications`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.notifications) {
            data.notifications.forEach(notif => {
                if (!notif.is_read) {
                    showFlashMessage(notif.message, notif.title.toLowerCase().includes('fail') ? 'error' : 'success');
                    markNotificationRead(notif.id);
                }
            });
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

async function markNotificationRead(notifId) {
    try {
        await fetch(`${API_BASE}/api/customer/notifications/${notifId}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});

async function initializeApp() {
    await loadProducts();
    await loadSettings();
    
    if (authToken) {
        await loadUserProfile();
        mergeLocalCartToServer();
        checkNotifications();
        notificationCheckInterval = setInterval(checkNotifications, 10000);
    }
    
    updateCartDisplay();
    setupEventListeners();
    startCartExpiryTimer();
    renderPriceFilter();
    updateAccountView();
}

function setupEventListeners() {
    document.getElementById('account-btn').addEventListener('click', () => showPage('account'));
    document.getElementById('back-btn').addEventListener('click', goBack);
    
    const loginForm = document.getElementById('customer-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const registerForm = document.getElementById('customer-register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckout);
    }
    
    const getLocationBtn = document.getElementById('get-location-btn');
    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', getLocation);
    }
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = products.filter(p => 
                p.name.toLowerCase().includes(searchTerm) || 
                (p.description && p.description.toLowerCase().includes(searchTerm))
            );
            renderProducts(applyFilters(filtered));
        });
    }
}

function showFlashMessage(message, type = 'success') {
    const existingFlash = document.querySelector('.flash-message');
    if (existingFlash) {
        existingFlash.remove();
    }
    
    const flash = document.createElement('div');
    flash.className = `flash-message flash-${type}`;
    flash.textContent = message;
    flash.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#E63946' : '#FF8C42'};
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 500;
        max-width: 90%;
        text-align: center;
        animation: slideDown 0.3s ease-out;
    `;
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => flash.remove(), 300);
    }, 4000);
}

if (!document.querySelector('#flash-animations')) {
    const style = document.createElement('style');
    style.id = 'flash-animations';
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
        .cart-icon-header {
            position: relative;
            display: inline-block;
        }
        .cart-icon-badge {
            position: absolute;
            top: -8px;
            right: -8px;
            background: #00BFFF;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
        }
        .price-filter-container {
            padding: 15px;
            background: #2a2a2a;
            border-radius: 8px;
            margin: 10px 0;
        }
        .price-slider {
            width: 100%;
            margin: 10px 0;
        }
        .price-range-display {
            display: flex;
            justify-content: space-between;
            margin-top: 5px;
            font-size: 14px;
            color: #FF8C42;
        }
        .filter-controls {
            display: flex;
            gap: 10px;
            margin: 10px 0;
            flex-wrap: wrap;
        }
        .filter-select {
            flex: 1;
            min-width: 150px;
            padding: 8px;
            border-radius: 5px;
            background: #1a1a1a;
            color: white;
            border: 1px solid #444;
        }
        .orders-list {
            max-width: 100%;
            overflow-x: auto;
        }
        .order-card {
            background: #2a2a2a;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 4px solid #FF8C42;
        }
        .order-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            margin: 5px 0;
        }
        .status-payment-failed {
            background: #E63946;
            color: white;
        }
        .status-payment-progress {
            background: #FFA500;
            color: white;
        }
        .status-payment-successful {
            background: #06D6A0;
            color: white;
        }
        .status-delivered {
            background: #118AB2;
            color: white;
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
        .profile-field input {
            width: 100%;
            padding: 10px;
            border-radius: 5px;
            background: #1a1a1a;
            color: white;
            border: 1px solid #444;
        }
        .cart-item-image {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 5px;
            margin-right: 10px;
        }
        .cart-item-details {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .otp-input-container {
            margin: 15px 0;
        }
        .otp-input {
            width: 100%;
            padding: 12px;
            font-size: 18px;
            text-align: center;
            letter-spacing: 5px;
            border-radius: 5px;
            background: #1a1a1a;
            color: white;
            border: 2px solid #FF8C42;
        }
    `;
    document.head.appendChild(style);
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/api/products`);
        products = await response.json();
        renderProducts(products);
        renderCategories();
        updatePriceRange();
    } catch (error) {
        console.error('Error loading products:', error);
        showFlashMessage('Failed to load products', 'error');
    }
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/settings`);
        settings = await response.json();
        
        if (settings.website_title) {
            document.title = settings.website_title;
            const headerTitle = document.querySelector('.app-header h1');
            if (headerTitle) {
                headerTitle.textContent = settings.website_title;
            }
        }
        
        if (settings.allow_pay_on_delivery) {
            const payOnDeliveryOption = document.getElementById('pay-on-delivery-option');
            if (payOnDeliveryOption) {
                payOnDeliveryOption.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/api/customer/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.customer;
        } else {
            localStorage.removeItem('customer_token');
            authToken = null;
            currentUser = null;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        localStorage.removeItem('customer_token');
        authToken = null;
        currentUser = null;
    }
}

function updatePriceRange() {
    minPrice = 0;
    maxPrice = 10000;
}

function renderPriceFilter() {
    const accountBtn = document.getElementById('account-btn');
    if (!accountBtn) return;
    
    const existingIcon = document.getElementById('price-filter-icon');
    if (existingIcon) return;
    
    const filterIcon = document.createElement('button');
    filterIcon.id = 'price-filter-icon';
    filterIcon.className = 'price-filter-icon';
    filterIcon.innerHTML = '💰';
    filterIcon.onclick = togglePriceFilter;
    
    accountBtn.parentElement.insertBefore(filterIcon, accountBtn);
    
    const existingDropdown = document.getElementById('price-filter-dropdown');
    if (existingDropdown) existingDropdown.remove();
    
    const priceFilterHTML = `
        <div id="price-filter-dropdown" class="price-filter-dropdown">
            <button class="filter-collapse-btn" onclick="togglePriceFilter()">▲</button>
            <label style="color: #FF8C42; font-weight: bold; margin-bottom: 10px; display: block;">Price Range</label>
            <input type="range" id="min-price-slider" class="price-slider" min="0" max="10000" value="0" step="10">
            <input type="range" id="max-price-slider" class="price-slider" min="0" max="10000" value="10000" step="10">
            <div class="price-range-display">
                <span>KES <span id="min-price-display">0</span></span>
                <span>KES <span id="max-price-display">10000</span></span>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', priceFilterHTML);
    
    document.getElementById('min-price-slider').addEventListener('input', (e) => {
        const minVal = parseInt(e.target.value);
        const maxVal = parseInt(document.getElementById('max-price-slider').value);
        
        if (minVal <= maxVal) {
            document.getElementById('min-price-display').textContent = minVal;
            applyAllFilters();
        } else {
            e.target.value = maxVal;
        }
    });
    
    document.getElementById('max-price-slider').addEventListener('input', (e) => {
        const maxVal = parseInt(e.target.value);
        const minVal = parseInt(document.getElementById('min-price-slider').value);
        
        if (maxVal >= minVal) {
            document.getElementById('max-price-display').textContent = maxVal;
            applyAllFilters();
        } else {
            e.target.value = minVal;
        }
    });
}

function togglePriceFilter() {
    const dropdown = document.getElementById('price-filter-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

function applyAllFilters() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    
    let filtered = products;
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }
    
    renderProducts(applyFilters(filtered));
}

function applyFilters(productList) {
    const minPriceVal = parseInt(document.getElementById('min-price-slider')?.value || minPrice);
    const maxPriceVal = parseInt(document.getElementById('max-price-slider')?.value || maxPrice);
    
    let filtered = productList.filter(p => p.price_now >= minPriceVal && p.price_now <= maxPriceVal);
    
    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.category === currentCategory);
    }
    
    return filtered;
}

function renderCategories() {
    const categories = [...new Set(products.map(p => p.category))];
    const filterDiv = document.getElementById('category-filter');
    
    if (!filterDiv) return;
    
    let html = '<button class="category-btn active" onclick="filterByCategory(\'all\')">All</button>';
    categories.forEach(cat => {
        html += `<button class="category-btn" onclick="filterByCategory('${cat}')">${cat}</button>`;
    });
    
    filterDiv.innerHTML = html;
}

function filterByCategory(category) {
    currentCategory = category;
    
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    applyAllFilters();
}

function renderProducts(productList) {
    const grid = document.getElementById('products-grid');
    
    if (!grid) return;
    
    let html = '';
    
    productList.forEach(product => {
        const quantity = cart[product.id] || 0;
        html += `
            <div class="product-card">
                <img src="${product.image_url}" alt="${product.name}" class="product-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27%3E%3Crect fill=%27%23ddd%27 width=%27200%27 height=%27200%27/%3E%3Ctext x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27%3ENo Image%3C/text%3E%3C/svg%3E'">
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-description">${product.description || ''}</div>
                    <div class="product-price">
                        <span class="price-now">KES ${product.price_now}</span>
                        ${product.price_old ? `<span class="price-old">KES ${product.price_old}</span>` : ''}
                    </div>
                    <div class="stock-info">Stock: ${product.stock || 'Available'}</div>
                    <div class="product-actions">
                        <div class="quantity-controls">
                            <button class="qty-btn" onclick="updateCart(${product.id}, -1)">-</button>
                            <span class="qty-display" id="qty-${product.id}">${quantity}</span>
                            <button class="qty-btn" onclick="updateCart(${product.id}, 1)">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html || '<p style="text-align: center; padding: 20px; color: #888;">No products found</p>';
}

function updateCart(productId, delta) {
    if (!cart[productId]) cart[productId] = 0;
    cart[productId] += delta;
    
    if (cart[productId] < 0) {
        cart[productId] = 0;
    }
    
    if (cart[productId] === 0) {
        delete cart[productId];
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('cart_timestamp', Date.now());
    
    updateCartDisplay();
}

function updateCartDisplay() {
    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    const cartBar = document.getElementById('cart-bar');
    const accountBtn = document.getElementById('account-btn');
    
    if (totalItems > 0) {
        if (cartBar) {
            cartBar.style.display = 'flex';
            const cartBarText = cartBar.querySelector('span');
            if (cartBarText) {
                cartBarText.textContent = `${totalItems} items in cart`;
            }
        }
        
        const existingIcon = document.querySelector('.cart-icon-header');
        if (!existingIcon && accountBtn) {
            const cartIcon = document.createElement('button');
            cartIcon.className = 'cart-icon-header account-btn';
            cartIcon.innerHTML = `
                🛒
                <span class="cart-icon-badge">${totalItems}</span>
            `;
            cartIcon.onclick = showCart;
            accountBtn.parentElement.insertBefore(cartIcon, accountBtn);
        } else if (existingIcon) {
            const badge = existingIcon.querySelector('.cart-icon-badge');
            if (badge) badge.textContent = totalItems;
        }
    } else {
        if (cartBar) cartBar.style.display = 'none';
        
        const existingIcon = document.querySelector('.cart-icon-header');
        if (existingIcon) existingIcon.remove();
    }
    
    document.querySelectorAll('[id^="qty-"]').forEach(qtyEl => {
        const productId = qtyEl.id.replace('qty-', '');
        qtyEl.textContent = cart[productId] || 0;
    });
}

function showCart() {
    renderCart();
    showPage('cart');
    
    const cartBar = document.getElementById('cart-bar');
    if (cartBar) {
        cartBar.style.display = 'none';
    }
}

function renderCart() {
    const cartItems = document.getElementById('cart-items');
    const cartSummary = document.getElementById('cart-summary');
    
    if (!cartItems || !cartSummary) return;
    
    let itemsHTML = '';
    let total = 0;
    
    Object.keys(cart).forEach(productId => {
        const product = products.find(p => p.id == productId);
        if (product) {
            const subtotal = product.price_now * cart[productId];
            total += subtotal;
            
            itemsHTML += `
                <div class="cart-item">
                    <div class="cart-item-details">
                        <img src="${product.image_url}" alt="${product.name}" class="cart-item-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2760%27 height=%2760%27%3E%3Crect fill=%27%23ddd%27 width=%2760%27 height=%2760%27/%3E%3C/svg%3E'">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; margin-bottom: 5px;">${product.name}</div>
                            <div style="font-size: 12px; color: #888;">${product.description || ''}</div>
                            <div style="margin-top: 5px;">
                                <span style="color: #FF8C42;">KES ${product.price_now}</span>
                                <span style="color: #888; margin-left: 10px;">x ${cart[productId]}</span>
                            </div>
                        </div>
                        <div style="font-weight: bold; color: #FF8C42;">KES ${subtotal.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }
    });
    
    cartItems.innerHTML = itemsHTML || '<p>Your cart is empty</p>';
    cartSummary.innerHTML = `<h3>Total: KES ${total.toFixed(2)}</h3>`;
}

function showCheckout() {
    if (!authToken) {
        showFlashMessage('Please login to checkout', 'error');
        showPage('account');
        return;
    }
    
    renderCart();
    
    const checkoutNameField = document.getElementById('checkout-name');
    if (checkoutNameField) {
        checkoutNameField.style.display = 'none';
        const label = checkoutNameField.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.style.display = 'none';
        }
    }
    
    if (currentUser && currentUser.phone) {
        const phoneField = document.getElementById('checkout-phone');
        if (phoneField) {
            phoneField.value = currentUser.phone;
        }
    }
    
    showPage('checkout');
}

async function handleCheckout(e) {
    e.preventDefault();
    
    const phone = document.getElementById('checkout-phone').value;
    const address = document.getElementById('delivery-address').value;
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const locationMethod = document.querySelector('input[name="location-method"]:checked').value;
    
    if (!currentUser) {
        showFlashMessage('Please login to place an order', 'error');
        showPage('account');
        return;
    }
    
    const items = Object.keys(cart).map(productId => {
        const product = products.find(p => p.id == productId);
        return {
            product_id: productId,
            name: product.name,
            price: product.price_now,
            quantity: cart[productId]
        };
    });
    
    const productTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = settings.min_delivery_fee || 0;
    const totalAmount = productTotal + deliveryFee;
    
    try {
        const response = await fetch(`${API_BASE}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                customer_id: currentUser.id,
                customer_name: currentUser.username || currentUser.email,
                customer_phone: phone,
                customer_email: currentUser.email,
                delivery_address: address,
                location_method: locationMethod,
                items: items,
                product_total: productTotal,
                delivery_fee: deliveryFee,
                total_amount: totalAmount,
                payment_method: paymentMethod
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            cart = {};
            localStorage.removeItem('cart');
            localStorage.removeItem('cart_timestamp');
            updateCartDisplay();
            showFlashMessage(`Order placed successfully! Order ID: ${data.order_id}`);
            showPage('menu');
        } else {
            showFlashMessage('Order failed: ' + data.message, 'error');
        }
    } catch (error) {
        showFlashMessage('Error placing order: ' + error.message, 'error');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/customer/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('customer_token', authToken);
            await loadUserProfile();
            updateAccountView();
            showFlashMessage('Login successful!');
            showPage('menu');
        } else {
            showFlashMessage('Login failed: ' + data.message, 'error');
        }
    } catch (error) {
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;
    const termsAccepted = document.getElementById('terms-accept').checked;
    
    if (password.length < 5) {
        showFlashMessage('Password must be at least 5 characters long', 'error');
        return;
    }
    
    if (!termsAccepted) {
        showFlashMessage('You must accept the terms and conditions', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/customer/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFlashMessage('OTP sent to your email!');
            showOTPVerification(email, username, password, phone, termsAccepted);
        } else {
            showFlashMessage('Registration failed: ' + data.message, 'error');
        }
    } catch (error) {
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

function showOTPVerification(email, username, password, phone, termsAccepted) {
    const registerForm = document.getElementById('register-form');
    
    if (!registerForm) return;
    
    registerForm.innerHTML = `
        <h2>Verify OTP</h2>
        <p style="color: #888; margin-bottom: 20px;">We've sent a 6-digit code to ${email}</p>
        <form id="otp-verify-form">
            <div class="otp-input-container">
                <input type="text" id="otp-code" class="otp-input" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code">
            </div>
            <button type="submit" class="btn-primary">Verify & Register</button>
            <button type="button" class="btn-secondary" onclick="backToAccount()">Cancel</button>
            <button type="button" class="btn-secondary" onclick="resendOTP('${email}')">Resend OTP</button>
        </form>
    `;
    
    const otpForm = document.getElementById('otp-verify-form');
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const otpCode = document.getElementById('otp-code').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/customer/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    otp_code: otpCode,
                    username,
                    password,
                    phone,
                    terms_accepted: termsAccepted
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                authToken = data.token;
                localStorage.setItem('customer_token', authToken);
                await loadUserProfile();
                updateAccountView();
                showFlashMessage('Registration successful!');
                showPage('menu');
            } else {
                showFlashMessage('Verification failed: ' + data.message, 'error');
            }
        } catch (error) {
            showFlashMessage('Error: ' + error.message, 'error');
        }
    });
}

async function resendOTP(email) {
    try {
        const response = await fetch(`${API_BASE}/api/customer/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFlashMessage('OTP resent successfully!');
        } else {
            showFlashMessage('Failed to resend OTP: ' + data.message, 'error');
        }
    } catch (error) {
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

function updateAccountView() {
    const loggedInView = document.getElementById('logged-in-view');
    const loggedOutView = document.getElementById('logged-out-view');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (!loggedInView || !loggedOutView) return;
    
    if (authToken && currentUser) {
        loggedInView.style.display = 'block';
        loggedOutView.style.display = 'none';
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        
        renderUserProfile();
    } else {
        loggedInView.style.display = 'none';
        loggedOutView.style.display = 'block';
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
    }
}

function renderUserProfile() {
    const accountInfo = document.getElementById('account-info');
    
    if (!accountInfo || !currentUser) return;
    
    accountInfo.innerHTML = `
        <div class="profile-view">
            <h3 style="color: #FF8C42; margin-bottom: 15px;">Profile Information</h3>
            <div class="profile-field">
                <label>Username</label>
                <div>${currentUser.username || 'Not set'}</div>
            </div>
            <div class="profile-field">
                <label>Email</label>
                <div>${currentUser.email}</div>
            </div>
            <div class="profile-field">
                <label>Phone</label>
                <div>${currentUser.phone || 'Not set'}</div>
            </div>
        </div>
    `;
}

function showEditProfile() {
    const accountInfo = document.getElementById('account-info');
    
    if (!accountInfo || !currentUser) return;
    
    accountInfo.innerHTML = `
        <div class="profile-view">
            <h3 style="color: #FF8C42; margin-bottom: 15px;">Edit Profile</h3>
            <form id="edit-profile-form">
                <div class="profile-field">
                    <label>Username</label>
                    <input type="text" id="edit-username" value="${currentUser.username || ''}" placeholder="Enter username">
                </div>
                <div class="profile-field">
                    <label>Email (cannot be changed)</label>
                    <input type="email" value="${currentUser.email}" disabled>
                </div>
                <div class="profile-field">
                    <label>Phone</label>
                    <input type="tel" id="edit-phone" value="${currentUser.phone || ''}" placeholder="0712345678">
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="submit" class="btn-primary">Save Changes</button>
                    <button type="button" class="btn-secondary" onclick="renderUserProfile()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    const editForm = document.getElementById('edit-profile-form');
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('edit-username').value;
        const phone = document.getElementById('edit-phone').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/customer/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ username, phone })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await loadUserProfile();
                renderUserProfile();
                showFlashMessage('Profile updated successfully!');
            } else {
                showFlashMessage('Update failed: ' + data.message, 'error');
            }
        } catch (error) {
            showFlashMessage('Error updating profile: ' + error.message, 'error');
        }
    });
}

async function showOrders() {
    if (!authToken) {
        showFlashMessage('Please login to view orders', 'error');
        return;
    }
    
    const accountInfo = document.getElementById('account-info');
    
    if (!accountInfo) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/customer/orders`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            let ordersHTML = `
                <div class="orders-list">
                    <h3 style="color: #FF8C42; margin-bottom: 15px;">My Orders</h3>
            `;
            
            if (data.orders.length === 0) {
                ordersHTML += '<p style="color: #888;">No orders yet</p>';
            } else {
                data.orders.forEach(order => {
                    const statusClass = getStatusClass(order.payment_status, order.status);
                    const statusText = getStatusText(order.payment_status, order.status);
                    
                    ordersHTML += `
                        <div class="order-card">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <div>
                                    <div style="font-weight: bold; color: #FF8C42;">Order #${order.order_id}</div>
                                    <div style="font-size: 12px; color: #888;">${new Date(order.created_at).toLocaleString()}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: bold;">KES ${order.total_amount.toFixed(2)}</div>
                                    <div class="order-status ${statusClass}">${statusText}</div>
                                </div>
                            </div>
                            <div style="margin-top: 10px;">
                                <div style="font-size: 12px; color: #888; margin-bottom: 5px;">Items:</div>
                                ${order.items.map(item => `
                                    <div style="font-size: 13px; margin-left: 10px;">
                                        ${item.name} x ${item.quantity} - KES ${(item.price * item.quantity).toFixed(2)}
                                    </div>
                                `).join('')}
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #888;">
                                <div>Payment: ${order.payment_method}</div>
                                <div>Delivery: ${order.delivery_address}</div>
                            </div>
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                                ${order.payment_status !== 'Payment Complete' ? `
                                    <button class="btn-primary" onclick="initiateCustomerPayment(${order.id}, '${order.customer_phone}')" style="flex: 1;">Pay Now</button>
                                ` : ''}
                                ${order.status === 'Out for Delivery' ? `
                                    <button class="btn-secondary" onclick="trackMyOrder('${order.order_id}')" style="flex: 1;">🗺️ Map</button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
            }
            
            ordersHTML += `
                <button class="btn-secondary" onclick="renderUserProfile()" style="margin-top: 15px;">Back to Profile</button>
                </div>
            `;
            
            accountInfo.innerHTML = ordersHTML;
        } else {
            showFlashMessage('Failed to load orders', 'error');
        }
    } catch (error) {
        showFlashMessage('Error loading orders: ' + error.message, 'error');
    }
}

function getStatusClass(paymentStatus, deliveryStatus) {
    if (deliveryStatus === 'Delivered') return 'status-delivered';
    if (paymentStatus === 'Payment Failed') return 'status-payment-failed';
    if (paymentStatus === 'Payment In Progress') return 'status-payment-progress';
    if (paymentStatus === 'Payment Complete') return 'status-payment-successful';
    return 'status-payment-progress';
}

function getStatusText(paymentStatus, deliveryStatus) {
    if (deliveryStatus === 'Delivered') return 'Delivered';
    if (paymentStatus === 'Payment Complete') return 'Paid';
    return 'Pending Payment';
}

function showNotifications() {
    showFlashMessage('Notifications feature coming soon!');
}

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const address = `Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude}`;
            document.getElementById('delivery-address').value = address;
            showFlashMessage('Location captured successfully!');
        }, error => {
            showFlashMessage('Unable to get location: ' + error.message, 'error');
        });
    } else {
        showFlashMessage('Geolocation is not supported by this browser', 'error');
    }
}

function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(`${pageName}-page`);
    
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    currentPage = pageName;
    
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        if (pageName === 'menu') {
            backBtn.style.display = 'none';
        } else {
            backBtn.style.display = 'block';
        }
    }
    
    if (pageName === 'menu') {
        const cartBar = document.getElementById('cart-bar');
        if (cartBar && Object.keys(cart).length > 0) {
            cartBar.style.display = 'flex';
        }
    }
}

function goBack() {
    showPage('menu');
}

function showLogin() {
    document.getElementById('logged-out-view').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showForgotPassword() {
    const loginForm = document.getElementById('login-form');
    
    loginForm.innerHTML = `
        <h2>Forgot Password</h2>
        <form id="forgot-password-form">
            <input type="email" id="forgot-email" placeholder="Enter your email" required>
            <button type="submit">Send Reset Code</button>
            <button type="button" onclick="backToAccount()">Back to Login</button>
        </form>
    `;
    
    const forgotForm = document.getElementById('forgot-password-form');
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/customer/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showFlashMessage('Reset code sent to your email!');
                showPasswordReset(email);
            } else {
                showFlashMessage(data.message || 'Failed to send reset code', 'error');
            }
        } catch (error) {
            showFlashMessage('Error: ' + error.message, 'error');
        }
    });
}

function showPasswordReset(email) {
    const loginForm = document.getElementById('login-form');
    
    loginForm.innerHTML = `
        <h2>Reset Password</h2>
        <p style="color: #888; margin-bottom: 20px;">Enter the code sent to ${email}</p>
        <form id="reset-password-form">
            <div class="otp-input-container">
                <input type="text" id="reset-otp" class="otp-input" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code">
            </div>
            <input type="password" id="new-password" placeholder="New Password" required>
            <button type="submit">Reset Password</button>
            <button type="button" onclick="backToAccount()">Cancel</button>
        </form>
    `;
    
    const resetForm = document.getElementById('reset-password-form');
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const otpCode = document.getElementById('reset-otp').value;
        const newPassword = document.getElementById('new-password').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/customer/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    otp_code: otpCode,
                    new_password: newPassword,
                    purpose: 'password_reset'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showFlashMessage('Password reset successfully!');
                backToAccount();
            } else {
                showFlashMessage(data.message || 'Reset failed', 'error');
            }
        } catch (error) {
            showFlashMessage('Error: ' + error.message, 'error');
        }
    });
}

function showRegister() {
    document.getElementById('logged-out-view').style.display = 'none';
    document.getElementById('login-form').style.display = 'none';
    
    const registerForm = document.getElementById('register-form');
    registerForm.style.display = 'block';
    
    registerForm.innerHTML = `
        <h2>Register</h2>
        <form id="customer-register-form">
            <input type="text" id="reg-username" placeholder="Username">
            <input type="email" id="reg-email" placeholder="Email" required>
            <input type="password" id="reg-password" placeholder="Password" required>
            <input type="tel" id="reg-phone" placeholder="Phone (0712345678)">
            <div class="checkbox-group">
                <input type="checkbox" id="terms-accept" required>
                <label for="terms-accept">
                    I have read and agree to <a href="#" onclick="showTerms()">Terms & Conditions</a>
                </label>
            </div>
            <button type="submit">Register</button>
            <button type="button" onclick="backToAccount()">Cancel</button>
        </form>
    `;
    
    const form = document.getElementById('customer-register-form');
    form.addEventListener('submit', handleRegister);
}

function backToAccount() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('logged-out-view').style.display = 'block';
}

function logout() {
    localStorage.removeItem('customer_token');
    authToken = null;
    currentUser = null;
    updateAccountView();
    showFlashMessage('Logged out successfully');
    showPage('menu');
}

async function initiateCustomerPayment(orderId, defaultPhone) {
    const phone = prompt('Enter phone number for M-Pesa payment:', defaultPhone);
    
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
            showFlashMessage('Payment request sent! Please check your phone.');
            setTimeout(() => showOrders(), 2000);
        } else {
            showFlashMessage(data.message || 'Payment request failed', 'error');
        }
    } catch (error) {
        showFlashMessage('Error: ' + error.message, 'error');
    }
}

async function mergeLocalCartToServer() {
    if (Object.keys(cart).length === 0) return;
    
    for (const [productId, quantity] of Object.entries(cart)) {
        try {
            await fetch(`${API_BASE}/api/customer/cart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ product_id: productId, quantity })
            });
        } catch (error) {
            console.error('Error syncing cart:', error);
        }
    }
}

function startCartExpiryTimer() {
    const timestamp = localStorage.getItem('cart_timestamp');
    if (timestamp) {
        const elapsed = Date.now() - parseInt(timestamp);
        const fiveHours = 5 * 60 * 60 * 1000;
        
        if (elapsed > fiveHours) {
            cart = {};
            localStorage.removeItem('cart');
            localStorage.removeItem('cart_timestamp');
            updateCartDisplay();
            showFlashMessage('Your cart has expired', 'error');
        }
    }
}

function showTerms() {
    showPage('terms');
    loadTerms();
}

async function loadTerms() {
    try {
        const response = await fetch(`${API_BASE}/api/terms`);
        const data = await response.json();
        
        const termsContent = document.getElementById('terms-content');
        
        if (data.current && termsContent) {
            termsContent.innerHTML = `<pre>${data.current.content}</pre>`;
        }
    } catch (error) {
        console.error('Error loading terms:', error);
        showFlashMessage('Error loading terms', 'error');
    }
}

async function trackMyOrder(orderId) {
    try {
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/tracking`);
        const data = await response.json();
        
        if (data.tracking_available && data.tracking_link) {
            window.open(data.tracking_link, '_blank');
        } else {
            showFlashMessage('Tracking not available yet. Your order has not been assigned to a delivery staff.', 'error');
        }
    } catch (error) {
        console.error('Error tracking order:', error);
        showFlashMessage('Error loading tracking information', 'error');
    }
}
