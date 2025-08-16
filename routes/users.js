const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all users (Admin only)
router.get('/', [
  requireAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('role').optional().isIn(['admin', 'lab_technician', 'doctor', 'receptionist']),
  query('department').optional().isIn(['hematology', 'biochemistry', 'microbiology', 'immunology', 'pathology', 'radiology', 'general']),
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
    const role = req.query.role;
    const department = req.query.department;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) query.role = role;
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID (Admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new user (Admin only)
router.post('/', [
  requireAdmin,
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('role').isIn(['admin', 'lab_technician', 'doctor', 'receptionist']).withMessage('Invalid role'),
  body('department').optional().isIn(['hematology', 'biochemistry', 'microbiology', 'immunology', 'pathology', 'radiology', 'general'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName, role, department, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      role,
      department: department || 'general',
      phone
    });

    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user (Admin only)
router.put('/:id', [
  requireAdmin,
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'lab_technician', 'doctor', 'receptionist']),
  body('department').optional().isIn(['hematology', 'biochemistry', 'microbiology', 'immunology', 'pathology', 'radiology', 'general']),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;

    // Prevent admin from deactivating themselves
    if (userId === req.user._id.toString() && req.body.isActive === false) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    // Check if email is already taken by another user
    if (req.body.email) {
      const existingUser = await User.findOne({ 
        email: req.body.email, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset user password (Admin only)
router.put('/:id/reset-password', [
  requireAdmin,
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = req.body.newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Deactivate user (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user statistics (Admin only)
router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalAdmins = await User.countDocuments({ role: 'admin', isActive: true });
    const totalDoctors = await User.countDocuments({ role: 'doctor', isActive: true });
    const totalTechnicians = await User.countDocuments({ role: 'lab_technician', isActive: true });
    const totalReceptionists = await User.countDocuments({ role: 'receptionist', isActive: true });

    // Users by department
    const departmentStats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      }
    ]);

    // Users by role
    const roleStats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent logins (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentLogins = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo },
      isActive: true
    });

    res.json({
      total: totalUsers,
      roles: {
        admin: totalAdmins,
        doctor: totalDoctors,
        lab_technician: totalTechnicians,
        receptionist: totalReceptionists
      },
      departmentBreakdown: departmentStats,
      roleBreakdown: roleStats,
      recentLogins,
      activeUsers: totalUsers
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get users by role
router.get('/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    
    if (!['admin', 'lab_technician', 'doctor', 'receptionist'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const users = await User.find({ 
      role, 
      isActive: true 
    })
      .select('firstName lastName username email department')
      .sort({ firstName: 1, lastName: 1 });

    res.json({ users });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get users by department
router.get('/department/:department', async (req, res) => {
  try {
    const { department } = req.params;
    
    if (!['hematology', 'biochemistry', 'microbiology', 'immunology', 'pathology', 'radiology', 'general'].includes(department)) {
      return res.status(400).json({ message: 'Invalid department' });
    }

    const users = await User.find({ 
      department, 
      isActive: true 
    })
      .select('firstName lastName username email role')
      .sort({ firstName: 1, lastName: 1 });

    res.json({ users });
  } catch (error) {
    console.error('Get users by department error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;