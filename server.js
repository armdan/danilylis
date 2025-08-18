const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Create Express app
const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Import routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const testRoutes = require('./routes/tests');
const orderRoutes = require('./routes/orders');
const resultRoutes = require('./routes/results');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');

// Security middleware - disabled CSP for development
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting - generous for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // High limit for development
  message: {
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// CORS for local development
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://192.168.86.118:27017/laboratory_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Reset admin users endpoint
app.get('/reset-admin', async (req, res) => {
  try {
    const User = require('./models/User');
    
    // Delete all existing users
    await User.deleteMany({});
    console.log('All users deleted');
    
    // Create fresh admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@lab.local',
      password: 'admin123',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      department: 'general'
    });
    
    await adminUser.save();
    console.log('New admin user created');
    
    res.json({ 
      message: 'Admin reset successful',
      credentials: {
        username: 'admin',
        password: 'admin123'
      }
    });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/patients', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patients.html'));
});

app.get('/tests', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tests.html'));
});

app.get('/orders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

app.get('/results', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

app.get('/reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://0.0.0.0:${PORT}`);
});