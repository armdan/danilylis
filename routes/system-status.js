const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/status', async (req, res) => {
  try {
    const status = {
      database: 'offline',
      labelPrinter: 'offline',
      labEquipment: 'offline',
      timestamp: new Date()
    };

    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      status.database = 'online';
      
      // Test database responsiveness
      try {
        await mongoose.connection.db.admin().ping();
        status.database = 'online';
      } catch (pingError) {
        status.database = 'warning';
      }
    } else if (mongoose.connection.readyState === 2) {
      status.database = 'connecting';
    } else {
      status.database = 'offline';
    }

    // Check printer status (simplified - you'd need actual printer API)
    // For now, we'll assume it's ready if database is online
    if (status.database === 'online') {
      status.labelPrinter = 'ready';
    }

    // Lab equipment would require actual integration
    // For now, marking as not connected
    status.labEquipment = 'not_connected';

    res.json(status);
  } catch (error) {
    console.error('System status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check system status',
      database: 'error',
      labelPrinter: 'unknown',
      labEquipment: 'unknown'
    });
  }
});

module.exports = router;