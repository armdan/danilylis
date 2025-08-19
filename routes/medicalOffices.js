const express = require('express');
const { body, validationResult, query } = require('express-validator');
const MedicalOffice = require('../models/MedicalOffice');
const Organization = require('../models/Organization');
const Doctor = require('../models/Doctor');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all medical offices with pagination and search
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']),
  query('organization').optional().isMongoId()
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
    const organizationId = req.query.organization;

    // Build query
    let queryObj = {};
    
    if (search) {
      queryObj.$or = [
        { name: { $regex: search, $options: 'i' } },
        { officeCode: { $regex: search, $options: 'i' } },
        { 'contactPerson.name': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.zipCode': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) queryObj.status = status;
    if (organizationId) queryObj.organization = organizationId;

    const medicalOffices = await MedicalOffice.find(queryObj)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .populate('organization', 'name code')
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username');

    const total = await MedicalOffice.countDocuments(queryObj);

    // Get doctor counts for each office
    const officeIds = medicalOffices.map(office => office._id);
    const doctorCounts = await Doctor.aggregate([
      { $match: { medicalOffices: { $in: officeIds } } },
      { $unwind: '$medicalOffices' },
      { $match: { medicalOffices: { $in: officeIds } } },
      { $group: { _id: '$medicalOffices', count: { $sum: 1 } } }
    ]);

    const doctorCountMap = {};
    doctorCounts.forEach(dc => {
      doctorCountMap[dc._id.toString()] = dc.count;
    });

    const officesWithCounts = medicalOffices.map(office => ({
      ...office.toObject(),
      doctorCount: doctorCountMap[office._id.toString()] || 0
    }));

    res.json({
      medicalOffices: officesWithCounts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Get medical offices error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get medical office by ID
router.get('/:id', async (req, res) => {
  try {
    const medicalOffice = await MedicalOffice.findById(req.params.id)
      .populate('organization', 'name code')
      .populate('preferredTests', 'testName testCode')
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username');

    if (!medicalOffice) {
      return res.status(404).json({ message: 'Medical office not found' });
    }

    // Get associated doctors
    const doctors = await Doctor.find({ medicalOffices: req.params.id })
      .select('firstName lastName title npiNumber primarySpecialty status');

    res.json({ 
      medicalOffice,
      doctors 
    });
  } catch (error) {
    console.error('Get medical office error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new medical office
router.post('/', [
  authorize('admin'),
  body('name').trim().notEmpty().withMessage('Office name is required'),
  body('address.street').trim().notEmpty().withMessage('Street address is required'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.state').isLength({ min: 2, max: 2 }).withMessage('Valid state code required'),
  body('address.zipCode').matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code required'),
  body('phone.main').trim().notEmpty().withMessage('Main phone number is required'),
  body('email.general').isEmail().withMessage('Valid email required'),
  body('contactPerson.name').trim().notEmpty().withMessage('Contact person name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify organization exists if provided
    if (req.body.organization) {
      const org = await Organization.findById(req.body.organization);
      if (!org) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
    }

    const medicalOffice = new MedicalOffice({
      ...req.body,
      createdBy: req.user.userId || req.user._id
    });

    await medicalOffice.save();

    res.status(201).json({
      message: 'Medical office created successfully',
      medicalOffice
    });
  } catch (error) {
    console.error('Create medical office error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `Medical office with this ${field} already exists` 
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update medical office
router.put('/:id', [
  authorize('admin'),
  body('name').optional().trim().notEmpty().withMessage('Office name cannot be empty'),
  body('email.general').optional().isEmail().withMessage('Valid email required'),
  body('address.zipCode').optional().matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const medicalOffice = await MedicalOffice.findById(req.params.id);
    if (!medicalOffice) {
      return res.status(404).json({ message: 'Medical office not found' });
    }

    // Verify organization exists if being changed
    if (req.body.organization && req.body.organization !== medicalOffice.organization?.toString()) {
      const org = await Organization.findById(req.body.organization);
      if (!org) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
    }

    Object.assign(medicalOffice, req.body, {
      modifiedBy: req.user.userId || req.user._id
    });

    await medicalOffice.save();

    res.json({
      message: 'Medical office updated successfully',
      medicalOffice
    });
  } catch (error) {
    console.error('Update medical office error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete medical office (soft delete)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const medicalOffice = await MedicalOffice.findById(req.params.id);
    if (!medicalOffice) {
      return res.status(404).json({ message: 'Medical office not found' });
    }

    // Check if there are active doctors
    const activeDoctors = await Doctor.countDocuments({
      medicalOffices: req.params.id,
      status: 'active'
    });

    if (activeDoctors > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete medical office with active doctors' 
      });
    }

    medicalOffice.status = 'inactive';
    medicalOffice.modifiedBy = req.user.userId || req.user._id;
    await medicalOffice.save();

    res.json({ message: 'Medical office deactivated successfully' });
  } catch (error) {
    console.error('Delete medical office error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get medical office statistics
router.get('/:id/statistics', async (req, res) => {
  try {
    const medicalOffice = await MedicalOffice.findById(req.params.id);
    if (!medicalOffice) {
      return res.status(404).json({ message: 'Medical office not found' });
    }

    // Get doctor count
    const doctorCount = await Doctor.countDocuments({
      medicalOffices: req.params.id
    });

    // Get order count
    const Order = require('../models/Order');
    const orderCount = await Order.countDocuments({
      'orderingPhysician.medicalOfficeId': req.params.id
    });

    // Get recent orders
    const recentOrders = await Order.find({
      'orderingPhysician.medicalOfficeId': req.params.id
    })
      .sort('-createdAt')
      .limit(5)
      .select('orderNumber createdAt status priority');

    res.json({
      statistics: {
        totalDoctors: doctorCount,
        totalOrders: orderCount,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Get medical office statistics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk import medical offices
router.post('/bulk-import', [
  authorize('admin'),
  body('offices').isArray({ min: 1 }).withMessage('At least one office is required'),
  body('offices.*.name').trim().notEmpty().withMessage('Office name is required'),
  body('offices.*.address.street').trim().notEmpty().withMessage('Street address is required'),
  body('offices.*.address.city').trim().notEmpty().withMessage('City is required'),
  body('offices.*.address.state').isLength({ min: 2, max: 2 }).withMessage('Valid state code required'),
  body('offices.*.address.zipCode').matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const officeData of req.body.offices) {
      try {
        const office = new MedicalOffice({
          ...officeData,
          createdBy: req.user.userId || req.user._id
        });
        await office.save();
        results.success.push({
          name: office.name,
          officeCode: office.officeCode
        });
      } catch (error) {
        results.failed.push({
          name: officeData.name,
          error: error.message
        });
      }
    }

    res.json({
      message: `Imported ${results.success.length} offices successfully`,
      results
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;