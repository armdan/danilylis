// routes/orders.js - Updated with label printing functionality
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Order = require('../models/Order');
const Patient = require('../models/Patient');
const Test = require('../models/Test');
const MedicalOffice = require('../models/MedicalOffice');
const Doctor = require('../models/Doctor');
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
  query('priority').optional().isIn(['routine', 'urgent', 'stat']),
  query('patient').optional().isMongoId(),
  query('labelPrinted').optional().isBoolean()
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
    const patientId = req.query.patient;
    const labelPrinted = req.query.labelPrinted;

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
    if (patientId) query.patient = patientId;
    if (labelPrinted !== undefined) query.labelPrinted = labelPrinted === 'true';

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient', 'firstName lastName patientId phone dateOfBirth')
      .populate('tests.test', 'testName testCode price category')
      .populate('medicalOffice', 'name')
      .populate('orderingPhysician.doctorId', 'firstName lastName title npiNumber')
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
      .populate('medicalOffice')
      .populate('orderingPhysician.doctorId')
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username')
      .populate('labelPrintedBy', 'firstName lastName');

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
  authorize('admin', 'doctor', 'receptionist', 'lab_technician'),
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

    // Import PCRTest model
    const PCRTest = require('../models/PCRTest');

    // Verify patient exists
    const patient = await Patient.findById(req.body.patient);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify all tests exist (check both regular tests and PCR tests)
    const testIds = req.body.tests.map(t => t.test);
    
    // Check regular tests
    const regularTests = await Test.find({ _id: { $in: testIds } });
    const regularTestIds = regularTests.map(t => t._id.toString());
    
    // Check PCR tests for IDs not found in regular tests
    const missingTestIds = testIds.filter(id => !regularTestIds.includes(id));
    const pcrTests = missingTestIds.length > 0 ? 
      await PCRTest.find({ _id: { $in: missingTestIds } }) : [];
    
    const totalTestsFound = regularTests.length + pcrTests.length;
    
    if (totalTestsFound !== testIds.length) {
      console.log('Test verification failed:', {
        requested: testIds.length,
        foundRegular: regularTests.length,
        foundPCR: pcrTests.length,
        total: totalTestsFound
      });
      return res.status(400).json({ message: 'One or more tests not found' });
    }

    // Combine all tests for price calculation
    const allTests = [...regularTests, ...pcrTests];

    // Generate order number with new format
    const orderNumber = await Order.generateOrderNumber();

    const order = new Order({
      ...req.body,
      orderNumber,
      createdBy: req.user._id || req.user.userId
    });

    // Calculate total amount using all tests
    order.totalAmount = allTests.reduce((total, test) => {
      return total + (test.price || 0);
    }, 0);

    await order.save();

    // Populate the order for response
    // Note: tests.test will reference both Test and PCRTest collections
    await order.populate('patient', 'firstName lastName patientId dateOfBirth');
    await order.populate('medicalOffice', 'name');
    await order.populate('orderingPhysician.doctorId', 'firstName lastName title');
    await order.populate('createdBy', 'firstName lastName username');
    
    // Manually populate test details since they come from different collections
    const populatedTests = await Promise.all(order.tests.map(async (testItem) => {
      let testDetails = await Test.findById(testItem.test);
      if (!testDetails) {
        testDetails = await PCRTest.findById(testItem.test);
      }
      return {
        ...testItem.toObject(),
        test: testDetails
      };
    }));
    
    order.tests = populatedTests;

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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
      { 
        ...req.body, 
        modifiedBy: req.user._id || req.user.userId 
      },
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

// Mark label as printed
router.patch('/:id/label-printed', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await order.markLabelPrinted(req.user._id || req.user.userId);

    res.json({
      message: 'Label marked as printed',
      order
    });
  } catch (error) {
    console.error('Mark label printed error:', error);
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

    testItem.status = status;
    if (notes) testItem.notes = notes;
    
    if (status === 'collected') {
      testItem.sampleCollectedAt = new Date();
      testItem.sampleCollectedBy = req.user._id || req.user.userId;
    } else if (status === 'processing') {
      testItem.processingStarted = new Date();
    } else if (status === 'completed') {
      testItem.processingCompleted = new Date();
    }

    // Update overall order status
    order.updateStatus();
    order.modifiedBy = req.user._id || req.user.userId;
    
    await order.save();
    await order.populate('patient', 'firstName lastName patientId')
              .populate('tests.test', 'testName testCode')
              .populate('createdBy', 'firstName lastName username');

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
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel completed orders' });
    }

    order.status = 'cancelled';
    order.modifiedBy = req.user._id || req.user.userId;
    await order.save();

    res.json({
      message: 'Order cancelled successfully',
      order
    });
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

// Get pending orders (for lab technicians)
router.get('/pending/list', authorize('admin', 'lab_technician'), async (req, res) => {
  try {
    const orders = await Order.find({ 
      status: 'pending',
      'tests.status': 'pending'
    })
      .sort({ priority: -1, createdAt: 1 }) // STAT first, then by creation time
      .populate('patient', 'firstName lastName patientId')
      .populate('tests.test', 'testName testCode category')
      .populate('orderingPhysician.doctorId', 'firstName lastName title');

    res.json({ orders });
  } catch (error) {
    console.error('Get pending orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get order statistics
router.get('/stats/overview', authorize('admin', 'doctor'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalOrders = await Order.countDocuments();
    const todayOrders = await Order.countDocuments({ 
      createdAt: { $gte: today } 
    });
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    const urgentOrders = await Order.countDocuments({ priority: 'urgent' });
    const statOrders = await Order.countDocuments({ priority: 'stat' });

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

    // Labels printed vs not printed
    const labelStats = await Order.aggregate([
      {
        $group: {
          _id: '$labelPrinted',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      total: totalOrders,
      today: todayOrders,
      pending: pendingOrders,
      completed: completedOrders,
      urgent: urgentOrders,
      stat: statOrders,
      statusBreakdown: statusStats,
      priorityBreakdown: priorityStats,
      labelBreakdown: labelStats
    });
  } catch (error) {
    console.error('Order stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;