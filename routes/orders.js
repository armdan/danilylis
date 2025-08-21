// routes/orders.js - Simplified without authorize calls
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Order = require('../models/Order');
const Patient = require('../models/Patient');
const Test = require('../models/Test');
const PCRTest = require('../models/PCRTest');
const MedicalOffice = require('../models/MedicalOffice');
const Doctor = require('../models/Doctor');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get order statistics
router.get('/statistics', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, pending, processing, completedToday] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'processing' }),
      Order.countDocuments({ 
        status: 'completed',
        updatedAt: { $gte: today, $lt: tomorrow }
      })
    ]);

    res.json({
      total,
      pending,
      processing,
      completedToday
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

// Export orders to CSV
router.get('/export', async (req, res) => {
  try {
    const { dateFrom, dateTo, status } = req.query;
    
    let query = {};
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('patient')
      .populate('medicalOffice')
      .sort({ createdAt: -1 })
      .limit(1000);

    // Create CSV content
    const csvRows = [
      ['Order Number', 'Date', 'Patient Name', 'Patient ID', 'Doctor', 'Tests', 'Priority', 'Status', 'Total Amount']
    ];

    for (const order of orders) {
      // Manually populate test details for both Test and PCRTest
      const testNames = [];
      for (const testItem of order.tests) {
        let test = await Test.findById(testItem.test);
        if (!test) {
          test = await PCRTest.findById(testItem.test);
        }
        if (test) {
          testNames.push(test.testName);
        }
      }
      
      const totalAmount = order.totalAmount || 0;
      
      csvRows.push([
        order.orderNumber,
        order.createdAt.toISOString(),
        `${order.patient?.firstName} ${order.patient?.lastName}`,
        order.patient?.patientId || '',
        order.orderingPhysician?.name || '',
        testNames.join('; '),
        order.priority,
        order.status,
        totalAmount.toFixed(2)
      ]);
    }

    // Convert to CSV string
    const csvContent = csvRows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting orders:', error);
    res.status(500).json({ message: 'Failed to export orders' });
  }
});

// Get all orders with pagination and search
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    
    if (req.query.search) {
      query.$or = [
        { orderNumber: { $regex: req.query.search, $options: 'i' } },
        { 'orderingPhysician.name': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    
    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom) {
        query.createdAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        const endDate = new Date(req.query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('patient', 'firstName lastName patientId phone dateOfBirth')
        .populate('medicalOffice', 'name')
        .populate('createdBy', 'firstName lastName username'),
      Order.countDocuments(query)
    ]);

    // Manually populate test details for mixed Test/PCRTest references
    for (const order of orders) {
      const populatedTests = [];
      for (const testItem of order.tests) {
        let test = await Test.findById(testItem.test).select('testName testCode price category');
        if (!test) {
          test = await PCRTest.findById(testItem.test).select('testName testCode price panel');
        }
        populatedTests.push({
          ...testItem.toObject(),
          test
        });
      }
      order.tests = populatedTests;
    }

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
      .populate('medicalOffice')
      .populate('createdBy', 'firstName lastName username')
      .populate('modifiedBy', 'firstName lastName username')
      .populate('labelPrintedBy', 'firstName lastName');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Convert to plain object to modify
    const orderObj = order.toObject();

    // Manually populate test details from both collections
    const populatedTests = [];
    for (const testItem of orderObj.tests) {
      // Try regular Test collection first
      let test = await Test.findById(testItem.test).lean();
      
      // If not found, try PCRTest collection
      if (!test) {
        test = await PCRTest.findById(testItem.test).lean();
      }
      
      if (test) {
        populatedTests.push({
          ...testItem,
          test: test
        });
      } else {
        // If test not found, include minimal info
        console.log('Test not found:', testItem.test);
        populatedTests.push({
          ...testItem,
          test: {
            _id: testItem.test,
            testName: 'Test not found',
            testCode: 'N/A'
          }
        });
      }
    }
    
    orderObj.tests = populatedTests;

    res.json({ order: orderObj });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new order
router.post('/', async (req, res) => {
  try {
    // Basic validation
    if (!req.body.patient) {
      return res.status(400).json({ message: 'Patient is required' });
    }
    if (!req.body.tests || !Array.isArray(req.body.tests) || req.body.tests.length === 0) {
      return res.status(400).json({ message: 'At least one test is required' });
    }
    if (!req.body.orderingPhysician || !req.body.orderingPhysician.name) {
      return res.status(400).json({ message: 'Ordering physician name is required' });
    }

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

    // Generate order number
    const orderNumber = await Order.generateOrderNumber();

    // Get user ID from token (handle different possible structures)
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const order = new Order({
      ...req.body,
      orderNumber,
      createdBy: userId,
      status: 'pending'
    });

    // Calculate total amount using all tests
    order.totalAmount = allTests.reduce((total, test) => {
      return total + (test.price || 0);
    }, 0);

    await order.save();

    // Populate the order for response
    await order.populate('patient', 'firstName lastName patientId dateOfBirth');
    await order.populate('medicalOffice', 'name');
    await order.populate('createdBy', 'firstName lastName username');
    
    // Manually populate test details
    const populatedTests = [];
    for (const testItem of order.tests) {
      let test = allTests.find(t => t._id.toString() === testItem.test.toString());
      populatedTests.push({
        ...testItem.toObject(),
        test
      });
    }
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

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    if (!req.body.status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status: req.body.status,
        modifiedBy: userId
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ message: 'Order status updated', order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// Mark label as printed
router.patch('/:id/label-printed', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        labelPrinted: true,
        labelPrintedAt: new Date(),
        labelPrintedBy: userId
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ message: 'Label marked as printed', order });
  } catch (error) {
    console.error('Error marking label as printed:', error);
    res.status(500).json({ message: 'Failed to update label status' });
  }
});

// Delete/Cancel order (admin only based on your pattern)
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow deletion of pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Only pending orders can be cancelled' 
      });
    }

    const userId = req.user?.userId || req.user?.id || req.user?._id;

    order.status = 'cancelled';
    order.modifiedBy = userId;
    await order.save();

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
});

module.exports = router;