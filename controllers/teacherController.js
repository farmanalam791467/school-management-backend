const Teacher = require('../models/Teacher');
const User = require('../models/User');
const ClassSubject = require('../models/ClassSubject');
const bcrypt = require('bcryptjs');

// Get all teachers
exports.getTeachers = async (req, res) => {
  const search = req.query.search || '';
  const status = req.query.status || 'active';

  try {
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      // Find users matching search by name or email
      const usersMatchingSearch = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      });
      const userIds = usersMatchingSearch.map(u => u._id);

      // Filter teachers by user ID or employee ID
      filter.$or = [
        { user: { $in: userIds } },
        { employee_id: { $regex: search, $options: 'i' } }
      ];
    }

    const teachers = await Teacher.find(filter)
      .populate('user', 'name email phone avatar status')
      .sort({ created_at: -1 });

    // Format like MySQL view_teacher_profiles
    const formattedTeachers = teachers.map(teacher => ({
      id: teacher._id.toString(),
      user_id: teacher.user ? teacher.user._id.toString() : null,
      name: teacher.user ? teacher.user.name : '',
      email: teacher.user ? teacher.user.email : '',
      phone: teacher.user ? teacher.user.phone : '',
      avatar: teacher.user ? teacher.user.avatar : '',
      employee_id: teacher.employee_id || '',
      designation: teacher.designation || '',
      department: teacher.department || '',
      qualification: teacher.qualification || '',
      experience: teacher.experience || '',
      salary: teacher.salary || 0,
      hire_date: teacher.joining_date,
      user_status: teacher.user ? teacher.user.status : 'inactive'
    }));

    res.json({ teachers: formattedTeachers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching teachers' });
  }
};

// Get teacher by ID
exports.getTeacherById = async (req, res) => {
  const { id } = req.params;
  try {
    const teacher = await Teacher.findById(id).populate('user', 'name email phone avatar status');
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Fetch classes taught by this teacher
    const classSubjects = await ClassSubject.find({ teacher: teacher._id })
      .populate('class', 'name')
      .populate('section', 'name')
      .populate('subject', 'name code');

    const classes = classSubjects.map(cs => ({
      mapping_id: cs._id.toString(),
      class_name: cs.class ? cs.class.name : '',
      section_name: cs.section ? cs.section.name : '',
      subject_name: cs.subject ? cs.subject.name : '',
      subject_code: cs.subject ? cs.subject.code : ''
    }));

    const formattedTeacher = {
      id: teacher._id.toString(),
      user_id: teacher.user ? teacher.user._id.toString() : null,
      name: teacher.user ? teacher.user.name : '',
      email: teacher.user ? teacher.user.email : '',
      phone: teacher.user ? teacher.user.phone : '',
      avatar: teacher.user ? teacher.user.avatar : '',
      employee_id: teacher.employee_id || '',
      designation: teacher.designation || '',
      department: teacher.department || '',
      qualification: teacher.qualification || '',
      experience: teacher.experience || '',
      salary: teacher.salary || 0,
      hire_date: teacher.joining_date,
      user_status: teacher.user ? teacher.user.status : 'inactive'
    };

    res.json({
      teacher: formattedTeacher,
      classes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a teacher
exports.createTeacher = async (req, res) => {
  const {
    name, email, password, phone, employee_id, designation,
    department, qualification, experience, salary, hire_date
  } = req.body;

  try {
    // 1. Create User
    const hashedPassword = await bcrypt.hash(password || 'teacher123', 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'teacher',
      phone,
      status: 'active'
    });
    await newUser.save();

    // 2. Create Teacher Profile
    const newTeacher = new Teacher({
      user: newUser._id,
      employee_id: employee_id || `EMP-${Date.now()}`,
      designation,
      department,
      qualification,
      experience,
      salary: salary || 0,
      joining_date: hire_date || new Date(),
      status: 'active'
    });
    await newTeacher.save();

    res.status(201).json({ message: 'Teacher registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error registering teacher: ' + err.message });
  }
};

// Update teacher profile
exports.updateTeacher = async (req, res) => {
  const { id } = req.params;
  const {
    name, email, phone, designation, department, qualification,
    experience, salary, hire_date, status
  } = req.body;

  try {
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Update User
    await User.findByIdAndUpdate(teacher.user, {
      name,
      email,
      phone,
      status: status || 'active'
    });

    // Update Teacher
    teacher.designation = designation;
    teacher.department = department;
    teacher.qualification = qualification;
    teacher.experience = experience;
    teacher.salary = salary;
    teacher.joining_date = hire_date;
    teacher.status = status || 'active';
    await teacher.save();

    res.json({ message: 'Teacher updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating teacher' });
  }
};

// Delete teacher (soft delete)
exports.deleteTeacher = async (req, res) => {
  const { id } = req.params;
  try {
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    await User.findByIdAndUpdate(teacher.user, { status: 'inactive' });
    teacher.status = 'inactive';
    await teacher.save();

    res.json({ message: 'Teacher set to inactive successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting teacher' });
  }
};
