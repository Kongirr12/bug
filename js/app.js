// Utility function for formatting currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
};

// UI State 
let chartInstance = null;

// DOM Elements
const elements = {
    loader: document.getElementById('global-loader'),
    loginScreen: document.getElementById('login-screen'),
    appContainer: document.getElementById('app-container'),
    loginForm: document.getElementById('loginForm'),
    logoutBtn: document.getElementById('logout-btn'),
    menuItems: document.querySelectorAll('.menu-item'),
    menuLabels: document.querySelectorAll('.menu-label'),
    viewSections: document.querySelectorAll('.view-section'),
    userName: document.getElementById('user-name'),
    userRole: document.getElementById('user-role'),
    userAvatar: document.getElementById('user-avatar')
};

// Show/Hide Loader
const showLoader = () => elements.loader.classList.add('active');
const hideLoader = () => elements.loader.classList.remove('active');

// View Routing
const switchView = (viewId) => {
    // Update menu active state
    elements.menuItems.forEach(item => {
        if (item.dataset.view === viewId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Show selected view
    elements.viewSections.forEach(section => {
        if (section.id === `view-${viewId}`) {
            section.classList.remove('hidden');
            if (viewId === 'dashboard') {
                loadDashboardData();
            }
        } else {
            section.classList.add('hidden');
        }
    });
};

// Setup Event Listeners
const setupEventListeners = () => {
    // Login
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        showLoader();
        try {
            const result = await API.login(username, password);
            if (result.success) {
                // Set user info
                elements.userName.textContent = result.user.name;
                elements.userRole.textContent = result.user.role;
                elements.userAvatar.textContent = result.user.name.charAt(0);
                
                // Hide login, show app
                elements.loginScreen.style.display = 'none';
                elements.appContainer.classList.remove('hidden');
                
                // Enforce Roles
                setupRoles(result.user.role);
                
                // Init dashboard
                switchView('dashboard');
                
                Swal.fire({
                    icon: 'success',
                    title: 'เข้าสู่ระบบสำเร็จ',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: result.message
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถเชื่อมต่อระบบได้',
                text: err.message
            });
        } finally {
            hideLoader();
        }
    });

    // Logout
    elements.logoutBtn.addEventListener('click', () => {
        Swal.fire({
            title: 'ต้องการออกจากระบบ?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ออกจากระบบ',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                elements.appContainer.classList.add('hidden');
                elements.loginScreen.style.display = 'flex';
                document.getElementById('password').value = '';
            }
        });
    });

    // Menu Navigation
    elements.menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            if (view) {
                switchView(view);
            }
        });
    });
};

// Dashboard Data Loading
const loadDashboardData = async () => {
    showLoader();
    try {
        const data = await API.getDashboardData();
        
        // Update KPIs
        document.getElementById('dash-total-budget').textContent = formatCurrency(data.totalBudget);
        document.getElementById('dash-used-budget').textContent = formatCurrency(data.usedBudget);
        document.getElementById('dash-pending-budget').textContent = formatCurrency(data.pendingBudget);
        document.getElementById('dash-remain-budget').textContent = formatCurrency(data.remainBudget);
        
        // Render Chart
        renderBudgetChart(data.chartData);
        
        // Render Recent Projects
        const tbody = document.getElementById('dash-recent-projects');
        tbody.innerHTML = '';
        data.recentProjects.forEach(proj => {
            const tr = document.createElement('tr');
            
            let statusBadge = 'badge-primary';
            if (proj.status === 'อนุมัติ') statusBadge = 'badge-success';
            if (proj.status === 'รอตรวจสอบ') statusBadge = 'badge-warning';
            
            tr.innerHTML = `
                <td><strong>${proj.name}</strong><br><small class="text-muted">${proj.id}</small></td>
                <td>${proj.owner}</td>
                <td><span class="badge ${statusBadge}">${proj.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error("Dashboard error", error);
        Swal.fire({
            icon: 'error',
            title: 'ไม่สามารถโหลดข้อมูลได้',
            toast: true,
            position: 'top-end'
        });
    } finally {
        hideLoader();
    }
};

// Chart Rendering
const renderBudgetChart = (chartData) => {
    const ctx = document.getElementById('budgetChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: "'Prompt', sans-serif" }
                    }
                }
            },
            cutout: '70%',
            borderWidth: 0
        }
    });
};

// Role-Based Access Control
const setupRoles = (userRole) => {
    // Check menu items
    elements.menuItems.forEach(item => {
        const allowedRoles = item.getAttribute('data-roles');
        if (allowedRoles) {
            if (allowedRoles.includes(userRole) || userRole === 'admin') {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        }
    });

    // Check menu labels
    elements.menuLabels.forEach(label => {
        const allowedRoles = label.getAttribute('data-roles');
        if (allowedRoles) {
            if (allowedRoles.includes(userRole) || userRole === 'admin') {
                label.style.display = 'block';
            } else {
                label.style.display = 'none';
            }
        }
    });
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});
