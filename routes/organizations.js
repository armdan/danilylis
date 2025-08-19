const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Organization = require('../models/Organization');
const MedicalOffice = require('../models/MedicalOffice');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all organizations with pagination and search
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive', 'suspended'])
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

    // Build query
    let queryObj = {};
    
    if (search) {
      queryObj.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { 'primaryContact.name': { $regex: search, $options: 'i' } },
        { 'primaryContact.email': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) queryObj.status = status;

    const organizations = await Organization.find(queryObj)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username');

    const total = await Organization.countDocuments(queryObj);

    // Get office counts for each organization
    const orgIds = organizations.map(org => org._id);
    const officeCounts = await MedicalOffice.aggregate([
      { $match: { organization: { $in: orgIds } } },
      { $group: { _id: '$organization', count: { $sum: 1 } } }
    ]);

    const officeCountMap = {};
    officeCounts.forEach(oc => {
      officeCountMap[oc._id.toString()] = oc.count;
    });

    const orgsWithCounts = organizations.map(org => ({
      ...org.toObject(),
      officeCount: officeCountMap[org._id.toString()] || 0
    }));

    res.json({
      organizations: orgsWithCounts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get organization by ID
router.get('/:id', async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username');

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Get associated medical offices
    const medicalOffices = await MedicalOffice.find({ organization: req.params.id })
      .select('name officeCode address status');

    res.json({ 
      organization,
      medicalOffices 
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new organization
router.post('/', [
  authorize('admin'),
  body('name').trim().notEmpty().withMessage('Organization name is required'),
  body('headquarters.street').trim().notEmpty().withMessage('Street address is required'),
  body('headquarters.city').trim().notEmpty().withMessage('City is required'),
  body('headquarters.state').isLength({ min: 2, max: 2 }).withMessage('Valid state code required'),
  body('headquarters.zipCode').matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code required'),
  body('primaryContact.name').trim().notEmpty().withMessage('Contact name is required'),
  body('primaryContact.phone').trim().notEmpty().withMessage('Contact phone is required'),
  body('primaryContact.email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check for duplicate name
    const existingOrg = await Organization.findOne({ name: req.body.name });
    if (existingOrg) {
      return res.status(400).json({ message: 'Organization with this name already exists' });
    }

    const organization = new Organization({
      ...req.body,
      createdBy: req.user.userId || req.user._id
    });

    await organization.save();

    res.status(201).json({
      message: 'Organization created successfully',
      organization
    });
  } catch (error) {
    console.error('Create organization error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `Organization with this ${field} already exists` 
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update organization
router.put('/:id', [
  authorize('admin'),
  body('name').optional().trim().notEmpty().withMessage('Organization name cannot be empty'),
  body('primaryContact.email').optional().isEmail().withMessage('Valid email required'),
  body('headquarters.zipCode').optional().matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check for duplicate name if name is being changed
    if (req.body.name && req.body.name !== organization.name) {
      const existingOrg = await Organization.findOne({ 
        name: req.body.name,
        _id: { $ne: req.params.id }
      });
      if (existingOrg) {
        return res.status(400).json({ message: 'Organization with this name already exists' });
      }
    }

    Object.assign(organization, req.body, {
      modifiedBy: req.user.userId || req.user._id
    });

    await organization.save();

    res.json({
      message: 'Organization updated successfully',
      organization
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete organization (soft delete by changing status)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if there are active medical offices
    const activeOffices = await MedicalOffice.countDocuments({
      organization: req.params.id,
      status: 'active'
    });

    if (activeOffices > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete organization with active medical offices' 
      });
    }

    organization.status = 'inactive';
    organization.modifiedBy = req.user.userId || req.user._id;
    await organization.save();

    res.json({ message: 'Organization deactivated successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get organization statistics
router.get('/:id/statistics', async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const medicalOffices = await MedicalOffice.find({ organization: req.params.id });
    const officeIds = medicalOffices.map(office => office._id);

    // Get doctor count
    const Doctor = require('../models/Doctor');
    const doctorCount = await Doctor.countDocuments({
      medicalOffices: { $in: officeIds }
    });

    // Get order count
    const Order = require('../models/Order');
    const orderCount = await Order.countDocuments({
      'orderingPhysician.medicalOfficeId': { $in: officeIds }
    });

    res.json({
      statistics: {
        totalOffices: medicalOffices.length,
        activeOffices: medicalOffices.filter(o => o.status === 'active').length,
        totalDoctors: doctorCount,
        totalOrders: orderCount
      }
    });
  } catch (error) {
    console.error('Get organization statistics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;