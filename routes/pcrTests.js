// routes/pcrTests.js
const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const PCRTest = require('../models/PCRTest');
const PCRResult = require('../models/PCRResult');
const { authenticateToken, authorize } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// ============= PCR TEST MANAGEMENT =============

// Test route to verify model is working
router.get('/test-model', async (req, res) => {
  try {
    const testCount = await PCRTest.countDocuments();
    res.json({ 
      message: 'PCRTest model is working',
      totalTests: testCount,
      modelName: PCRTest.modelName
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'PCRTest model error',
      error: error.message 
    });
  }
});

// Get all PCR tests with filtering
router.get('/tests', [
  query('panel').optional().isIn(['UTI', 'Nail_Fungus', 'Pneumonia', 'Wound', 'GI', 'COVID_FLU_RSV', 'STI', 'Respiratory']),
  query('search').optional().trim(),
  query('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let queryObj = {};
    if (req.query.panel) queryObj.panel = req.query.panel;
    if (req.query.isActive !== undefined) queryObj.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      queryObj.$or = [
        { testName: { $regex: req.query.search, $options: 'i' } },
        { testCode: { $regex: req.query.search, $options: 'i' } },
        { 'targets.name': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const tests = await PCRTest.find(queryObj)
      .populate('createdBy', 'firstName lastName')
      .sort({ panel: 1, testName: 1 });

    res.json({ tests });
  } catch (error) {
    console.error('Get PCR tests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get PCR test by ID with full details
router.get('/tests/:id', async (req, res) => {
  try {
    const test = await PCRTest.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('lastModifiedBy', 'firstName lastName');

    if (!test) {
      return res.status(404).json({ message: 'PCR test not found' });
    }

    res.json({ test });
  } catch (error) {
    console.error('Get PCR test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get tests by panel
router.get('/tests/panel/:panel', async (req, res) => {
  try {
    const tests = await PCRTest.getByPanel(req.params.panel);
    res.json({ tests });
  } catch (error) {
    console.error('Get tests by panel error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new PCR test (Admin only)
router.post('/tests', [
  authorize('admin'),
  body('testCode').trim().notEmpty().withMessage('Test code is required'),
  body('testName').trim().notEmpty().withMessage('Test name is required'),
  body('panel').isIn(['UTI', 'Nail_Fungus', 'Pneumonia', 'Wound', 'GI', 'COVID_FLU_RSV', 'STI', 'Respiratory', 'Custom']),
  body('price').isFloat({ min: 0 }).withMessage('Price must be positive'),
  body('targets').isArray({ min: 1 }).withMessage('At least one target is required'),
  body('targets.*.name').trim().notEmpty().withMessage('Target name is required'),
  body('targets.*.category').isIn(['bacteria', 'virus', 'fungus', 'parasite', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check for duplicate test code
    const existing = await PCRTest.findOne({ testCode: req.body.testCode.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Test code already exists' });
    }

    const test = new PCRTest({
      ...req.body,
      testCode: req.body.testCode.toUpperCase(),
      createdBy: req.user._id || req.user.userId
    });

    await test.save();
    await test.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      message: 'PCR test created successfully',
      test
    });
  } catch (error) {
    console.error('Create PCR test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update PCR test (Admin only) - COMPLETE FIX
router.put('/tests/:id', authorize('admin'), async (req, res) => {
  try {
    const testId = req.params.id;
    
    console.log('=== UPDATE PCR TEST ===');
    console.log('Test ID:', testId);
    console.log('Headers Content-Type:', req.headers['content-type']);
    console.log('Raw body type:', typeof req.body);
    console.log('Body keys:', Object.keys(req.body));
    console.log('Price from body:', req.body.price);
    console.log('Full body received:', JSON.stringify(req.body, null, 2));
    
    // Check if body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('ERROR: Request body is empty!');
      return res.status(400).json({ message: 'No data provided for update' });
    }
    
    // Remove fields that shouldn't be updated
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;
    delete updateData.createdBy;
    
    // Add metadata
    updateData.lastModifiedBy = req.user._id || req.user.userId;
    
    // Ensure price is a number if it exists
    if (updateData.price !== undefined) {
      updateData.price = Number(updateData.price);
      console.log('Converted price to number:', updateData.price);
    }
    
    console.log('Cleaned update data:', JSON.stringify(updateData, null, 2));
    
    // Perform the update
    const updatedTest = await PCRTest.findOneAndUpdate(
      { _id: testId },
      updateData,
      { 
        new: true, // Return the updated document
        runValidators: true, // Run schema validators
        upsert: false // Don't create if doesn't exist
      }
    );

    if (!updatedTest) {
      console.log('Test not found with ID:', testId);
      return res.status(404).json({ message: 'PCR test not found' });
    }

    // Populate references
    await updatedTest.populate('createdBy lastModifiedBy', 'firstName lastName');
    
    console.log('Test updated successfully');
    console.log('Updated test name:', updatedTest.testName);
    console.log('Updated price:', updatedTest.price);
    console.log('Updated description:', updatedTest.description);

    res.json({
      message: 'PCR test updated successfully',
      test: updatedTest
    });
    
  } catch (error) {
    console.error('=== UPDATE ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Failed to update test', 
      error: error.message 
    });
  }
});

// ============= PCR RESULT MANAGEMENT =============

// Create new PCR result
router.post('/results', [
  body('order').notEmpty().withMessage('Order ID is required'),
  body('patient').notEmpty().withMessage('Patient ID is required'),
  body('test').notEmpty().withMessage('Test ID is required'),
  body('sampleInfo.sampleType').notEmpty().withMessage('Sample type is required'),
  body('sampleInfo.collectionDate').isISO8601().withMessage('Valid collection date required'),
  body('targetResults').isArray({ min: 1 }).withMessage('At least one target result is required'),
  body('qualityControl.internalControlResult').isIn(['Pass', 'Fail', 'Invalid'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Generate result number
    const resultNumber = await PCRResult.generateResultNumber();

    const result = new PCRResult({
      ...req.body,
      resultNumber,
      performedBy: req.user._id || req.user.userId
    });

    // Check for critical values
    const criticalValues = result.checkCriticalValues();
    if (criticalValues.length > 0) {
      result.criticalValues = criticalValues;
    }

    await result.save();
    await result.populate('patient test order performedBy', 'firstName lastName testName orderNumber');

    res.status(201).json({
      message: 'PCR result created successfully',
      result,
      criticalValues: criticalValues.length > 0 ? criticalValues : null
    });
  } catch (error) {
    console.error('Create PCR result error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get PCR results with filters
router.get('/results', [
  query('patient').optional().isMongoId(),
  query('order').optional().isMongoId(),
  query('status').optional().isIn(['Preliminary', 'Final', 'Amended', 'Cancelled']),
  query('overallResult').optional().isIn(['Positive', 'Negative', 'Indeterminate', 'Invalid']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let queryObj = {};
    if (req.query.patient) queryObj.patient = req.query.patient;
    if (req.query.order) queryObj.order = req.query.order;
    if (req.query.status) queryObj.status = req.query.status;
    if (req.query.overallResult) queryObj['overallResult.status'] = req.query.overallResult;
    
    if (req.query.startDate || req.query.endDate) {
      queryObj.performedDate = {};
      if (req.query.startDate) queryObj.performedDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) queryObj.performedDate.$lte = new Date(req.query.endDate);
    }

    const results = await PCRResult.find(queryObj)
      .populate('patient', 'firstName lastName patientId')
      .populate('test', 'testName panel')
      .populate('order', 'orderNumber orderingPhysician medicalOffice')
      .populate('performedBy reviewedBy approvedBy', 'firstName lastName')
      .populate('patient', 'firstName lastName patientId dateOfBirth gender')  // Add gender here too
      .sort({ performedDate: -1 });

    res.json({ results });
  } catch (error) {
    console.error('Get PCR results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get PCR result by ID
router.get('/results/:id', async (req, res) => {
  try {
    const result = await PCRResult.findById(req.params.id)
      .populate('patient', 'firstName lastName patientId dateOfBirth gender')
      .populate('test')
      .populate('order', 'orderNumber orderingPhysician')
      .populate('performedBy reviewedBy approvedBy', 'firstName lastName');

    if (!result) {
      return res.status(404).json({ message: 'PCR result not found' });
    }

    res.json({ result });
  } catch (error) {
    console.error('Get PCR result error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update PCR result status (review/approve)
router.patch('/results/:id/status', [
  body('action').isIn(['review', 'approve', 'finalize']).withMessage('Valid action required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await PCRResult.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'PCR result not found' });
    }

    const userId = req.user._id || req.user.userId;
    const now = new Date();

    switch (req.body.action) {
      case 'review':
        result.reviewedBy = userId;
        result.reviewedDate = now;
        if (req.body.notes) result.technicalNotes = req.body.notes;
        break;
      
      case 'approve':
        if (!result.reviewedBy) {
          return res.status(400).json({ message: 'Result must be reviewed before approval' });
        }
        result.approvedBy = userId;
        result.approvedDate = now;
        break;
      
      case 'finalize':
        if (!result.approvedBy) {
          return res.status(400).json({ message: 'Result must be approved before finalizing' });
        }
        result.status = 'Final';
        result.reportedDate = now;
        break;
    }

    await result.save();
    await result.populate('performedBy reviewedBy approvedBy', 'firstName lastName');

    res.json({
      message: `Result ${req.body.action}d successfully`,
      result
    });
  } catch (error) {
    console.error('Update result status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Amend PCR result
router.post('/results/:id/amend', [
  body('reason').trim().notEmpty().withMessage('Amendment reason is required'),
  body('targetResults').optional().isArray(),
  body('resistanceResults').optional().isArray(),
  body('interpretation').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await PCRResult.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'PCR result not found' });
    }

    // Store previous values
    const amendment = {
      reason: req.body.reason,
      amendedBy: req.user._id || req.user.userId,
      amendedDate: new Date(),
      previousValues: {},
      newValues: {}
    };

    // Update fields and track changes
    if (req.body.targetResults) {
      amendment.previousValues.targetResults = result.targetResults;
      result.targetResults = req.body.targetResults;
      amendment.newValues.targetResults = req.body.targetResults;
    }

    if (req.body.resistanceResults) {
      amendment.previousValues.resistanceResults = result.resistanceResults;
      result.resistanceResults = req.body.resistanceResults;
      amendment.newValues.resistanceResults = req.body.resistanceResults;
    }

    if (req.body.interpretation) {
      amendment.previousValues.interpretation = result.overallResult.clinicalInterpretation;
      result.overallResult.clinicalInterpretation = req.body.interpretation;
      amendment.newValues.interpretation = req.body.interpretation;
    }

    result.amendments.push(amendment);
    result.status = 'Amended';

    await result.save();

    res.json({
      message: 'Result amended successfully',
      result
    });
  } catch (error) {
    console.error('Amend result error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Initialize PCR test data (Admin only - one-time setup)
router.post('/initialize', authorize('admin'), async (req, res) => {
  try {
    const pcrTestPanels = require('../data/pcrTestPanels');
    const userId = req.user._id || req.user.userId;

    const results = [];
    for (const panel of pcrTestPanels) {
      // Check if test already exists
      const existing = await PCRTest.findOne({ testCode: panel.testCode });
      if (!existing) {
        const test = new PCRTest({
          ...panel,
          createdBy: userId
        });
        await test.save();
        results.push({ testCode: panel.testCode, status: 'created' });
      } else {
        results.push({ testCode: panel.testCode, status: 'exists' });
      }
    }

    res.json({
      message: 'PCR test initialization complete',
      results
    });
  } catch (error) {
    console.error('Initialize PCR tests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;