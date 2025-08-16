const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
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
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['hematology', 'biochemistry', 'microbiology', 'immunology', 'pathology', 'radiology', 'molecular'],
    required: true
  },
  sampleType: {
    type: String,
    enum: ['blood', 'urine', 'serum', 'plasma', 'stool', 'saliva', 'tissue', 'swab', 'other'],
    required: true
  },
  sampleVolume: {
    value: Number,
    unit: {
      type: String,
      enum: ['ml', 'µl', 'l', 'drops'],
      default: 'ml'
    }
  },
  containerType: {
    type: String,
    enum: ['red_top', 'purple_top', 'blue_top', 'green_top', 'gray_top', 'yellow_top', 'sterile_container', 'other']
  },
  processingTime: {
    value: Number,
    unit: {
      type: String,
      enum: ['minutes', 'hours', 'days'],
      default: 'hours'
    }
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  normalRanges: [{
    parameter: String,
    minValue: Number,
    maxValue: Number,
    unit: String,
    ageGroup: {
      type: String,
      enum: ['pediatric', 'adult', 'geriatric', 'all'],
      default: 'all'
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'all'],
      default: 'all'
    }
  }],
  prerequisites: [{
    type: String,
    trim: true
  }],
  instructions: {
    preTest: [String],
    postTest: [String],
    patientInstructions: [String]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  methodology: String,
  equipment: String,
  reagents: [String],
  qualityControl: {
    frequency: String,
    lastPerformed: Date,
    nextDue: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
testSchema.index({ testCode: 1 });
testSchema.index({ category: 1 });
testSchema.index({ testName: 'text', description: 'text' });

module.exports = mongoose.model('Test', testSchema);