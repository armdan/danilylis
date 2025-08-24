const express = require('express');
const Patient = require('../models/Patient');
const Order = require('../models/Order');
const Result = require('../models/Result');
const Test = require('../models/Test');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get dashboard statistics
router.get('/statistics', async (req, res) => {
  try {
    // Basic counts
    const totalPatients = await Patient.countDocuments({ isActive: true });
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const completedTests = await Order.countDocuments({ status: 'completed' });
    const criticalResults = await Result.countDocuments({ 
      overallResult: 'critical',
      status: { $in: ['preliminary', 'final'] }
    });

    // Recent statistics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newPatientsThisMonth = await Patient.countDocuments({
      isActive: true,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const ordersThisMonth = await Order.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const resultsThisMonth = await Result.countDocuments({
      performedDate: { $gte: thirtyDaysAgo }
    });

    res.json({
      totalPatients,
      pendingOrders,
      completedTests,
      criticalResults,
      recentActivity: {
        newPatientsThisMonth,
        ordersThisMonth,
        resultsThisMonth
      }
    });
  } catch (error) {
    console.error('Dashboard statistics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get recent orders for dashboard
router.get('/recent-orders', async (req, res) => {
  try {
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('patient', 'firstName lastName patientId')
      .populate('tests.test', 'testName testCode')
      .populate('createdBy', 'firstName lastName');

    res.json({ orders: recentOrders });
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get alerts and notifications
router.get('/alerts', async (req, res) => {
  try {
    const alerts = [];

    // Critical results that need attention
    const criticalResults = await Result.countDocuments({
      overallResult: 'critical',
      status: 'preliminary'
    });

    if (criticalResults > 0) {
      alerts.push({
        type: 'danger',
        message: `${criticalResults} critical result${criticalResults > 1 ? 's' : ''} pending review`,
        action: '/results?filter=critical'
      });
    }

    // Overdue orders (more than 2 days old and still pending)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const overdueOrders = await Order.countDocuments({
      status: 'pending',
      createdAt: { $lt: twoDaysAgo }
    });

    if (overdueOrders > 0) {
      alerts.push({
        type: 'warning',
        message: `${overdueOrders} order${overdueOrders > 1 ? 's' : ''} overdue for processing`,
        action: '/orders?filter=overdue'
      });
    }

    // Quality control checks needed
    const qcFailures = await Result.countDocuments({
      'qualityControl.controlsPassed': false,
      performedDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    if (qcFailures > 0) {
      alerts.push({
        type: 'warning',
        message: `${qcFailures} quality control failure${qcFailures > 1 ? 's' : ''} in the last week`,
        action: '/results?filter=qc-failed'
      });
    }

    // High priority orders
    const urgentOrders = await Order.countDocuments({
      priority: { $in: ['urgent', 'stat'] },
      status: { $in: ['pending', 'partial'] }
    });

    if (urgentOrders > 0) {
      alerts.push({
        type: 'info',
        message: `${urgentOrders} urgent order${urgentOrders > 1 ? 's' : ''} require attention`,
        action: '/orders?filter=urgent'
      });
    }

    res.json({ alerts });
  } catch (error) {
    console.error('Dashboard alerts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get workload summary
router.get('/workload', async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Today's workload
    const ordersToday = await Order.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const resultsToday = await Result.countDocuments({
      performedDate: { $gte: startOfDay, $lte: endOfDay }
    });

    const pendingTests = await Order.aggregate([
      {
        $match: { status: { $in: ['pending', 'partial'] } }
      },
      {
        $unwind: '$tests'
      },
      {
        $match: { 'tests.status': { $in: ['pending', 'collected', 'processing'] } }
      },
      {
        $count: 'pendingTests'
      }
    ]);

    const pendingTestCount = pendingTests.length > 0 ? pendingTests[0].pendingTests : 0;

    // Test category breakdown for pending work
    const categoryWorkload = await Order.aggregate([
      {
        $match: { status: { $in: ['pending', 'partial'] } }
      },
      {
        $unwind: '$tests'
      },
      {
        $match: { 'tests.status': { $in: ['pending', 'collected', 'processing'] } }
      },
      {
        $lookup: {
          from: 'tests',
          localField: 'tests.test',
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
          count: { $sum: 1 },
          urgent: {
            $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
          },
          stat: {
            $sum: { $cond: [{ $eq: ['$priority', 'stat'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      today: {
        ordersCreated: ordersToday,
        resultsCompleted: resultsToday
      },
      pending: {
        totalTests: pendingTestCount,
        byCategory: categoryWorkload
      }
    });
  } catch (error) {
    console.error('Dashboard workload error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // Average turnaround time
    const turnaroundTimes = await Order.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: last30Days },
          actualCompletion: { $exists: true }
        }
      },
      {
        $project: {
          turnaroundHours: {
            $divide: [
              { $subtract: ['$actualCompletion', '$createdAt'] },
              1000 * 60 * 60
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTurnaround: { $avg: '$turnaroundHours' },
          minTurnaround: { $min: '$turnaroundHours' },
          maxTurnaround: { $max: '$turnaroundHours' }
        }
      }
    ]);

    // Result accuracy (QC pass rate)
    const qcStats = await Result.aggregate([
      {
        $match: {
          performedDate: { $gte: last30Days }
        }
      },
      {
        $group: {
          _id: null,
          totalResults: { $sum: 1 },
          passedQC: {
            $sum: { $cond: ['$qualityControl.controlsPassed', 1, 0] }
          }
        }
      },
      {
        $project: {
          totalResults: 1,
          passedQC: 1,
          qcPassRate: {
            $multiply: [
              { $divide: ['$passedQC', '$totalResults'] },
              100
            ]
          }
        }
      }
    ]);

    // Daily volume trend (last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const dailyVolume = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          orders: { $sum: 1 },
          tests: { $sum: { $size: '$tests' } }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    const performance = {
      turnaroundTime: turnaroundTimes[0] || { avgTurnaround: 0, minTurnaround: 0, maxTurnaround: 0 },
      qualityControl: qcStats[0] || { totalResults: 0, passedQC: 0, qcPassRate: 0 },
      dailyVolume
    };

    res.json(performance);
  } catch (error) {
    console.error('Dashboard performance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user activity summary
router.get('/activity', async (req, res) => {
  try {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    // Recent user activities
    const recentOrders = await Order.find({
      createdAt: { $gte: last24Hours }
    })
      .limit(10)
      .populate('createdBy', 'firstName lastName')
      .populate('patient', 'firstName lastName patientId')
      .sort({ createdAt: -1 });

    const recentResults = await Result.find({
      performedDate: { $gte: last24Hours }
    })
      .limit(10)
      .populate('performedBy', 'firstName lastName')
      .populate('patient', 'firstName lastName patientId')
      .populate('test', 'testName testCode')
      .sort({ performedDate: -1 });

    // Activity by user role
    const userActivity = await Order.aggregate([
      {
        $match: { createdAt: { $gte: last24Hours } }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $group: {
          _id: '$user.role',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      recentOrders: recentOrders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        patient: order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : 'Unknown',
        createdBy: order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : 'Unknown',
        createdAt: order.createdAt,
        status: order.status
      })),
      recentResults: recentResults.map(result => ({
        id: result._id,
        resultNumber: result.resultNumber,
        patient: result.patient ? `${result.patient.firstName} ${result.patient.lastName}` : 'Unknown',
        test: result.test ? result.test.testName : 'Unknown',
        performedBy: result.performedBy ? `${result.performedBy.firstName} ${result.performedBy.lastName}` : 'Unknown',
        performedDate: result.performedDate,
        overallResult: result.overallResult
      })),
      activityByRole: userActivity
    });
  } catch (error) {
    console.error('Dashboard activity error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;