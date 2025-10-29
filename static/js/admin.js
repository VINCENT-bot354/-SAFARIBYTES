const API_BASE = '';
let authToken = localStorage.getItem('admin_token');
let currentSection = 'dashboard';
let currentEditingProductId = null;
let currentEditingCapitalId = null;
let currentEditingSocialLinkId = null;
let charts = {
    sales: null,
    revenue: null,
    paymentMethods: null,
    orderStatus: null
};
let ordersData = [];
let analyticsData = null;

function toggleAdminMenu() {
    const dropdown = document.getElementById('admin-nav-dropdown');
    dropdown.classList.toggle('active');
}

function closeAdminMenu() {
    const dropdown = document.getElementById('admin-nav-dropdown');
    dropdown.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', async () => {
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('admin-nav-dropdown');
        const menuToggle = document.getElementById('menu-toggle');
        
        if (dropdown && !dropdown.contains(e.target) && e.target !== menuToggle) {
            dropdown.classList.remove('active');
        }
    });

    if (authToken) {
        await checkAuth();
    } else {
        await checkBootstrap();
    }

    setupEventListeners();
});

function setupEventListeners() {
    const bootstrapForm = document.getElementById('admin-bootstrap-form');
    if (bootstrapForm) {
        bootstrapForm.addEventListener('submit', handleBootstrap);
    }

    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSettings);
    }

    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', handleProduct);
    }

    const capitalForm = document.getElementById('capital-form');
    if (capitalForm) {
        capitalForm.addEventListener('submit', handleCapital);
    }

    const socialLinkForm = document.getElementById('social-link-form');
    if (socialLinkForm) {
        socialLinkForm.addEventListener('submit', handleSocialLink);
    }
}

function showFlash(message, type = 'info') {
    const existingFlash = document.querySelector('.flash-message');
    if (existingFlash) {
        existingFlash.remove();
    }

    const flash = document.createElement('div');
    flash.className = `flash-message ${type}`;
    flash.textContent = message;
    document.body.appendChild(flash);

    setTimeout(() => {
        flash.classList.add('hiding');
        setTimeout(() => flash.remove(), 300);
    }, 4000);
}

async function checkBootstrap() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/check-bootstrap`);
        const data = await response.json();

        if (data.needs_bootstrap) {
            document.getElementById('bootstrap-view').style.display = 'block';
            document.getElementById('login-view').style.display = 'none';
        } else {
            document.getElementById('bootstrap-view').style.display = 'none';
            document.getElementById('login-view').style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        showFlash('Failed to check bootstrap status', 'error');
    }
}

async function handleBootstrap(e) {
    e.preventDefault();

    const email = document.getElementById('bootstrap-email').value;
    const password = document.getElementById('bootstrap-password').value;

    try {
        const response = await fetch(`${API_BASE}/api/admin/bootstrap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem('admin_token', authToken);
            showFlash('Admin account created successfully!', 'success');
            setTimeout(() => showDashboard(), 1000);
        } else {
            showFlash(data.message || 'Bootstrap failed', 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function handleLogin(e) {
    e.preventDefault();


function showAdminForgotPassword() {
    const loginView = document.getElementById('login-view');
    
    loginView.innerHTML = `
        <h2>Forgot Password</h2>
        <form id="admin-forgot-form">
            <input type="email" id="forgot-email" placeholder="Enter your email" required>
            <button type="submit">Send Reset Code</button>
            <button type="button" onclick="location.reload()">Back to Login</button>
        </form>
    `;
    
    const forgotForm = document.getElementById('admin-forgot-form');
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/admin/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showFlash('Reset code sent to your email!', 'success');
                showAdminPasswordReset(email);
            } else {
                showFlash(data.message || 'Failed to send reset code', 'error');
            }
        } catch (error) {
            showFlash('Error: ' + error.message, 'error');
        }
    });
}

function showAdminPasswordReset(email) {
    const loginView = document.getElementById('login-view');
    
    loginView.innerHTML = `
        <h2>Reset Password</h2>
        <p style="color: #888; margin-bottom: 20px;">Enter the code sent to ${email}</p>
        <form id="admin-reset-form">
            <div class="otp-input-container">
                <input type="text" id="reset-otp" class="otp-input" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code">
            </div>
            <input type="password" id="new-password" placeholder="New Password (min 5 characters)" required minlength="5">
            <button type="submit">Reset Password</button>
            <button type="button" onclick="location.reload()">Cancel</button>
        </form>
    `;
    
    const resetForm = document.getElementById('admin-reset-form');
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const otpCode = document.getElementById('reset-otp').value;
        const newPassword = document.getElementById('new-password').value;
        
        if (newPassword.length < 5) {
            showFlash('Password must be at least 5 characters long', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/admin/reset-password`, {
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
                showFlash('Password reset successfully!', 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                showFlash(data.message || 'Reset failed', 'error');
            }
        } catch (error) {
            showFlash('Error: ' + error.message, 'error');
        }
    });
}


    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    try {
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem('admin_token', authToken);
            showFlash('Login successful!', 'success');
            setTimeout(() => showDashboard(), 500);
        } else {
            showFlash(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function checkAuth() {
    showDashboard();
}

function showDashboard() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'block';
    loadDashboard();
}

async function loadDashboard() {
    await Promise.all([
        loadAnalytics(),
        loadOrders(),
        loadProducts(),
        loadCapital(),
        loadPendingStaff(),
        loadSettings(),
        loadSocialLinks(),
        loadTerms(),
        loadBackupHistory()
    ]);

    setInterval(async () => {
        await loadAnalytics();
        await loadOrders();
    }, 10000);
}

async function loadAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/api/analytics/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        analyticsData = data;

        const confirmedOrders = ordersData.filter(o => o.payment_status === 'Payment Complete');
        const productSales = confirmedOrders.reduce((sum, o) => sum + parseFloat(o.product_total), 0);
        const deliveryFees = confirmedOrders.reduce((sum, o) => sum + parseFloat(o.delivery_fee), 0);
        const totalRevenue = confirmedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
        const totalProfit = totalRevenue - data.total_capital;

        document.getElementById('totals-table').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Product Sales (KES)</th>
                        <th>Delivery Fees (KES)</th>
                        <th>Total Revenue (KES)</th>
                        <th>Total Capital (KES)</th>
                        <th>Total Profit (KES)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${productSales.toFixed(2)}</td>
                        <td>${deliveryFees.toFixed(2)}</td>
                        <td>${totalRevenue.toFixed(2)}</td>
                        <td>${data.total_capital.toFixed(2)}</td>
                        <td>${totalProfit.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        `;

        updateCharts();
    } catch (error) {
        console.error('Error loading analytics:', error);
        showFlash('Failed to load analytics data', 'error');
    }
}

async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE}/api/orders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const orders = await response.json();
        ordersData = orders;
        const tbody = document.querySelector('#orders-table tbody');

        tbody.innerHTML = orders.map(o => {
            const productNames = o.items.map(item => item.name).join(', ');
            return `
            <tr onclick="viewOrderDetails(${o.id})" style="cursor: pointer;">
                <td>${o.order_id}</td>
                <td>${o.customer_name}</td>
                <td>${productNames}</td>
                <td>${o.product_total}</td>
                <td>${o.delivery_fee}</td>
                <td>${o.total_amount}</td>
                <td>${o.payment_method}</td>
                <td>${o.staff_name || 'Unassigned'}</td>
                <td><span class="status-badge status-${o.payment_status.toLowerCase().replace(/ /g, '-')}">${o.payment_status}</span></td>
                <td>${new Date(o.created_at).toLocaleString()}</td>
            </tr>
        `;
        }).join('');

        updateCharts();
    } catch (error) {
        console.error('Error loading orders:', error);
        showFlash('Failed to load orders', 'error');
    }
}

function viewOrderDetails(orderId) {
    const order = ordersData.find(o => o.id === orderId);
    if (!order) return;

    const itemsList = order.items.map(item => 
        `<li>${item.name} x ${item.quantity} - KES ${(item.price * item.quantity).toFixed(2)}</li>`
    ).join('');

    const modalContent = `
        <h3>Order #${order.order_id}</h3>
        <div style="margin: 20px 0;">
            <p><strong>Customer:</strong> ${order.customer_name}</p>
            <p><strong>Phone:</strong> ${order.customer_phone}</p>
            <p><strong>Email:</strong> ${order.customer_email || 'N/A'}</p>
            <p><strong>Address:</strong> ${order.delivery_address}</p>
            <p><strong>Payment Method:</strong> ${order.payment_method}</p>
            <p><strong>Payment Status:</strong> <span class="status-badge status-${order.payment_status.toLowerCase().replace(/ /g, '-')}">${order.payment_status}</span></p>
            <p><strong>Staff:</strong> ${order.staff_id || 'Unassigned'}</p>
            <p><strong>Created:</strong> ${new Date(order.created_at).toLocaleString()}</p>
        </div>
        <h4>Items:</h4>
        <ul style="margin: 10px 0 20px 20px;">
            ${itemsList}
        </ul>
        <div style="border-top: 2px solid #444; padding-top: 15px; margin-top: 15px;">
            <p><strong>Product Total:</strong> KES ${order.product_total.toFixed(2)}</p>
            <p><strong>Delivery Fee:</strong> KES ${order.delivery_fee.toFixed(2)}</p>
            <p style="font-size: 18px; color: #ff8c00;"><strong>Total Amount:</strong> KES ${order.total_amount.toFixed(2)}</p>
        </div>
    `;

    document.getElementById('order-detail-content').innerHTML = modalContent;
    document.getElementById('product-modal').style.display = 'block';
}

function updateCharts() {
    if (!ordersData.length || !analyticsData) return;

    updateSalesChart();
    updateRevenueChart();
    updatePaymentMethodsChart();
    updateOrderStatusChart();
}

function updateSalesChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    const now = new Date();
    const ordersByDay = {};
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayKey = date.toISOString().split('T')[0];
        ordersByDay[dayKey] = 0;
    }

    ordersData.forEach(order => {
        const orderDate = new Date(order.created_at);
        const dayKey = orderDate.toISOString().split('T')[0];
        if (ordersByDay.hasOwnProperty(dayKey)) {
            ordersByDay[dayKey]++;
        }
    });

    const labels = Object.keys(ordersByDay).map(dateStr => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = Object.values(ordersByDay);

    if (charts.sales) {
        charts.sales.destroy();
    }

    charts.sales = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Orders Per Day',
                data: data,
                borderColor: '#ff8c00',
                backgroundColor: 'rgba(255, 140, 0, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#ff8c00'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#fff',
                        stepSize: 1
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

function updateRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx || !analyticsData) return;

    if (charts.revenue) {
        charts.revenue.destroy();
    }

    charts.revenue = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Revenue', 'Capital', 'Profit'],
            datasets: [{
                label: 'Amount (KES)',
                data: [
                    analyticsData.total_revenue,
                    analyticsData.total_capital,
                    analyticsData.total_profit
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(255, 140, 0, 0.8)'
                ],
                borderColor: [
                    '#10b981',
                    '#ef4444',
                    '#ff8c00'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

function updatePaymentMethodsChart() {
    const ctx = document.getElementById('paymentMethodsChart');
    if (!ctx) return;

    const paymentMethods = {};
    ordersData.forEach(order => {
        const method = order.payment_method || 'Unknown';
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });

    const labels = Object.keys(paymentMethods);
    const data = Object.values(paymentMethods);

    if (charts.paymentMethods) {
        charts.paymentMethods.destroy();
    }

    charts.paymentMethods = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(255, 140, 0, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(168, 85, 247, 0.8)'
                ],
                borderColor: '#1a1a1a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff', padding: 15 }
                }
            }
        }
    });
}

function updateOrderStatusChart() {
    const ctx = document.getElementById('orderStatusChart');
    if (!ctx) return;

    const statuses = {};
    ordersData.forEach(order => {
        const status = order.payment_status || 'Unknown';
        statuses[status] = (statuses[status] || 0) + 1;
    });

    const labels = Object.keys(statuses);
    const data = Object.values(statuses);

    if (charts.orderStatus) {
        charts.orderStatus.destroy();
    }

    charts.orderStatus = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(255, 140, 0, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(168, 85, 247, 0.8)'
                ],
                borderColor: '#1a1a1a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff', padding: 15 }
                }
            }
        }
    });
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/api/products`);
        const products = await response.json();

        document.getElementById('products-list').innerHTML = products.map(p => `
            <div class="product-item">
                <img src="${p.image_url}" alt="${p.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">
                <div>
                    <h4>${p.name}</h4>
                    <p>${p.description || 'No description'}</p>
                    <p><strong>Price:</strong> KES ${p.price_now} ${p.price_old ? `<s>KES ${p.price_old}</s>` : ''}</p>
                    <p><strong>Stock:</strong> ${p.stock || 'N/A'} | <strong>Category:</strong> ${p.category}</p>
                    <p><strong>Cost of Goods:</strong> KES ${p.cost_of_goods || 0} | <strong>Combo:</strong> ${p.is_combo ? 'Yes' : 'No'}</p>
                    <button onclick="editProduct(${p.id})" class="btn-edit">✏️ Edit</button>
                    <button onclick="deleteProduct(${p.id})" class="btn-delete">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading products:', error);
        showFlash('Failed to load products', 'error');
    }
}

async function editProduct(productId) {
    try {
        const response = await fetch(`${API_BASE}/api/products`);
        const products = await response.json();
        const product = products.find(p => p.id === productId);

        if (!product) {
            showFlash('Product not found', 'error');
            return;
        }

        currentEditingProductId = productId;
        document.getElementById('modal-title').textContent = 'Edit Product';
        document.getElementById('product-image-url').value = product.image_url;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-price-now').value = product.price_now;
        document.getElementById('product-price-old').value = product.price_old || '';
        document.getElementById('product-stock').value = product.stock || '';
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-cost').value = product.cost_of_goods || 0;
        document.getElementById('product-is-combo').checked = product.is_combo;

        document.getElementById('product-modal').style.display = 'block';
    } catch (error) {
        console.error('Error loading product:', error);
        showFlash('Failed to load product details', 'error');
    }
}

function showAddProduct() {
    currentEditingProductId = null;
    document.getElementById('modal-title').textContent = 'Add Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-modal').style.display = 'block';
}

async function handleProduct(e) {
    e.preventDefault();

    const product = {
        image_url: document.getElementById('product-image-url').value,
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        price_now: parseFloat(document.getElementById('product-price-now').value),
        price_old: document.getElementById('product-price-old').value ? parseFloat(document.getElementById('product-price-old').value) : null,
        stock: document.getElementById('product-stock').value,
        category: document.getElementById('product-category').value,
        cost_of_goods: document.getElementById('product-cost').value ? parseFloat(document.getElementById('product-cost').value) : 0,
        is_combo: document.getElementById('product-is-combo').checked
    };

    try {
        let response;
        if (currentEditingProductId) {
            response = await fetch(`${API_BASE}/api/products/${currentEditingProductId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(product)
            });
        } else {
            response = await fetch(`${API_BASE}/api/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(product)
            });
        }

        const data = await response.json();

        if (data.success) {
            showFlash(currentEditingProductId ? 'Product updated successfully!' : 'Product added successfully!', 'success');
            closeModal();
            loadProducts();
            currentEditingProductId = null;
        } else {
            showFlash('Error: ' + (data.message || 'Operation failed'), 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Product deleted successfully!', 'success');
            loadProducts();
        } else {
            showFlash('Failed to delete product', 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function loadCapital() {
    try {
        const response = await fetch(`${API_BASE}/api/capital`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        document.getElementById('capital-total').innerHTML = `<h3>Total Capital: KES ${data.total.toFixed(2)}</h3>`;

        const tbody = document.querySelector('#capital-table tbody');
        tbody.innerHTML = data.entries.map(e => `
            <tr>
                <td>${new Date(e.created_at).toLocaleDateString()}</td>
                <td>${e.purpose} ${e.is_edited ? '<small style="color: #ff8c00;">(edited)</small>' : ''}</td>
                <td>KES ${e.amount.toFixed(2)}</td>
                <td><button onclick="editCapital(${e.id})" class="btn-edit">✏️ Edit</button></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading capital:', error);
        showFlash('Failed to load capital ledger', 'error');
    }
}

async function editCapital(entryId) {
    try {
        const response = await fetch(`${API_BASE}/api/capital`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        const entry = data.entries.find(e => e.id === entryId);

        if (!entry) {
            showFlash('Entry not found', 'error');
            return;
        }

        currentEditingCapitalId = entryId;
        document.getElementById('capital-modal-title').textContent = 'Edit Capital Entry';
        document.getElementById('capital-id').value = entryId;
        document.getElementById('capital-amount').value = entry.amount;
        document.getElementById('capital-purpose').value = entry.purpose;

        document.getElementById('capital-modal').style.display = 'block';
    } catch (error) {
        console.error('Error loading capital entry:', error);
        showFlash('Failed to load capital entry', 'error');
    }
}

function showAddCapital() {
    currentEditingCapitalId = null;
    document.getElementById('capital-modal-title').textContent = 'Add Capital Entry';
    document.getElementById('capital-form').reset();
    document.getElementById('capital-modal').style.display = 'block';
}

async function handleCapital(e) {
    e.preventDefault();

    const entry = {
        amount: parseFloat(document.getElementById('capital-amount').value),
        purpose: document.getElementById('capital-purpose').value
    };

    try {
        let response;
        if (currentEditingCapitalId) {
            response = await fetch(`${API_BASE}/api/capital/${currentEditingCapitalId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(entry)
            });
        } else {
            response = await fetch(`${API_BASE}/api/capital`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(entry)
            });
        }

        const data = await response.json();

        if (data.success) {
            showFlash(currentEditingCapitalId ? 'Capital entry updated!' : 'Capital entry added!', 'success');
            closeModal();
            loadCapital();
            currentEditingCapitalId = null;
        } else {
            showFlash('Error: ' + (data.message || 'Operation failed'), 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function loadPendingStaff() {
    try {
        const response = await fetch(`${API_BASE}/api/staff/pending`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const pending = await response.json();

        document.getElementById('pending-staff').innerHTML = pending.map(s => `
            <div class="staff-item" style="background: rgba(255, 255, 255, 0.05); padding: 16px; margin: 12px 0; border-radius: 8px;">
                <h4>${s.full_name || s.email}</h4>
                <p><strong>Email:</strong> ${s.email}</p>
                <p><strong>Phone:</strong> ${s.phone}</p>
                <p><strong>Registered:</strong> ${new Date(s.created_at).toLocaleString()}</p>
                <button onclick="approveStaff(${s.id}, true)" class="btn-success">✅ Approve</button>
                <button onclick="approveStaff(${s.id}, false)" class="btn-delete">❌ Reject</button>
            </div>
        `).join('') || '<p>No pending staff approvals</p>';
    } catch (error) {
        console.error('Error loading staff:', error);
        showFlash('Failed to load pending staff', 'error');
    }
}

async function approveStaff(staffId, approved) {
    try {
        const response = await fetch(`${API_BASE}/api/staff/${staffId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ approved })
        });

        const data = await response.json();

        if (data.success) {
            showFlash(approved ? 'Staff approved successfully!' : 'Staff rejected successfully!', 'success');
            loadPendingStaff();
        } else {
            showFlash('Error: ' + (data.message || 'Operation failed'), 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/settings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const settings = await response.json();

        if (settings) {
        document.getElementById('allow-email-signin').checked = settings.allow_email_signin;
        document.getElementById('allow-pay-on-delivery').checked = settings.allow_pay_on_delivery;
        document.getElementById('splash-enabled').checked = settings.splash_enabled;
        document.getElementById('adverts-enabled').checked = settings.adverts_enabled;
        document.getElementById('min-delivery-fee').value = settings.min_delivery_fee;
        document.getElementById('delivery-per-km-rate').value = settings.delivery_per_km_rate;
        document.getElementById('customer-care-number').value = settings.customer_care_number || '';
    }
    } catch (error) {
        console.error('Error loading settings:', error);
        showFlash('Failed to load settings', 'error');
    }
}

async function handleSettings(e) {
    e.preventDefault();

    const settingsData = {
        allow_email_signin: document.getElementById('allow-email-signin').checked,
        allow_pay_on_delivery: document.getElementById('allow-pay-on-delivery').checked,
        splash_enabled: document.getElementById('splash-enabled').checked,
        adverts_enabled: document.getElementById('adverts-enabled').checked,
        min_delivery_fee: parseFloat(document.getElementById('min-delivery-fee').value),
        delivery_per_km_rate: parseFloat(document.getElementById('delivery-per-km-rate').value),
        customer_care_number: document.getElementById('customer-care-number').value
    };

    try {
        const response = await fetch(`${API_BASE}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(settingsData)
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Settings saved successfully!', 'success');
        } else {
            showFlash('Error: ' + (data.message || 'Failed to save settings'), 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function loadSocialLinks() {
    try {
        const response = await fetch(`${API_BASE}/api/social-links`);
        const links = await response.json();

        const container = document.getElementById('social-links-list');
        if (links.length === 0) {
            container.innerHTML = '<p>No social links added yet</p>';
            return;
        }

        container.innerHTML = links.map(link => `
            <div class="social-link-item" style="background: rgba(255, 255, 255, 0.05); padding: 16px; margin: 12px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4>${link.platform} ${link.is_primary ? '<span style="color: #ff8c00;">⭐ Primary</span>' : ''}</h4>
                    <p><strong>Username:</strong> ${link.username}</p>
                    <p><strong>URL:</strong> <a href="${link.url}" target="_blank" style="color: #ff8c00;">${link.url}</a></p>
                </div>
                <div>
                    <button onclick="editSocialLink(${link.id})" class="btn-edit">✏️ Edit</button>
                    <button onclick="deleteSocialLink(${link.id})" class="btn-delete">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading social links:', error);
        showFlash('Failed to load social links', 'error');
    }
}

function addSocialLink() {
    currentEditingSocialLinkId = null;
    document.getElementById('social-link-modal-title').textContent = 'Add Social Link';
    document.getElementById('social-link-form').reset();
    document.getElementById('social-link-modal').style.display = 'block';
}

async function editSocialLink(linkId) {
    try {
        const response = await fetch(`${API_BASE}/api/social-links`);
        const links = await response.json();
        const link = links.find(l => l.id === linkId);

        if (!link) {
            showFlash('Social link not found', 'error');
            return;
        }

        currentEditingSocialLinkId = linkId;
        document.getElementById('social-link-modal-title').textContent = 'Edit Social Link';
        document.getElementById('social-link-id').value = linkId;
        document.getElementById('social-platform').value = link.platform;
        document.getElementById('social-username').value = link.username;
        document.getElementById('social-url').value = link.url;
        document.getElementById('social-is-primary').checked = link.is_primary;

        document.getElementById('social-link-modal').style.display = 'block';
    } catch (error) {
        console.error('Error loading social link:', error);
        showFlash('Failed to load social link', 'error');
    }
}

async function handleSocialLink(e) {
    e.preventDefault();

    const link = {
        platform: document.getElementById('social-platform').value,
        username: document.getElementById('social-username').value,
        url: document.getElementById('social-url').value,
        is_primary: document.getElementById('social-is-primary').checked
    };

    try {
        let response;
        if (currentEditingSocialLinkId) {
            response = await fetch(`${API_BASE}/api/social-links/${currentEditingSocialLinkId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(link)
            });
        } else {
            response = await fetch(`${API_BASE}/api/social-links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(link)
            });
        }

        const data = await response.json();

        if (data.success) {
            showFlash(currentEditingSocialLinkId ? 'Social link updated!' : 'Social link added!', 'success');
            closeModal();
            loadSocialLinks();
            currentEditingSocialLinkId = null;
        } else {
            showFlash('Error: ' + (data.message || 'Operation failed'), 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function deleteSocialLink(linkId) {
    if (!confirm('Are you sure you want to delete this social link?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/social-links/${linkId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Social link deleted successfully!', 'success');
            loadSocialLinks();
        } else {
            showFlash('Failed to delete social link', 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function loadTerms() {
    try {
        const response = await fetch(`${API_BASE}/api/terms`);
        const data = await response.json();

        if (data.content) {
            document.getElementById('terms-content').value = data.content;
        }
    } catch (error) {
        console.error('Error loading terms:', error);
    }
}

async function updateTerms() {
    const content = document.getElementById('terms-content').value;

    if (!content.trim()) {
        showFlash('Terms & Conditions cannot be empty', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/terms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Terms & Conditions updated successfully!', 'success');
        } else {
            showFlash('Error: ' + (data.message || 'Failed to update terms'), 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function loadBackupHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/backup/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const history = await response.json();

        const container = document.getElementById('backup-history');
        if (history.length === 0) {
            container.innerHTML = '<p>No backups created yet</p>';
            return;
        }

        container.innerHTML = history.map(backup => `
            <div class="backup-item" style="background: rgba(255, 255, 255, 0.05); padding: 12px; margin: 8px 0; border-radius: 8px;">
                <p><strong>Created:</strong> ${new Date(backup.created_at).toLocaleString()}</p>
                <p><strong>File:</strong> ${backup.filename}</p>
                <p><strong>Size:</strong> ${(backup.file_size / 1024).toFixed(2)} KB</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading backup history:', error);
    }
}

async function createBackup() {
    try {
        showFlash('Creating backup...', 'info');
        const response = await fetch(`${API_BASE}/api/backup/create`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Backup created successfully!', 'success');
            loadBackupHistory();
        } else {
            showFlash('Error: ' + (data.message || 'Failed to create backup'), 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

async function saveBackupSettings() {
    const interval = document.getElementById('backup-interval').value;

    try {
        const response = await fetch(`${API_BASE}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ backup_interval: interval })
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Backup schedule updated!', 'success');
        } else {
            showFlash('Error: ' + (data.message || 'Failed to save settings'), 'error');
        }
    } catch (error) {
        showFlash('Error: ' + error.message, 'error');
    }
}

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${section}-section`).classList.add('active');
    currentSection = section;
}

function closeModal() {
    document.getElementById('product-modal').style.display = 'none';
    document.getElementById('capital-modal').style.display = 'none';
    document.getElementById('social-link-modal').style.display = 'none';
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('admin_token');
        showFlash('Logged out successfully', 'success');
        setTimeout(() => location.reload(), 1000);
    }
}

async function exportOrders(format) {
    try {
        showFlash(`Exporting orders as ${format.toUpperCase()}...`, 'info');
        const response = await fetch(`${API_BASE}/api/orders/export?format=${format}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `orders_${new Date().toISOString().split('T')[0]}.${format}`;
            a.click();
            showFlash(`Orders exported successfully!`, 'success');
        } else {
            showFlash('Export functionality not yet implemented on backend', 'error');
        }
    } catch (error) {
        showFlash('Export functionality not yet implemented on backend', 'error');
    }
}