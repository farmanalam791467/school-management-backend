const mongoose = require('mongoose');
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

require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eskooly_clone';

async function seed() {
  console.log('Connecting to database...');
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB.');

  // Clear existing data
  console.log('Clearing old collections...');
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

  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // 1. Create School Settings
  console.log('Seeding school settings...');
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

  // 2. Create Classes & Sections
  console.log('Seeding Classes & Sections...');
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

  // 3. Create Subjects
  console.log('Seeding Subjects...');
  const sub1 = new Subject({ name: 'Mathematics', code: 'MATH-01', type: 'Theory' });
  const sub2 = new Subject({ name: 'Science', code: 'SCI-01', type: 'Theory' });
  const sub3 = new Subject({ name: 'English Literature', code: 'ENG-01', type: 'Theory' });
  await sub1.save();
  await sub2.save();
  await sub3.save();

  // 4. Create Grade boundaries
  console.log('Seeding Grade System...');
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

  // 5. Seed Users & Profile Associations
  console.log('Seeding User roles & Profiles...');

  // A. Admin User
  const admin = new User({
    name: 'School Administrator',
    email: 'admin@eskooly.com',
    password: defaultPasswordHash,
    role: 'school_admin',
    phone: '+91 98765 43210',
    status: 'active'
  });
  await admin.save();

  // B. Teacher User & Profile
  const teacherUser = new User({
    name: 'Sarah Connor',
    email: 'teacher@eskooly.com',
    password: defaultPasswordHash,
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

  // C. Parent User & Profile
  const parentUser = new User({
    name: 'John Doe Sr.',
    email: 'parent@eskooly.com',
    password: defaultPasswordHash,
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

  // D. Student User & Profile (linked to Parent and Class 1-A)
  const studentUser = new User({
    name: 'Tommy Doe',
    email: 'student@eskooly.com',
    password: defaultPasswordHash,
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

  // E. HR Manager User & Employee Profile
  const hrUser = new User({
    name: 'David Smith',
    email: 'hr@eskooly.com',
    password: defaultPasswordHash,
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

  // F. Accountant User & Employee Profile
  const accountantUser = new User({
    name: 'Emily Davis',
    email: 'accountant@eskooly.com',
    password: defaultPasswordHash,
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

  // G. Librarian User & Employee Profile
  const librarianUser = new User({
    name: 'Michael Miller',
    email: 'librarian@eskooly.com',
    password: defaultPasswordHash,
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

  console.log('\n🎉 ALL DONE! MongoDB has been successfully seeded.');
  console.log('----------------------------------------------------');
  console.log('Credentials for all accounts:');
  console.log('  1. School Admin:  admin@eskooly.com      / password123');
  console.log('  2. Teacher:       teacher@eskooly.com    / password123');
  console.log('  3. Student:       student@eskooly.com    / password123');
  console.log('  4. Parent:        parent@eskooly.com     / password123');
  console.log('  5. HR Manager:    hr@eskooly.com         / password123');
  console.log('  6. Accountant:    accountant@eskooly.com / password123');
  console.log('  7. Librarian:     librarian@eskooly.com  / password123');
  console.log('----------------------------------------------------');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
