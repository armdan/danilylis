// models/PCRTest.js
const mongoose = require('mongoose');

// Define target schema for pathogens/organisms
const targetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['bacteria', 'virus', 'fungus', 'parasite', 'other'],
    required: true
  },
  gene: {
    type: String,
    trim: true // Gene target for detection (e.g., mecA for MRSA)
  },
  clinicalSignificance: {
    type: String,
    trim: true
  },
  reportingThreshold: {
    type: Number, // CT value threshold for positive result
    default: 35
  }
});

// Define antibiotic resistance marker schema
const resistanceMarkerSchema = new mongoose.Schema({
  marker: {
    type: String,
    required: true,
    trim: true // e.g., mecA, vanA, KPC, NDM-1
  },
  gene: {
    type: String,
    trim: true
  },
  antibioticClass: [{
    type: String,
    trim: true // e.g., Beta-lactams, Aminoglycosides
  }],
  clinicalImplication: {
    type: String,
    trim: true
  }
});

const pcrTestSchema = new mongoose.Schema({
  testCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  testName: {
    type: String,
    required: true,
    trim: true
  },
  shortName: {
    type: String,
    trim: true // e.g., 'UTI', 'Nail', 'GI'
  },
  description: {
    type: String,
    trim: true
  },
  testType: {
    type: String,
    enum: ['PCR', 'RT-PCR', 'qPCR', 'NGS', 'LAMP'],
    default: 'PCR'
  },
  panel: {
    type: String,
    enum: ['UTI', 'Nail_Fungus', 'Pneumonia', 'Wound', 'GI', 'COVID_FLU_RSV', 'STI', 'Respiratory', 'Custom'],
    required: true
  },
  category: {
    type: String,
    default: 'molecular'
  },
  sampleTypes: [{
    type: String,
    enum: ['urine', 'nail_clipping', 'sputum', 'bronchial_wash', 'wound_swab', 'tissue', 'stool', 'nasopharyngeal_swab', 'oropharyngeal_swab', 'blood', 'other']
  }],
  preferredSampleType: {
    type: String
  },
  targets: [targetSchema],
  resistanceMarkers: [resistanceMarkerSchema],
  // Test specifications
  specifications: {
    sensitivity: {
      type: String, // e.g., "95-99%"
    },
    specificity: {
      type: String, // e.g., "98-100%"
    },
    limitOfDetection: {
      type: String, // e.g., "100 copies/mL"
    },
    turnaroundTime: {
      value: {
        type: Number,
        default: 24
      },
      unit: {
        type: String,
        enum: ['hours', 'days'],
        default: 'hours'
      }
    }
  },
  // CPT and LOINC codes for billing and standardization
  billingCodes: {
    cptCode: {
      type: String,
      trim: true
    },
    loincCode: {
      type: String,
      trim: true
    }
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  // Sample requirements
  sampleRequirements: {
    volume: {
      min: Number,
      ideal: Number,
      unit: {
        type: String,
        default: 'mL'
      }
    },
    storageTemperature: {
      type: String, // e.g., "2-8°C"
    },
    stability: {
      type: String, // e.g., "7 days at 2-8°C"
    },
    rejectionCriteria: [{
      type: String
    }]
  },
  // Instructions and prerequisites
  instructions: {
    preCollection: [String],
    collectionMethod: [String],
    handling: [String],
    patientPrep: [String]
  },
  // Quality control
  qualityControl: {
    internalControl: {
      type: String,
      default: 'Human RNase P gene'
    },
    positiveControl: String,
    negativeControl: String
  },
  // Reporting
  reportingFormat: {
    includeCtValues: {
      type: Boolean,
      default: false
    },
    includeInterpretation: {
      type: Boolean,
      default: true
    },
    includeResistanceProfile: {
      type: Boolean,
      default: true
    }
  },
  interpretationGuidelines: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
pcrTestSchema.index({ testCode: 1 });
pcrTestSchema.index({ panel: 1 });
pcrTestSchema.index({ testName: 'text', description: 'text' });
pcrTestSchema.index({ 'targets.name': 1 });
pcrTestSchema.index({ isActive: 1 });

// Virtual to get all target names
pcrTestSchema.virtual('targetNames').get(function() {
  return this.targets.map(t => t.name);
});

// Virtual to get all resistance markers
pcrTestSchema.virtual('resistanceMarkerNames').get(function() {
  return this.resistanceMarkers.map(r => r.marker);
});

// Method to check if a specific target is included
pcrTestSchema.methods.hasTarget = function(targetName) {
  return this.targets.some(t => t.name.toLowerCase() === targetName.toLowerCase());
};

// Method to check if a specific resistance marker is included
pcrTestSchema.methods.hasResistanceMarker = function(markerName) {
  return this.resistanceMarkers.some(r => r.marker.toLowerCase() === markerName.toLowerCase());
};

// Static method to get tests by panel
pcrTestSchema.statics.getByPanel = async function(panel) {
  return this.find({ panel, isActive: true }).populate('createdBy', 'firstName lastName');
};

// Static method to find tests that detect a specific pathogen
pcrTestSchema.statics.findByTarget = async function(targetName) {
  return this.find({ 
    'targets.name': new RegExp(targetName, 'i'),
    isActive: true 
  });
};

module.exports = mongoose.model('PCRTest', pcrTestSchema);