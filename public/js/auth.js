// Authentication utilities for frontend
const AuthManager = {
    // Check if user is authenticated
    isAuthenticated() {
        const token = localStorage.getItem('authToken');
        return token !== null && token.trim() !== '';
    },

    // Get stored token
    getToken() {
        return localStorage.getItem('authToken');
    },

    // Get user data
    getUser() {
        const userData = localStorage.getItem('user');
        return userData ? JSON.parse(userData) : null;
    },

    // Set auth headers for AJAX requests
    getAuthHeaders() {
        const token = this.getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    // Logout user
    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        window.location.replace('/');
    },

    // Check if user has specific role
    hasRole(roles) {
        const user = this.getUser();
        if (!user) return false;
        
        if (Array.isArray(roles)) {
            return roles.includes(user.role);
        }
        return user.role === roles;
    },

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.replace('/');
            return false;
        }
        return true;
    }
};

// REMOVED global variables that were causing conflicts
// These should be defined locally in each page that needs them

// Setup AJAX defaults when document is ready
$(document).ready(function() {
    // Add auth headers to all AJAX requests
    $.ajaxSetup({
        beforeSend: function(xhr) {
            const headers = AuthManager.getAuthHeaders();
            if (headers.Authorization) {
                xhr.setRequestHeader('Authorization', headers.Authorization);
            }
        }
    });

    // Handle 401 responses globally
    $(document).ajaxError(function(event, xhr, settings) {
        if (xhr.status === 401) {
            AuthManager.logout();
        }
    });
});

// Global logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        AuthManager.logout();
    }
}

// Check authentication - simpler version
function checkAuth() {
    if (!AuthManager.isAuthenticated()) {
        console.log('User not authenticated, redirecting to login...');
        window.location.href = '/login';
        return false;
    }
    return true;
}

// Update navbar user name (safe version with retries)
function updateNavbarUser() {
    const user = AuthManager.getUser();
    if (user && user.firstName && user.lastName) {
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = `${user.firstName} ${user.lastName}`;
            console.log('✅ Updated navbar user name:', `${user.firstName} ${user.lastName}`);
        } else {
            console.log('⚠️ userName element not found, will retry...');
            // Retry after navbar loads
            setTimeout(() => {
                const retryElement = document.getElementById('userName');
                if (retryElement && user.firstName && user.lastName) {
                    retryElement.textContent = `${user.firstName} ${user.lastName}`;
                    console.log('✅ Retry successful - updated navbar user');
                } else {
                    console.log('❌ Could not find userName element after retry');
                }
            }, 500);
        }
    } else {
        console.log('⚠️ User data not available for navbar update');
    }
}

// Alternative function that's more aggressive with retries
function forceUpdateNavbarUser() {
    let attempts = 0;
    const maxAttempts = 10;
    
    const tryUpdate = () => {
        attempts++;
        const user = AuthManager.getUser();
        const userNameElement = document.getElementById('userName');
        
        if (user && user.firstName && user.lastName && userNameElement) {
            userNameElement.textContent = `${user.firstName} ${user.lastName}`;
            console.log(`✅ Updated navbar user (attempt ${attempts}):`, `${user.firstName} ${user.lastName}`);
            return true;
        }
        
        if (attempts < maxAttempts) {
            console.log(`⏳ Navbar update attempt ${attempts}/${maxAttempts}...`);
            setTimeout(tryUpdate, 200);
        } else {
            console.log('❌ Failed to update navbar user after', maxAttempts, 'attempts');
        }
    };
    
    tryUpdate();
}

// Initialize profile modal with user data
function initializeProfileModal() {
    console.log('🔄 Initializing profile modal...');
    if (typeof AuthManager !== 'undefined') {
        const user = AuthManager.getUser();
        if (user) {
            const firstNameEl = document.getElementById('profileFirstName');
            const lastNameEl = document.getElementById('profileLastName');
            const emailEl = document.getElementById('profileEmail');
            const phoneEl = document.getElementById('profilePhone');
            const roleEl = document.getElementById('profileRole');
            const departmentEl = document.getElementById('profileDepartment');
            
            if (firstNameEl) firstNameEl.value = user.firstName || '';
            if (lastNameEl) lastNameEl.value = user.lastName || '';
            if (emailEl) emailEl.value = user.email || '';
            if (phoneEl) phoneEl.value = user.phone || '';
            if (roleEl) roleEl.value = (user.role || '').replace('_', ' ').toUpperCase();
            if (departmentEl) departmentEl.value = (user.department || '').toUpperCase();
            
            console.log('✅ Profile modal initialized with user data:', user.firstName, user.lastName);
        } else {
            console.log('⚠️ No user data available for profile modal');
        }
    } else {
        console.log('⚠️ AuthManager not available for profile modal');
    }
}

// Initialize settings modal
function initializeSettingsModal() {
    console.log('🔄 Initializing settings modal...');
    // Load saved settings from localStorage
    const theme = localStorage.getItem('app_theme') || 'light';
    const notifications = localStorage.getItem('app_notifications') !== 'false';
    
    const themeEl = document.getElementById('themeSelect');
    const notificationsEl = document.getElementById('notificationsEnabled');
    
    if (themeEl) themeEl.value = theme;
    if (notificationsEl) notificationsEl.checked = notifications;
    
    console.log('✅ Settings modal initialized');
}

function updateProfile() {
    const profileData = {
        firstName: document.getElementById('profileFirstName').value,
        lastName: document.getElementById('profileLastName').value,
        email: document.getElementById('profileEmail').value,
        phone: document.getElementById('profilePhone').value
    };

    fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...AuthManager.getAuthHeaders()
        },
        body: JSON.stringify(profileData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.user) {
            // Update stored user data
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Update navbar user name
            forceUpdateNavbarUser();
            
            $('#profileModal').modal('hide');
            
            // Show success message
            if (typeof showAlert === 'function') {
                showAlert('success', 'Profile updated successfully');
            } else {
                alert('Profile updated successfully');
            }
        }
    })
    .catch(error => {
        console.error('Error updating profile:', error);
        if (typeof showAlert === 'function') {
            showAlert('error', 'Failed to update profile');
        } else {
            alert('Failed to update profile');
        }
    });
}

// Save settings function for navbar
function saveSettings() {
    const theme = document.getElementById('themeSelect').value;
    const notifications = document.getElementById('notificationsEnabled').checked;
    
    // Save to localStorage
    localStorage.setItem('app_theme', theme);
    localStorage.setItem('app_notifications', notifications);
    
    // Apply theme immediately
    applyTheme(theme);
    
    $('#settingsModal').modal('hide');
    
    if (typeof showAlert === 'function') {
        showAlert('success', 'Settings saved successfully');
    } else {
        alert('Settings saved successfully');
    }
}

// Apply theme function
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// Utility functions that can be used globally
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US');
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-US');
}

function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

function capitalizeFirst(str) {
    if (!str) return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showAlert(type, message) {
    console.log('Showing alert:', type, message);
    
    // Try to find alertContainer, if not found, create one or use fallback
    let alertContainer = document.getElementById('alertContainer');
    
    if (!alertContainer) {
        // Look for alternative containers
        alertContainer = document.querySelector('.main-content') || 
                        document.querySelector('.container-fluid') ||
                        document.body;
        
        if (alertContainer) {
            // Create a temporary alert container
            const tempContainer = document.createElement('div');
            tempContainer.id = 'tempAlertContainer';
            tempContainer.style.position = 'fixed';
            tempContainer.style.top = '80px';
            tempContainer.style.right = '20px';
            tempContainer.style.zIndex = '9999';
            tempContainer.style.maxWidth = '400px';
            alertContainer.appendChild(tempContainer);
            alertContainer = tempContainer;
        } else {
            // Fallback to browser alert
            alert(`${type.toUpperCase()}: ${message}`);
            return;
        }
    }
    
    const alertClass = type === 'error' ? 'danger' : type;
    
    const alertHtml = `
        <div class="alert alert-${alertClass} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        </div>
    `;
    
    alertContainer.innerHTML = alertHtml;
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        $('.alert').alert('close');
    }, 5000);
}

// Apply saved theme on page load
$(document).ready(function() {
    const savedTheme = localStorage.getItem('app_theme') || 'light';
    applyTheme(savedTheme);
    
    // Set up modal event handlers when DOM is ready
    setTimeout(() => {
        const profileModal = document.getElementById('profileModal');
        const settingsModal = document.getElementById('settingsModal');
        
        if (profileModal) {
            $(profileModal).on('show.bs.modal', function() {
                console.log('🔄 Profile modal opening...');
                initializeProfileModal();
            });
            console.log('✅ Profile modal event handler set up');
        }
        
        if (settingsModal) {
            $(settingsModal).on('show.bs.modal', function() {
                console.log('🔄 Settings modal opening...');
                initializeSettingsModal();
            });
            console.log('✅ Settings modal event handler set up');
        }
    }, 1000); // Wait 1 second for navbar to load
});