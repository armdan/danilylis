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
    name: {
      type: String,
      required: true
    },
    license: String,
    phone: String,
    email: String,
    facility: String
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

// Generate order number
orderSchema.statics.generateOrderNumber = async function() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `ORD${year}${month}${day}`;
  const count = await this.countDocuments({
    orderNumber: new RegExp(`^${prefix}`)
  });
  
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

// Calculate total amount
orderSchema.methods.calculateTotal = async function() {
  await this.populate('tests.test');
  this.totalAmount = this.tests.reduce((total, testItem) => {
    return total + (testItem.test.price || 0);
  }, 0);
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

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ patient: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'orderingPhysician.name': 1 });

module.exports = mongoose.model('Order', orderSchema);