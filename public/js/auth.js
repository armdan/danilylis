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