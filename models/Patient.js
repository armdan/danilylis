const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function(value) {
        // Validate numeric patient ID format: YYMMDDNNN (9 digits)
        return /^\d{9}$/.test(value);
      },
      message: 'Patient ID must be a 9-digit numeric value'
    }
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  dateOfBirth: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value <= new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    index: true,
    sparse: true
  },
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: 100
    },
    city: {
      type: String,
      trim: true,
      maxlength: 50
    },
    state: {
      type: String,
      trim: true,
      maxlength: 50
    },
    zipCode: {
      type: String,
      trim: true,
      maxlength: 20
    },
    country: { 
      type: String, 
      default: 'USA',
      trim: true,
      maxlength: 50
    }
  },
  emergencyContact: {
    name: {
      type: String,
      trim: true,
      maxlength: 100
    },
    relationship: {
      type: String,
      trim: true,
      maxlength: 50
    },
    phone: {
      type: String,
      trim: true
    }
  },
  
  // BILLING AND INSURANCE INFORMATION
  billing: {
    // Primary Insurance
    primaryInsurance: {
      provider: {
        type: String,
        trim: true,
        maxlength: 100
      },
      planName: {
        type: String,
        trim: true,
        maxlength: 100
      },
      policyNumber: {
        type: String,
        trim: true,
        maxlength: 50
      },
      groupNumber: {
        type: String,
        trim: true,
        maxlength: 50
      },
      subscriberId: {
        type: String,
        trim: true,
        maxlength: 50
      },
      subscriberName: {
        type: String,
        trim: true,
        maxlength: 100
      },
      subscriberRelationship: {
        type: String,
        enum: ['self', 'spouse', 'child', 'parent', 'other'],
        default: 'self'
      },
      effectiveDate: Date,
      expirationDate: Date,
      copayAmount: {
        type: Number,
        min: 0
      },
      deductible: {
        type: Number,
        min: 0
      },
      deductibleMet: {
        type: Number,
        min: 0,
        default: 0
      },
      insurancePhone: {
        type: String,
        trim: true
      },
      priorAuthRequired: {
        type: Boolean,
        default: false
      }
    },
    
    // Secondary Insurance (optional)
    secondaryInsurance: {
      provider: {
        type: String,
        trim: true,
        maxlength: 100
      },
      planName: {
        type: String,
        trim: true,
        maxlength: 100
      },
      policyNumber: {
        type: String,
        trim: true,
        maxlength: 50
      },
      groupNumber: {
        type: String,
        trim: true,
        maxlength: 50
      },
      subscriberId: {
        type: String,
        trim: true,
        maxlength: 50
      },
      subscriberName: {
        type: String,
        trim: true,
        maxlength: 100
      },
      subscriberRelationship: {
        type: String,
        enum: ['self', 'spouse', 'child', 'parent', 'other']
      },
      effectiveDate: Date,
      expirationDate: Date,
      insurancePhone: {
        type: String,
        trim: true
      }
    },
    
    // Medicare Information
    medicare: {
      hasMedicare: {
        type: Boolean,
        default: false
      },
      medicareNumber: {
        type: String,
        trim: true,
        maxlength: 50
      },
      partAEffectiveDate: Date,
      partBEffectiveDate: Date,
      partCPlanName: {
        type: String,
        trim: true,
        maxlength: 100
      },
      partDPlanName: {
        type: String,
        trim: true,
        maxlength: 100
      }
    },
    
    // Medicaid Information
    medicaid: {
      hasMedicaid: {
        type: Boolean,
        default: false
      },
      medicaidNumber: {
        type: String,
        trim: true,
        maxlength: 50
      },
      stateIssued: {
        type: String,
        trim: true,
        maxlength: 2
      },
      effectiveDate: Date,
      eligibilityCategory: {
        type: String,
        trim: true
      }
    },
    
    // Billing Preferences
    billingPreferences: {
      preferredPaymentMethod: {
        type: String,
        enum: ['insurance', 'self-pay', 'payment-plan', 'credit-card', 'cash', 'check'],
        default: 'insurance'
      },
      paperlessBilling: {
        type: Boolean,
        default: false
      },
      billingEmail: {
        type: String,
        lowercase: true,
        trim: true
      },
      paymentPlanActive: {
        type: Boolean,
        default: false
      },
      accountBalance: {
        type: Number,
        default: 0
      },
      lastPaymentDate: Date,
      lastPaymentAmount: Number
    },
    
    // Guarantor Information (if different from patient)
    guarantor: {
      isPatientGuarantor: {
        type: Boolean,
        default: true
      },
      firstName: {
        type: String,
        trim: true,
        maxlength: 50
      },
      lastName: {
        type: String,
        trim: true,
        maxlength: 50
      },
      relationship: {
        type: String,
        trim: true,
        maxlength: 50
      },
      dateOfBirth: Date,
      ssn: {
        type: String,
        trim: true,
        maxlength: 11
      },
      phone: {
        type: String,
        trim: true
      },
      email: {
        type: String,
        lowercase: true,
        trim: true
      },
      address: {
        street: {
          type: String,
          trim: true,
          maxlength: 100
        },
        city: {
          type: String,
          trim: true,
          maxlength: 50
        },
        state: {
          type: String,
          trim: true,
          maxlength: 50
        },
        zipCode: {
          type: String,
          trim: true,
          maxlength: 20
        }
      },
      employer: {
        name: {
          type: String,
          trim: true,
          maxlength: 100
        },
        phone: {
          type: String,
          trim: true
        }
      }
    }
  },
  
  // MEDICAL HISTORY
  medicalHistory: [{
    condition: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    diagnosedDate: {
      type: Date
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  allergies: [{
    allergen: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      required: true
    },
    reaction: {
      type: String,
      trim: true,
      maxlength: 200
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  currentMedications: [{
    medication: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    dosage: {
      type: String,
      trim: true,
      maxlength: 50
    },
    frequency: {
      type: String,
      trim: true,
      maxlength: 50
    },
    prescribedDate: {
      type: Date
    },
    prescribedBy: {
      type: String,
      trim: true,
      maxlength: 100
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Social Security Number (encrypted)
  ssn: {
    type: String,
    trim: true,
    select: false // Don't include in queries by default
  },
  
  // Employment Information
  employment: {
    status: {
      type: String,
      enum: ['employed', 'unemployed', 'retired', 'student', 'disabled'],
      default: 'employed'
    },
    employer: {
      name: {
        type: String,
        trim: true,
        maxlength: 100
      },
      phone: {
        type: String,
        trim: true
      },
      address: {
        street: {
          type: String,
          trim: true,
          maxlength: 100
        },
        city: {
          type: String,
          trim: true,
          maxlength: 50
        },
        state: {
          type: String,
          trim: true,
          maxlength: 50
        },
        zipCode: {
          type: String,
          trim: true,
          maxlength: 20
        }
      }
    }
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return Math.max(0, age);
});

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual for insurance status
patientSchema.virtual('insuranceStatus').get(function() {
  if (this.billing?.primaryInsurance?.provider) {
    return 'insured';
  } else if (this.billing?.medicare?.hasMedicare) {
    return 'medicare';
  } else if (this.billing?.medicaid?.hasMedicaid) {
    return 'medicaid';
  } else {
    return 'self-pay';
  }
});

// Virtual for current balance
patientSchema.virtual('currentBalance').get(function() {
  return this.billing?.billingPreferences?.accountBalance || 0;
});

// Static method to generate patient ID
patientSchema.statics.generatePatientId = async function() {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const datePrefix = `${year}${month}${day}`;
    const todayPattern = new RegExp(`^${datePrefix}\\d{3}$`);
    
    const todayPatients = await this.find(
      { patientId: { $regex: todayPattern } },
      { patientId: 1 }
    ).sort({ patientId: -1 });
    
    let nextSequence = 1;
    if (todayPatients.length > 0) {
      const lastPatientId = todayPatients[0].patientId;
      const lastSequence = parseInt(lastPatientId.slice(-3), 10);
      nextSequence = lastSequence + 1;
    }
    
    if (nextSequence > 999) {
      const timestamp = Date.now();
      return timestamp.toString().slice(-9);
    }
    
    return `${datePrefix}${String(nextSequence).padStart(3, '0')}`;
    
  } catch (error) {
    console.error('Patient ID generation error:', error);
    const timestamp = Date.now();
    return timestamp.toString().slice(-9);
  }
};

// Method to check insurance eligibility
patientSchema.methods.checkInsuranceEligibility = function() {
  const today = new Date();
  const primary = this.billing?.primaryInsurance;
  
  if (!primary || !primary.provider) {
    return { eligible: false, reason: 'No insurance on file' };
  }
  
  if (primary.expirationDate && primary.expirationDate < today) {
    return { eligible: false, reason: 'Insurance expired' };
  }
  
  if (primary.effectiveDate && primary.effectiveDate > today) {
    return { eligible: false, reason: 'Insurance not yet effective' };
  }
  
  return { eligible: true, reason: 'Insurance active' };
};

// Method to calculate remaining deductible
patientSchema.methods.getRemainingDeductible = function() {
  const primary = this.billing?.primaryInsurance;
  if (!primary) return null;
  
  const deductible = primary.deductible || 0;
  const met = primary.deductibleMet || 0;
  return Math.max(0, deductible - met);
};

// Pre-save middleware for data cleaning
patientSchema.pre('save', function(next) {
  // Clean and format names
  if (this.firstName) {
    this.firstName = this.firstName.charAt(0).toUpperCase() + 
                     this.firstName.slice(1).toLowerCase();
  }
  
  if (this.lastName) {
    this.lastName = this.lastName.charAt(0).toUpperCase() + 
                    this.lastName.slice(1).toLowerCase();
  }
  
  // Clean phone numbers
  if (this.phone) {
    this.phone = this.phone.replace(/[^\d\+\-\(\)\s]/g, '').trim();
  }
  
  if (this.emergencyContact && this.emergencyContact.phone) {
    this.emergencyContact.phone = this.emergencyContact.phone
      .replace(/[^\d\+\-\(\)\s]/g, '').trim();
  }
  
  // Encrypt SSN if provided (you should use proper encryption in production)
  // This is just a placeholder - use crypto libraries for real encryption
  if (this.ssn && !this.ssn.includes('*')) {
    // Store only last 4 digits visible
    const last4 = this.ssn.slice(-4);
    this.ssn = `***-**-${last4}`;
  }
  
  next();
});

// Indexes for performance
patientSchema.index({ patientId: 1 }, { unique: true });
patientSchema.index({ firstName: 1, lastName: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ email: 1 }, { sparse: true });
patientSchema.index({ isActive: 1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ 'billing.primaryInsurance.provider': 1 });
patientSchema.index({ 'billing.medicare.medicareNumber': 1 }, { sparse: true });
patientSchema.index({ 'billing.medicaid.medicaidNumber': 1 }, { sparse: true });

// Compound indexes
patientSchema.index({ isActive: 1, createdAt: -1 });
patientSchema.index({ firstName: 1, lastName: 1, isActive: 1 });

// Static methods for common operations
patientSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

patientSchema.statics.findByInsurance = function(insuranceProvider) {
  return this.find({
    $or: [
      { 'billing.primaryInsurance.provider': insuranceProvider },
      { 'billing.secondaryInsurance.provider': insuranceProvider }
    ],
    isActive: true
  });
};

patientSchema.statics.findSelfPay = function() {
  return this.find({
    'billing.billingPreferences.preferredPaymentMethod': 'self-pay',
    isActive: true
  });
};

patientSchema.statics.findWithBalance = function() {
  return this.find({
    'billing.billingPreferences.accountBalance': { $gt: 0 },
    isActive: true
  });
};

module.exports = mongoose.model('Patient', patientSchema);