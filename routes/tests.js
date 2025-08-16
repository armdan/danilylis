const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Test = require('../models/Test');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all tests with pagination and search
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim(),
  query('category').optional().isIn(['hematology', 'biochemistry', 'microbiology', 'immunology', 'pathology', 'radiology', 'molecular']),
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
    const category = req.query.category;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { testName: { $regex: search, $options: 'i' } },
        { testCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive;

    const tests = await Test.find(query)
      .sort({ testName: 1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'firstName lastName username');

    const total = await Test.countDocuments(query);

    res.json({
      tests,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get test by ID
router.get('/:id', async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate('createdBy', 'firstName lastName username');

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json({ test });
  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new test
router.post('/', [
  authorize('admin'),
  body('testCode').trim().notEmpty().withMessage('Test code is required'),
  body('testName').trim().notEmpty().withMessage('Test name is required'),
  body('category').isIn(['hematology', 'biochemistry', 'microbiology', 'immunology', 'pathology', 'radiology', 'molecular']).withMessage('Valid category is required'),
  body('sampleType').isIn(['blood', 'urine', 'serum', 'plasma', 'stool', 'saliva', 'tissue', 'swab', 'other']).withMessage('Valid sample type is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if test code already exists
    const existingTest = await Test.findOne({ 
      testCode: req.body.testCode.toUpperCase() 
    });

    if (existingTest) {
      return res.status(400).json({ 
        message: 'Test with this code already exists' 
      });
    }

    const test = new Test({
      ...req.body,
      testCode: req.body.testCode.toUpperCase(),
      createdBy: req.user._id
    });

    await test.save();
    await test.populate('createdBy', 'firstName lastName username');

    res.status(201).json({
      message: 'Test created successfully',
      test
    });
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update test
router.put('/:id', [
  authorize('admin'),
  body('testName').optional().trim().notEmpty().withMessage('Test name cannot be empty'),
  body('category').optional().isIn(['hematology', 'biochemistry', 'microbiology', 'immunology', 'pathology', 'radiology', 'molecular']),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const test = await Test.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName username');

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json({
      message: 'Test updated successfully',
      test
    });
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Soft delete test
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json({ message: 'Test deactivated successfully' });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get tests by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const tests = await Test.find({ 
      category, 
      isActive: true 
    }).sort({ testName: 1 });

    res.json({ tests });
  } catch (error) {
    console.error('Get tests by category error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;