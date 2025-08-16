const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Result = require('../models/Result');
const Order = require('../models/Order');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all results with pagination and search
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['preliminary', 'final', 'amended', 'cancelled']),
  query('overallResult').optional().isIn(['normal', 'abnormal', 'inconclusive', 'critical'])
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
    const overallResult = req.query.overallResult;

    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { resultNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (overallResult) query.overallResult = overallResult;

    const results = await Result.find(query)
      .sort({ performedDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient', 'firstName lastName patientId')
      .populate('test', 'testName testCode')
      .populate('order', 'orderNumber')
      .populate('performedBy', 'firstName lastName username')
      .populate('reviewedBy', 'firstName lastName username')
      .populate('approvedBy', 'firstName lastName username');

    const total = await Result.countDocuments(query);

    res.json({
      results,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get result by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate('patient')
      .populate('test')
      .populate('order')
      .populate('performedBy', 'firstName lastName username')
      .populate('reviewedBy', 'firstName lastName username')
      .populate('approvedBy', 'firstName lastName username');

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    res.json({ result });
  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new result
router.post('/', [
  authorize('admin', 'lab_technician'),
  body('order').isMongoId().withMessage('Valid order ID is required'),
  body('patient').isMongoId().withMessage('Valid patient ID is required'),
  body('test').isMongoId().withMessage('Valid test ID is required'),
  body('parameters').isArray({ min: 1 }).withMessage('At least one parameter is required'),
  body('parameters.*.name').trim().notEmpty().withMessage('Parameter name is required'),
  body('parameters.*.value').notEmpty().withMessage('Parameter value is required'),
  body('overallResult').isIn(['normal', 'abnormal', 'inconclusive', 'critical']).withMessage('Valid overall result is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify order exists
    const order = await Order.findById(req.body.order);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Generate result number
    const resultNumber = await Result.generateResultNumber();

    const result = new Result({
      ...req.body,
      resultNumber,
      performedBy: req.user._id,
      performedDate: new Date()
    });

    // Check for critical values
    const criticalValues = result.checkCriticalValues();
    if (criticalValues.length > 0) {
      result.criticalValues = criticalValues.map(cv => ({
        ...cv,
        notificationTime: new Date()
      }));
    }

    await result.save();
    await result.populate('patient', 'firstName lastName patientId')
                 .populate('test', 'testName testCode')
                 .populate('order', 'orderNumber')
                 .populate('performedBy', 'firstName lastName username');

    // Update corresponding test status in order
    const testItem = order.tests.find(t => t.test.toString() === req.body.test);
    if (testItem) {
      testItem.status = 'completed';
      testItem.processingCompleted = new Date();
      order.updateStatus();
      await order.save();
    }

    res.status(201).json({
      message: 'Result created successfully',
      result
    });
  } catch (error) {
    console.error('Create result error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update result
router.put('/:id', [
  authorize('admin', 'lab_technician'),
  body('parameters').optional().isArray({ min: 1 }),
  body('overallResult').optional().isIn(['normal', 'abnormal', 'inconclusive', 'critical']),
  body('interpretation').optional().trim(),
  body('recommendations').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await Result.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Store previous values for amendment tracking
    const previousValues = {
      parameters: result.parameters,
      overallResult: result.overallResult,
      interpretation: result.interpretation,
      recommendations: result.recommendations
    };

    // Update result
    Object.assign(result, req.body);

    // Add amendment record if status is final
    if (result.status === 'final') {
      result.amendments.push({
        reason: req.body.amendmentReason || 'Result updated',
        changedBy: req.user._id,
        changedAt: new Date(),
        previousValues,
        newValues: req.body
      });
      result.status = 'amended';
    }

    await result.save();
    await result.populate('patient', 'firstName lastName patientId')
                 .populate('test', 'testName testCode')
                 .populate('performedBy', 'firstName lastName username');

    res.json({
      message: 'Result updated successfully',
      result
    });
  } catch (error) {
    console.error('Update result error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Review result
router.put('/:id/review', [
  authorize('admin', 'doctor'),
  body('approved').isBoolean().withMessage('Approval status is required'),
  body('reviewNotes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await Result.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    if (req.body.approved) {
      result.status = 'final';
      result.approvedBy = req.user._id;
      result.approvedDate = new Date();
      result.reportedDate = new Date();
    } else {
      result.reviewedBy = req.user._id;
      result.reviewedDate = new Date();
      result.technicalNotes = req.body.reviewNotes;
    }

    await result.save();
    await result.populate('patient', 'firstName lastName patientId')
                 .populate('test', 'testName testCode')
                 .populate('approvedBy', 'firstName lastName username');

    res.json({
      message: result.status === 'final' ? 'Result approved successfully' : 'Result reviewed successfully',
      result
    });
  } catch (error) {
    console.error('Review result error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get results by patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const results = await Result.find({ 
      patient: req.params.patientId,
      status: { $in: ['final', 'amended'] }
    })
      .sort({ performedDate: -1 })
      .populate('test', 'testName testCode category')
      .populate('order', 'orderNumber')
      .populate('performedBy', 'firstName lastName username');

    res.json({ results });
  } catch (error) {
    console.error('Get patient results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get results by order
router.get('/order/:orderId', async (req, res) => {
  try {
    const results = await Result.find({ order: req.params.orderId })
      .sort({ performedDate: -1 })
      .populate('test', 'testName testCode category')
      .populate('performedBy', 'firstName lastName username')
      .populate('approvedBy', 'firstName lastName username');

    res.json({ results });
  } catch (error) {
    console.error('Get order results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get critical results
router.get('/critical/list', authorize('admin', 'doctor'), async (req, res) => {
  try {
    const criticalResults = await Result.find({
      overallResult: 'critical',
      status: { $in: ['preliminary', 'final'] }
    })
      .sort({ performedDate: -1 })
      .limit(50)
      .populate('patient', 'firstName lastName patientId phone')
      .populate('test', 'testName testCode')
      .populate('performedBy', 'firstName lastName username');

    res.json({ criticalResults });
  } catch (error) {
    console.error('Get critical results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get result statistics
router.get('/stats/overview', authorize('admin', 'doctor'), async (req, res) => {
  try {
    const totalResults = await Result.countDocuments();
    const pendingResults = await Result.countDocuments({ status: 'preliminary' });
    const finalResults = await Result.countDocuments({ status: 'final' });
    const criticalResults = await Result.countDocuments({ overallResult: 'critical' });

    // Results by status
    const statusStats = await Result.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Results by overall result
    const resultStats = await Result.aggregate([
      {
        $group: {
          _id: '$overallResult',
          count: { $sum: 1 }
        }
      }
    ]);

    // Results by test category
    const categoryStats = await Result.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'test',
          foreignField: '_id',
          as: 'testDetails'
        }
      },
      {
        $unwind: '$testDetails'
      },
      {
        $group: {
          _id: '$testDetails.category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      total: totalResults,
      pending: pendingResults,
      final: finalResults,
      critical: criticalResults,
      statusBreakdown: statusStats,
      resultBreakdown: resultStats,
      categoryBreakdown: categoryStats
    });
  } catch (error) {
    console.error('Result stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;