const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  resultNumber: {
    type: String,
    required: true,
    unique: true
  },
  parameters: [{
    name: {
      type: String,
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    unit: String,
    referenceRange: {
      min: Number,
      max: Number,
      text: String
    },
    flag: {
      type: String,
      enum: ['normal', 'high', 'low', 'critical_high', 'critical_low', 'abnormal'],
      default: 'normal'
    },
    notes: String
  }],
  overallResult: {
    type: String,
    enum: ['normal', 'abnormal', 'inconclusive', 'critical'],
    required: true
  },
  interpretation: String,
  recommendations: String,
  technicalNotes: String,
  qualityControl: {
    controlsPassed: {
      type: Boolean,
      default: true
    },
    controlResults: [{
      controlType: String,
      expectedValue: String,
      actualValue: String,
      status: {
        type: String,
        enum: ['pass', 'fail', 'warning']
      }
    }],
    calibrationDate: Date,
    instrumentId: String
  },
  status: {
    type: String,
    enum: ['preliminary', 'final', 'amended', 'cancelled'],
    default: 'preliminary'
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  performedDate: {
    type: Date,
    default: Date.now
  },
  reviewedDate: Date,
  approvedDate: Date,
  reportedDate: Date,
  amendments: [{
    reason: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    previousValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed
  }],
  criticalValues: [{
    parameter: String,
    value: String,
    notifiedTo: String,
    notificationTime: Date,
    acknowledgment: String
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Generate result number
resultSchema.statics.generateResultNumber = async function() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `RES${year}${month}${day}`;
  const count = await this.countDocuments({
    resultNumber: new RegExp(`^${prefix}`)
  });
  
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

// Check for critical values
resultSchema.methods.checkCriticalValues = function() {
  const critical = [];
  
  this.parameters.forEach(param => {
    if (param.flag === 'critical_high' || param.flag === 'critical_low') {
      critical.push({
        parameter: param.name,
        value: param.value,
        flag: param.flag
      });
    }
  });
  
  return critical;
};

// Automatically flag parameters
resultSchema.pre('save', function(next) {
  this.parameters.forEach(param => {
    if (param.referenceRange && param.referenceRange.min !== undefined && param.referenceRange.max !== undefined) {
      const numericValue = parseFloat(param.value);
      
      if (!isNaN(numericValue)) {
        if (numericValue < param.referenceRange.min) {
          param.flag = 'low';
        } else if (numericValue > param.referenceRange.max) {
          param.flag = 'high';
        } else {
          param.flag = 'normal';
        }
      }
    }
  });
  
  next();
});

// Indexes
resultSchema.index({ resultNumber: 1 });
resultSchema.index({ order: 1 });
resultSchema.index({ patient: 1 });
resultSchema.index({ test: 1 });
resultSchema.index({ status: 1 });
resultSchema.index({ performedDate: -1 });

module.exports = mongoose.model('Result', resultSchema);