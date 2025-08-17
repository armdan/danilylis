// navbar-loader.js - Shared Navigation Component Loader

// Track if navbar is already loaded
let navbarLoaded = false;

// Function to load the shared navbar
function loadNavbar(callback) {
    // Prevent double loading
    if (navbarLoaded || document.querySelector('.navbar')) {
        console.log('⚠️ Navbar already loaded, skipping...');
        if (typeof callback === 'function') {
            callback();
        }
        return;
    }
    
    console.log('🔄 Loading navbar...');
    navbarLoaded = true; // Mark as loading to prevent duplicates
    
    fetch('/navbar.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            // Insert navbar at the beginning of body
            document.body.insertAdjacentHTML('afterbegin', html);
            
            // Call callback function if provided
            if (typeof callback === 'function') {
                callback();
            }
            
            console.log('✅ Navbar loaded successfully');
            
            // Auto-update user name after navbar is inserted
            setTimeout(() => {
                if (typeof AuthManager !== 'undefined') {
                    const user = AuthManager.getUser();
                    if (user && user.firstName && user.lastName) {
                        const userNameElement = document.getElementById('userName');
                        if (userNameElement) {
                            userNameElement.textContent = `${user.firstName} ${user.lastName}`;
                            console.log('🎯 Auto-updated navbar user:', `${user.firstName} ${user.lastName}`);
                        }
                    }
                }
            }, 50);
        })
        .catch(error => {
            console.error('❌ Error loading navbar:', error);
            navbarLoaded = false; // Reset on error so it can be retried
            // Fallback: show a basic message
            document.body.insertAdjacentHTML('afterbegin', 
                '<div class="alert alert-danger">Navigation failed to load</div>'
            );
        });
}

// Auto-load navbar when DOM is ready (if not manually called)
document.addEventListener('DOMContentLoaded', function() {
    // Only auto-load if navbar doesn't already exist and hasn't been loaded
    if (!navbarLoaded && !document.querySelector('.navbar')) {
        loadNavbar();
    }
});