const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Class = require('./models/Class');
const Section = require('./models/Section');
const Subject = require('./models/Subject');
const Grade = require('./models/Grade');
const SchoolSettings = require('./models/SchoolSettings');
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

  // 1. Create Default Admin
  console.log('Seeding default Admin...');
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const admin = new User({
    name: 'School Administrator',
    email: 'admin@eskooly.com',
    password: hashedAdminPassword,
    role: 'school_admin',
    phone: '+91 98765 43210',
    status: 'active'
  });
  await admin.save();
  console.log('✔ Admin seeded successfully (admin@eskooly.com / admin123).');

  // 2. Create School Settings
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
  console.log('✔ School Settings seeded.');

  // 3. Create Classes & Sections
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
  console.log('✔ Classes and Sections seeded.');

  // 4. Create Subjects
  console.log('Seeding Subjects...');
  const sub1 = new Subject({ name: 'Mathematics', code: 'MATH-01', type: 'Theory' });
  const sub2 = new Subject({ name: 'Science', code: 'SCI-01', type: 'Theory' });
  const sub3 = new Subject({ name: 'English Literature', code: 'ENG-01', type: 'Theory' });
  const sub4 = new Subject({ name: 'Physics Practical', code: 'PHY-PR', type: 'Practical' });
  await sub1.save();
  await sub2.save();
  await sub3.save();
  await sub4.save();
  console.log('✔ Subjects seeded.');

  // 5. Create Grade System scale
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
    const grade = new Grade(g);
    await grade.save();
  }
  console.log('✔ Grading System seeded.');

  console.log('\n🎉 ALL DONE! Seeding completed successfully. Close script.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
