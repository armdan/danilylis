// models/PCRResult.js
const mongoose = require('mongoose');

// Individual target result schema
const targetResultSchema = new mongoose.Schema({
  targetName: {
    type: String,
    required: true
  },
  targetCategory: {
    type: String,
    enum: ['bacteria', 'virus', 'fungus', 'parasite', 'other']
  },
  detected: {
    type: Boolean,
    required: true
  },
  ctValue: {
    type: Number, // Cycle threshold value
    min: 0,
    max: 50
  },
  quantification: {
    value: Number, // Viral/bacterial load if quantitative
    unit: String // e.g., "copies/mL", "CFU/mL"
  },
  interpretation: {
    type: String,
    enum: ['Detected', 'Not Detected', 'Indeterminate', 'Invalid', 'Inhibited'],
    required: true
  },
  clinicalSignificance: String
});

// Resistance marker result schema
const resistanceResultSchema = new mongoose.Schema({
  markerName: {
    type: String,
    required: true
  },
  detected: {
    type: Boolean,
    required: true
  },
  gene: String,
  interpretation: {
    type: String,
    enum: ['Detected', 'Not Detected', 'Indeterminate', 'Invalid'],
    required: true
  },
  implication: String, // Clinical implication of the resistance
  affectedAntibiotics: [String] // List of antibiotics this resistance affects
});

// Antibiotic susceptibility result
const susceptibilityResultSchema = new mongoose.Schema({
  antibiotic: {
    type: String,
    required: true
  },
  interpretation: {
    type: String,
    enum: ['Susceptible', 'Intermediate', 'Resistant', 'Not Tested'],
    required: true
  },
  mic: { // Minimum Inhibitory Concentration
    value: Number,
    unit: String
  }
});

const pcrResultSchema = new mongoose.Schema({
  // Link to order and patient
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
    ref: 'PCRTest',
    required: true
  },
  resultNumber: {
    type: String,
    required: true,
    unique: true
  },
  // Sample information
  sampleInfo: {
    sampleType: {
      type: String,
      required: true
    },
    collectionDate: {
      type: Date,
      required: true
    },
    receivedDate: {
      type: Date,
      required: true
    },
    sampleQuality: {
      type: String,
      enum: ['Adequate', 'Marginal', 'Inadequate'],
      default: 'Adequate'
    },
    sampleId: String
  },
  // Test results
  targetResults: [targetResultSchema],
  resistanceResults: [resistanceResultSchema],
  susceptibilityResults: [susceptibilityResultSchema],
  // Quality control results
  qualityControl: {
    internalControlResult: {
      type: String,
      enum: ['Pass', 'Fail', 'Invalid'],
      required: true
    },
    internalControlCt: Number,
    positiveControlResult: {
      type: String,
      enum: ['Pass', 'Fail', 'Not Run']
    },
    negativeControlResult: {
      type: String,
      enum: ['Pass', 'Fail', 'Not Run']
    },
    notes: String
  },
  // Overall result interpretation
  overallResult: {
    status: {
      type: String,
      enum: ['Positive', 'Negative', 'Indeterminate', 'Invalid', 'Partially Positive'],
      required: true
    },
    summary: String, // Brief summary of findings
    pathogensDetected: [String], // List of detected pathogens
    resistanceDetected: [String], // List of detected resistance markers
    clinicalInterpretation: String, // Detailed clinical interpretation
    recommendations: String
  },
  // Treatment suggestions (if applicable)
  treatmentSuggestions: {
    preferred: [String], // Preferred antibiotics based on results
    alternative: [String], // Alternative options
    avoid: [String], // Antibiotics to avoid based on resistance
    notes: String
  },
  // Result status and workflow
  status: {
    type: String,
    enum: ['Preliminary', 'Final', 'Amended', 'Cancelled', 'Rejected'],
    default: 'Preliminary'
  },
  rejectionReason: String,
  // Personnel and dates
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedDate: {
    type: Date,
    default: Date.now
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedDate: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: Date,
  reportedDate: Date,
  // Amendments tracking
  amendments: [{
    reason: String,
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    amendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amendedDate: {
      type: Date,
      default: Date.now
    }
  }],
  // Critical values notification
  criticalValues: [{
    pathogen: String,
    notifiedTo: String,
    notificationTime: Date,
    notificationMethod: String,
    acknowledgment: String
  }],
  // Additional notes
  technicalNotes: String, // For lab use
  physicianNotes: String, // Notes for ordering physician
  // Report customization
  reportOptions: {
    includeCtValues: {
      type: Boolean,
      default: false
    },
    includeQuantification: {
      type: Boolean,
      default: false
    },
    includeResistanceProfile: {
      type: Boolean,
      default: true
    },
    includeMethodology: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Generate result number
pcrResultSchema.statics.generateResultNumber = async function() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `PCR${year}${month}${day}`;
  const count = await this.countDocuments({
    resultNumber: new RegExp(`^${prefix}`)
  });
  
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

// Method to determine overall status based on target results
pcrResultSchema.methods.determineOverallStatus = function() {
  const hasPositive = this.targetResults.some(t => t.detected);
  const hasInvalid = this.targetResults.some(t => t.interpretation === 'Invalid');
  const hasIndeterminate = this.targetResults.some(t => t.interpretation === 'Indeterminate');
  
  if (hasInvalid) return 'Invalid';
  if (hasPositive && this.targetResults.some(t => !t.detected)) return 'Partially Positive';
  if (hasPositive) return 'Positive';
  if (hasIndeterminate) return 'Indeterminate';
  return 'Negative';
};

// Method to get list of detected pathogens
pcrResultSchema.methods.getDetectedPathogens = function() {
  return this.targetResults
    .filter(t => t.detected)
    .map(t => ({
      name: t.targetName,
      category: t.targetCategory,
      ctValue: t.ctValue,
      quantification: t.quantification
    }));
};

// Method to get resistance profile
pcrResultSchema.methods.getResistanceProfile = function() {
  return this.resistanceResults
    .filter(r => r.detected)
    .map(r => ({
      marker: r.markerName,
      gene: r.gene,
      affectedAntibiotics: r.affectedAntibiotics
    }));
};

// Method to check for critical values
pcrResultSchema.methods.checkCriticalValues = function() {
  const criticalPathogens = [
    'MRSA', 'VRE', 'CRE', 'Carbapenem-resistant', 
    'ESBL', 'KPC', 'NDM', 'Clostridioides difficile'
  ];
  
  const detected = this.targetResults
    .filter(t => t.detected)
    .filter(t => criticalPathogens.some(cp => 
      t.targetName.toLowerCase().includes(cp.toLowerCase())
    ));
  
  return detected.map(t => ({
    pathogen: t.targetName,
    requiresNotification: true
  }));
};

// Pre-save hook to update overall result
pcrResultSchema.pre('save', function(next) {
  if (this.isModified('targetResults')) {
    this.overallResult.status = this.determineOverallStatus();
    this.overallResult.pathogensDetected = this.targetResults
      .filter(t => t.detected)
      .map(t => t.targetName);
    this.overallResult.resistanceDetected = this.resistanceResults
      .filter(r => r.detected)
      .map(r => r.markerName);
  }
  next();
});

// Indexes
pcrResultSchema.index({ resultNumber: 1 });
pcrResultSchema.index({ order: 1 });
pcrResultSchema.index({ patient: 1 });
pcrResultSchema.index({ test: 1 });
pcrResultSchema.index({ status: 1 });
pcrResultSchema.index({ 'overallResult.status': 1 });
pcrResultSchema.index({ performedDate: -1 });

module.exports = mongoose.model('PCRResult', pcrResultSchema);