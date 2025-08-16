const express = require('express');
const { query, validationResult } = require('express-validator');
const Result = require('../models/Result');
const Order = require('../models/Order');
const Patient = require('../models/Patient');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Generate patient report
router.get('/patient/:patientId', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const results = await Result.find({ 
      patient: req.params.patientId,
      status: { $in: ['final', 'amended'] }
    })
      .sort({ performedDate: -1 })
      .populate('test', 'testName testCode category')
      .populate('order', 'orderNumber orderingPhysician')
      .populate('performedBy', 'firstName lastName');

    res.json({
      patient,
      results,
      generatedAt: new Date(),
      generatedBy: req.user._id
    });
  } catch (error) {
    console.error('Generate patient report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate order report
router.get('/order/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('patient')
      .populate('tests.test')
      .populate('createdBy', 'firstName lastName');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const results = await Result.find({ order: req.params.orderId })
      .populate('test', 'testName testCode category')
      .populate('performedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    res.json({
      order,
      results,
      generatedAt: new Date(),
      generatedBy: req.user._id
    });
  } catch (error) {
    console.error('Generate order report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate lab statistics report
router.get('/statistics', [
  authorize('admin', 'doctor'),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('category').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, category } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Patient statistics
    const patientStats = {
      total: await Patient.countDocuments({ isActive: true }),
      newThisMonth: await Patient.countDocuments({
        isActive: true,
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      })
    };

    // Order statistics
    const orderStats = {
      total: await Order.countDocuments(dateFilter),
      pending: await Order.countDocuments({ ...dateFilter, status: 'pending' }),
      completed: await Order.countDocuments({ ...dateFilter, status: 'completed' }),
      cancelled: await Order.countDocuments({ ...dateFilter, status: 'cancelled' })
    };

    // Result statistics
    const resultStats = {
      total: await Result.countDocuments(dateFilter),
      normal: await Result.countDocuments({ ...dateFilter, overallResult: 'normal' }),
      abnormal: await Result.countDocuments({ ...dateFilter, overallResult: 'abnormal' }),
      critical: await Result.countDocuments({ ...dateFilter, overallResult: 'critical' })
    };

    // Test category breakdown
    const categoryBreakdown = await Result.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'tests',
          localField: 'test',
          foreignField: '_id',
          as: 'testDetails'
        }
      },
      { $unwind: '$testDetails' },
      {
        $group: {
          _id: '$testDetails.category',
          count: { $sum: 1 },
          normal: {
            $sum: { $cond: [{ $eq: ['$overallResult', 'normal'] }, 1, 0] }
          },
          abnormal: {
            $sum: { $cond: [{ $eq: ['$overallResult', 'abnormal'] }, 1, 0] }
          },
          critical: {
            $sum: { $cond: [{ $eq: ['$overallResult', 'critical'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      reportType: 'statistics',
      dateRange: { startDate, endDate },
      generatedAt: new Date(),
      generatedBy: req.user._id,
      data: {
        patients: patientStats,
        orders: orderStats,
        results: resultStats,
        categoryBreakdown
      }
    });
  } catch (error) {
    console.error('Generate statistics report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate daily workload report
router.get('/workload/daily', [
  authorize('admin', 'doctor'),
  query('date').optional().isISO8601()
], async (req, res) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const dateFilter = {
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    };

    // Orders created today
    const ordersToday = await Order.countDocuments(dateFilter);
    
    // Results completed today
    const resultsToday = await Result.countDocuments({
      performedDate: { $gte: startOfDay, $lte: endOfDay }
    });

    // Tests by category today
    const testsByCategory = await Result.aggregate([
      {
        $match: {
          performedDate: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $lookup: {
          from: 'tests',
          localField: 'test',
          foreignField: '_id',
          as: 'testDetails'
        }
      },
      { $unwind: '$testDetails' },
      {
        $group: {
          _id: '$testDetails.category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Pending orders
    const pendingOrders = await Order.countDocuments({ status: 'pending' });

    // Critical results pending review
    const criticalPending = await Result.countDocuments({
      overallResult: 'critical',
      status: 'preliminary'
    });

    res.json({
      reportType: 'daily_workload',
      date: targetDate,
      generatedAt: new Date(),
      generatedBy: req.user._id,
      data: {
        ordersCreated: ordersToday,
        resultsCompleted: resultsToday,
        testsByCategory,
        pendingOrders,
        criticalResultsPending: criticalPending
      }
    });
  } catch (error) {
    console.error('Generate workload report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate quality control report
router.get('/quality-control', [
  authorize('admin'),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.performedDate = {};
      if (startDate) dateFilter.performedDate.$gte = new Date(startDate);
      if (endDate) dateFilter.performedDate.$lte = new Date(endDate);
    }

    // Quality control statistics
    const qcStats = await Result.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalResults: { $sum: 1 },
          passedQC: {
            $sum: { $cond: ['$qualityControl.controlsPassed', 1, 0] }
          },
          failedQC: {
            $sum: { $cond: [{ $not: '$qualityControl.controlsPassed' }, 1, 0] }
          },
          averageProcessingTime: { $avg: '$processingTime' }
        }
      }
    ]);

    // Results by technician
    const technicianStats = await Result.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'performedBy',
          foreignField: '_id',
          as: 'technician'
        }
      },
      { $unwind: '$technician' },
      {
        $group: {
          _id: '$performedBy',
          name: { $first: { $concat: ['$technician.firstName', ' ', '$technician.lastName'] } },
          totalResults: { $sum: 1 },
          qcPassed: {
            $sum: { $cond: ['$qualityControl.controlsPassed', 1, 0] }
          }
        }
      }
    ]);

    res.json({
      reportType: 'quality_control',
      dateRange: { startDate, endDate },
      generatedAt: new Date(),
      generatedBy: req.user._id,
      data: {
        overallStats: qcStats[0] || {},
        technicianPerformance: technicianStats
      }
    });
  } catch (error) {
    console.error('Generate QC report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;