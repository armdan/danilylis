const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Patient = require('../models/Patient');
const { authenticateToken, authorize, checkPatientAccess } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all patients with pagination and search
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim(),
  query('gender').optional().isIn(['male', 'female', 'other']),
  query('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const gender = req.query.gender;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (gender) query.gender = gender;
    if (isActive !== undefined) query.isActive = isActive;

    const patients = await Patient.find(query)
      .select('-medicalHistory -allergies -currentMedications') // Exclude sensitive data in list
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'firstName lastName username');

    const total = await Patient.countDocuments(query);

    res.json({
      patients,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get patient by ID
router.get('/:id', checkPatientAccess, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('createdBy', 'firstName lastName username');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({ patient });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new patient
router.post('/', [
  authorize('admin', 'doctor', 'receptionist'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().normalizeEmail(),
  body('address.street').optional().trim(),
  body('address.city').optional().trim(),
  body('address.state').optional().trim(),
  body('address.zipCode').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if patient with same phone already exists
    const existingPatient = await Patient.findOne({ 
      phone: req.body.phone,
      isActive: true 
    });

    if (existingPatient) {
      return res.status(400).json({ 
        message: 'Patient with this phone number already exists' 
      });
    }

    // Generate patient ID
    const patientId = await Patient.generatePatientId();

    const patient = new Patient({
      ...req.body,
      patientId,
      createdBy: req.user._id
    });

    await patient.save();
    await patient.populate('createdBy', 'firstName lastName username');

    res.status(201).json({
      message: 'Patient created successfully',
      patient
    });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update patient
router.put('/:id', [
  authorize('admin', 'doctor', 'receptionist'),
  checkPatientAccess,
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth is required'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('phone').optional().trim().notEmpty().withMessage('Phone number cannot be empty'),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patientId = req.params.id;

    // If phone is being updated, check for duplicates
    if (req.body.phone) {
      const existingPatient = await Patient.findOne({ 
        phone: req.body.phone,
        _id: { $ne: patientId },
        isActive: true 
      });

      if (existingPatient) {
        return res.status(400).json({ 
          message: 'Another patient with this phone number already exists' 
        });
      }
    }

    const patient = await Patient.findByIdAndUpdate(
      patientId,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName username');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({
      message: 'Patient updated successfully',
      patient
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add medical history entry
router.post('/:id/medical-history', [
  authorize('admin', 'doctor'),
  checkPatientAccess,
  body('condition').trim().notEmpty().withMessage('Condition is required'),
  body('diagnosedDate').optional().isISO8601().withMessage('Valid diagnosed date required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    patient.medicalHistory.push(req.body);
    await patient.save();

    res.json({
      message: 'Medical history added successfully',
      medicalHistory: patient.medicalHistory
    });
  } catch (error) {
    console.error('Add medical history error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add allergy
router.post('/:id/allergies', [
  authorize('admin', 'doctor'),
  checkPatientAccess,
  body('allergen').trim().notEmpty().withMessage('Allergen is required'),
  body('severity').isIn(['mild', 'moderate', 'severe']).withMessage('Valid severity is required'),
  body('reaction').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    patient.allergies.push(req.body);
    await patient.save();

    res.json({
      message: 'Allergy added successfully',
      allergies: patient.allergies
    });
  } catch (error) {
    console.error('Add allergy error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Soft delete patient
router.delete('/:id', [
  authorize('admin'),
  checkPatientAccess
], async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({ message: 'Patient deactivated successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get patient statistics
router.get('/stats/overview', authorize('admin', 'doctor'), async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments({ isActive: true });
    const malePatients = await Patient.countDocuments({ gender: 'male', isActive: true });
    const femalePatients = await Patient.countDocuments({ gender: 'female', isActive: true });
    
    // Age groups
    const today = new Date();
    const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    const sixtyFiveYearsAgo = new Date(today.getFullYear() - 65, today.getMonth(), today.getDate());

    const pediatric = await Patient.countDocuments({ 
      dateOfBirth: { $gt: eighteenYearsAgo },
      isActive: true 
    });
    const adults = await Patient.countDocuments({ 
      dateOfBirth: { $lte: eighteenYearsAgo, $gt: sixtyFiveYearsAgo },
      isActive: true 
    });
    const seniors = await Patient.countDocuments({ 
      dateOfBirth: { $lte: sixtyFiveYearsAgo },
      isActive: true 
    });

    res.json({
      total: totalPatients,
      genderDistribution: {
        male: malePatients,
        female: femalePatients,
        other: totalPatients - malePatients - femalePatients
      },
      ageGroups: {
        pediatric: pediatric,
        adults: adults,
        seniors: seniors
      }
    });
  } catch (error) {
    console.error('Patient stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;