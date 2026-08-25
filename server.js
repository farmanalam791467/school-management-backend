const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// DB Connection
const db = require('./config/db');

// Middlewares
const { auth } = require('./middleware/auth');
const { sanitizeInput } = require('./middleware/security');

// Route Imports
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const classRoutes = require('./routes/classes');
const teacherRoutes = require('./routes/teachers');
const dashboardRoutes = require('./routes/dashboard');
const attendanceRoutes = require('./routes/attendance');
const feeRoutes = require('./routes/fees');
const examRoutes = require('./routes/exams');
const accountingRoutes = require('./routes/accounting');
const libraryRoutes = require('./routes/library');
const transportRoutes = require('./routes/transport');
const hostelRoutes = require('./routes/hostel');
const hrRoutes = require('./routes/hr');
const chatRoutes = require('./routes/chat');
const noticeRoutes = require('./routes/notices');
const eventRoutes = require('./routes/events');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for express-rate-limit behind reverse proxy (e.g. Render)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow loading local uploads on frontend
}));
app.use(cors());
app.use(express.json());
app.use(sanitizeInput); // Escape HTML tags in body, query, params to prevent XSS

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 2000 : 100000, // Limit to 2000 in production, 100000 in dev
  message: { message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Serve uploads folder statically for document/avatar access
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', auth, studentRoutes);
app.use('/api/classes', auth, classRoutes);
app.use('/api/teachers', auth, teacherRoutes);
app.use('/api/dashboard', auth, dashboardRoutes);
app.use('/api/attendance', auth, attendanceRoutes);
app.use('/api/fees', auth, feeRoutes);
app.use('/api/exams', auth, examRoutes);
app.use('/api/accounting', auth, accountingRoutes);
app.use('/api/library', auth, libraryRoutes);
app.use('/api/transport', auth, transportRoutes);
app.use('/api/hostel', auth, hostelRoutes);
app.use('/api/hr', auth, hrRoutes);
app.use('/api/chat', auth, chatRoutes);
app.use('/api/notices', auth, noticeRoutes);
app.use('/api/events', auth, eventRoutes);
app.use('/api/reports', auth, reportRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.send('Secondary School of Modern Education API is running');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error: ' + err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
