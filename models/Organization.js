const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Contact Information
  headquarters: {
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
  
  // Primary Contact
  primaryContact: {
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
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
  },
  
  // Business Information
  taxId: {
    type: String,
    trim: true
  },
  businessType: {
    type: String,
    enum: ['healthcare_system', 'medical_group', 'hospital_network', 'private_practice', 'other'],
    default: 'medical_group'
  },
  
  // Billing Information
  billingContact: {
    name: {
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
    }
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Notes
  notes: {
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

// Indexes for better query performance
organizationSchema.index({ name: 1 });
organizationSchema.index({ code: 1 });
organizationSchema.index({ status: 1 });
organizationSchema.index({ 'primaryContact.email': 1 });

// Virtual for full address
organizationSchema.virtual('fullAddress').get(function() {
  const addr = this.headquarters;
  let fullAddr = addr.street;
  if (addr.suite) fullAddr += `, ${addr.suite}`;
  fullAddr += `, ${addr.city}, ${addr.state} ${addr.zipCode}`;
  if (addr.country !== 'USA') fullAddr += `, ${addr.country}`;
  return fullAddr;
});

// Method to get all medical offices
organizationSchema.methods.getMedicalOffices = async function() {
  const MedicalOffice = mongoose.model('MedicalOffice');
  return await MedicalOffice.find({ organization: this._id });
};

// Pre-save hook to auto-generate code if not provided
organizationSchema.pre('save', async function(next) {
  if (!this.code && this.isNew) {
    // Generate code from name (first letters of each word, max 4 chars)
    const words = this.name.split(' ').filter(w => w.length > 0);
    let code = words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
    
    // Ensure uniqueness
    const Organization = mongoose.model('Organization');
    let counter = 1;
    let testCode = code;
    while (await Organization.findOne({ code: testCode })) {
      testCode = code + counter;
      counter++;
    }
    this.code = testCode;
  }
  next();
});

module.exports = mongoose.model('Organization', organizationSchema);