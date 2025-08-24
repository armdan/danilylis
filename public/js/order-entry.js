// Order Entry Module
const OrderEntry = (function() {
    // Module variables
    let selectedPatient = null;
    let selectedOffice = null;
    let selectedDoctor = null;
    let selectedTests = [];
    let allTests = [];
    let editingOrderId = null; // Track if we're editing an order

    // Initialize
    $(document).ready(function() {
        console.log('Order Entry page loaded');
        
        // Check if we're in edit mode
        const urlParams = new URLSearchParams(window.location.search);
        const editOrderId = urlParams.get('edit');
        
        if (editOrderId) {
            // Load the order for editing
            loadOrderForEdit(editOrderId);
            // Update page title
            $('.page-header h1').html('<i class="fas fa-edit me-2"></i>Edit Order');
            // Change button text
            $('#saveOrderBtn').html('<i class="fas fa-save me-2"></i>Update Order');
            $('#saveAndPrintBtn').html('<i class="fas fa-save me-2"></i>Update & Print Labels');
        } else {
            // Normal create mode - set current date/time
            setCurrentDateTime();
        }
        
        loadTests();
        setupEventHandlers();
    });

    // Function to load order for editing
    function loadOrderForEdit(orderId) {
        $.get(`/api/orders/${orderId}`)
            .done(function(response) {
                const order = response.order;
                
                // Store the order ID for update
                editingOrderId = orderId;
                window.editingOrderId = orderId; // Also store globally for save function
                
                // Populate order information
                $('#orderNumber').text(order.orderNumber);
                $('#orderPriority').val(order.priority);
                $('#collectionType').val(order.collectionType || 'facility');
                
                // Populate dates
                if (order.createdAt) {
                    $('#orderDateTime').val(new Date(order.createdAt).toISOString().slice(0, 16));
                }
                if (order.collectionDateTime) {
                    $('#collectionDateTime').val(new Date(order.collectionDateTime).toISOString().slice(0, 16));
                }
                
                // Load patient
                if (order.patient) {
                    selectedPatient = order.patient;
                    $('#patientName').text(`${order.patient.firstName} ${order.patient.lastName}`);
                    $('#patientId').text(order.patient.patientId);
                    $('#patientDob').text(new Date(order.patient.dateOfBirth).toLocaleDateString());
                    $('#selectedPatientInfo').show();
                }
                
                // Load medical office
                if (order.medicalOffice) {
                    selectedOffice = order.medicalOffice;
                    $('#officeSearch').val(order.medicalOffice.name);
                    $('#selectedOfficeInfo').html(`<strong>Selected:</strong> ${order.medicalOffice.name}`).show();
                }
                
                // Load doctor
                if (order.orderingPhysician) {
                    selectedDoctor = order.orderingPhysician;
                    $('#doctorSearch').val(order.orderingPhysician.name);
                    $('#selectedDoctorInfo').html(`<strong>Selected:</strong> ${order.orderingPhysician.name}`).show();
                }
                
                // Load specimen information
                if (order.specimenInfo) {
                    $('#specimenType').val(order.specimenInfo.type || '');
                    $('#specimenCondition').val(order.specimenInfo.condition || 'good');
                    $('#specimenVolume').val(order.specimenInfo.volume || '');
                    $('#volumeUnit').val(order.specimenInfo.unit || 'mL');
                    $('#specimenNotes').val(order.specimenInfo.notes || '');
                }
                
                // Load tests - wait for tests to be loaded first
                setTimeout(() => {
                    if (order.tests && order.tests.length > 0) {
                        selectedTests = [];
                        order.tests.forEach(testItem => {
                            if (testItem.test) {
                                selectedTests.push({
                                    _id: testItem.test._id,
                                    testName: testItem.test.testName,
                                    testCode: testItem.test.testCode,
                                    price: testItem.test.price,
                                    category: testItem.test.category || testItem.test.panel
                                });
                                // Mark test as selected in the grid
                                $(`.test-card[data-test-id="${testItem.test._id}"]`).addClass('selected');
                            }
                        });
                        updateSelectedTestsList();
                        updateSaveButtonState();
                    }
                }, 500);
                
                // Load clinical info
                if (order.clinicalInfo) {
                    $('#diagnosis').val(order.clinicalInfo.diagnosis || '');
                    $('#specialInstructions').val(order.clinicalInfo.specialInstructions || '');
                }
            })
            .fail(function() {
                alert('Failed to load order for editing');
                window.location.href = '/orders';
            });
    }

    function setCurrentDateTime() {
        const now = new Date();
        const localDateTime = now.toISOString().slice(0, 16);
        $('#orderDateTime').val(localDateTime);
        $('#collectionDateTime').val(localDateTime);
    }

    function setupEventHandlers() {
        // Patient search
        $('#patientSearch').on('input', debounce(searchPatients, 300));
        $('#searchPatientBtn').click(searchPatients);
        $('#newPatientBtn').click(showNewPatientModal);
        $('#clearPatientBtn').click(clearPatient);
        $('#createPatientBtn').click(createNewPatient);

        // Office search
        $('#officeSearch').on('input', debounce(searchOffices, 300));

        // Doctor search
        $('#doctorSearch').on('input', debounce(searchDoctors, 300));

        // Test search
        $('#testSearch').on('input', debounce(filterTests, 300));
        $('#clearTestSearch').click(() => {
            $('#testSearch').val('');
            filterTests();
        });

        // Save buttons
        $('#saveOrderBtn').click(() => saveOrder(false));
        $('#saveAndPrintBtn').click(() => saveOrder(true));
        $('#cancelOrderBtn').click(() => {
            if (confirm('Cancel order entry? All data will be lost.')) {
                window.location.href = '/orders';
            }
        });

        // Close dropdowns on click outside
        $(document).click(function(e) {
            if (!$(e.target).closest('#patientSearch, #patientDropdown').length) {
                $('#patientDropdown').hide();
            }
            if (!$(e.target).closest('#officeSearch, #officeDropdown').length) {
                $('#officeDropdown').hide();
            }
            if (!$(e.target).closest('#doctorSearch, #doctorDropdown').length) {
                $('#doctorDropdown').hide();
            }
        });

        // Label preview controls
        $('#copiesPerTest').on('change', function() {
            if ($('#labelsContainer').children().length > 0) {
                generateLabels($('#orderNumber').text());
            }
        });
    }

    // Patient Functions
    function searchPatients() {
        const searchTerm = $('#patientSearch').val().trim();
        if (searchTerm.length < 2) {
            $('#patientDropdown').hide();
            return;
        }

        $.get(`/api/patients?search=${searchTerm}`)
            .done(function(response) {
                const patients = response.patients || [];
                displayPatientDropdown(patients, searchTerm);
            })
            .fail(function() {
                console.error('Failed to search patients');
            });
    }

    function displayPatientDropdown(patients, searchTerm) {
        const dropdown = $('#patientDropdown');
        dropdown.empty();

        if (patients.length === 0) {
            dropdown.append(`
                <div class="autocomplete-item text-muted">
                    No patients found
                </div>
                <div class="create-new-btn" onclick="OrderEntry.showNewPatientModal()">
                    <i class="fas fa-plus"></i> Create New Patient
                </div>
            `);
        } else {
            patients.forEach(patient => {
                const dob = new Date(patient.dateOfBirth).toLocaleDateString();
                dropdown.append(`
                    <div class="autocomplete-item" onclick="OrderEntry.selectPatient('${patient._id}')">
                        <strong>${patient.firstName} ${patient.lastName}</strong>
                        <span class="text-muted ms-2">ID: ${patient.patientId}</span>
                        <br>
                        <small>DOB: ${dob} | Phone: ${patient.phone || 'N/A'}</small>
                    </div>
                `);
            });
        }

        dropdown.show();
    }

    function selectPatient(patientId) {
        $.get(`/api/patients/${patientId}`)
            .done(function(response) {
                // Handle both direct patient object or wrapped in response
                const patient = response.patient || response;
                selectedPatient = patient;
                $('#patientSearch').val('');
                $('#patientDropdown').hide();
                $('#patientName').text(`${patient.firstName} ${patient.lastName}`);
                $('#patientId').text(patient.patientId);
                $('#patientDob').text(new Date(patient.dateOfBirth).toLocaleDateString());
                $('#selectedPatientInfo').show();
                updateSaveButtonState();
            })
            .fail(function() {
                console.error('Failed to load patient details');
            });
    }

    function clearPatient() {
        selectedPatient = null;
        $('#selectedPatientInfo').hide();
        $('#patientSearch').val('');
        updateSaveButtonState();
    }

    function showNewPatientModal() {
        $('#newPatientModal').modal('show');
        $('#patientDropdown').hide();
    }

    function createNewPatient() {
        const patientData = {
            firstName: $('#newPatientFirstName').val(),
            lastName: $('#newPatientLastName').val(),
            dateOfBirth: $('#newPatientDob').val(),
            gender: $('#newPatientGender').val(),
            phone: $('#newPatientPhone').val(),
            email: $('#newPatientEmail').val(),
            address: {
                street: $('#newPatientStreet').val(),
                city: $('#newPatientCity').val(),
                state: $('#newPatientState').val(),
                zipCode: $('#newPatientZipCode').val()
            },
            emergencyContact: {
                name: $('#newPatientEmergencyName').val(),
                phone: $('#newPatientEmergencyPhone').val(),
                relationship: $('#newPatientEmergencyRelationship').val()
            },
            insurance: {
                provider: $('#newPatientInsuranceProvider').val(),
                policyNumber: $('#newPatientPolicyNumber').val(),
                groupNumber: $('#newPatientGroupNumber').val()
            }
        };

        $.ajax({
            url: '/api/patients',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(patientData),
            success: function(response) {
                $('#newPatientModal').modal('hide');
                selectPatient(response.patient._id);
                $('#newPatientForm')[0].reset();
            },
            error: function(xhr) {
                alert('Failed to create patient: ' + (xhr.responseJSON?.message || 'Unknown error'));
            }
        });
    }

    // Office Functions - FIXED VERSION
    function searchOffices() {
        const searchTerm = $('#officeSearch').val().trim();
        if (searchTerm.length < 2) {
            $('#officeDropdown').hide();
            return;
        }

        $.get(`/api/medical-offices?search=${searchTerm}`)
            .done(function(response) {
                console.log('Office search response:', response); // Debug log
                // Handle both possible response structures
                let offices = [];
                if (Array.isArray(response)) {
                    offices = response;
                } else if (response.medicalOffices && Array.isArray(response.medicalOffices)) {
                    offices = response.medicalOffices;
                } else if (response.offices && Array.isArray(response.offices)) {
                    offices = response.offices;
                } else if (response.data && Array.isArray(response.data)) {
                    offices = response.data;
                }
                console.log('Processed offices:', offices); // Debug log
                displayOfficeDropdown(offices);
            })
            .fail(function(xhr, status, error) {
                console.error('Failed to search offices:', error);
                $('#officeDropdown').hide();
            });
    }

    function displayOfficeDropdown(offices) {
        const dropdown = $('#officeDropdown');
        dropdown.empty();

        if (!offices || !Array.isArray(offices) || offices.length === 0) {
            dropdown.html(`
                <div class="create-new-btn">
                    <i class="fas fa-plus"></i> Create New Office
                </div>
            `);
            // Attach click handler after adding to DOM
            dropdown.find('.create-new-btn').on('click', function() {
                OrderEntry.showNewOfficeModal();
            });
        } else {
            offices.forEach((office, index) => {
                const officeName = office.name || 'Unnamed Office';
                const officeId = office._id || office.id;
                
                const itemHtml = `
                    <div class="autocomplete-item office-item-${index}" data-index="${index}">
                        <strong>${officeName}</strong>
                        ${office.address ? `<br><small>${office.address.street || ''}, ${office.address.city || ''}</small>` : ''}
                    </div>
                `;
                dropdown.append(itemHtml);
                
                // Attach click handler to the specific item
                dropdown.find(`.office-item-${index}`).on('click', function() {
                    console.log('Office clicked:', officeId, officeName); // Debug log
                    OrderEntry.selectOffice(officeId, officeName);
                });
            });
        }

        dropdown.show();
    }

    function selectOffice(officeId, officeName) {
        console.log('selectOffice called with:', officeId, officeName); // Debug log
        selectedOffice = { _id: officeId, name: officeName };
        $('#officeSearch').val(officeName);
        $('#officeDropdown').hide();
        $('#selectedOfficeInfo').html(`<strong>Selected:</strong> ${officeName}`).show();
        updateSaveButtonState();
    }

    function showNewOfficeModal() {
        $('#newOfficeModal').modal('show');
        $('#officeDropdown').hide();
    }

    // Doctor Functions - FIXED VERSION
    function searchDoctors() {
        const searchTerm = $('#doctorSearch').val().trim();
        if (searchTerm.length < 2) {
            $('#doctorDropdown').hide();
            return;
        }

        $.get(`/api/doctors?search=${searchTerm}`)
            .done(function(response) {
                // Handle both possible response structures
                let doctors = [];
                if (Array.isArray(response)) {
                    doctors = response;
                } else if (response.doctors && Array.isArray(response.doctors)) {
                    doctors = response.doctors;
                } else if (response.data && Array.isArray(response.data)) {
                    doctors = response.data;
                }
                displayDoctorDropdown(doctors);
            })
            .fail(function() {
                console.error('Failed to search doctors');
                $('#doctorDropdown').hide();
            });
    }

    function displayDoctorDropdown(doctors) {
        const dropdown = $('#doctorDropdown');
        dropdown.empty();

        if (!doctors || !Array.isArray(doctors) || doctors.length === 0) {
            dropdown.append(`
                <div class="create-new-btn" onclick="OrderEntry.showNewDoctorModal()">
                    <i class="fas fa-plus"></i> Create New Doctor
                </div>
            `);
        } else {
            doctors.forEach(doctor => {
                // Construct doctor name from available fields
                const doctorName = doctor.name || 
                    `${doctor.title ? doctor.title + ' ' : ''}${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() ||
                    'Unnamed Doctor';
                    
                dropdown.append(`
                    <div class="autocomplete-item" onclick="OrderEntry.selectDoctor('${doctor._id}', '${doctorName}')">
                        <strong>${doctorName}</strong>
                        ${doctor.specialty || doctor.primarySpecialty ? `<br><small>${doctor.specialty || doctor.primarySpecialty}</small>` : ''}
                    </div>
                `);
            });
        }

        dropdown.show();
    }

    function selectDoctor(doctorId, doctorName) {
        selectedDoctor = { _id: doctorId, name: doctorName };
        $('#doctorSearch').val(doctorName);
        $('#doctorDropdown').hide();
        $('#selectedDoctorInfo').html(`<strong>Selected:</strong> ${doctorName}`).show();
        updateSaveButtonState();
    }

    function showNewDoctorModal() {
        $('#doctorModal').modal('show');
        $('#doctorDropdown').hide();
    }

    // Test Functions
    function loadTests() {
        // Load regular tests
        $.get('/api/tests')
            .done(function(response) {
                const regularTests = response.tests || response;
                regularTests.forEach(test => {
                    test.category = test.category || 'General';
                });
                allTests = [...allTests, ...regularTests];
                
                // Load PCR tests
                $.get('/api/pcr/tests')
                    .done(function(pcrResponse) {
                        const pcrTests = pcrResponse.tests || pcrResponse;
                        pcrTests.forEach(test => {
                            test.category = 'PCR';
                        });
                        allTests = [...allTests, ...pcrTests];
                        displayTests(allTests);
                    });
            });
    }

    function displayTests(tests) {
        const testGrid = $('#testGrid');
        testGrid.empty();

        tests.forEach(test => {
            const isSelected = selectedTests.some(t => t._id === test._id);
            testGrid.append(`
                <div class="test-card ${isSelected ? 'selected' : ''}" 
                     data-test-id="${test._id}"
                     onclick="OrderEntry.toggleTest('${test._id}')">
                    <strong>${test.testName}</strong>
                    <br><small>${test.testCode}</small>
                    <br><small class="text-muted">${test.category}</small>
                    ${test.price ? `<br><strong>$${test.price.toFixed(2)}</strong>` : ''}
                </div>
            `);
        });
    }

    function toggleTest(testId) {
        const test = allTests.find(t => t._id === testId);
        if (!test) return;

        const index = selectedTests.findIndex(t => t._id === testId);
        if (index > -1) {
            selectedTests.splice(index, 1);
            $(`.test-card[data-test-id="${testId}"]`).removeClass('selected');
        } else {
            selectedTests.push(test);
            $(`.test-card[data-test-id="${testId}"]`).addClass('selected');
        }

        updateSelectedTestsList();
        updateSaveButtonState();
    }

    function updateSelectedTestsList() {
        const listContainer = $('#selectedTestsList');
        listContainer.empty();

        if (selectedTests.length === 0) {
            listContainer.html('<div class="text-muted">No tests selected</div>');
        } else {
            selectedTests.forEach(test => {
                listContainer.append(`
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${test.testName}</strong>
                            <br><small>${test.testCode}</small>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="OrderEntry.toggleTest('${test._id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `);
            });
        }

        $('#totalTests').text(selectedTests.length);
    }

    function filterTests() {
        const searchTerm = $('#testSearch').val().toLowerCase();
        const filtered = searchTerm 
            ? allTests.filter(test => 
                test.testName.toLowerCase().includes(searchTerm) ||
                test.testCode.toLowerCase().includes(searchTerm)
              )
            : allTests;
        displayTests(filtered);
    }

    // Save Order Function - For both create and edit mode
    function saveOrder(printLabels = false) {
        // Validation
        if (!selectedPatient) {
            alert('Please select a patient');
            return;
        }

        if (selectedTests.length === 0) {
            alert('Please select at least one test');
            return;
        }

        const doctorName = $('#doctorSearch').val().trim();
        if (!doctorName) {
            alert('Please enter ordering physician name');
            return;
        }

        const specimenType = $('#specimenType').val();
        if (!specimenType) {
            alert('Please select specimen type');
            return;
        }

        // Prepare order data
        const orderData = {
            patient: selectedPatient._id,
            medicalOffice: selectedOffice?._id || null,
            orderingPhysician: {
                name: doctorName,
                _id: selectedDoctor?._id || null
            },
            tests: selectedTests.map(test => ({
                test: test._id,
                status: 'pending'
            })),
            priority: $('#orderPriority').val(),
            collectionType: $('#collectionType').val(),
            collectionDateTime: $('#collectionDateTime').val(),
            specimenInfo: {
                type: specimenType,
                condition: $('#specimenCondition').val(),
                volume: $('#specimenVolume').val(),
                unit: $('#volumeUnit').val(),
                notes: $('#specimenNotes').val()
            },
            clinicalInfo: {
                diagnosis: $('#diagnosis').val(),
                specialInstructions: $('#specialInstructions').val()
            }
        };

        // Determine if we're updating or creating
        const isEdit = editingOrderId ? true : false;
        const url = isEdit ? `/api/orders/${editingOrderId}` : '/api/orders';
        const method = isEdit ? 'PUT' : 'POST';

        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(orderData),
            success: function(response) {
                const orderNumber = response.order.orderNumber;
                $('#orderNumber').text(orderNumber);
                
                if (printLabels) {
                    // Generate and show labels
                    generateLabels(orderNumber);
                    $('#labelPreviewSection').show();
                    // Smooth scroll to label preview
                    $('html, body').animate({
                        scrollTop: $('#labelPreviewSection').offset().top - 100
                    }, 500);
                } else {
                    alert(isEdit ? 'Order updated successfully!' : 'Order created successfully!');
                    window.location.href = '/orders';
                }
            },
            error: function(xhr) {
                alert('Failed to save order: ' + (xhr.responseJSON?.message || 'Unknown error'));
            }
        });
    }

    function updateSaveButtonState() {
        const canSave = selectedPatient && selectedTests.length > 0;
        $('#saveOrderBtn').prop('disabled', !canSave);
        $('#saveAndPrintBtn').prop('disabled', !canSave);
    }

    // Label Functions
    function generateLabels(orderNumber) {
        const container = $('#labelsContainer');
        container.empty();
        
        const copiesPerTest = parseInt($('#copiesPerTest').val()) || 1;
        
        selectedTests.forEach(test => {
            for (let i = 0; i < copiesPerTest; i++) {
                const labelHtml = `
                    <div class="label-container">
                        <div class="barcode-section">
                            <canvas id="barcode-${test._id}-${i}"></canvas>
                        </div>
                        <div class="order-number">${orderNumber}</div>
                        <div class="patient-info">
                            <div class="info-row">
                                <span class="info-label">Name:</span>
                                <span class="info-value">${selectedPatient.firstName} ${selectedPatient.lastName}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">DOB:</span>
                                <span class="info-value">${new Date(selectedPatient.dateOfBirth).toLocaleDateString()}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">ID:</span>
                                <span class="info-value">${selectedPatient.patientId}</span>
                            </div>
                            <div class="test-name">${test.testName}</div>
                            <div class="date-time">${new Date().toLocaleString()}</div>
                        </div>
                    </div>
                `;
                container.append(labelHtml);
                
                // Generate barcode
                JsBarcode(`#barcode-${test._id}-${i}`, orderNumber, {
                    format: "CODE128",
                    width: 1.5,
                    height: 25,
                    displayValue: false,
                    margin: 0
                });
            }
        });
    }

    function printLabelsNow() {
        // Create a hidden iframe specifically for printing
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'absolute';
        printFrame.style.top = '-9999px';
        printFrame.style.left = '-9999px';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        document.body.appendChild(printFrame);
        
        const printDocument = printFrame.contentDocument || printFrame.contentWindow.document;
        
        // Get just the label content
        const labelContent = document.getElementById('labelsContainer').innerHTML;
        
        // Create a complete HTML document with proper print styles
        const printHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Print Labels</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    @media print {
                        @page {
                            size: 2in 1in;
                            margin: 0;
                        }
                        
                        body {
                            margin: 0;
                            padding: 0;
                        }
                    }
                    
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: Arial, sans-serif;
                    }
                    
                    .label-container {
                        width: 2in;
                        height: 1in;
                        padding: 8px;
                        page-break-after: always;
                        page-break-inside: avoid;
                        display: flex;
                        flex-direction: column;
                        font-size: 10px;
                        line-height: 1.2;
                        border: none;
                        box-shadow: none;
                    }
                    
                    .label-container:last-child {
                        page-break-after: auto;
                    }
                    
                    .barcode-section {
                        text-align: center;
                        margin-bottom: 4px;
                    }
                    
                    .barcode-section canvas {
                        max-width: 100%;
                        height: 25px;
                    }
                    
                    .order-number {
                        text-align: center;
                        font-size: 9px;
                        font-weight: bold;
                        margin-bottom: 4px;
                    }
                    
                    .patient-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }
                    
                    .info-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 2px;
                        font-size: 9px;
                    }
                    
                    .info-label {
                        font-weight: bold;
                        margin-right: 4px;
                    }
                    
                    .info-value {
                        flex: 1;
                        text-overflow: ellipsis;
                        overflow: hidden;
                        white-space: nowrap;
                    }
                    
                    .test-name {
                        font-weight: bold;
                        font-size: 10px;
                        text-overflow: ellipsis;
                        overflow: hidden;
                        white-space: nowrap;
                    }
                    
                    .date-time {
                        font-size: 8px;
                        text-align: right;
                        margin-top: 2px;
                    }
                </style>
            </head>
            <body>
                ${labelContent}
            </body>
            </html>
        `;
        
        printDocument.open();
        printDocument.write(printHTML);
        printDocument.close();
        
        // Wait for content and images to load
        setTimeout(() => {
            // Re-generate barcodes in the iframe
            const canvases = printDocument.querySelectorAll('canvas');
            const sourceCanvases = document.querySelectorAll('#labelsContainer canvas');
            
            canvases.forEach((canvas, index) => {
                if (sourceCanvases[index]) {
                    const ctx = canvas.getContext('2d');
                    canvas.width = sourceCanvases[index].width;
                    canvas.height = sourceCanvases[index].height;
                    ctx.drawImage(sourceCanvases[index], 0, 0);
                }
            });
            
            // Print just the iframe content
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            
            // Clean up after printing
            setTimeout(() => {
                document.body.removeChild(printFrame);
            }, 1000);
        }, 500);
    }

    function hideLabels() {
        $('#labelPreviewSection').hide();
    }

    // Utility Functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API
    return {
        selectPatient,
        selectOffice,
        selectDoctor,
        toggleTest,
        showNewPatientModal,
        showNewOfficeModal,
        showNewDoctorModal,
        printLabelsNow,
        hideLabels
    };
})();

// CRITICAL: Expose OrderEntry to global scope for onclick handlers
window.OrderEntry = OrderEntry;

// Global saveDoctor function for the doctor modal
function saveDoctor() {
    const doctorData = {
        title: $('#doctorTitle').val(),
        firstName: $('#firstName').val(),
        lastName: $('#lastName').val(),
        name: `Dr. ${$('#firstName').val()} ${$('#lastName').val()}`,
        npiNumber: $('#npiNumber').val(),
        phone: $('#phoneOffice').val(),
        email: $('#emailPrimary').val(),
        specialty: $('#primarySpecialty').val()
    };

    $.ajax({
        url: '/api/doctors',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(doctorData),
        success: function(response) {
            $('#doctorModal').modal('hide');
            OrderEntry.selectDoctor(response.doctor._id, response.doctor.name);
            $('#doctorForm')[0].reset();
        },
        error: function(xhr) {
            alert('Failed to create doctor: ' + (xhr.responseJSON?.message || 'Unknown error'));
        }
    });
}

// Create office button handler
$('#createOfficeBtn').click(function() {
    const officeData = {
        name: $('#newOfficeName').val(),
        address: {
            street: $('#newOfficeStreet').val(),
            suite: $('#newOfficeSuite').val(),
            city: $('#newOfficeCity').val(),
            state: $('#newOfficeState').val(),
            zipCode: $('#newOfficeZipCode').val()
        },
        phone: $('#newOfficePhoneMain').val(),
        email: $('#newOfficeEmailGeneral').val(),
        contactPerson: {
            name: $('#newOfficeContactName').val(),
            title: $('#newOfficeContactTitle').val(),
            phone: $('#newOfficeContactPhone').val(),
            email: $('#newOfficeContactEmail').val()
        }
    };

    $.ajax({
        url: '/api/medical-offices',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(officeData),
        success: function(response) {
            $('#newOfficeModal').modal('hide');
            OrderEntry.selectOffice(response.office._id, response.office.name);
            $('#newOfficeForm')[0].reset();
        },
        error: function(xhr) {
            alert('Failed to create office: ' + (xhr.responseJSON?.message || 'Unknown error'));
        }
    });
});