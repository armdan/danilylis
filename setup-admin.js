// setup-admin.js - Run this script to create the initial admin user
const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('./models/User');

async function createAdminUser() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/laboratory_db';
    console.log('Connecting to MongoDB:', MONGODB_URI);
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✓ Connected to MongoDB');
    console.log('Database:', mongoose.connection.name);

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('⚠ Admin user already exists');
      console.log('Deleting existing admin user...');
      await User.deleteOne({ username: 'admin' });
      console.log('✓ Existing admin user deleted');
    }

    // Create new admin user
    console.log('Creating new admin user...');
    
    const adminUser = new User({
      username: 'admin',
      email: 'admin@lab.local',
      password: 'admin123',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      department: 'general',
      phone: '+1-555-0123'
    });

    await adminUser.save();
    console.log('✓ Admin user created successfully!');
    
    // Create additional sample users for testing
    console.log('\nCreating sample users...');
    
    const sampleUsers = [
      {
        username: 'doctor1',
        email: 'doctor@lab.local',
        password: 'doctor123',
        firstName: 'Dr. John',
        lastName: 'Smith',
        role: 'doctor',
        department: 'general',
        phone: '+1-555-0124'
      },
      {
        username: 'tech1',
        email: 'tech@lab.local',
        password: 'tech123',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'lab_technician',
        department: 'hematology',
        phone: '+1-555-0125'
      },
      {
        username: 'reception1',
        email: 'reception@lab.local',
        password: 'reception123',
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'receptionist',
        department: 'general',
        phone: '+1-555-0126'
      }
    ];

    for (const userData of sampleUsers) {
      // Check if user exists
      const existingUser = await User.findOne({ username: userData.username });
      if (existingUser) {
        console.log(`⚠ User ${userData.username} already exists, skipping...`);
        continue;
      }

      const user = new User(userData);
      await user.save();
      console.log(`✓ Created user: ${userData.username} (${userData.role})`);
    }

    // Display all created users
    console.log('\n📋 USER ACCOUNTS CREATED:');
    console.log('========================');
    console.log('Admin Account:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('  Role: admin');
    console.log('');
    console.log('Doctor Account:');
    console.log('  Username: doctor1');
    console.log('  Password: doctor123');
    console.log('  Role: doctor');
    console.log('');
    console.log('Lab Technician Account:');
    console.log('  Username: tech1');
    console.log('  Password: tech123');
    console.log('  Role: lab_technician');
    console.log('');
    console.log('Receptionist Account:');
    console.log('  Username: reception1');
    console.log('  Password: reception123');
    console.log('  Role: receptionist');
    console.log('========================');

    // Verify the users were created
    const totalUsers = await User.countDocuments();
    console.log(`\n✓ Total users in database: ${totalUsers}`);

    console.log('\n🎉 Setup completed successfully!');
    console.log('You can now start your server and login with any of the above credentials.');
    
  } catch (error) {
    console.error('❌ Error setting up admin user:', error.message);
    console.error('Full error:', error);
  } finally {
    // Close the database connection
    await mongoose.disconnect();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  }
}

// Run the setup
createAdminUser();