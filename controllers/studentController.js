const Student = require('../models/Student');
const User = require('../models/User');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const Section = require('../models/Section');
const bcrypt = require('bcryptjs');

// Get all students with pagination, search, and class filtering
exports.getStudents = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search || '';
  const classId = req.query.classId || '';
  const sectionId = req.query.sectionId || '';
  const status = req.query.status || 'active';

  try {
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (classId) {
      filter.class = classId;
    }

    if (sectionId) {
      filter.section = sectionId;
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

      // Filter students by user ID or roll number or admission number
      filter.$or = [
        { user: { $in: userIds } },
        { roll_number: { $regex: search, $options: 'i' } },
        { admission_number: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Student.countDocuments(filter);
    
    const students = await Student.find(filter)
      .populate('user', 'name email phone avatar status')
      .populate('class', 'name')
      .populate('section', 'name')
      .populate({
        path: 'parent',
        populate: { path: 'user', select: 'name email phone' }
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    // Map to flat structure like MySQL view_student_profiles
    const formattedStudents = students.map(student => ({
      student_id: student._id.toString(),
      user_id: student.user ? student.user._id.toString() : null,
      name: student.user ? student.user.name : '',
      email: student.user ? student.user.email : '',
      phone: student.user ? student.user.phone : '',
      roll_number: student.roll_number,
      admission_no: student.admission_number,
      class_name: student.class ? student.class.name : '',
      section_name: student.section ? student.section.name : '',
      user_status: student.user ? student.user.status : 'inactive',
      father_name: student.parent ? student.parent.father_name : '',
      father_phone: student.parent ? student.parent.father_phone : '',
      gender: student.gender || '',
      dob: student.dob,
      blood_group: student.blood_group || '',
      avatar: student.user ? student.user.avatar : ''
    }));

    res.json({
      students: formattedStudents,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching students' });
  }
};

// Get a single student by ID
exports.getStudentById = async (req, res) => {
  const { id } = req.params;
  try {
    const student = await Student.findById(id)
      .populate('user', 'name email phone avatar')
      .populate('class')
      .populate('section')
      .populate('parent');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({
      student: {
        id: student._id.toString(),
        user_id: student.user ? student.user._id.toString() : null,
        parent_id: student.parent ? student.parent._id.toString() : null,
        roll_number: student.roll_number,
        admission_no: student.admission_number,
        admission_date: student.admission_date,
        class_id: student.class ? student.class._id.toString() : null,
        section_id: student.section ? student.section._id.toString() : null,
        gender: student.gender,
        dob: student.dob,
        blood_group: student.blood_group,
        status: student.status
      },
      user: {
        name: student.user ? student.user.name : '',
        email: student.user ? student.user.email : '',
        phone: student.user ? student.user.phone : '',
        avatar: student.user ? student.user.avatar : ''
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a student (Admission)
exports.createStudent = async (req, res) => {
  const {
    name, email, password, phone, gender, dob, roll_number, admission_no,
    class_id, section_id, blood_group, medical_history,
    father_name, father_phone, father_occupation, mother_name, mother_phone, mother_occupation, address,
    avatar
  } = req.body;

  try {
    // 1. Create User
    const hashedPassword = await bcrypt.hash(password || 'student123', 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'student',
      phone,
      avatar: avatar || '',
      status: 'active'
    });
    await newUser.save();

    // 2. Handle Parent (Create parent user and parent profile if it's new)
    let parentId = null;
    if (father_name) {
      const parentEmail = `parent_${roll_number || Date.now()}@eskooly.com`;
      const parentPassword = await bcrypt.hash('parent123', 10);
      
      const newParentUser = new User({
        name: father_name,
        email: parentEmail,
        password: parentPassword,
        role: 'parent',
        phone: father_phone,
        status: 'active'
      });
      await newParentUser.save();

      const newParent = new Parent({
        user: newParentUser._id,
        father_name,
        father_phone,
        father_occupation,
        mother_name,
        mother_phone,
        mother_occupation,
        address
      });
      await newParent.save();
      parentId = newParent._id;
    }

    // 3. Create Student
    const admissionDate = new Date();
    const newStudent = new Student({
      user: newUser._id,
      parent: parentId,
      roll_number,
      admission_number: admission_no || `ADM-${Date.now()}`,
      admission_date: admissionDate,
      class: class_id,
      section: section_id,
      gender,
      dob,
      blood_group,
      medical_history,
      status: 'active'
    });
    await newStudent.save();

    res.status(201).json({ message: 'Student admitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during admission: ' + err.message });
  }
};

// Update student profile
exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const {
    name, email, phone, gender, dob, roll_number, class_id, section_id,
    blood_group, medical_history, status, photo
  } = req.body;

  try {
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Update User
    await User.findByIdAndUpdate(student.user, {
      name,
      email,
      phone,
      status: status || 'active'
    });

    // Update Student
    student.roll_number = roll_number;
    student.class = class_id;
    student.section = section_id;
    student.gender = gender;
    student.dob = dob;
    student.blood_group = blood_group;
    student.medical_history = medical_history;
    student.status = status || 'active';
    student.photo = photo || null;
    await student.save();

    res.json({ message: 'Student updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating student' });
  }
};

// Promote Student (bulk or single)
exports.promoteStudents = async (req, res) => {
  const { studentIds, targetClassId, targetSectionId } = req.body;
  if (!studentIds || !Array.isArray(studentIds) || !targetClassId || !targetSectionId) {
    return res.status(400).json({ message: 'Invalid promotion data' });
  }

  try {
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { class: targetClassId, section: targetSectionId, status: 'active' }
    );
    res.json({ message: `${studentIds.length} students promoted successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error promoting students' });
  }
};

// Delete student (Soft Delete by setting status to inactive)
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;
  try {
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    await User.findByIdAndUpdate(student.user, { status: 'inactive' });
    student.status = 'inactive';
    await student.save();

    res.json({ message: 'Student set to inactive successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting student' });
  }
};
