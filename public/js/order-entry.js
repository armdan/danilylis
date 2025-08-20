// public/js/order-entry.js
const OrderEntry = {
    selectedPatient: null,
    selectedOffice: null,
    selectedDoctor: null,
    selectedTests: new Map(),
    allTests: [],

    init() {

        this.setCurrentDateTime();
        this.loadTests();
        this.setupEventListeners();
        this.setupModals();
        
        // Load navbar if not already loaded by HTML
    },

    // Remove checkAuth() function entirely - not needed

    setCurrentDateTime() {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        now.setMinutes(now.getMinutes() - offset);
        document.getElementById('orderDateTime').value = now.toISOString().slice(0, 16);
    },

    setupModals() {
        this.newPatientModal = new bootstrap.Modal(document.getElementById('newPatientModal'));
        this.newOfficeModal = new bootstrap.Modal(document.getElementById('newOfficeModal'));
        this.newDoctorModal = new bootstrap.Modal(document.getElementById('newDoctorModal'));
    },

    setupEventListeners() {
        // Patient search
        const patientSearch = document.getElementById('patientSearch');
        let patientTimeout;
        patientSearch.addEventListener('input', (e) => {
            clearTimeout(patientTimeout);
            patientTimeout = setTimeout(() => this.searchPatients(e.target.value), 300);
        });

        document.getElementById('newPatientBtn').addEventListener('click', () => {
            this.newPatientModal.show();
        });

        document.getElementById('createPatientBtn').addEventListener('click', () => {
            this.createNewPatient();
        });

        document.getElementById('clearPatientBtn').addEventListener('click', () => {
            this.clearPatient();
        });

        // Office search
        const officeSearch = document.getElementById('officeSearch');
        let officeTimeout;
        officeSearch.addEventListener('input', (e) => {
            clearTimeout(officeTimeout);
            officeTimeout = setTimeout(() => this.searchOffices(e.target.value), 300);
        });

        document.getElementById('createOfficeBtn').addEventListener('click', () => {
            this.createNewOffice();
        });

        // Doctor search
        const doctorSearch = document.getElementById('doctorSearch');
        let doctorTimeout;
        doctorSearch.addEventListener('input', (e) => {
            clearTimeout(doctorTimeout);
            doctorTimeout = setTimeout(() => this.searchDoctors(e.target.value), 300);
        });

        document.getElementById('createDoctorBtn').addEventListener('click', () => {
            this.createNewDoctor();
        });

        // Test search
        const testSearch = document.getElementById('testSearch');
        testSearch.addEventListener('input', (e) => {
            this.filterTests(e.target.value);
        });

        document.getElementById('clearTestSearch').addEventListener('click', () => {
            testSearch.value = '';
            this.filterTests('');
        });

        // Order actions
        document.getElementById('saveOrderBtn').addEventListener('click', () => {
            this.saveOrder(false);
        });

        document.getElementById('saveAndPrintBtn').addEventListener('click', () => {
            this.saveOrder(true);
        });

        document.getElementById('cancelOrderBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel this order?')) {
                window.location.href = '/orders';
            }
        });

        // Priority change
        document.getElementById('orderPriority').addEventListener('change', (e) => {
            this.updatePriorityDisplay(e.target.value);
        });

        // Click outside to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.position-relative')) {
                document.querySelectorAll('.autocomplete-dropdown').forEach(d => {
                    d.style.display = 'none';
                });
            }
        });
    },

    async searchPatients(query) {
        if (query.length < 2) {
            document.getElementById('patientDropdown').style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=10`, {
                headers: AuthManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.showPatientDropdown(data.patients);
            }
        } catch (error) {
            console.error('Error searching patients:', error);
        }
    },

    showPatientDropdown(patients) {
        const dropdown = document.getElementById('patientDropdown');
        
        if (patients.length === 0) {
            dropdown.innerHTML = `
                <div class="p-3 text-muted">No patients found</div>
                <div class="create-new-btn" onclick="OrderEntry.newPatientModal.show()">
                    <i class="fas fa-plus me-2"></i>Create New Patient
                </div>
            `;
        } else {
            dropdown.innerHTML = patients.map(p => `
                <div class="autocomplete-item" onclick="OrderEntry.selectPatient('${p._id}')">
                    <div><strong>${p.firstName} ${p.lastName}</strong></div>
                    <div class="text-muted small">
                        ID: ${p.patientId} | DOB: ${new Date(p.dateOfBirth).toLocaleDateString()} | 
                        Phone: ${p.phone || 'N/A'}
                    </div>
                </div>
            `).join('') + `
                <div class="create-new-btn" onclick="OrderEntry.newPatientModal.show()">
                    <i class="fas fa-plus me-2"></i>Create New Patient
                </div>
            `;
        }
        
        dropdown.style.display = 'block';
    },

    async selectPatient(patientId) {
        try {
            const response = await fetch(`/api/patients/${patientId}`, {
                headers: AuthManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.selectedPatient = data.patient;
                this.displaySelectedPatient();
                document.getElementById('patientDropdown').style.display = 'none';
                document.getElementById('patientSearch').value = '';
                this.checkOrderReady();
            }
        } catch (error) {
            console.error('Error selecting patient:', error);
        }
    },

    displaySelectedPatient() {
        if (!this.selectedPatient) return;
        
        document.getElementById('selectedPatientInfo').style.display = 'block';
        document.getElementById('patientName').textContent = 
            `${this.selectedPatient.firstName} ${this.selectedPatient.lastName}`;
        document.getElementById('patientId').textContent = this.selectedPatient.patientId;
        document.getElementById('patientDob').textContent = 
            new Date(this.selectedPatient.dateOfBirth).toLocaleDateString();
    },

    clearPatient() {
        this.selectedPatient = null;
        document.getElementById('selectedPatientInfo').style.display = 'none';
        document.getElementById('patientSearch').value = '';
        this.checkOrderReady();
    },

    async createNewPatient() {
        const patientData = {
            firstName: document.getElementById('newPatientFirstName').value,
            lastName: document.getElementById('newPatientLastName').value,
            dateOfBirth: document.getElementById('newPatientDob').value,
            gender: document.getElementById('newPatientGender').value,
            phone: document.getElementById('newPatientPhone').value,
            email: document.getElementById('newPatientEmail').value
        };

        try {
            const response = await fetch('/api/patients', {
                method: 'POST',
                headers: {
                    ...AuthManager.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(patientData)
            });

            if (response.ok) {
                const data = await response.json();
                this.selectedPatient = data.patient;
                this.displaySelectedPatient();
                this.newPatientModal.hide();
                document.getElementById('newPatientForm').reset();
                this.showAlert('success', 'Patient created successfully');
                this.checkOrderReady();
            } else {
                const error = await response.json();
                this.showAlert('danger', error.message || 'Failed to create patient');
            }
        } catch (error) {
            console.error('Error creating patient:', error);
            this.showAlert('danger', 'Failed to create patient');
        }
    },

    async searchOffices(query) {
        if (query.length < 2) {
            document.getElementById('officeDropdown').style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/api/medical-offices?search=${encodeURIComponent(query)}&limit=10`, {
                headers: AuthManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.showOfficeDropdown(data.medicalOffices);
            }
        } catch (error) {
            console.error('Error searching offices:', error);
        }
    },

    showOfficeDropdown(offices) {
        const dropdown = document.getElementById('officeDropdown');
        
        if (offices.length === 0) {
            dropdown.innerHTML = `
                <div class="p-3 text-muted">No offices found</div>
                <div class="create-new-btn" onclick="OrderEntry.newOfficeModal.show()">
                    <i class="fas fa-plus me-2"></i>Create New Office
                </div>
            `;
        } else {
            dropdown.innerHTML = offices.map(o => `
                <div class="autocomplete-item" onclick="OrderEntry.selectOffice('${o._id}')">
                    <div><strong>${o.name}</strong></div>
                    <div class="text-muted small">${o.address?.city || ''} | ${o.phone || 'N/A'}</div>
                </div>
            `).join('') + `
                <div class="create-new-btn" onclick="OrderEntry.newOfficeModal.show()">
                    <i class="fas fa-plus me-2"></i>Create New Office
                </div>
            `;
        }
        
        dropdown.style.display = 'block';
    },

    async selectOffice(officeId) {
        try {
            const response = await fetch(`/api/medical-offices/${officeId}`, {
                headers: AuthManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.selectedOffice = data.medicalOffice;
                this.displaySelectedOffice();
                document.getElementById('officeDropdown').style.display = 'none';
                document.getElementById('officeSearch').value = this.selectedOffice.name;
                this.checkOrderReady();
            }
        } catch (error) {
            console.error('Error selecting office:', error);
        }
    },

    displaySelectedOffice() {
        if (!this.selectedOffice) return;
        
        document.getElementById('selectedOfficeInfo').style.display = 'block';
        document.getElementById('selectedOfficeInfo').innerHTML = `
            <strong>Selected Office:</strong> ${this.selectedOffice.name} 
            ${this.selectedOffice.phone ? `| Phone: ${this.selectedOffice.phone}` : ''}
        `;
    },

    async createNewOffice() {
        const officeData = {
            name: document.getElementById('newOfficeName').value,
            phone: document.getElementById('newOfficePhone').value,
            address: {
                street: document.getElementById('newOfficeAddress').value
            }
        };

        try {
            const response = await fetch('/api/medical-offices', {
                method: 'POST',
                headers: {
                    ...AuthManager.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(officeData)
            });

            if (response.ok) {
                const data = await response.json();
                this.selectedOffice = data.medicalOffice;
                this.displaySelectedOffice();
                this.newOfficeModal.hide();
                document.getElementById('newOfficeForm').reset();
                document.getElementById('officeSearch').value = this.selectedOffice.name;
                this.showAlert('success', 'Medical office created successfully');
                this.checkOrderReady();
            } else {
                const error = await response.json();
                this.showAlert('danger', error.message || 'Failed to create office');
            }
        } catch (error) {
            console.error('Error creating office:', error);
            this.showAlert('danger', 'Failed to create office');
        }
    },

    async searchDoctors(query) {
        if (query.length < 2) {
            document.getElementById('doctorDropdown').style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/api/doctors/search/autocomplete?q=${encodeURIComponent(query)}`, {
                headers: AuthManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.showDoctorDropdown(data);
            }
        } catch (error) {
            console.error('Error searching doctors:', error);
        }
    },

    showDoctorDropdown(doctors) {
        const dropdown = document.getElementById('doctorDropdown');
        
        if (doctors.length === 0) {
            dropdown.innerHTML = `
                <div class="p-3 text-muted">No doctors found</div>
                <div class="create-new-btn" onclick="OrderEntry.newDoctorModal.show()">
                    <i class="fas fa-plus me-2"></i>Create New Doctor
                </div>
            `;
        } else {
            dropdown.innerHTML = doctors.map(d => `
                <div class="autocomplete-item" onclick="OrderEntry.selectDoctor('${d.id}')">
                    <div><strong>${d.label}</strong></div>
                    <div class="text-muted small">
                        ${d.specialty || ''} ${d.npiNumber ? `| NPI: ${d.npiNumber}` : ''}
                    </div>
                </div>
            `).join('') + `
                <div class="create-new-btn" onclick="OrderEntry.newDoctorModal.show()">
                    <i class="fas fa-plus me-2"></i>Create New Doctor
                </div>
            `;
        }
        
        dropdown.style.display = 'block';
    },

    async selectDoctor(doctorId) {
        try {
            const response = await fetch(`/api/doctors/${doctorId}`, {
                headers: AuthManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.selectedDoctor = data.doctor;
                this.displaySelectedDoctor();
                document.getElementById('doctorDropdown').style.display = 'none';
                document.getElementById('doctorSearch').value = 
                    `${this.selectedDoctor.firstName} ${this.selectedDoctor.lastName}, ${this.selectedDoctor.title}`;
                this.checkOrderReady();
            }
        } catch (error) {
            console.error('Error selecting doctor:', error);
        }
    },

    displaySelectedDoctor() {
        if (!this.selectedDoctor) return;
        
        document.getElementById('selectedDoctorInfo').style.display = 'block';
        document.getElementById('selectedDoctorInfo').innerHTML = `
            <strong>Selected Doctor:</strong> 
            ${this.selectedDoctor.firstName} ${this.selectedDoctor.lastName}, ${this.selectedDoctor.title}
            ${this.selectedDoctor.npiNumber ? `| NPI: ${this.selectedDoctor.npiNumber}` : ''}
        `;
    },

    async createNewDoctor() {
        // Validate required fields
        const firstName = document.getElementById('newDoctorFirstName').value.trim();
        const lastName = document.getElementById('newDoctorLastName').value.trim();
        
        if (!firstName || !lastName) {
            this.showAlert('warning', 'Please fill in all required fields');
            return;
        }

        const doctorData = {
            firstName: firstName,
            lastName: lastName,
            title: document.getElementById('newDoctorTitle').value || 'MD',
            npiNumber: document.getElementById('newDoctorNpi').value.trim(),
            phone: document.getElementById('newDoctorPhone').value.trim()
        };

        // Add medical office if one is selected
        if (this.selectedOffice && this.selectedOffice._id) {
            doctorData.medicalOffices = [this.selectedOffice._id];
        }

        console.log('Creating doctor with data:', doctorData);

        try {
            const response = await fetch('/api/doctors', {
                method: 'POST',
                headers: {
                    ...AuthManager.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(doctorData)
            });

            const responseData = await response.json();
            console.log('Doctor creation response:', responseData);

            if (response.ok) {
                this.selectedDoctor = responseData.doctor;
                this.displaySelectedDoctor();
                this.newDoctorModal.hide();
                document.getElementById('newDoctorForm').reset();
                document.getElementById('doctorSearch').value = 
                    `${this.selectedDoctor.firstName} ${this.selectedDoctor.lastName}, ${this.selectedDoctor.title}`;
                this.showAlert('success', 'Doctor created successfully');
                this.checkOrderReady();
            } else {
                const errorMessage = responseData.message || responseData.error || 'Failed to create doctor';
                this.showAlert('danger', errorMessage);
            }
        } catch (error) {
            console.error('Error creating doctor:', error);
            this.showAlert('danger', 'Failed to create doctor');
        }
    },

    async loadTests() {
        try {
            // Load regular tests
            const [regularResponse, pcrResponse] = await Promise.all([
                fetch('/api/tests?isActive=true', {
                    headers: AuthManager.getAuthHeaders()
                }),
                fetch('/api/pcr/tests?isActive=true', {
                    headers: AuthManager.getAuthHeaders()
                })
            ]);

            const regularTests = regularResponse.ok ? await regularResponse.json() : { tests: [] };
            const pcrTests = pcrResponse.ok ? await pcrResponse.json() : { tests: [] };

            // Combine and format all tests
            this.allTests = [
                ...regularTests.tests.map(test => ({
                    ...test,
                    displayCategory: test.category,
                    type: 'regular'
                })),
                ...pcrTests.tests.map(test => ({
                    ...test,
                    displayCategory: test.panel || 'PCR',
                    category: 'pcr',
                    type: 'pcr'
                }))
            ];

            console.log('Loaded tests:', this.allTests.length);
            this.displayTests(this.allTests);
            this.setupCategoryTabs();
        } catch (error) {
            console.error('Error loading tests:', error);
            this.showAlert('warning', 'Failed to load some tests');
        }
    },

    setupCategoryTabs() {
        // Get unique categories
        const categories = new Set();
        categories.add('all');
        
        this.allTests.forEach(test => {
            if (test.type === 'regular') {
                categories.add(test.category);
            } else if (test.type === 'pcr') {
                categories.add('pcr');
            }
        });

        // Update tab structure
        const tabsContainer = document.querySelector('.test-category-tabs');
        if (tabsContainer) {
            const categoryLabels = {
                'all': 'All Tests',
                'hematology': 'Hematology',
                'biochemistry': 'Biochemistry',
                'microbiology': 'Microbiology',
                'immunology': 'Immunology',
                'pathology': 'Pathology',
                'radiology': 'Radiology',
                'molecular': 'Molecular',
                'pcr': 'PCR Panels'
            };

            let tabsHtml = '';
            categories.forEach(cat => {
                const isActive = cat === 'all' ? 'active' : '';
                const label = categoryLabels[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
                tabsHtml += `
                    <li class="nav-item">
                        <a class="nav-link ${isActive}" href="#" data-category="${cat}" onclick="OrderEntry.filterByCategory('${cat}'); return false;">
                            ${label}
                        </a>
                    </li>
                `;
            });
            
            tabsContainer.innerHTML = tabsHtml;
        }
    },

    filterByCategory(category) {
        // Update active tab
        document.querySelectorAll('.test-category-tabs .nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.category === category) {
                link.classList.add('active');
            }
        });

        // Filter tests
        let filtered = this.allTests;
        if (category !== 'all') {
            if (category === 'pcr') {
                filtered = this.allTests.filter(test => test.type === 'pcr');
            } else {
                filtered = this.allTests.filter(test => test.category === category);
            }
        }
        
        this.displayTests(filtered);
    },

    displayTests(tests) {
        const grid = document.getElementById('testGrid');
        
        if (tests.length === 0) {
            grid.innerHTML = '<div class="text-muted">No tests available</div>';
            return;
        }

        grid.innerHTML = tests.map(test => {
            // Determine display info based on test type
            let categoryBadge = '';
            let testInfo = '';
            
            if (test.type === 'pcr') {
                categoryBadge = `<span class="badge bg-primary">PCR - ${test.panel || 'Panel'}</span>`;
                testInfo = test.targets ? `<div class="text-muted small">${test.targets.length} targets</div>` : '';
            } else {
                const categoryColors = {
                    'hematology': 'danger',
                    'biochemistry': 'success',
                    'microbiology': 'warning',
                    'immunology': 'info',
                    'pathology': 'secondary',
                    'radiology': 'dark',
                    'molecular': 'primary'
                };
                const color = categoryColors[test.category] || 'secondary';
                categoryBadge = `<span class="badge bg-${color}">${test.category}</span>`;
                testInfo = test.sampleType ? `<div class="text-muted small">Sample: ${test.sampleType}</div>` : '';
            }

            return `
                <div class="test-card ${this.selectedTests.has(test._id) ? 'selected' : ''}" 
                     onclick="OrderEntry.toggleTest('${test._id}')" data-test-id="${test._id}">
                    <div class="fw-bold">${test.testName}</div>
                    <div class="text-muted small">${test.testCode}</div>
                    ${testInfo}
                    <div class="text-primary fw-bold">${test.price || 0}</div>
                    ${categoryBadge}
                </div>
            `;
        }).join('');
    },

    filterTests(query) {
        const filtered = this.allTests.filter(test => {
            const searchLower = query.toLowerCase();
            return test.testName.toLowerCase().includes(searchLower) ||
                   test.testCode.toLowerCase().includes(searchLower) ||
                   (test.description && test.description.toLowerCase().includes(searchLower)) ||
                   (test.panel && test.panel.toLowerCase().includes(searchLower)) ||
                   (test.targets && test.targets.some(t => t.name.toLowerCase().includes(searchLower)));
        });
        this.displayTests(filtered);
    },

    toggleTest(testId) {
        const test = this.allTests.find(t => t._id === testId);
        if (!test) return;

        if (this.selectedTests.has(testId)) {
            this.selectedTests.delete(testId);
            document.querySelector(`[data-test-id="${testId}"]`).classList.remove('selected');
        } else {
            this.selectedTests.set(testId, test);
            document.querySelector(`[data-test-id="${testId}"]`).classList.add('selected');
        }

        this.updateOrderSummary();
        this.checkOrderReady();
    },

    updateOrderSummary() {
        const testsList = document.getElementById('selectedTestsList');
        const totalTests = document.getElementById('totalTests');
        const totalAmount = document.getElementById('totalAmount');

        if (this.selectedTests.size === 0) {
            testsList.innerHTML = '<div class="text-muted">No tests selected</div>';
            totalTests.textContent = '0';
            totalAmount.textContent = '$0.00';
            return;
        }

        let total = 0;
        testsList.innerHTML = Array.from(this.selectedTests.values()).map(test => {
            total += test.price || 0;
            
            // Determine badge based on test type
            let badge = '';
            if (test.type === 'pcr') {
                badge = '<span class="badge bg-primary ms-2">PCR</span>';
            } else if (test.priority === 'stat') {
                badge = '<span class="badge bg-danger ms-2">STAT</span>';
            }
            
            return `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold">${test.testName}${badge}</div>
                        <div class="text-muted small">${test.testCode}</div>
                    </div>
                    <div>
                        <span class="badge bg-success">${test.price || 0}</span>
                        <button class="btn btn-sm btn-outline-danger ms-2" 
                                onclick="OrderEntry.toggleTest('${test._id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        totalTests.textContent = this.selectedTests.size;
        totalAmount.textContent = `${total.toFixed(2)}`;
    },

    checkOrderReady() {
        const isReady = this.selectedPatient && 
                       this.selectedDoctor && 
                       this.selectedTests.size > 0;
        
        console.log('Order ready check:', {
            hasPatient: !!this.selectedPatient,
            hasDoctor: !!this.selectedDoctor,
            testCount: this.selectedTests.size,
            isReady: isReady
        });
        
        document.getElementById('saveOrderBtn').disabled = !isReady;
        document.getElementById('saveAndPrintBtn').disabled = !isReady;
        
        // Show what's missing if not ready
        if (!isReady) {
            const missing = [];
            if (!this.selectedPatient) missing.push('Patient');
            if (!this.selectedDoctor) missing.push('Doctor');
            if (this.selectedTests.size === 0) missing.push('Tests');
            
            if (missing.length > 0) {
                console.log('Missing required fields:', missing.join(', '));
            }
        }
    },

    async saveOrder(printLabels) {
        if (!this.selectedPatient || !this.selectedDoctor || this.selectedTests.size === 0) {
            this.showAlert('warning', 'Please complete all required fields');
            return;
        }

        // Build order data with proper structure
        const orderData = {
            patient: this.selectedPatient._id,
            tests: Array.from(this.selectedTests.keys()).map(testId => ({
                test: testId,
                priority: document.getElementById('orderPriority').value || 'routine'
            })),
            orderingPhysician: {
            doctorId: this.selectedDoctor._id,
            name: `${this.selectedDoctor.firstName} ${this.selectedDoctor.lastName}, ${this.selectedDoctor.title || 'MD'}`,
            license: this.selectedDoctor.licenseNumber || '',
            phone: this.selectedDoctor.phone?.office || this.selectedDoctor.phone?.mobile || '',
            email: this.selectedDoctor.email?.primary || '',
            facility: this.selectedOffice?.name || ''
},
            priority: document.getElementById('orderPriority').value || 'routine',
            clinicalInfo: {
                diagnosis: document.getElementById('diagnosis').value || '',
                urgencyReason: document.getElementById('specialInstructions').value || ''
            }
        };

        // Add medical office if selected
        if (this.selectedOffice && this.selectedOffice._id) {
            orderData.medicalOffice = this.selectedOffice._id;
        }

        console.log('Sending order data:', orderData);

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    ...AuthManager.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });

            const responseData = await response.json();
            console.log('Server response:', responseData);

            if (response.ok) {
                this.showAlert('success', `Order ${responseData.order.orderNumber} created successfully`);
                
                if (printLabels) {
                    await this.printLabels(responseData.order);
                }
                
                setTimeout(() => {
                    window.location.href = `/orders`;
                }, 2000);
            } else {
                // Show specific error message from server
                const errorMessage = responseData.message || responseData.error || 'Failed to create order';
                console.error('Order creation failed:', responseData);
                
                // Check for specific validation errors
                if (responseData.errors && Array.isArray(responseData.errors)) {
                    const validationErrors = responseData.errors.map(e => e.msg || e.message).join(', ');
                    this.showAlert('danger', `Validation errors: ${validationErrors}`);
                } else {
                    this.showAlert('danger', errorMessage);
                }
            }
        } catch (error) {
            console.error('Error saving order:', error);
            this.showAlert('danger', 'Network error: Failed to save order. Please check your connection.');
        }
    },

    async printLabels(order) {
        // Open label printing window
        const labelWindow = window.open('/label-print', '_blank', 'width=400,height=600');
        
        // Wait for window to load then send order data
        labelWindow.addEventListener('load', () => {
            labelWindow.postMessage({
                type: 'printLabels',
                order: order
            }, window.location.origin);
        });
    },

    updatePriorityDisplay(priority) {
        const badge = document.querySelector('.priority-badge');
        if (badge) {
            badge.className = `priority-badge priority-${priority}`;
            badge.textContent = priority.toUpperCase();
        }
    },

    showAlert(type, message) {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const container = document.querySelector('.container-fluid');
        const alertDiv = document.createElement('div');
        alertDiv.innerHTML = alertHtml;
        container.insertBefore(alertDiv.firstChild, container.firstChild);
        
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) alert.remove();
        }, 5000);
    }
};

// Initialize when DOM is ready (matching your dashboard pattern)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => OrderEntry.init());
} else {
    OrderEntry.init();
}