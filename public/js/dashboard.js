// Enhanced Dashboard JavaScript
$(document).ready(function() {
    console.log('Dashboard loading...');
    
    // Check authentication
    if (!AuthManager.isAuthenticated()) {
        console.log('User not authenticated, redirecting to login...');
        window.location.href = '/';
        return;
    }

    // Initialize dashboard
    try {
        initializeDashboard();
        loadDashboardData();
        setupEventHandlers();
        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error loading dashboard', 'danger');
    }
});

function initializeDashboard() {
    const user = AuthManager.getUser();
    
    if (user) {
        try {
            $('#userName').text(`${user.firstName} ${user.lastName}`);
            $('#welcomeUserName').text(user.firstName);
            
            // Populate profile modal if it exists
            $('#profileFirstName').val(user.firstName);
            $('#profileLastName').val(user.lastName);
            $('#profileEmail').val(user.email);
            $('#profilePhone').val(user.phone || '');
            $('#profileRole').val((user.role || '').replace('_', ' ').toUpperCase());
            $('#profileDepartment').val((user.department || '').toUpperCase());
            
            // Show/hide quick actions based on role
            $('.quick-action-btn').each(function() {
                const allowedRoles = $(this).data('role');
                if (allowedRoles) {
                    const roles = allowedRoles.toString().split(',');
                    if (!roles.includes(user.role)) {
                        $(this).hide();
                    }
                }
            });
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
}

function loadDashboardData() {
    loadStatistics();
    loadRecentOrders();
    loadAlerts();
}

function loadStatistics() {
    $.ajax({
        url: '/api/dashboard/statistics',
        method: 'GET',
        headers: AuthManager.getAuthHeaders(),
        success: function(response) {
            $('#totalPatients').text(response.totalPatients || 0);
            $('#pendingOrders').text(response.pendingOrders || 0);
            $('#completedTests').text(response.completedTests || 0);
            $('#criticalResults').text(response.criticalResults || 0);
        },
        error: function(xhr) {
            console.error('Error loading statistics:', xhr);
            // Set default values on error
            $('#totalPatients').text('0');
            $('#pendingOrders').text('0');
            $('#completedTests').text('0');
            $('#criticalResults').text('0');
            
            if (xhr.status === 401) {
                AuthManager.logout();
            }
        }
    });
}

function loadRecentOrders() {
    $.ajax({
        url: '/api/orders?limit=5&sort=-createdAt',
        method: 'GET',
        headers: AuthManager.getAuthHeaders(),
        success: function(response) {
            const tbody = $('#recentOrdersTable tbody');
            tbody.empty();
            
            if (response.orders && response.orders.length > 0) {
                response.orders.forEach(order => {
                    const row = createOrderRow(order);
                    tbody.append(row);
                });
            } else {
                tbody.append(`
                    <tr>
                        <td colspan="5" class="text-center text-muted">
                            No recent orders found
                        </td>
                    </tr>
                `);
            }
        },
        error: function(xhr) {
            console.error('Error loading recent orders:', xhr);
            $('#recentOrdersTable tbody').html(`
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        Error loading recent orders
                    </td>
                </tr>
            `);
            
            if (xhr.status === 401) {
                AuthManager.logout();
            }
        }
    });
}

function createOrderRow(order) {
    const statusClass = getStatusClass(order.status);
    const formattedDate = new Date(order.createdAt).toLocaleDateString();
    const testCount = order.tests ? order.tests.length : 0;
    
    return `
        <tr>
            <td>
                <a href="/orders?id=${order._id}" class="text-primary">
                    ${order.orderNumber || 'N/A'}
                </a>
            </td>
            <td>
                ${order.patient ? (order.patient.firstName + ' ' + order.patient.lastName) : 'Unknown'}
            </td>
            <td>
                <span class="badge badge-info">${testCount} test${testCount !== 1 ? 's' : ''}</span>
            </td>
            <td>
                <span class="badge ${statusClass}">${(order.status || 'unknown').toUpperCase()}</span>
            </td>
            <td>${formattedDate}</td>
        </tr>
    `;
}

function getStatusClass(status) {
    const statusClasses = {
        'pending': 'badge-pending',
        'completed': 'badge-completed',
        'cancelled': 'badge-cancelled',
        'partial': 'badge-partial',
        'processing': 'badge-processing'
    };
    return statusClasses[status] || 'badge-secondary';
}

function loadAlerts() {
    $.ajax({
        url: '/api/dashboard/alerts',
        method: 'GET',
        headers: AuthManager.getAuthHeaders(),
        success: function(response) {
            const container = $('#alertsContainer');
            
            if (response.alerts && response.alerts.length > 0) {
                container.empty();
                response.alerts.forEach(alert => {
                    const alertHtml = `
                        <div class="alert alert-${alert.type} alert-dismissible fade show">
                            <i class="fas fa-${getAlertIcon(alert.type)}"></i>
                            ${alert.message}
                            <button type="button" class="close" data-dismiss="alert">
                                <span>&times;</span>
                            </button>
                        </div>
                    `;
                    container.append(alertHtml);
                });
            }
        },
        error: function(xhr) {
            console.error('Error loading alerts:', xhr);
            if (xhr.status === 401) {
                AuthManager.logout();
            }
        }
    });
}

function getAlertIcon(type) {
    const icons = {
        'info': 'info-circle',
        'warning': 'exclamation-triangle',
        'danger': 'exclamation-circle',
        'success': 'check-circle'
    };
    return icons[type] || 'info-circle';
}

function setupEventHandlers() {
    // Refresh dashboard data every 5 minutes
    setInterval(loadDashboardData, 5 * 60 * 1000);
    
    // Manual refresh button (if exists)
    $('#refreshDashboard').on('click', function() {
        loadDashboardData();
        showNotification('Dashboard refreshed', 'success');
    });
}

function updateProfile() {
    const profileData = {
        firstName: $('#profileFirstName').val(),
        lastName: $('#profileLastName').val(),
        email: $('#profileEmail').val(),
        phone: $('#profilePhone').val()
    };

    $.ajax({
        url: '/api/auth/profile',
        method: 'PUT',
        headers: AuthManager.getAuthHeaders(),
        contentType: 'application/json',
        data: JSON.stringify(profileData),
        success: function(response) {
            // Update stored user data
            localStorage.setItem('user', JSON.stringify(response.user));
            
            // Update UI
            $('#userName').text(`${response.user.firstName} ${response.user.lastName}`);
            $('#welcomeUserName').text(response.user.firstName);
            
            $('#profileModal').modal('hide');
            showNotification('Profile updated successfully', 'success');
        },
        error: function(xhr) {
            console.error('Error updating profile:', xhr);
            const response = xhr.responseJSON;
            const message = response?.message || 'Error updating profile';
            showNotification(message, 'danger');
            
            if (xhr.status === 401) {
                AuthManager.logout();
            }
        }
    });
}

function showNotification(message, type) {
    const notification = `
        <div class="alert alert-${type} alert-dismissible fade show" style="position: fixed; top: 100px; right: 20px; z-index: 9999;">
            ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        </div>
    `;
    
    $('body').append(notification);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        $('.alert').last().alert('close');
    }, 3000);
}