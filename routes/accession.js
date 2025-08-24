// routes/accession.js - Complete corrected version
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Patient = require('../models/Patient');
const Test = require('../models/Test');
const PCRTest = require('../models/PCRTest');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Helper function to populate test details
async function populateTestDetails(testItem) {
  if (!testItem || !testItem.test) return null;
  
  const testId = typeof testItem.test === 'string' ? testItem.test : testItem.test._id;
  if (!testId) return null;
  
  let testDoc;
  
  // Check if testModel is specified
  if (testItem.testModel === 'PCRTest') {
    testDoc = await PCRTest.findById(testId).lean();
  } else if (testItem.testModel === 'Test') {
    testDoc = await Test.findById(testId).lean();
  } else {
    // Try PCRTest first, then fallback to Test
    testDoc = await PCRTest.findById(testId).lean();
    if (!testDoc) {
      testDoc = await Test.findById(testId).lean();
    }
  }
  
  return testDoc;
}

// POST /api/accession/manual - Create manual specimen entry
router.post('/manual', async (req, res) => {
  try {
    const {
      patientId,
      medicalOfficeId,
      doctorId,
      specimenType,
      collectionDate,
      receivedDate,
      orderNumber,
      tests,
      orderingPhysician,
      priority
    } = req.body;

    // Generate order number if not provided
    const finalOrderNumber = orderNumber || await Order.generateOrderNumber();

    // Format tests array properly - determine which model each test belongs to
    const formattedTests = [];
    for (const testItem of tests) {
      const testId = testItem.test || testItem;
      
      // Check if it's a PCR test first
      let testDoc = await PCRTest.findById(testId);
      let testModel = 'PCRTest';
      
      if (!testDoc) {
        testDoc = await Test.findById(testId);
        testModel = 'Test';
      }
      
      if (testDoc) {
        formattedTests.push({
          test: testId,
          testModel: testModel,
          testName: testDoc.testName, // Store test name for quick access
          status: 'pending',
          priority: priority || 'routine'
        });
      }
    }

    // Create the order with specimen information
    const order = new Order({
      orderNumber: finalOrderNumber,
      patient: patientId,
      medicalOffice: medicalOfficeId,
      orderingPhysician: {
        doctorId: doctorId,
        name: orderingPhysician || 'Unknown'
      },
      tests: formattedTests,
      specimenType: specimenType,
      collectionDate: new Date(collectionDate),
      receivedDate: new Date(receivedDate),
      receivedBy: req.user._id,
      status: 'pending',
      priority: priority || 'routine',
      orderType: 'manual',
      createdBy: req.user._id
    });

    await order.save();

    res.status(201).json({
      message: 'Specimen added successfully',
      order: order,
      orderNumber: finalOrderNumber
    });

  } catch (error) {
    console.error('Manual specimen entry error:', error);
    res.status(500).json({ 
      message: 'Failed to add specimen',
      error: error.message 
    });
  }
});

// GET /api/accession/specimen/:id - Get specimen details with populated tests
router.get('/specimen/:id', async (req, res) => {
  try {
    let order = await Order.findById(req.params.id)
      .populate('patient')
      .populate('medicalOffice')
      .populate('orderingPhysician.doctorId')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Specimen not found' });
    }

    // Manually populate tests from both Test and PCRTest collections
    for (let i = 0; i < order.tests.length; i++) {
      const testDoc = await populateTestDetails(order.tests[i]);
      if (testDoc) {
        order.tests[i].test = testDoc;
      }
    }

    res.json({ specimen: order });

  } catch (error) {
    console.error('Error fetching specimen:', error);
    res.status(500).json({ 
      message: 'Error fetching specimen details',
      error: error.message 
    });
  }
});

// GET /api/accession/pending - Get pending specimens with populated tests
router.get('/pending', async (req, res) => {
  try {
    let orders = await Order.find({ 
      status: 'pending',
      accessionNumber: { $exists: false }
    })
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('medicalOffice', 'name')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

    // Populate test details for each order
    for (let order of orders) {
      if (order.tests && order.tests.length > 0) {
        for (let i = 0; i < order.tests.length; i++) {
          const testDoc = await populateTestDetails(order.tests[i]);
          if (testDoc) {
            order.tests[i].test = testDoc;
          }
        }
      }
    }

    // Format specimens for display with test names
    const specimens = orders.map(order => {
      // Extract test information
      const testsInfo = order.tests.map(t => {
        if (t.test && typeof t.test === 'object') {
          return {
            id: t.test._id,
            name: t.test.testName || 'Unknown Test',
            panel: t.test.panel
          };
        } else if (t.testName) {
          // Fallback to stored testName if available
          return {
            id: t.test,
            name: t.testName,
            panel: t.panel
          };
        } else {
          return {
            id: t.test || 'unknown',
            name: 'Test ID: ' + (t.test ? t.test.toString().substring(0, 8) : 'unknown')
          };
        }
      });

      return {
        id: order._id,
        orderNumber: order.orderNumber,
        patientName: order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : 'Unknown',
        patientId: order.patient?.patientId || 'N/A',
        specimenType: order.specimenType || 'Not specified',
        collectionTime: order.collectionDate,
        receivedTime: order.receivedDate,
        status: order.status,
        priority: order.priority,
        tests: testsInfo
      };
    });

    res.json({ specimens });

  } catch (error) {
    console.error('Error fetching pending specimens:', error);
    res.status(500).json({ 
      message: 'Error fetching pending specimens',
      error: error.message 
    });
  }
});

// GET /api/accession/status/:status - Get specimens by status with populated tests
// In routes/accession.js - Replace the GET /api/accession/status/:status route with this:

// GET /api/accession/status/:status - Get specimens by status with populated tests
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    
    // Add 'received' to the valid statuses list
    const validStatuses = ['pending', 'received', 'accessioned', 'completed', 'rejected'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    let query = { status: status };
    
    // Special handling for different statuses
    if (status === 'accessioned') {
      query = { 
        status: 'accessioned',
        accessionNumber: { $exists: true }
      };
    } else if (status === 'received') {
      // For 'received' tab, you might want to show orders received today
      // or orders that are pending but have been received
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = {
        receivedDate: { $gte: today },
        status: { $in: ['pending', 'received'] }
      };
    }

    let orders = await Order.find(query)
      .populate('patient', 'firstName lastName patientId dateOfBirth')
      .populate('medicalOffice', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Populate test details for each order
    for (let order of orders) {
      if (order.tests && order.tests.length > 0) {
        for (let i = 0; i < order.tests.length; i++) {
          const testDoc = await populateTestDetails(order.tests[i]);
          if (testDoc) {
            order.tests[i].test = testDoc;
          }
        }
      }
    }

    // Format specimens for display with test names
    const specimens = orders.map(order => {
      // Extract test information
      const testsInfo = order.tests.map(t => {
        if (t.test && typeof t.test === 'object') {
          return {
            id: t.test._id,
            name: t.test.testName || 'Unknown Test',
            panel: t.test.panel
          };
        } else if (t.testName) {
          return {
            id: t.test,
            name: t.testName,
            panel: t.panel
          };
        } else {
          return {
            id: t.test || 'unknown',
            name: 'Test ID: ' + (t.test ? t.test.toString().substring(0, 8) : 'unknown')
          };
        }
      });

      return {
        id: order._id,
        orderNumber: order.orderNumber,
        accessionNumber: order.accessionNumber,
        patientName: order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : 'Unknown',
        patientId: order.patient?.patientId || 'N/A',
        specimenType: order.specimenType || 'Not specified',
        collectionTime: order.collectionDate,
        receivedTime: order.receivedDate,
        status: order.status,
        priority: order.priority,
        tests: testsInfo
      };
    });

    res.json({ specimens });

  } catch (error) {
    console.error('Error fetching specimens by status:', error);
    res.status(500).json({ 
      message: 'Error fetching specimens',
      error: error.message 
    });
  }
});

// POST /api/accession/:id/accession - Complete accession process
router.post('/:id/accession', async (req, res) => {
  try {
    const { specimenCondition, accessionNotes } = req.body;

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Generate accession number
    const accessionNumber = await Order.generateAccessionNumber();

    // Update order with accession information
    order.accessionNumber = accessionNumber;
    order.accessionDate = new Date();
    order.accessionedBy = req.user._id || req.user.id || req.user.userId;
    order.status = 'accessioned';
    order.specimenCondition = specimenCondition || 'good';
    order.accessionNotes = accessionNotes;

    // Update individual test statuses to 'collected'
    order.tests.forEach(test => {
      if (test.status === 'pending') {
        test.status = 'collected';
        test.sampleCollectedAt = new Date();
        test.sampleCollectedBy = req.user._id || req.user.id || req.user.userId;
      }
    });

    await order.save();

    res.json({
      message: 'Specimen accessioned successfully',
      accessionNumber: accessionNumber,
      order: order
    });

  } catch (error) {
    console.error('Accession specimen error:', error);
    res.status(500).json({ 
      message: 'Failed to accession specimen',
      error: error.message 
    });
  }
});

// GET /api/accession/statistics - Get accession statistics
router.get('/statistics', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayReceived,
      pendingAccession,
      inProcess,
      rejectedToday,
      accessioned
    ] = await Promise.all([
      Order.countDocuments({
        receivedDate: { $gte: today }
      }),
      Order.countDocuments({
        status: 'pending',
        accessionNumber: { $exists: false }
      }),
      Order.countDocuments({
        status: 'partial'
      }),
      Order.countDocuments({
        status: 'rejected',
        rejectionDate: { $gte: today }
      }),
      Order.countDocuments({
        status: 'accessioned',
        accessionDate: { $gte: today }
      })
    ]);

    res.json({
      todayReceived,
      pendingAccession,
      inProcess,
      rejectedToday,
      accessioned
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ 
      message: 'Error fetching statistics',
      error: error.message 
    });
  }
});

// POST /api/accession/:id/reject - Reject a specimen
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason, comments } = req.body;

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = 'rejected';
    order.rejectionDate = new Date();
    order.rejectedBy = req.user._id || req.user.id || req.user.userId;
    order.rejectionReason = reason;
    order.rejectionComments = comments;

    await order.save();

    res.json({
      message: 'Specimen rejected',
      order: order
    });

  } catch (error) {
    console.error('Reject specimen error:', error);
    res.status(500).json({ 
      message: 'Failed to reject specimen',
      error: error.message 
    });
  }
});

// GET /api/accession/search/:barcode - Search specimen by barcode
router.get('/search/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    const order = await Order.findOne({
      $or: [
        { orderNumber: barcode },
        { accessionNumber: barcode },
        { specimenBarcode: barcode }
      ]
    })
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('medicalOffice', 'name')
    .lean();

    if (!order) {
      return res.status(404).json({ message: 'Specimen not found' });
    }

    // Populate test details
    if (order.tests && order.tests.length > 0) {
      for (let i = 0; i < order.tests.length; i++) {
        const testDoc = await populateTestDetails(order.tests[i]);
        if (testDoc) {
          order.tests[i].test = testDoc;
        }
      }
    }

    res.json({ specimen: order });

  } catch (error) {
    console.error('Error searching specimen:', error);
    res.status(500).json({ 
      message: 'Error searching specimen',
      error: error.message 
    });
  }
});

module.exports = router;