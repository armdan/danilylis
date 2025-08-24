// models/Accession.js
const mongoose = require('mongoose');

const accessionSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  accessionNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  accessionedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  specimenCondition: {
    type: String,
    enum: ['good', 'hemolyzed', 'clotted', 'insufficient', 'contaminated', 'other'],
    default: 'good'
  },
  status: {
    type: String,
    enum: ['accessioned', 'rejected', 'hold'],
    default: 'accessioned'
  },
  rejectionReason: {
    type: String,
    enum: [
      'hemolyzed',
      'clotted',
      'insufficient',
      'wrong_tube',
      'unlabeled',
      'mislabeled',
      'contaminated',
      'expired',
      'temperature',
      'other'
    ]
  },
  notes: {
    type: String
  },
  // Chain of custody tracking
  chainOfCustody: [{
    action: {
      type: String,
      enum: ['received', 'accessioned', 'transferred', 'processed', 'stored', 'discarded']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: String,
    notes: String
  }],
  // Storage information
  storageLocation: {
    type: String
  },
  storageTemperature: {
    type: String,
    enum: ['room', 'refrigerated', 'frozen', '-80']
  },
  // Aliquot tracking
  aliquots: [{
    aliquotId: String,
    volume: Number,
    unit: String,
    location: String,
    createdDate: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Indexes for performance
accessionSchema.index({ accessionDate: -1 });
accessionSchema.index({ status: 1, accessionDate: -1 });
accessionSchema.index({ order: 1 });

// Virtual for age of specimen
accessionSchema.virtual('specimenAge').get(function() {
  if (this.accessionDate) {
    const hours = Math.floor((Date.now() - this.accessionDate) / (1000 * 60 * 60));
    if (hours < 24) {
      return `${hours} hours`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} days`;
    }
  }
  return null;
});

// Method to add chain of custody entry
accessionSchema.methods.addChainOfCustody = function(action, userId, location, notes) {
  this.chainOfCustody.push({
    action,
    performedBy: userId,
    timestamp: new Date(),
    location,
    notes
  });
  return this.save();
};

// Method to create aliquot
accessionSchema.methods.createAliquot = function(volume, unit, location, userId) {
  const aliquotId = `${this.accessionNumber}-${this.aliquots.length + 1}`;
  this.aliquots.push({
    aliquotId,
    volume,
    unit,
    location,
    createdDate: new Date(),
    createdBy: userId
  });
  return this.save();
};

// Static method to get daily accession statistics
accessionSchema.statics.getDailyStatistics = async function(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const stats = await this.aggregate([
    {
      $match: {
        accessionDate: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return stats.reduce((acc, stat) => {
    acc[stat._id] = stat.count;
    return acc;
  }, {});
};

module.exports = mongoose.model('Accession', accessionSchema);