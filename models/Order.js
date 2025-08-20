// models/Order.js - Updated with correct order number format
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
      ref: 'Test',
      required: true
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
    enum: ['pending', 'partial', 'completed', 'cancelled'],
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
  const year = String(today.getFullYear()).slice(-2); // Last 2 digits of year
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `${year}${month}${day}`;
  
  // Find the highest order number for today
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

// Calculate total amount
orderSchema.methods.calculateTotal = async function() {
  const Test = require('./Test');
  const PCRTest = require('./PCRTest');
  
  let total = 0;
  
  for (const testItem of this.tests) {
    // Try regular test first
    let test = await Test.findById(testItem.test);
    
    // If not found, try PCR test
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

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ patient: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'orderingPhysician.name': 1 });

module.exports = mongoose.model('Order', orderSchema);