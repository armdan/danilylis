const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Order = require('../models/Order');
const Patient = require('../models/Patient');
const Test = require('../models/Test');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all orders with pagination and search
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['pending', 'partial', 'completed', 'cancelled']),
  query('priority').optional().isIn(['routine', 'urgent', 'stat'])
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
    const priority = req.query.priority;

    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'orderingPhysician.name': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient', 'firstName lastName patientId phone')
      .populate('tests.test', 'testName testCode price')
      .populate('createdBy', 'firstName lastName username');

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('patient')
      .populate('tests.test')
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new order
router.post('/', [
  authorize('admin', 'doctor', 'receptionist'),
  body('patient').isMongoId().withMessage('Valid patient ID is required'),
  body('tests').isArray({ min: 1 }).withMessage('At least one test is required'),
  body('tests.*.test').isMongoId().withMessage('Valid test ID is required'),
  body('orderingPhysician.name').trim().notEmpty().withMessage('Ordering physician name is required'),
  body('priority').optional().isIn(['routine', 'urgent', 'stat'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify patient exists
    const patient = await Patient.findById(req.body.patient);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify all tests exist
    const testIds = req.body.tests.map(t => t.test);
    const tests = await Test.find({ _id: { $in: testIds } });
    if (tests.length !== testIds.length) {
      return res.status(400).json({ message: 'One or more tests not found' });
    }

    // Generate order number
    const orderNumber = await Order.generateOrderNumber();

    const order = new Order({
      ...req.body,
      orderNumber,
      createdBy: req.user._id
    });

    // Calculate total amount
    await order.calculateTotal();
    await order.save();

    await order.populate('patient', 'firstName lastName patientId')
                .populate('tests.test', 'testName testCode price')
                .populate('createdBy', 'firstName lastName username');

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update order
router.put('/:id', [
  authorize('admin', 'doctor', 'lab_technician'),
  body('priority').optional().isIn(['routine', 'urgent', 'stat']),
  body('status').optional().isIn(['pending', 'partial', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { ...req.body, modifiedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('patient', 'firstName lastName patientId')
     .populate('tests.test', 'testName testCode price')
     .populate('createdBy', 'firstName lastName username');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update test status in order
router.put('/:id/tests/:testId/status', [
  authorize('admin', 'lab_technician'),
  body('status').isIn(['pending', 'collected', 'processing', 'completed', 'cancelled']).withMessage('Valid status is required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id, testId } = req.params;
    const { status, notes } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const testItem = order.tests.find(t => t.test.toString() === testId);
    if (!testItem) {
      return res.status(404).json({ message: 'Test not found in order' });
    }

    // Update test status and timestamps
    testItem.status = status;
    testItem.notes = notes;

    if (status === 'collected' && !testItem.sampleCollectedAt) {
      testItem.sampleCollectedAt = new Date();
      testItem.sampleCollectedBy = req.user._id;
    } else if (status === 'processing' && !testItem.processingStarted) {
      testItem.processingStarted = new Date();
    } else if (status === 'completed' && !testItem.processingCompleted) {
      testItem.processingCompleted = new Date();
    }

    // Update overall order status
    order.updateStatus();
    order.modifiedBy = req.user._id;

    await order.save();
    await order.populate('patient', 'firstName lastName patientId')
                .populate('tests.test', 'testName testCode price');

    res.json({
      message: 'Test status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update test status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Cancel order
router.delete('/:id', authorize('admin', 'doctor'), async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'cancelled',
        modifiedBy: req.user._id
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get orders by patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const orders = await Order.find({ patient: req.params.patientId })
      .sort({ createdAt: -1 })
      .populate('tests.test', 'testName testCode')
      .populate('createdBy', 'firstName lastName username');

    res.json({ orders });
  } catch (error) {
    console.error('Get patient orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get order statistics
router.get('/stats/overview', authorize('admin', 'doctor'), async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    const urgentOrders = await Order.countDocuments({ priority: 'urgent' });

    // Orders by status
    const statusStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Orders by priority
    const priorityStats = await Order.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      total: totalOrders,
      pending: pendingOrders,
      completed: completedOrders,
      urgent: urgentOrders,
      statusBreakdown: statusStats,
      priorityBreakdown: priorityStats
    });
  } catch (error) {
    console.error('Order stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;