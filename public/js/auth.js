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

// Global variables for patients page
let currentPage = 1;
let currentSearch = '';
let currentFilters = {};
let currentPatientId = null;

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

// Show add patient modal
function showAddPatientModal() {
    console.log('showAddPatientModal called');
    currentPatientId = null;
    document.getElementById('patientModalTitle').textContent = 'Add New Patient';
    document.getElementById('patientForm').reset();
    document.getElementById('patientId').value = '';
    $('#patientModal').modal('show');
}

// Search patients
function searchPatients() {
    currentPage = 1;
    loadPatients(1);
}

// Filter patients
function filterPatients() {
    currentPage = 1;
    loadPatients(1);
}

// Clear filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('genderFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('limitSelect').value = '10';
    loadPatients(1);
}

// Load patients with pagination
async function loadPatients(page = 1) {
    try {
        const limit = $('#limitSelect').val() || 10;
        const search = $('#searchInput').val();
        const gender = $('#genderFilter').val();
        const isActive = $('#statusFilter').val();

        let url = `/api/patients?page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (gender) url += `&gender=${gender}`;
        if (isActive !== '') url += `&isActive=${isActive}`;

        console.log('Loading patients from:', url);

        const response = await fetch(url, {
            headers: AuthManager.getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.log('Unauthorized, redirecting to login...');
                AuthManager.logout();
                return;
            }
            throw new Error(`Failed to load patients: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Loaded patients:', data);
        
        displayPatients(data.patients);
        updatePagination(data.pagination);
        updatePatientCount(data.pagination.total);
        currentPage = page;

    } catch (error) {
        console.error('Error loading patients:', error);
        showAlert('error', 'Failed to load patients: ' + error.message);
    }
}

// Display patients in table
function displayPatients(patients) {
    console.log('Displaying patients:', patients.length);
    const tbody = document.getElementById('patientsTableBody');
    
    if (patients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    <i class="fas fa-users"></i><br>
                    No patients found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = patients.map(patient => {
        // Safely handle potentially undefined values
        const patientId = patient.patientId || 'N/A';
        const firstName = patient.firstName || '';
        const lastName = patient.lastName || '';
        const dateOfBirth = patient.dateOfBirth ? formatDate(patient.dateOfBirth) : 'N/A';
        const gender = patient.gender || 'unknown';
        const phone = patient.phone || 'N/A';
        const email = patient.email || null;
        const isActive = patient.isActive !== undefined ? patient.isActive : true;
        
        return `
            <tr>
                <td><strong>${patientId}</strong></td>
                <td><strong>${firstName} ${lastName}</strong></td>
                <td>${dateOfBirth}</td>
                <td>
                    <span class="badge badge-${getGenderBadgeClass(gender)}">
                        ${capitalizeFirst(gender)}
                    </span>
                </td>
                <td><a href="tel:${phone}" class="text-decoration-none">${phone}</a></td>
                <td>${email ? `<a href="mailto:${email}" class="text-decoration-none">${email}</a>` : '<span class="text-muted">-</span>'}</td>
                <td>
                    <span class="badge badge-${isActive ? 'success' : 'secondary'}">
                        ${isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewPatientDetails('${patient._id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-success" onclick="editPatient('${patient._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="viewPatientOrders('${patient._id}')" title="View Orders">
                            <i class="fas fa-clipboard-list"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Save patient
async function savePatient() {
    console.log('Saving patient...');
    try {
        const form = document.getElementById('patientForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const patientData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            dateOfBirth: document.getElementById('dateOfBirth').value,
            gender: document.getElementById('gender').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value || undefined,
            address: {
                street: document.getElementById('street').value || undefined,
                city: document.getElementById('city').value || undefined,
                state: document.getElementById('state').value || undefined,
                zipCode: document.getElementById('zipCode').value || undefined
            },
            emergencyContact: {
                name: document.getElementById('emergencyContactName').value || undefined,
                phone: document.getElementById('emergencyContactPhone').value || undefined,
                relationship: document.getElementById('emergencyContactRelationship').value || undefined
            }
        };

        // Clean up empty objects
        if (!patientData.address.street && !patientData.address.city && !patientData.address.state && !patientData.address.zipCode) {
            delete patientData.address;
        }
        if (!patientData.emergencyContact.name && !patientData.emergencyContact.phone && !patientData.emergencyContact.relationship) {
            delete patientData.emergencyContact;
        }

        console.log('Patient data to save:', patientData);

        const isEdit = currentPatientId !== null;
        const url = isEdit ? `/api/patients/${currentPatientId}` : '/api/patients';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...AuthManager.getAuthHeaders()
            },
            body: JSON.stringify(patientData)
        });

        console.log('Save response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Save error response:', errorData);
            throw new Error(errorData.message || 'Failed to save patient');
        }

        const result = await response.json();
        console.log('Patient saved successfully:', result);

        $('#patientModal').modal('hide');
        showAlert('success', isEdit ? 'Patient updated successfully' : 'Patient created successfully');
        loadPatients(currentPage);

    } catch (error) {
        console.error('Error saving patient:', error);
        showAlert('error', error.message);
    }
}

// Edit patient
async function editPatient(patientId) {
    try {
        console.log('Editing patient:', patientId);
        const response = await fetch(`/api/patients/${patientId}`, {
            headers: AuthManager.getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load patient');
        }

        const data = await response.json();
        const patient = data.patient;

        // Populate form
        currentPatientId = patientId;
        document.getElementById('patientModalTitle').textContent = 'Edit Patient';
        document.getElementById('patientId').value = patient._id;
        document.getElementById('firstName').value = patient.firstName;
        document.getElementById('lastName').value = patient.lastName;
        document.getElementById('dateOfBirth').value = patient.dateOfBirth.split('T')[0];
        document.getElementById('gender').value = patient.gender;
        document.getElementById('phone').value = patient.phone;
        document.getElementById('email').value = patient.email || '';
        
        // Address
        if (patient.address) {
            document.getElementById('street').value = patient.address.street || '';
            document.getElementById('city').value = patient.address.city || '';
            document.getElementById('state').value = patient.address.state || '';
            document.getElementById('zipCode').value = patient.address.zipCode || '';
        }

        // Emergency contact
        if (patient.emergencyContact) {
            document.getElementById('emergencyContactName').value = patient.emergencyContact.name || '';
            document.getElementById('emergencyContactPhone').value = patient.emergencyContact.phone || '';
            document.getElementById('emergencyContactRelationship').value = patient.emergencyContact.relationship || '';
        }

        $('#patientModal').modal('show');

    } catch (error) {
        console.error('Error loading patient:', error);
        showAlert('error', 'Failed to load patient details');
    }
}

// View patient details
async function viewPatientDetails(patientId) {
    try {
        console.log('Viewing patient details:', patientId);
        currentPatientId = patientId;
        const response = await fetch(`/api/patients/${patientId}`, {
            headers: AuthManager.getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load patient details');
        }

        const data = await response.json();
        const patient = data.patient;

        const detailsHtml = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Personal Information</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Patient ID:</strong></td><td>${patient.patientId}</td></tr>
                        <tr><td><strong>Name:</strong></td><td>${patient.firstName} ${patient.lastName}</td></tr>
                        <tr><td><strong>Date of Birth:</strong></td><td>${formatDate(patient.dateOfBirth)}</td></tr>
                        <tr><td><strong>Age:</strong></td><td>${calculateAge(patient.dateOfBirth)} years</td></tr>
                        <tr><td><strong>Gender:</strong></td><td>${capitalizeFirst(patient.gender)}</td></tr>
                        <tr><td><strong>Phone:</strong></td><td><a href="tel:${patient.phone}">${patient.phone}</a></td></tr>
                        <tr><td><strong>Email:</strong></td><td>${patient.email ? `<a href="mailto:${patient.email}">${patient.email}</a>` : 'Not provided'}</td></tr>
                        <tr><td><strong>Status:</strong></td><td><span class="badge badge-${patient.isActive ? 'success' : 'secondary'}">${patient.isActive ? 'Active' : 'Inactive'}</span></td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>Address</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Street:</strong></td><td>${patient.address?.street || 'Not provided'}</td></tr>
                        <tr><td><strong>City:</strong></td><td>${patient.address?.city || 'Not provided'}</td></tr>
                        <tr><td><strong>State:</strong></td><td>${patient.address?.state || 'Not provided'}</td></tr>
                        <tr><td><strong>ZIP Code:</strong></td><td>${patient.address?.zipCode || 'Not provided'}</td></tr>
                    </table>
                    
                    <h6 class="mt-4">Emergency Contact</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Name:</strong></td><td>${patient.emergencyContact?.name || 'Not provided'}</td></tr>
                        <tr><td><strong>Phone:</strong></td><td>${patient.emergencyContact?.phone ? `<a href="tel:${patient.emergencyContact.phone}">${patient.emergencyContact.phone}</a>` : 'Not provided'}</td></tr>
                        <tr><td><strong>Relationship:</strong></td><td>${patient.emergencyContact?.relationship || 'Not provided'}</td></tr>
                    </table>
                </div>
            </div>
            
            <div class="row mt-4">
                <div class="col-12">
                    <h6>Account Information</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Created:</strong></td><td>${formatDateTime(patient.createdAt)}</td></tr>
                        <tr><td><strong>Created By:</strong></td><td>${patient.createdBy ? `${patient.createdBy.firstName} ${patient.createdBy.lastName}` : 'System'}</td></tr>
                        <tr><td><strong>Last Updated:</strong></td><td>${formatDateTime(patient.updatedAt)}</td></tr>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('patientDetailsContent').innerHTML = detailsHtml;
        $('#patientDetailsModal').modal('show');

    } catch (error) {
        console.error('Error loading patient details:', error);
        showAlert('error', 'Failed to load patient details');
    }
}

// View patient orders
function viewPatientOrders(patientId) {
    console.log('Viewing orders for patient:', patientId);
    window.location.href = `/orders?patient=${patientId}`;
}

// Edit patient from details modal
function editPatientFromDetails() {
    $('#patientDetailsModal').modal('hide');
    setTimeout(() => {
        editPatient(currentPatientId);
    }, 300);
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

// Utility functions
function updatePagination(pagination) {
    const paginationEl = document.getElementById('pagination');
    
    if (pagination.pages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    let html = '';
    
    // Previous button
    html += `
        <li class="page-item ${pagination.current === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="loadPatients(${pagination.current - 1})">Previous</a>
        </li>
    `;

    // Page numbers
    for (let i = 1; i <= pagination.pages; i++) {
        if (i === pagination.current) {
            html += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
        } else if (i === 1 || i === pagination.pages || (i >= pagination.current - 2 && i <= pagination.current + 2)) {
            html += `<li class="page-item"><a class="page-link" href="#" onclick="loadPatients(${i})">${i}</a></li>`;
        } else if (i === pagination.current - 3 || i === pagination.current + 3) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    // Next button
    html += `
        <li class="page-item ${pagination.current === pagination.pages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="loadPatients(${pagination.current + 1})">Next</a>
        </li>
    `;

    paginationEl.innerHTML = html;
}

function updatePatientCount(total) {
    document.getElementById('patientCount').textContent = total;
}

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

function getGenderBadgeClass(gender) {
    if (!gender) return 'secondary';
    switch (gender.toLowerCase()) {
        case 'male': return 'primary';
        case 'female': return 'info';
        default: return 'secondary';
    }
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