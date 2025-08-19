const mongoose = require('mongoose');

const medicalOfficeSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  officeCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  
  // Organization Relationship
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false // Can be independent
  },
  
  // Location Information
  address: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    suite: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 2
    },
    zipCode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{5}(-\d{4})?$/
    },
    country: {
      type: String,
      default: 'USA',
      trim: true
    }
  },
  
  // Contact Information
  phone: {
    main: {
      type: String,
      required: true,
      trim: true
    },
    billing: {
      type: String,
      trim: true
    },
    emergency: {
      type: String,
      trim: true
    }
  },
  fax: {
    type: String,
    trim: true
  },
  email: {
    general: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    billing: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    results: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
  },
  
  // Contact Person
  contactPerson: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    preferredContactMethod: {
      type: String,
      enum: ['phone', 'email', 'fax'],
      default: 'phone'
    }
  },
  
  // Business Information
  npiNumber: {
    type: String,
    trim: true,
    match: /^\d{10}$/
  },
  taxId: {
    type: String,
    trim: true
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  
  // Operating Hours
  operatingHours: {
    monday: { open: String, close: String, closed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
    friday: { open: String, close: String, closed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, closed: { type: Boolean, default: true } },
    sunday: { open: String, close: String, closed: { type: Boolean, default: true } }
  },
  
  // Billing Information
  billingType: {
    type: String,
    enum: ['direct', 'insurance', 'both'],
    default: 'both'
  },
  paymentTerms: {
    type: String,
    enum: ['net30', 'net60', 'net90', 'immediate'],
    default: 'net30'
  },
  insuranceProviders: [{
    name: String,
    planId: String,
    groupNumber: String
  }],
  
  // Service Preferences
  preferredTests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test'
  }],
  resultDeliveryPreference: {
    type: String,
    enum: ['email', 'fax', 'portal', 'mail'],
    default: 'email'
  },
  criticalValueNotification: {
    enabled: {
      type: Boolean,
      default: true
    },
    method: {
      type: String,
      enum: ['phone', 'email', 'both'],
      default: 'phone'
    }
  },
  
  // Compliance
  hipaaAgreementDate: {
    type: Date
  },
  contractStartDate: {
    type: Date
  },
  contractEndDate: {
    type: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'active'
  },
  
  // Notes
  specialInstructions: {
    type: String,
    trim: true
  },
  internalNotes: {
    type: String,
    trim: true
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
medicalOfficeSchema.index({ name: 1 });
medicalOfficeSchema.index({ officeCode: 1 });
medicalOfficeSchema.index({ organization: 1 });
medicalOfficeSchema.index({ status: 1 });
medicalOfficeSchema.index({ 'address.zipCode': 1 });

// Virtual for full address
medicalOfficeSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  let fullAddr = addr.street;
  if (addr.suite) fullAddr += `, ${addr.suite}`;
  fullAddr += `, ${addr.city}, ${addr.state} ${addr.zipCode}`;
  if (addr.country !== 'USA') fullAddr += `, ${addr.country}`;
  return fullAddr;
});

// Method to get all doctors associated with this office
medicalOfficeSchema.methods.getDoctors = async function() {
  const Doctor = mongoose.model('Doctor');
  return await Doctor.find({ medicalOffices: this._id });
};

// Pre-save hook to auto-generate office code
medicalOfficeSchema.pre('save', async function(next) {
  if (!this.officeCode && this.isNew) {
    const MedicalOffice = mongoose.model('MedicalOffice');
    
    // Generate code from name
    const words = this.name.split(' ').filter(w => w.length > 0);
    let code = words.map(w => w[0]).join('').toUpperCase().slice(0, 5);
    
    // Ensure uniqueness
    let counter = 1;
    let testCode = code;
    while (await MedicalOffice.findOne({ officeCode: testCode })) {
      testCode = code + counter;
      counter++;
    }
    this.officeCode = testCode;
  }
  next();
});

module.exports = mongoose.model('MedicalOffice', medicalOfficeSchema);