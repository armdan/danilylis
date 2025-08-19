const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Doctor = require('../models/Doctor');
const MedicalOffice = require('../models/MedicalOffice');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all doctors with pagination and search
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending_verification']),
  query('medicalOffice').optional().isMongoId(),
  query('specialty').optional().trim()
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
    const status = req.query.status;
    const medicalOfficeId = req.query.medicalOffice;
    const specialty = req.query.specialty;

    // Build query
    let queryObj = {};
    
    if (search) {
      queryObj.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { npiNumber: { $regex: search, $options: 'i' } },
        { 'email.primary': { $regex: search, $options: 'i' } },
        { primarySpecialty: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) queryObj.status = status;
    if (medicalOfficeId) queryObj.medicalOffices = medicalOfficeId;
    if (specialty) queryObj.primarySpecialty = { $regex: specialty, $options: 'i' };

    const doctors = await Doctor.find(queryObj)
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(limit)
      .populate('medicalOffices', 'name officeCode')
      .populate('primaryOffice', 'name officeCode')
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username');

    const total = await Doctor.countDocuments(queryObj);

    res.json({
      doctors,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get doctor by ID
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('medicalOffices', 'name officeCode address phone')
      .populate('primaryOffice', 'name officeCode')
      .populate('preferences.preferredTests', 'testName testCode')
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Update statistics
    await doctor.updateStatistics();

    res.json({ doctor });
  } catch (error) {
    console.error('Get doctor error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new doctor
router.post('/', [
  authorize('admin', 'receptionist'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('title').isIn(['MD', 'DO', 'DPM', 'DDS', 'DMD', 'PhD', 'PA', 'NP', 'RN', 'Other']).withMessage('Valid title required'),
  body('npiNumber').matches(/^\d{10}$/).withMessage('Valid 10-digit NPI number required'),
  body('primarySpecialty').trim().notEmpty().withMessage('Primary specialty is required'),
  body('phone.office').trim().notEmpty().withMessage('Office phone is required'),
  body('email.primary').isEmail().withMessage('Valid primary email required'),
  body('medicalOffices').optional().isArray().withMessage('Medical offices must be an array'),
  body('medicalOffices.*').optional().isMongoId().withMessage('Valid medical office ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check for duplicate NPI
    const existingDoctor = await Doctor.findOne({ npiNumber: req.body.npiNumber });
    if (existingDoctor) {
      return res.status(400).json({ message: 'Doctor with this NPI number already exists' });
    }

    // Verify medical offices exist
    if (req.body.medicalOffices && req.body.medicalOffices.length > 0) {
      const offices = await MedicalOffice.find({ 
        _id: { $in: req.body.medicalOffices } 
      });
      if (offices.length !== req.body.medicalOffices.length) {
        return res.status(400).json({ message: 'One or more invalid medical office IDs' });
      }
    }

    // Verify primary office is in the medical offices list
    if (req.body.primaryOffice) {
      if (!req.body.medicalOffices || !req.body.medicalOffices.includes(req.body.primaryOffice)) {
        return res.status(400).json({ 
          message: 'Primary office must be one of the selected medical offices' 
        });
      }
    }

    const doctor = new Doctor({
      ...req.body,
      createdBy: req.user.userId || req.user._id
    });

    await doctor.save();

    res.status(201).json({
      message: 'Doctor created successfully',
      doctor
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `Doctor with this ${field} already exists` 
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update doctor
router.put('/:id', [
  authorize('admin', 'receptionist'),
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('npiNumber').optional().matches(/^\d{10}$/).withMessage('Valid 10-digit NPI number required'),
  body('email.primary').optional().isEmail().withMessage('Valid primary email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check for duplicate NPI if being changed
    if (req.body.npiNumber && req.body.npiNumber !== doctor.npiNumber) {
      const existingDoctor = await Doctor.findOne({ 
        npiNumber: req.body.npiNumber,
        _id: { $ne: req.params.id }
      });
      if (existingDoctor) {
        return res.status(400).json({ message: 'Doctor with this NPI number already exists' });
      }
    }

    // Verify medical offices exist if being changed
    if (req.body.medicalOffices && req.body.medicalOffices.length > 0) {
      const offices = await MedicalOffice.find({ 
        _id: { $in: req.body.medicalOffices } 
      });
      if (offices.length !== req.body.medicalOffices.length) {
        return res.status(400).json({ message: 'One or more invalid medical office IDs' });
      }
    }

    Object.assign(doctor, req.body, {
      modifiedBy: req.user.userId || req.user._id
    });

    await doctor.save();

    res.json({
      message: 'Doctor updated successfully',
      doctor
    });
  } catch (error) {
    console.error('Update doctor error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete doctor (soft delete)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check if doctor has recent orders
    const Order = require('../models/Order');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentOrders = await Order.countDocuments({
      'orderingPhysician.doctorId': req.params.id,
      createdAt: { $gte: thirtyDaysAgo }
    });

    if (recentOrders > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete doctor with recent orders (last 30 days)' 
      });
    }

    doctor.status = 'inactive';
    doctor.modifiedBy = req.user.userId || req.user._id;
    await doctor.save();

    res.json({ message: 'Doctor deactivated successfully' });
  } catch (error) {
    console.error('Delete doctor error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add medical office to doctor
router.post('/:id/medical-offices', [
  authorize('admin', 'receptionist'),
  body('medicalOfficeId').isMongoId().withMessage('Valid medical office ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const medicalOffice = await MedicalOffice.findById(req.body.medicalOfficeId);
    if (!medicalOffice) {
      return res.status(404).json({ message: 'Medical office not found' });
    }

    // Check if already associated
    if (doctor.medicalOffices.includes(req.body.medicalOfficeId)) {
      return res.status(400).json({ message: 'Doctor already associated with this medical office' });
    }

    doctor.medicalOffices.push(req.body.medicalOfficeId);
    doctor.modifiedBy = req.user.userId || req.user._id;
    await doctor.save();

    res.json({
      message: 'Medical office added successfully',
      doctor
    });
  } catch (error) {
    console.error('Add medical office error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove medical office from doctor
router.delete('/:id/medical-offices/:officeId', authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check if this is the primary office
    if (doctor.primaryOffice?.toString() === req.params.officeId) {
      return res.status(400).json({ 
        message: 'Cannot remove primary office. Please change primary office first.' 
      });
    }

    doctor.medicalOffices = doctor.medicalOffices.filter(
      office => office.toString() !== req.params.officeId
    );
    doctor.modifiedBy = req.user.userId || req.user._id;
    await doctor.save();

    res.json({
      message: 'Medical office removed successfully',
      doctor
    });
  } catch (error) {
    console.error('Remove medical office error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get doctor statistics
router.get('/:id/statistics', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    await doctor.updateStatistics();

    // Get detailed order statistics
    const Order = require('../models/Order');
    
    // Orders by status
    const ordersByStatus = await Order.aggregate([
      { $match: { 'orderingPhysician.doctorId': doctor._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Recent orders
    const recentOrders = await Order.find({
      'orderingPhysician.doctorId': doctor._id
    })
      .sort('-createdAt')
      .limit(10)
      .select('orderNumber createdAt status priority patient')
      .populate('patient', 'firstName lastName patientId');

    res.json({
      statistics: doctor.statistics,
      ordersByStatus,
      recentOrders
    });
  } catch (error) {
    console.error('Get doctor statistics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Search doctors for autocomplete
router.get('/search/autocomplete', [
  query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  query('officeId').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const searchQuery = req.query.q;
    const officeId = req.query.officeId;

    let queryObj = {
      status: 'active',
      $or: [
        { firstName: { $regex: searchQuery, $options: 'i' } },
        { lastName: { $regex: searchQuery, $options: 'i' } },
        { npiNumber: { $regex: searchQuery, $options: 'i' } }
      ]
    };

    if (officeId) {
      queryObj.medicalOffices = officeId;
    }

    const doctors = await Doctor.find(queryObj)
      .limit(10)
      .select('firstName lastName title npiNumber primarySpecialty')
      .sort('lastName firstName');

    const results = doctors.map(doc => ({
      id: doc._id,
      label: doc.fullName,
      value: doc._id,
      npiNumber: doc.npiNumber,
      specialty: doc.primarySpecialty
    }));

    res.json(results);
  } catch (error) {
    console.error('Autocomplete search error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;