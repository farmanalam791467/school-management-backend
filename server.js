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

// Database Seeding Route (Temporary, for bypassing local querySrv DNS block)
app.get('/api/seed', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const User = require('./models/User');
    const Class = require('./models/Class');
    const Section = require('./models/Section');
    const Subject = require('./models/Subject');
    const Grade = require('./models/Grade');
    const SchoolSettings = require('./models/SchoolSettings');
    const Teacher = require('./models/Teacher');
    const Parent = require('./models/Parent');
    const Student = require('./models/Student');
    const Employee = require('./models/Employee');

    // Clear existing data
    await User.deleteMany({});
    await Class.deleteMany({});
    await Section.deleteMany({});
    await Subject.deleteMany({});
    await Grade.deleteMany({});
    await SchoolSettings.deleteMany({});
    await Teacher.deleteMany({});
    await Parent.deleteMany({});
    await Student.deleteMany({});
    await Employee.deleteMany({});

    // Create Settings
    const settings = new SchoolSettings({
      school_name: 'Secondary School of Modern Education',
      email: 'contact@eskooly.com',
      phone: '+91 98765 43210',
      address: '123 Education Colony, New Delhi, India',
      logo: '/assets/logo.png',
      academic_year_start: '2026-04-01',
      academic_year_end: '2027-03-31'
    });
    await settings.save();

    // Create Classes
    const class1 = new Class({ name: 'Class 1' });
    const class2 = new Class({ name: 'Class 2' });
    await class1.save();
    await class2.save();

    const sec1A = new Section({ class: class1._id, name: 'A', room_no: 'Room 101', capacity: 30 });
    const sec1B = new Section({ class: class1._id, name: 'B', room_no: 'Room 102', capacity: 30 });
    const sec2A = new Section({ class: class2._id, name: 'A', room_no: 'Room 201', capacity: 30 });
    await sec1A.save();
    await sec1B.save();
    await sec2A.save();

    // Create Subjects
    const sub1 = new Subject({ name: 'Mathematics', code: 'MATH-01', type: 'Theory' });
    const sub2 = new Subject({ name: 'Science', code: 'SCI-01', type: 'Theory' });
    const sub3 = new Subject({ name: 'English Literature', code: 'ENG-01', type: 'Theory' });
    await sub1.save();
    await sub2.save();
    await sub3.save();

    // Grades
    const grades = [
      { name: 'A+', point: 4.0, mark_from: 90, mark_upto: 100, comment: 'Excellent Performance' },
      { name: 'A', point: 3.75, mark_from: 80, mark_upto: 89, comment: 'Very Good Performance' },
      { name: 'B', point: 3.0, mark_from: 70, mark_upto: 79, comment: 'Good Performance' },
      { name: 'C', point: 2.0, mark_from: 60, mark_upto: 69, comment: 'Satisfactory' },
      { name: 'D', point: 1.0, mark_from: 40, mark_upto: 59, comment: 'Pass' },
      { name: 'F', point: 0.0, mark_from: 0, mark_upto: 39, comment: 'Fail' }
    ];
    for (const g of grades) {
      await new Grade(g).save();
    }

    // Admin
    const admin = new User({
      name: 'School Administrator',
      email: 'admin@eskooly.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'school_admin',
      phone: '+91 98765 43210',
      status: 'active'
    });
    await admin.save();

    // Teacher
    const teacherUser = new User({
      name: 'Sarah Connor',
      email: 'teacher@eskooly.com',
      password: await bcrypt.hash('teacher123', 10),
      role: 'teacher',
      phone: '+91 98765 43211',
      status: 'active'
    });
    await teacherUser.save();

    const teacherProfile = new Teacher({
      user: teacherUser._id,
      employee_id: 'TCH-001',
      designation: 'Senior Teacher',
      department: 'Mathematics',
      qualification: 'Master of Science (M.Sc)',
      experience: '5 Years',
      specialization: 'Mathematics & physics',
      status: 'active'
    });
    await teacherProfile.save();

    // Parent
    const parentUser = new User({
      name: 'John Doe Sr.',
      email: 'parent@eskooly.com',
      password: await bcrypt.hash('parent123', 10),
      role: 'parent',
      phone: '+91 98765 43212',
      status: 'active'
    });
    await parentUser.save();

    const parentProfile = new Parent({
      user: parentUser._id,
      father_name: 'John Doe Sr.',
      father_phone: '+91 98765 43212',
      father_occupation: 'Engineer',
      mother_name: 'Mary Doe',
      mother_phone: '+91 98765 43213',
      mother_occupation: 'Doctor',
      address: '456 Lane Avenue, New Delhi, India'
    });
    await parentProfile.save();

    // Student
    const studentUser = new User({
      name: 'Tommy Doe',
      email: 'student@eskooly.com',
      password: await bcrypt.hash('student123', 10),
      role: 'student',
      phone: '+91 98765 43214',
      status: 'active'
    });
    await studentUser.save();

    const studentProfile = new Student({
      user: studentUser._id,
      parent: parentProfile._id,
      class: class1._id,
      section: sec1A._id,
      roll_number: 'STD-101',
      admission_number: 'ADM-2026-001',
      gender: 'Male',
      dob: new Date('2018-05-15'),
      blood_group: 'O+',
      admission_date: new Date(),
      status: 'active'
    });
    await studentProfile.save();

    // HR
    const hrUser = new User({
      name: 'David Smith',
      email: 'hr@eskooly.com',
      password: await bcrypt.hash('hr123', 10),
      role: 'hr',
      phone: '+91 98765 43215',
      status: 'active'
    });
    await hrUser.save();

    const hrProfile = new Employee({
      user: hrUser._id,
      employee_id: 'EMP-HR-01',
      department: 'Human Resources',
      designation: 'HR Specialist',
      salary: 55000,
      status: 'active',
      joining_date: new Date()
    });
    await hrProfile.save();

    // Accountant
    const accountantUser = new User({
      name: 'Emily Davis',
      email: 'accountant@eskooly.com',
      password: await bcrypt.hash('accountant123', 10),
      role: 'accountant',
      phone: '+91 98765 43216',
      status: 'active'
    });
    await accountantUser.save();

    const accountantProfile = new Employee({
      user: accountantUser._id,
      employee_id: 'EMP-ACC-01',
      department: 'Finance',
      designation: 'Chief Accountant',
      salary: 60000,
      status: 'active',
      joining_date: new Date()
    });
    await accountantProfile.save();

    // Librarian
    const librarianUser = new User({
      name: 'Michael Miller',
      email: 'librarian@eskooly.com',
      password: await bcrypt.hash('librarian123', 10),
      role: 'librarian',
      phone: '+91 98765 43217',
      status: 'active'
    });
    await librarianUser.save();

    const librarianProfile = new Employee({
      user: librarianUser._id,
      employee_id: 'EMP-LIB-01',
      department: 'Library Management',
      designation: 'Head Librarian',
      salary: 45000,
      status: 'active',
      joining_date: new Date()
    });
    await librarianProfile.save();

    res.json({ message: 'Database seeded successfully with role-specific accounts!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Seeding failed: ' + err.message });
  }
});

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
