// routes/settings.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const LaboratorySettings = require('../models/LaboratorySettings');
const { authenticateToken, authorize } = require('../middleware/auth');

// Configure multer for logo upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/logos';
    if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg)'));
    }
  }
});

// Get current laboratory settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await LaboratorySettings.getCurrent();
    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update laboratory settings (Admin only)
router.put('/', [
  authenticateToken,
  authorize('admin'),
  body('labName').trim().notEmpty().withMessage('Laboratory name is required'),
  body('labDirector.firstName').trim().notEmpty().withMessage('Director first name is required'),
  body('labDirector.lastName').trim().notEmpty().withMessage('Director last name is required'),
  body('address.street').trim().notEmpty().withMessage('Street address is required'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.state').trim().isLength({ min: 2, max: 2 }).withMessage('Valid state code required'),
  body('address.zipCode').matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code required'),
  body('cliaNumber').matches(/^[A-Z0-9]{10}$/).withMessage('Valid CLIA number required (10 characters)'),
  body('npiNumber').matches(/^\d{10}$/).withMessage('Valid NPI number required (10 digits)'),
  body('phone.main').trim().notEmpty().withMessage('Main phone number is required'),
  body('fax').trim().notEmpty().withMessage('Fax number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Find existing settings or create new
    let settings = await LaboratorySettings.findOne({ isActive: true });
    
    if (settings) {
      // Update existing settings
      Object.assign(settings, req.body);
      settings.lastUpdatedBy = req.user.userId || req.user._id;
    } else {
      // Create new settings
      settings = new LaboratorySettings({
        ...req.body,
        lastUpdatedBy: req.user.userId || req.user._id,
        isActive: true
      });
    }

    await settings.save();

    res.json({
      message: 'Laboratory settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field === 'cliaNumber' ? 'CLIA' : 'NPI'} number already exists` 
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Upload laboratory logo (Admin only)
router.post('/logo', [
  authenticateToken,
  authorize('admin'),
  upload.single('logo')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get current settings
    let settings = await LaboratorySettings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Please configure laboratory settings first' });
    }

    // Delete old logo if exists
    if (settings.logo && settings.logo.filename) {
      const oldLogoPath = path.join('uploads/logos', settings.logo.filename);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Update logo information
    settings.logo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date()
    };
    settings.lastUpdatedBy = req.user.userId || req.user._id;

    await settings.save();

    res.json({
      message: 'Logo uploaded successfully',
      logo: {
        url: `/uploads/logos/${req.file.filename}`,
        ...settings.logo.toObject()
      }
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    // Clean up uploaded file if there was an error
    if (req.file) {
      const uploadedPath = path.join('uploads/logos', req.file.filename);
      if (fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete logo (Admin only)
router.delete('/logo', [
  authenticateToken,
  authorize('admin')
], async (req, res) => {
  try {
    const settings = await LaboratorySettings.findOne({ isActive: true });
    
    if (!settings || !settings.logo || !settings.logo.filename) {
      return res.status(404).json({ message: 'No logo found' });
    }

    // Delete logo file
    const logoPath = path.join('uploads/logos', settings.logo.filename);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }

    // Clear logo information
    settings.logo = undefined;
    settings.lastUpdatedBy = req.user.userId || req.user._id;
    await settings.save();

    res.json({ message: 'Logo deleted successfully' });
  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update operating hours (Admin only)
router.put('/hours', [
  authenticateToken,
  authorize('admin')
], async (req, res) => {
  try {
    const settings = await LaboratorySettings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({ message: 'Please configure laboratory settings first' });
    }

    settings.operatingHours = req.body.operatingHours;
    settings.lastUpdatedBy = req.user.userId || req.user._id;
    await settings.save();

    res.json({
      message: 'Operating hours updated successfully',
      operatingHours: settings.operatingHours
    });
  } catch (error) {
    console.error('Update hours error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get logo URL
router.get('/logo', authenticateToken, async (req, res) => {
  try {
    const settings = await LaboratorySettings.findOne({ isActive: true });
    
    if (!settings || !settings.logo || !settings.logo.filename) {
      return res.status(404).json({ message: 'No logo configured' });
    }

    res.json({
      url: `/uploads/logos/${settings.logo.filename}`,
      ...settings.logo.toObject()
    });
  } catch (error) {
    console.error('Get logo error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;