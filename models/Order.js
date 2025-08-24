// models/Order.js - Complete corrected version
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  tests: [{
    test: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'tests.testModel', // Dynamic reference
      required: true
    },
    testModel: {
      type: String,
      enum: ['Test', 'PCRTest'],
      default: 'PCRTest'
    },
    status: {
      type: String,
      enum: ['pending', 'collected', 'processing', 'completed', 'cancelled'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['routine', 'urgent', 'stat'],
      default: 'routine'
    },
    sampleCollectedAt: Date,
    sampleCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processingStarted: Date,
    processingCompleted: Date,
    notes: String
  }],
  orderingPhysician: {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    name: {
      type: String,
      required: true
    },
    license: String,
    phone: String,
    email: String,
    facility: String
  },
  medicalOffice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalOffice'
  },
  clinicalInfo: {
    diagnosis: String,
    symptoms: String,
    treatmentHistory: String,
    urgencyReason: String
  },
  status: {
    type: String,
    enum: ['pending', 'accessioned', 'partial', 'completed', 'cancelled', 'rejected', 'hold'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine'
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'insurance', 'online', 'check']
  },
  insuranceClaim: {
    claimNumber: String,
    status: {
      type: String,
      enum: ['submitted', 'approved', 'denied', 'pending']
    },
    amount: Number
  },
  scheduledDate: Date,
  collectionDate: Date,
  expectedCompletion: Date,
  actualCompletion: Date,
  labelPrinted: {
    type: Boolean,
    default: false
  },
  labelPrintedAt: Date,
  labelPrintedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Accession-specific fields
  accessionNumber: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  accessionDate: {
    type: Date
  },
  accessionedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Specimen tracking
  specimenType: {
    type: String,
    enum: ['blood', 'serum', 'plasma', 'urine', 'stool', 'swab', 'tissue', 'sputum', 'nail_clipping', 'nasopharyngeal_swab', 'wound_swab', 'other'],
  
  },
  specimenBarcode: {
    type: String,
    index: true
  },
  labBarcode: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  specimenCondition: {
    type: String,
    enum: ['good', 'hemolyzed', 'clotted', 'insufficient', 'contaminated', 'other'],
    default: 'good'
  },
  
  // Collection and receipt tracking
  receivedDate: {
    type: Date
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Rejection tracking
  rejectionDate: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String
  },
  rejectionComments: {
    type: String
  },
  
  // Hold tracking
  holdDate: {
    type: Date
  },
  holdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  holdReason: {
    type: String
  },
  holdNotes: {
    type: String
  },
  
  // Order source tracking
  orderType: {
    type: String,
    enum: ['electronic', 'paper', 'manual', 'phone', 'walk-in'],
    default: 'manual'
  },
  orderSource: {
    type: String
  },
  
  // Additional tracking
  accessionNotes: {
    type: String
  },
  turnaroundTime: {
    target: Number,
    actual: Number
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Generate order number in format: YYMMDD001
orderSchema.statics.generateOrderNumber = async function() {
  const today = new Date();
  const year = String(today.getFullYear()).slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `${year}${month}${day}`;
  
  const lastOrder = await this.findOne({
    orderNumber: new RegExp(`^${prefix}`)
  }).sort({ orderNumber: -1 });
  
  let nextNumber = 1;
  if (lastOrder) {
    const lastNumber = parseInt(lastOrder.orderNumber.slice(6));
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
};

// Generate accession number
orderSchema.statics.generateAccessionNumber = async function() {
  const today = new Date();
  const year = String(today.getFullYear()).slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `ACC${year}${month}${day}`;
  
  const lastAccession = await this.findOne({
    accessionNumber: new RegExp(`^${prefix}`)
  }).sort({ accessionNumber: -1 });
  
  let nextNumber = 1;
  if (lastAccession) {
    const lastNumber = parseInt(lastAccession.accessionNumber.slice(9));
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

// Calculate total amount
orderSchema.methods.calculateTotal = async function() {
  const Test = require('./Test');
  const PCRTest = require('./PCRTest');
  
  let total = 0;
  
  for (const testItem of this.tests) {
    let test = await Test.findById(testItem.test);
    
    if (!test) {
      test = await PCRTest.findById(testItem.test);
    }
    
    if (test && test.price) {
      total += test.price;
    }
  }
  
  this.totalAmount = total;
  return this.totalAmount;
};

// Update order status based on test statuses
orderSchema.methods.updateStatus = function() {
  const testStatuses = this.tests.map(t => t.status);
  
  if (testStatuses.every(status => status === 'completed')) {
    this.status = 'completed';
    this.actualCompletion = new Date();
  } else if (testStatuses.some(status => status === 'completed')) {
    this.status = 'partial';
  } else if (testStatuses.every(status => status === 'cancelled')) {
    this.status = 'cancelled';
  } else if (this.accessionNumber) {
    this.status = 'accessioned';
  } else {
    this.status = 'pending';
  }
};

// Mark label as printed
orderSchema.methods.markLabelPrinted = function(userId) {
  this.labelPrinted = true;
  this.labelPrintedAt = new Date();
  this.labelPrintedBy = userId;
  return this.save();
};

// Calculate turnaround time
orderSchema.methods.calculateTurnaroundTime = function() {
  if (this.accessionDate && this.actualCompletion) {
    const hours = Math.floor((this.actualCompletion - this.accessionDate) / (1000 * 60 * 60));
    this.turnaroundTime.actual = hours;
    return hours;
  }
  return null;
};

// Check if specimen is acceptable
orderSchema.methods.isSpecimenAcceptable = function() {
  const unacceptableConditions = ['hemolyzed', 'clotted', 'insufficient', 'contaminated'];
  return !unacceptableConditions.includes(this.specimenCondition);
};

// Virtual for specimen age
orderSchema.virtual('specimenAge').get(function() {
  if (this.collectionDate) {
    const hours = Math.floor((Date.now() - this.collectionDate) / (1000 * 60 * 60));
    return hours;
  }
  return null;
});

// Virtual for is specimen expired
orderSchema.virtual('isSpecimenExpired').get(function() {
  const maxAgeHours = 72;
  return this.specimenAge > maxAgeHours;
});

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ patient: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'orderingPhysician.name': 1 });
orderSchema.index({ accessionNumber: 1 });
orderSchema.index({ specimenBarcode: 1 });

module.exports = mongoose.model('Order', orderSchema);