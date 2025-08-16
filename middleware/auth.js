const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token or user inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(500).json({ message: 'Token verification failed' });
  }
};

// Check user roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

// Check if user can access patient data
const checkPatientAccess = async (req, res, next) => {
  try {
    const patientId = req.params.patientId || req.body.patient;
    
    // Admins and doctors have full access
    if (['admin', 'doctor'].includes(req.user.role)) {
      return next();
    }
    
    // Lab technicians can access patients they've worked with
    if (req.user.role === 'lab_technician') {
      return next(); // Allow access for now, can be restricted based on business rules
    }
    
    // Receptionists can access basic patient info
    if (req.user.role === 'receptionist') {
      return next();
    }
    
    return res.status(403).json({ 
      message: 'Access denied. Cannot access patient data.' 
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error checking patient access' });
  }
};

module.exports = {
  authenticateToken,
  authorize,
  requireAdmin,
  checkPatientAccess
};