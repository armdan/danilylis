const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    enum: ['MD', 'DO', 'DPM', 'DDS', 'DMD', 'PhD', 'PA', 'NP', 'RN', 'Other'],
    default: 'MD'
  },
  suffix: {
    type: String,
    trim: true
  },
  
  // Professional Information
  npiNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: /^\d{10}$/
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  licenseState: {
    type: String,
    uppercase: true,
    trim: true,
    minlength: 2,
    maxlength: 2
  },
  deaNumber: {
    type: String,
    trim: true
  },
  
  // Specialties
  primarySpecialty: {
    type: String,
    required: true,
    trim: true
  },
  secondarySpecialties: [{
    type: String,
    trim: true
  }],
  
  // Contact Information
  phone: {
    office: {
      type: String,
      required: true,
      trim: true
    },
    mobile: {
      type: String,
      trim: true
    },
    emergency: {
      type: String,
      trim: true
    }
  },
  email: {
    primary: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    secondary: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
  },
  fax: {
    type: String,
    trim: true
  },
  
  // Associated Medical Offices (Many-to-Many)
  medicalOffices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalOffice'
  }],
  
  // Primary Office (for default selection)
  primaryOffice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalOffice'
  },
  
  // Preferences
  preferences: {
    resultNotification: {
      critical: {
        type: String,
        enum: ['phone', 'email', 'both', 'none'],
        default: 'phone'
      },
      abnormal: {
        type: String,
        enum: ['phone', 'email', 'both', 'none'],
        default: 'email'
      },
      normal: {
        type: String,
        enum: ['email', 'none'],
        default: 'email'
      }
    },
    preferredContactTime: {
      start: String, // e.g., "09:00"
      end: String    // e.g., "17:00"
    },
    preferredTests: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test'
    }]
  },
  
  // Signature
  signatureOnFile: {
    type: Boolean,
    default: false
  },
  signatureDate: {
    type: Date
  },
  digitalSignature: {
    type: String, // Base64 encoded signature image
    trim: true
  },
  
  // Credentials & Compliance
  credentialingDate: {
    type: Date
  },
  recredentialingDate: {
    type: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_verification'],
    default: 'active'
  },
  
  // Notes
  notes: {
    type: String,
    trim: true
  },
  specialInstructions: {
    type: String,
    trim: true
  },
  
  // Statistics (denormalized for performance)
  statistics: {
    totalOrders: {
      type: Number,
      default: 0
    },
    lastOrderDate: {
      type: Date
    },
    averageOrdersPerMonth: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
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

// Indexes
doctorSchema.index({ firstName: 1, lastName: 1 });
doctorSchema.index({ npiNumber: 1 });
doctorSchema.index({ status: 1 });
doctorSchema.index({ medicalOffices: 1 });
doctorSchema.index({ 'email.primary': 1 });

// Virtual for full name
doctorSchema.virtual('fullName').get(function() {
  let name = '';
  if (this.title) name += this.title + ' ';
  name += this.firstName;
  if (this.middleName) name += ' ' + this.middleName;
  name += ' ' + this.lastName;
  if (this.suffix) name += ', ' + this.suffix;
  return name;
});

// Virtual for display name (Last, First)
doctorSchema.virtual('displayName').get(function() {
  let name = this.lastName + ', ' + this.firstName;
  if (this.title) name = this.title + ' ' + name;
  if (this.suffix) name += ', ' + this.suffix;
  return name;
});

// Method to get all orders by this doctor
doctorSchema.methods.getOrders = async function() {
  const Order = mongoose.model('Order');
  return await Order.find({ 'orderingPhysician.doctorId': this._id });
};

// Method to update statistics
doctorSchema.methods.updateStatistics = async function() {
  const Order = mongoose.model('Order');
  
  const totalOrders = await Order.countDocuments({ 
    'orderingPhysician.doctorId': this._id 
  });
  
  const lastOrder = await Order.findOne({ 
    'orderingPhysician.doctorId': this._id 
  }).sort('-createdAt');
  
  // Calculate average orders per month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const recentOrders = await Order.countDocuments({
    'orderingPhysician.doctorId': this._id,
    createdAt: { $gte: sixMonthsAgo }
  });
  
  this.statistics = {
    totalOrders,
    lastOrderDate: lastOrder ? lastOrder.createdAt : null,
    averageOrdersPerMonth: Math.round(recentOrders / 6)
  };
  
  await this.save();
};

// Pre-save validation
doctorSchema.pre('save', function(next) {
  // Ensure primary office is in medical offices list
  if (this.primaryOffice && !this.medicalOffices.includes(this.primaryOffice)) {
    this.medicalOffices.push(this.primaryOffice);
  }
  next();
});

module.exports = mongoose.model('Doctor', doctorSchema);