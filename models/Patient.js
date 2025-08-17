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
  insuranceInfo: {
    provider: {
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
    }
  },
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
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Simple and reliable patient ID generation: YYMMDDNNN
patientSchema.statics.generatePatientId = async function() {
  try {
    // Get current date
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // YY
    const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
    const day = String(now.getDate()).padStart(2, '0'); // DD
    
    const datePrefix = `${year}${month}${day}`; // YYMMDD
    console.log(`🔢 Generating patient ID with date prefix: ${datePrefix}`);
    
    // Find all patient IDs for today with the correct format
    const todayPattern = new RegExp(`^${datePrefix}\\d{3}$`);
    const todayPatients = await this.find(
      { patientId: { $regex: todayPattern } },
      { patientId: 1 }
    ).sort({ patientId: -1 }); // Sort descending to get highest first
    
    console.log(`📊 Found ${todayPatients.length} patients for today:`, 
                todayPatients.map(p => p.patientId));
    
    // Determine next sequence number
    let nextSequence = 1;
    if (todayPatients.length > 0) {
      const lastPatientId = todayPatients[0].patientId;
      const lastSequence = parseInt(lastPatientId.slice(-3), 10);
      nextSequence = lastSequence + 1;
      console.log(`🔍 Last sequence: ${lastSequence}, Next sequence: ${nextSequence}`);
    }
    
    // Handle edge case of more than 999 patients per day
    if (nextSequence > 999) {
      console.warn('⚠️ More than 999 patients created today!');
      // Use a timestamp-based fallback but keep it 9 digits
      const timestamp = Date.now();
      return timestamp.toString().slice(-9);
    }
    
    // Generate the final patient ID
    const newPatientId = `${datePrefix}${String(nextSequence).padStart(3, '0')}`;
    console.log(`✅ Generated patient ID: ${newPatientId}`);
    
    return newPatientId;
    
  } catch (error) {
    console.error('❌ Patient ID generation error:', error);
    
    // Fallback: use timestamp but ensure 9 digits
    const timestamp = Date.now();
    const fallbackId = timestamp.toString().slice(-9);
    console.warn(`🔄 Using fallback patient ID: ${fallbackId}`);
    return fallbackId;
  }
};

// Pre-save middleware for data cleaning
patientSchema.pre('save', function(next) {
  // Clean and format names - capitalize first letter
  if (this.firstName) {
    this.firstName = this.firstName.charAt(0).toUpperCase() + 
                     this.firstName.slice(1).toLowerCase();
  }
  
  if (this.lastName) {
    this.lastName = this.lastName.charAt(0).toUpperCase() + 
                    this.lastName.slice(1).toLowerCase();
  }
  
  // Clean phone numbers - remove any non-digit characters except +, -, (, ), space
  if (this.phone) {
    this.phone = this.phone.replace(/[^\d\+\-\(\)\s]/g, '').trim();
  }
  
  if (this.emergencyContact && this.emergencyContact.phone) {
    this.emergencyContact.phone = this.emergencyContact.phone
      .replace(/[^\d\+\-\(\)\s]/g, '').trim();
  }
  
  // Clean address fields
  if (this.address) {
    Object.keys(this.address).forEach(key => {
      if (this.address[key] && typeof this.address[key] === 'string') {
        this.address[key] = this.address[key].trim();
        // Remove empty strings
        if (this.address[key] === '') {
          this.address[key] = undefined;
        }
      }
    });
  }
  
  next();
});

// Post-save logging
patientSchema.post('save', function(doc) {
  console.log(`✅ Patient saved: ${doc.patientId} - ${doc.fullName}`);
});

// Error handling for duplicate key errors
patientSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyPattern && error.keyPattern.patientId) {
      next(new Error('Patient ID already exists. Please try again.'));
    } else if (error.keyPattern && error.keyPattern.phone) {
      next(new Error('A patient with this phone number already exists.'));
    } else if (error.keyPattern && error.keyPattern.email) {
      next(new Error('A patient with this email address already exists.'));
    } else {
      next(new Error('Duplicate patient information detected.'));
    }
  } else {
    next();
  }
});

// Indexes for performance
patientSchema.index({ patientId: 1 }, { unique: true });
patientSchema.index({ firstName: 1, lastName: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ email: 1 }, { sparse: true });
patientSchema.index({ isActive: 1 });
patientSchema.index({ createdAt: -1 });

// Compound indexes for common queries
patientSchema.index({ isActive: 1, createdAt: -1 });
patientSchema.index({ firstName: 1, lastName: 1, isActive: 1 });

// Static methods for common operations
patientSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

patientSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone, isActive: true });
};

patientSchema.statics.findByEmail = function(email) {
  if (!email) return null;
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

patientSchema.statics.searchPatients = function(searchTerm, options = {}) {
  const {
    limit = 10,
    skip = 0,
    includeInactive = false
  } = options;
  
  let query;
  
  // If search term is purely numeric, search patient ID
  if (/^\d+$/.test(searchTerm)) {
    query = {
      patientId: { $regex: searchTerm, $options: 'i' }
    };
  } else {
    // Otherwise search name, email, and phone fields
    query = {
      $or: [
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } }
      ]
    };
  }
  
  if (!includeInactive) {
    query.isActive = true;
  }
  
  return this.find(query)
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 });
};

// Instance methods
patientSchema.methods.softDelete = function() {
  this.isActive = false;
  return this.save();
};

patientSchema.methods.addMedicalHistory = function(condition, diagnosedDate, notes) {
  this.medicalHistory.push({
    condition,
    diagnosedDate,
    notes
  });
  return this.save();
};

patientSchema.methods.addAllergy = function(allergen, severity, reaction) {
  this.allergies.push({
    allergen,
    severity,
    reaction
  });
  return this.save();
};

patientSchema.methods.addMedication = function(medication, dosage, frequency, prescribedDate) {
  this.currentMedications.push({
    medication,
    dosage,
    frequency,
    prescribedDate
  });
  return this.save();
};

module.exports = mongoose.model('Patient', patientSchema);