// models/LaboratorySettings.js
const mongoose = require('mongoose');

const laboratorySettingsSchema = new mongoose.Schema({
  // Basic Laboratory Information
  labName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  labDirector: {
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
    title: {
      type: String,
      trim: true,
      default: 'M.D.'
    },
    licenseNumber: {
      type: String,
      trim: true
    }
  },
  // Laboratory Address
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
      trim: true,
      uppercase: true,
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
  // Regulatory Information
  cliaNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: /^[A-Z0-9]{10}$/,
    unique: true
  },
  npiNumber: {
    type: String,
    required: true,
    trim: true,
    match: /^\d{10}$/,
    unique: true
  },
  // Contact Information
  phone: {
    main: {
      type: String,
      required: true,
      trim: true,
      match: /^[\d\s\-\(\)\+]+$/
    },
    toll_free: {
      type: String,
      trim: true,
      match: /^[\d\s\-\(\)\+]+$/
    }
  },
  fax: {
    type: String,
    required: true,
    trim: true,
    match: /^[\d\s\-\(\)\+]+$/
  },
  email: {
    general: {
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
    },
    billing: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
  },
  // Logo Information
  logo: {
    filename: {
      type: String,
      trim: true
    },
    originalName: {
      type: String,
      trim: true
    },
    mimetype: {
      type: String,
      trim: true
    },
    size: {
      type: Number
    },
    uploadedAt: {
      type: Date
    }
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
  // Report Settings
  reportSettings: {
    headerText: {
      type: String,
      trim: true,
      default: 'Laboratory Test Report'
    },
    footerText: {
      type: String,
      trim: true,
      default: 'This report is confidential and intended for the use of the addressee only.'
    },
    showLogo: {
      type: Boolean,
      default: true
    },
    showAccreditation: {
      type: Boolean,
      default: true
    }
  },
  // Accreditation Information
  accreditation: [{
    organization: {
      type: String,
      trim: true
    },
    certificateNumber: {
      type: String,
      trim: true
    },
    validFrom: Date,
    validTo: Date,
    status: {
      type: String,
      enum: ['active', 'expired', 'pending'],
      default: 'active'
    }
  }],
  // Tax Information
  taxId: {
    type: String,
    trim: true
  },
  // System Settings
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual for full address
laboratorySettingsSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  let fullAddr = addr.street;
  if (addr.suite) fullAddr += `, ${addr.suite}`;
  fullAddr += `, ${addr.city}, ${addr.state} ${addr.zipCode}`;
  if (addr.country !== 'USA') fullAddr += `, ${addr.country}`;
  return fullAddr;
});

// Virtual for director full name
laboratorySettingsSchema.virtual('directorFullName').get(function() {
  const dir = this.labDirector;
  return `${dir.title ? dir.title + ' ' : ''}${dir.firstName} ${dir.lastName}`;
});

// Static method to get current settings
laboratorySettingsSchema.statics.getCurrent = async function() {
  let settings = await this.findOne({ isActive: true }).sort('-createdAt');
  
  // If no settings exist, return default structure
  if (!settings) {
    settings = {
      labName: 'Laboratory Information System',
      labDirector: {
        firstName: '',
        lastName: '',
        title: 'M.D.'
      },
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA'
      },
      cliaNumber: '',
      npiNumber: '',
      phone: {
        main: ''
      },
      fax: '',
      email: {},
      operatingHours: {}
    };
  }
  
  return settings;
};

// Ensure only one active settings document
laboratorySettingsSchema.pre('save', async function(next) {
  if (this.isActive && !this.isNew) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { isActive: false }
    );
  }
  next();
});

module.exports = mongoose.model('LaboratorySettings', laboratorySettingsSchema);