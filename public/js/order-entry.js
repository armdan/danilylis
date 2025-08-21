// public/js/order-entry.js
const OrderEntry = {
    selectedPatient: null,
    selectedOffice: null,
    selectedDoctor: null,
    selectedTests: new Map(),
    allTests: [],
    currentOrder: null,

    init() {
        this.setCurrentDateTime();
        this.loadTests();
        this.setupEventListeners();
        this.setupModals();
        this.initializeEnhancedModals();
    },

    setCurrentDateTime() {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        now.setMinutes(now.getMinutes() - offset);
        const dateTimeLocal = now.toISOString().slice(0, 16);
        document.getElementById('orderDateTime').value = dateTimeLocal;
        document.getElementById('collectionDateTime').value = dateTimeLocal;
    },

    setupModals() {
        // Only initialize modals if the elements exist
        const patientModalEl = document.getElementById('newPatientModal');
        const officeModalEl = document.getElementById('newOfficeModal');
        const doctorModalEl = document.getElementById('doctorModal');
        
        if (patientModalEl) {
            this.newPatientModal = new bootstrap.Modal(patientModalEl);
        } else {
            console.warn('Patient modal element not found');
        }
        
        if (officeModalEl) {
            this.newOfficeModal = new bootstrap.Modal(officeModalEl);
        } else {
            console.warn('Office modal element not found');
        }
        
        if (doctorModalEl) {
            this.doctorModal = new bootstrap.Modal(doctorModalEl);
        } else {
            console.warn('Doctor modal element not found');
        }
    },

    // Initialize enhanced modals with all fields
    initializeEnhancedModals() {
        // Enhanced Patient Modal
        this.initializeEnhancedPatientModal();
        
        // Enhanced Office Modal
        this.initializeEnhancedOfficeModal();
        
        // Enhanced Doctor Modal
        this.initializeEnhancedDoctorModal();
    },

    // Complete patient save function for order-entry.js
    initializeEnhancedPatientModal() {
        // Setup Medicare/Medicaid checkbox handlers
        $('#newPatientHasMedicare').on('change', function(e) {
            $('#newPatientMedicareNumber').toggle(e.target.checked);
        });

        $('#newPatientHasMedicaid').on('change', function(e) {
            $('#newPatientMedicaidNumber').toggle(e.target.checked);
        });

        $('#createPatientBtn').off('click').on('click', () => {
            const form = document.getElementById('newPatientForm');
            
            // Bootstrap 5 validation
            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }

            const patientData = {
                firstName: $('#newPatientFirstName').val().trim(),
                lastName: $('#newPatientLastName').val().trim(),
                dateOfBirth: $('#newPatientDob').val(),
                gender: $('#newPatientGender').val(),
                phone: $('#newPatientPhone').val().trim(),
                email: $('#newPatientEmail').val().trim() || undefined,
                
                // Address
                address: {
                    street: $('#newPatientStreet').val().trim() || undefined,
                    city: $('#newPatientCity').val().trim() || undefined,
                    state: $('#newPatientState').val().trim() || undefined,
                    zipCode: $('#newPatientZipCode').val().trim() || undefined
                },
                
                // Emergency Contact
                emergencyContact: {
                    name: $('#newPatientEmergencyName').val().trim() || undefined,
                    phone: $('#newPatientEmergencyPhone').val().trim() || undefined,
                    relationship: $('#newPatientEmergencyRelationship').val().trim() || undefined
                },
                
                // Billing object matching your patients.html structure
                billing: {
                    primaryInsurance: {
                        provider: $('#newPatientInsuranceProvider').val().trim() || undefined,
                        planName: $('#newPatientInsurancePlanName').val().trim() || undefined,
                        policyNumber: $('#newPatientPolicyNumber').val().trim() || undefined,
                        groupNumber: $('#newPatientGroupNumber').val().trim() || undefined,
                        subscriberId: $('#newPatientSubscriberId').val().trim() || undefined,
                        subscriberName: $('#newPatientSubscriberName').val().trim() || undefined,
                        subscriberRelationship: $('#newPatientSubscriberRelationship').val() || 'self',
                        effectiveDate: $('#newPatientInsuranceEffectiveDate').val() || undefined,
                        copayAmount: parseFloat($('#newPatientInsuranceCopay').val()) || undefined,
                        deductible: parseFloat($('#newPatientInsuranceDeductible').val()) || undefined
                    },
                    medicare: {
                        hasMedicare: $('#newPatientHasMedicare').is(':checked'),
                        medicareNumber: $('#newPatientHasMedicare').is(':checked') ? 
                            $('#newPatientMedicareNumber').val().trim() || undefined : undefined
                    },
                    medicaid: {
                        hasMedicaid: $('#newPatientHasMedicaid').is(':checked'),
                        medicaidNumber: $('#newPatientHasMedicaid').is(':checked') ? 
                            $('#newPatientMedicaidNumber').val().trim() || undefined : undefined
                    },
                    billingPreferences: {
                        preferredPaymentMethod: $('#newPatientPaymentMethod').val() || 'insurance',
                        billingEmail: $('#newPatientBillingEmail').val().trim() || undefined,
                        paperlessBilling: $('#newPatientPaperlessBilling').is(':checked')
                    },
                    guarantor: {
                        isPatientGuarantor: $('#newPatientIsGuarantor').is(':checked')
                    }
                }
            };

            // Clean up empty objects
            if (!Object.values(patientData.address).some(v => v)) {
                delete patientData.address;
            }
            if (!Object.values(patientData.emergencyContact).some(v => v)) {
                delete patientData.emergencyContact;
            }
            if (!Object.values(patientData.billing.primaryInsurance).some(v => v && v !== 'self')) {
                delete patientData.billing.primaryInsurance;
            }

            // Validate required fields
            if (!patientData.firstName || !patientData.lastName || !patientData.dateOfBirth || 
                !patientData.gender || !patientData.phone) {
                this.showAlert('warning', 'Please fill in all required fields');
                return;
            }

            // Save patient
            $.ajax({
                url: '/api/patients',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(patientData),
                success: (response) => {
                    const patient = response.patient;
                    this.selectedPatient = patient;
                    this.displaySelectedPatient();
                    this.newPatientModal.hide();
                    $('#newPatientForm')[0].reset();
                    $('#newPatientForm').removeClass('was-validated');
                    this.showAlert('success', 'Patient created successfully');
                    this.checkOrderReady();
                },
                error: (xhr) => {
                    console.error('Patient save error:', xhr.responseJSON);
                    const error = xhr.responseJSON?.message || 'Failed to create patient';
                    this.showAlert('danger', error);
                }
            });
        });
    },

    initializeEnhancedOfficeModal() {
        // Load organizations for dropdown
        $.get('/api/organizations?limit=100&status=active')
            .done((response) => {
                const select = $('#newOfficeOrganization');
                if (select.length) {
                    select.empty();
                    select.append('<option value="">Independent Office</option>');
                    if (response.organizations) {
                        response.organizations.forEach(org => {
                            select.append(`<option value="${org._id}">${org.name}</option>`);
                        });
                    }
                }
            });

        $('#createOfficeBtn').off('click').on('click', () => {
            // Generate office code if not provided
            let officeCode = $('#newOfficeCode').val().trim();
            if (!officeCode) {
                const nameParts = $('#newOfficeName').val().trim().split(' ');
                const initials = nameParts.map(word => word.charAt(0).toUpperCase()).join('');
                const timestamp = Date.now().toString().slice(-4);
                officeCode = `${initials}-${timestamp}`;
            }

            const officeData = {
                name: $('#newOfficeName').val().trim(),
                officeCode: officeCode,
                organization: $('#newOfficeOrganization').val() || null,
                status: 'active',
                address: {
                    street: $('#newOfficeStreet').val().trim() || $('#newOfficeAddress').val().trim(),
                    suite: $('#newOfficeSuite').val().trim(),
                    city: $('#newOfficeCity').val().trim(),
                    state: $('#newOfficeState').val().trim().toUpperCase(),
                    zipCode: $('#newOfficeZipCode').val().trim()
                },
                phone: {
                    main: $('#newOfficePhoneMain').val().trim() || $('#newOfficePhone').val().trim(),
                    billing: $('#newOfficePhoneBilling').val().trim()
                },
                fax: $('#newOfficeFax').val().trim(),
                email: {
                    general: $('#newOfficeEmailGeneral').val().trim(),
                    billing: $('#newOfficeEmailBilling').val().trim(),
                    results: $('#newOfficeEmailResults').val().trim()
                },
                contactPerson: {
                    name: $('#newOfficeContactName').val().trim(),
                    title: $('#newOfficeContactTitle').val().trim(),
                    phone: $('#newOfficeContactPhone').val().trim(),
                    email: $('#newOfficeContactEmail').val().trim()
                },
                npiNumber: $('#newOfficeNpiNumber').val().trim(),
                taxId: $('#newOfficeTaxId').val().trim(),
                licenseNumber: $('#newOfficeLicenseNumber').val().trim(),
                billingType: $('#newOfficeBillingType').val() || 'both',
                paymentTerms: $('#newOfficePaymentTerms').val() || 'net30',
                specialInstructions: $('#newOfficeSpecialInstructions').val().trim()
            };

            // Validate minimum required fields
            if (!officeData.name) {
                this.showAlert('warning', 'Office name is required');
                return;
            }

            // Clean up empty fields
            if (!officeData.address.suite) delete officeData.address.suite;
            if (!officeData.phone.billing) delete officeData.phone.billing;
            if (!officeData.fax) delete officeData.fax;
            if (!officeData.email.billing) delete officeData.email.billing;
            if (!officeData.email.results) delete officeData.email.results;
            if (!officeData.contactPerson.title) delete officeData.contactPerson.title;
            if (!officeData.contactPerson.phone) delete officeData.contactPerson.phone;
            if (!officeData.contactPerson.email) delete officeData.contactPerson.email;
            if (!officeData.npiNumber) delete officeData.npiNumber;
            if (!officeData.taxId) delete officeData.taxId;
            if (!officeData.licenseNumber) delete officeData.licenseNumber;
            if (!officeData.specialInstructions) delete officeData.specialInstructions;

            // Save medical office
            $.ajax({
                url: '/api/medical-offices',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(officeData),
                success: (response) => {
                    const office = response.medicalOffice;
                    this.selectedOffice = office;
                    this.displaySelectedOffice();
                    this.newOfficeModal.hide();
                    $('#newOfficeForm')[0].reset();
                    $('#officeSearch').val(office.name);
                    this.showAlert('success', 'Medical office created successfully');
                    this.checkOrderReady();
                    // Reload offices for doctor modal
                    this.loadMedicalOfficesForDoctorModal();
                },
                error: (xhr) => {
                    const error = xhr.responseJSON?.message || 'Failed to create medical office';
                    this.showAlert('danger', error);
                }
            });
        });
    },

    initializeEnhancedDoctorModal() {
        // Load medical offices for association
        this.loadMedicalOfficesForDoctorModal();
        
        // Handle the medicalOffices change for primary office updates
        $('#medicalOffices').on('change', function() {
            OrderEntry.updateDoctorPrimaryOfficeOptions();
        });
    },

    saveDoctorFromModal() {
        console.log('saveDoctorFromModal called');
        
        // Clear any previous validation states
        $('#doctorForm .is-invalid').removeClass('is-invalid');
        
        // Get values using the SAME field IDs as doctors.html modal
        const firstName = $('#firstName').val()?.trim() || '';
        const lastName = $('#lastName').val()?.trim() || '';
        const npiNumber = $('#npiNumber').val()?.trim() || '';
        const primarySpecialty = $('#primarySpecialty').val()?.trim() || '';
        const phoneOffice = $('#phoneOffice').val()?.trim() || '';
        const emailPrimary = $('#emailPrimary').val()?.trim() || '';
        const title = $('#doctorTitle').val() || 'MD';
        
        console.log('Form values collected:', {
            firstName, lastName, npiNumber, 
            primarySpecialty, phoneOffice, emailPrimary, title
        });
        
        // Track validation errors
        let hasErrors = false;
        let firstErrorField = null;
        
        // Validate all required fields per API requirements
        if (!firstName) {
            $('#firstName').addClass('is-invalid');
            if (!firstErrorField) firstErrorField = $('#firstName');
            hasErrors = true;
        }
        
        if (!lastName) {
            $('#lastName').addClass('is-invalid');
            if (!firstErrorField) firstErrorField = $('#lastName');
            hasErrors = true;
        }
        
        if (!npiNumber) {
            $('#npiNumber').addClass('is-invalid');
            if (!firstErrorField) firstErrorField = $('#npiNumber');
            hasErrors = true;
        } else if (!/^\d{10}$/.test(npiNumber)) {
            $('#npiNumber').addClass('is-invalid');
            if (!firstErrorField) firstErrorField = $('#npiNumber');
            this.showAlert('warning', 'NPI Number must be exactly 10 digits');
            hasErrors = true;
        }
        
        if (!primarySpecialty) {
            $('#primarySpecialty').addClass('is-invalid');
            if (!firstErrorField) firstErrorField = $('#primarySpecialty');
            hasErrors = true;
        }
        
        if (!phoneOffice) {
            $('#phoneOffice').addClass('is-invalid');
            if (!firstErrorField) firstErrorField = $('#phoneOffice');
            hasErrors = true;
        }
        
        if (!emailPrimary) {
            $('#emailPrimary').addClass('is-invalid');
            if (!firstErrorField) firstErrorField = $('#emailPrimary');
            hasErrors = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPrimary)) {
            $('#emailPrimary').addClass('is-invalid');
            if (!firstErrorField) firstErrorField = $('#emailPrimary');
            this.showAlert('warning', 'Please enter a valid email address');
            hasErrors = true;
        }
        
        // If there are errors, show message and focus on first error field
        if (hasErrors) {
            this.showAlert('warning', 'Please fill in all required fields marked with *');
            
            // Switch to the tab containing the first error field
            if (firstErrorField) {
                // Find which tab contains the error field
                const tabPane = firstErrorField.closest('.tab-pane');
                if (tabPane) {
                    const tabId = tabPane.attr('id');
                    // Activate the corresponding tab
                    $(`.nav-link[href="#${tabId}"]`).tab('show');
                    // Focus the field after tab animation
                    setTimeout(() => firstErrorField.focus(), 300);
                } else {
                    firstErrorField.focus();
                }
            }
            return;
        }
        
        // Create doctor data matching API requirements exactly
        const doctorData = {
            firstName: firstName,
            lastName: lastName,
            title: title,
            npiNumber: npiNumber,
            primarySpecialty: primarySpecialty,
            phone: {
                office: phoneOffice
            },
            email: {
                primary: emailPrimary
            },
            status: 'active'
        };
        
        // Add selected medical offices
        const selectedOffices = $('#medicalOffices').val();
        if (selectedOffices && selectedOffices.length > 0) {
            doctorData.medicalOffices = selectedOffices;
            
            // Set primary office if selected
            const primaryOffice = $('#primaryOffice').val();
            if (primaryOffice) {
                doctorData.primaryOffice = primaryOffice;
            }
        } else if (this.selectedOffice && this.selectedOffice._id) {
            // Use the currently selected office from order entry if no offices selected in modal
            doctorData.medicalOffices = [this.selectedOffice._id];
        }

        console.log('Sending doctor data:', JSON.stringify(doctorData, null, 2));

        // Save doctor
        $.ajax({
            url: '/api/doctors',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(doctorData),
            success: (response) => {
                console.log('Doctor created successfully:', response);
                const doctor = response.doctor;
                this.selectedDoctor = doctor;
                this.displaySelectedDoctor();
                
                // Close the modal
                if (this.doctorModal) {
                    this.doctorModal.hide();
                }
                
                // Reset the form
                $('#doctorForm')[0].reset();
                $('#doctorForm .is-invalid').removeClass('is-invalid');
                $('#doctorSearch').val(`${doctor.firstName} ${doctor.lastName}, ${doctor.title}`);
                this.showAlert('success', 'Doctor created successfully');
                this.checkOrderReady();
            },
            error: (xhr) => {
                console.error('Doctor save error:', xhr.responseJSON);
                let errorMessage = 'Failed to create doctor';
                
                if (xhr.responseJSON) {
                    if (xhr.responseJSON.message) {
                        errorMessage = xhr.responseJSON.message;
                    } else if (xhr.responseJSON.error) {
                        errorMessage = xhr.responseJSON.error;
                    } else if (xhr.responseJSON.errors) {
                        if (Array.isArray(xhr.responseJSON.errors)) {
                            const errors = xhr.responseJSON.errors.map(err => {
                                const field = err.param || err.path || err.field || 'Field';
                                const msg = err.msg || err.message || 'Invalid value';
                                return `${field}: ${msg}`;
                            });
                            errorMessage = errors.join('\n');
                        }
                    }
                }
                
                this.showAlert('danger', errorMessage);
            }
        });
    },

    loadMedicalOfficesForDoctorModal() {
        $.get('/api/medical-offices?limit=100&status=active')
            .done((response) => {
                // Use the correct select element ID from doctors.html modal
                const select = $('#medicalOffices');
                if (select.length) {
                    select.empty();
                    if (response.medicalOffices) {
                        response.medicalOffices.forEach(office => {
                            select.append(`<option value="${office._id}">${office.name} (${office.officeCode || 'No Code'})</option>`);
                        });
                    }
                }
            })
            .fail((error) => {
                console.error('Failed to load medical offices:', error);
            });
    },

    updateDoctorPrimaryOfficeOptions() {
        const selectedOffices = $('#medicalOffices').val();
        const primarySelect = $('#primaryOffice');
        
        if (primarySelect.length) {
            const currentPrimary = primarySelect.val();
            
            primarySelect.empty();
            primarySelect.append('<option value="">Select Primary Office</option>');
            
            if (selectedOffices && selectedOffices.length > 0) {
                $('#medicalOffices option:selected').each(function() {
                    primarySelect.append(`<option value="${$(this).val()}">${$(this).text()}</option>`);
                });
                
                if (selectedOffices.includes(currentPrimary)) {
                    primarySelect.val(currentPrimary);
                }
            }
        }
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

        // Doctor search
        const doctorSearch = document.getElementById('doctorSearch');
        let doctorTimeout;
        doctorSearch.addEventListener('input', (e) => {
            clearTimeout(doctorTimeout);
            doctorTimeout = setTimeout(() => this.searchDoctors(e.target.value), 300);
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

        // Copies per test change
        const copiesInput = document.getElementById('copiesPerTest');
        if (copiesInput) {
            copiesInput.addEventListener('change', () => {
                if (this.currentOrder) {
                    this.refreshLabels();
                }
            });
        }

        // Click outside to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.position-relative')) {
                document.querySelectorAll('.autocomplete-dropdown').forEach(d => {
                    d.style.display = 'none';
                });
            }
        });
    },

    // Helper function to simplify test names
    simplifyTestName(fullName) {
        let simplified = fullName.replace(/\s*\([^)]*\)/g, '');
        simplified = simplified.replace(/\s*(PCR\s+)?Panel$/i, '');
        simplified = simplified.replace(/\s*(PCR|DNA|RNA|RT-PCR|qPCR)$/i, '');
        return simplified.trim();
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
                    <div class="text-muted small">${o.address?.city || ''} | ${o.phone?.main || o.phone || 'N/A'}</div>
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
        
        const phoneDisplay = this.selectedOffice.phone?.main || this.selectedOffice.phone || '';
        document.getElementById('selectedOfficeInfo').style.display = 'block';
        document.getElementById('selectedOfficeInfo').innerHTML = `
            <strong>Selected Office:</strong> ${this.selectedOffice.name} 
            ${phoneDisplay ? `| Phone: ${phoneDisplay}` : ''}
        `;
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
                <div class="create-new-btn" onclick="OrderEntry.showDoctorModal()">
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
                <div class="create-new-btn" onclick="OrderEntry.showDoctorModal()">
                    <i class="fas fa-plus me-2"></i>Create New Doctor
                </div>
            `;
        }
        
        dropdown.style.display = 'block';
    },

    showDoctorModal() {
        $('#modalTitle').text('Add Doctor');
        $('#doctorForm')[0].reset();
        $('#doctorId').val('');
        this.loadMedicalOfficesForDoctorModal();
        if (this.doctorModal) {
            this.doctorModal.show();
        }
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

    async loadTests() {
        try {
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
        const categories = new Set();
        categories.add('all');
        
        this.allTests.forEach(test => {
            if (test.type === 'regular') {
                categories.add(test.category);
            } else if (test.type === 'pcr') {
                categories.add('pcr');
            }
        });

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
        document.querySelectorAll('.test-category-tabs .nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.category === category) {
                link.classList.add('active');
            }
        });

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
            const simplifiedName = this.simplifyTestName(test.testName);
            
            let categoryBadge = '';
            let testInfo = '';
            
            if (test.type === 'pcr') {
                categoryBadge = `<span class="badge bg-primary">PCR</span>`;
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
                    <div class="fw-bold">${simplifiedName}</div>
                    ${testInfo}
                    ${categoryBadge}
                </div>
            `;
        }).join('');
    },

    filterTests(query) {
        const filtered = this.allTests.filter(test => {
            const searchLower = query.toLowerCase();
            const simplifiedName = this.simplifyTestName(test.testName).toLowerCase();
            
            return simplifiedName.includes(searchLower) ||
                   test.testName.toLowerCase().includes(searchLower) ||
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

        if (this.selectedTests.size === 0) {
            testsList.innerHTML = '<div class="text-muted">No tests selected</div>';
            totalTests.textContent = '0';
            return;
        }

        testsList.innerHTML = Array.from(this.selectedTests.values()).map(test => {
            const simplifiedName = this.simplifyTestName(test.testName);
            
            let badge = '';
            if (test.type === 'pcr') {
                badge = '<span class="badge bg-primary ms-2">PCR</span>';
            } else if (test.priority === 'stat') {
                badge = '<span class="badge bg-danger ms-2">STAT</span>';
            }
            
            let targetInfo = '';
            if (test.type === 'pcr' && test.targets) {
                targetInfo = `<div class="text-muted small">${test.targets.length} targets</div>`;
            }
            
            return `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold">${simplifiedName}${badge}</div>
                        ${targetInfo}
                    </div>
                    <button class="btn btn-sm btn-outline-danger" 
                            onclick="OrderEntry.toggleTest('${test._id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

        totalTests.textContent = this.selectedTests.size;
    },

    checkOrderReady() {
        const isReady = this.selectedPatient && 
                       this.selectedDoctor && 
                       this.selectedTests.size > 0;
        
        document.getElementById('saveOrderBtn').disabled = !isReady;
        document.getElementById('saveAndPrintBtn').disabled = !isReady;
    },

    async saveOrder(printLabels) {
        if (!this.selectedPatient || !this.selectedDoctor || this.selectedTests.size === 0) {
            this.showAlert('warning', 'Please complete all required fields');
            return;
        }

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
            collectionDateTime: document.getElementById('collectionDateTime').value,
            collectionType: document.getElementById('collectionType').value || 'walk-in',
            clinicalInfo: {
                diagnosis: document.getElementById('diagnosis').value || '',
                urgencyReason: document.getElementById('specialInstructions').value || ''
            }
        };

        if (this.selectedOffice && this.selectedOffice._id) {
            orderData.medicalOffice = this.selectedOffice._id;
        }

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

            if (response.ok) {
                this.showAlert('success', `Order ${responseData.order.orderNumber} created successfully`);
                
                if (printLabels) {
                    this.currentOrder = responseData.order;
                    this.generateLabels(responseData.order);
                } else {
                    setTimeout(() => {
                        window.location.href = `/orders`;
                    }, 2000);
                }
            } else {
                const errorMessage = responseData.message || responseData.error || 'Failed to create order';
                this.showAlert('danger', errorMessage);
            }
        } catch (error) {
            console.error('Error saving order:', error);
            this.showAlert('danger', 'Network error: Failed to save order. Please check your connection.');
        }
    },

    generateLabels(order) {
        const labelSection = document.getElementById('labelPreviewSection');
        if (labelSection) {
            labelSection.style.display = 'block';
            labelSection.scrollIntoView({ behavior: 'smooth' });
            this.refreshLabels();
        }
    },

    refreshLabels() {
        if (!this.currentOrder) return;
        
        const container = document.getElementById('labelsContainer');
        if (!container) return;
        
        const copiesPerTest = parseInt(document.getElementById('copiesPerTest')?.value || 1);
        
        container.innerHTML = '';
        
        this.currentOrder.tests.forEach((testItem, index) => {
            const testDetails = this.selectedTests.get(testItem.test) || testItem.test;
            
            for (let copy = 0; copy < copiesPerTest; copy++) {
                const label = this.createLabel(testDetails, index + 1, copy + 1);
                container.appendChild(label);
            }
        });
    },

    createLabel(testItem, testNumber, copyNumber) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'label-container';
        
        const orderDate = new Date(this.currentOrder.createdAt || new Date());
        const formattedDate = `${(orderDate.getMonth() + 1).toString().padStart(2, '0')}/${orderDate.getDate().toString().padStart(2, '0')}/${orderDate.getFullYear()}`;
        const formattedTime = orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        const patientName = this.selectedPatient ? 
            `${this.selectedPatient.lastName}, ${this.selectedPatient.firstName}` : 
            'Unknown Patient';
        
        const doctorName = this.selectedDoctor ? 
            `${this.selectedDoctor.lastName}, ${this.selectedDoctor.title || 'MD'}` : 
            'Unknown Doctor';
        
        const testName = this.simplifyTestName(testItem.testName || 'Unknown Test');
        const testCode = testItem.testCode || '';
        
        labelDiv.innerHTML = `
            <div class="barcode-section">
                <canvas id="barcode-${testNumber}-${copyNumber}"></canvas>
            </div>
            <div class="order-number">${this.currentOrder.orderNumber}</div>
            <div class="patient-info">
                <div class="info-row">
                    <span class="info-value" style="font-weight: bold;">${patientName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Dr:</span>
                    <span class="info-value">${doctorName}</span>
                </div>
                <div class="test-name">${testName}</div>
                <div class="info-row">
                    <span class="info-label">Code:</span>
                    <span class="info-value">${testCode}</span>
                </div>
                <div class="date-time">${formattedDate} ${formattedTime}</div>
            </div>
        `;
        
        setTimeout(() => {
            const canvas = document.getElementById(`barcode-${testNumber}-${copyNumber}`);
            if (canvas && typeof JsBarcode !== 'undefined') {
                try {
                    JsBarcode(canvas, this.currentOrder.orderNumber, {
                        format: "CODE128",
                        width: 1,
                        height: 25,
                        displayValue: false,
                        margin: 0
                    });
                } catch (error) {
                    console.error('Error generating barcode:', error);
                }
            }
        }, 100);
        
        return labelDiv;
    },

    printLabelsNow() {
        window.print();
        
        if (this.currentOrder && this.currentOrder._id) {
            this.markOrderAsPrinted(this.currentOrder._id);
        }
        
        setTimeout(() => {
            window.location.href = '/orders';
        }, 1000);
    },

    async markOrderAsPrinted(orderId) {
        try {
            await fetch(`/api/orders/${orderId}/label-printed`, {
                method: 'PATCH',
                headers: {
                    ...AuthManager.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ printed: true })
            });
        } catch (error) {
            console.error('Error marking order as printed:', error);
        }
    },

    hideLabels() {
        const labelSection = document.getElementById('labelPreviewSection');
        if (labelSection) {
            labelSection.style.display = 'none';
        }
        window.location.href = '/orders';
    },

    updatePriorityDisplay(priority) {
        const badge = document.querySelector('.priority-badge');
        if (badge) {
            badge.className = `priority-badge priority-${priority}`;
            badge.textContent = priority.toUpperCase();
        }
    },

    showAlert(type, message) {
        // Remove any existing alerts first
        const existingAlerts = document.querySelectorAll('.floating-alert');
        existingAlerts.forEach(alert => alert.remove());
        
        // Create alert with better positioning and styling
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show floating-alert" role="alert" 
                 style="position: fixed; top: 70px; right: 20px; z-index: 9999; min-width: 300px; 
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1); animation: slideIn 0.3s ease-out;">
                <strong>${type === 'warning' ? '⚠️ Warning:' : type === 'danger' ? '❌ Error:' : '✅ Success:'}</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Add CSS animation if not already present
        if (!document.getElementById('alert-animations')) {
            const style = document.createElement('style');
            style.id = 'alert-animations';
            style.innerHTML = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .floating-alert { animation: slideIn 0.3s ease-out; }
            `;
            document.head.appendChild(style);
        }
        
        const alertDiv = document.createElement('div');
        alertDiv.innerHTML = alertHtml;
        document.body.appendChild(alertDiv.firstChild);
        
        // Auto-remove after 7 seconds for warnings/errors, 5 seconds for success
        const timeout = (type === 'warning' || type === 'danger') ? 7000 : 5000;
        setTimeout(() => {
            const alert = document.querySelector('.floating-alert');
            if (alert) alert.remove();
        }, timeout);
    }
};

// Global function for the modal's Save Doctor button (called by onclick="saveDoctor()")
function saveDoctor() {
    console.log('saveDoctor global function called');
    
    // Check if OrderEntry is initialized
    if (typeof OrderEntry === 'undefined' || !OrderEntry) {
        console.error('OrderEntry not initialized');
        return;
    }
    
    // Call the OrderEntry method
    OrderEntry.saveDoctorFromModal();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Small delay to ensure Bootstrap is fully loaded
        setTimeout(() => OrderEntry.init(), 100);
    });
} else {
    // If DOM is already loaded, still wait for Bootstrap
    setTimeout(() => OrderEntry.init(), 100);
}