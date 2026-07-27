const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Get all students with pagination, search, and class filtering
exports.getStudents = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const classId = req.query.classId || '';
  const sectionId = req.query.sectionId || '';
  const status = req.query.status || 'active';

  try {
    let countQuery = 'SELECT COUNT(*) as total FROM view_student_profiles WHERE 1=1';
    let dataQuery = 'SELECT * FROM view_student_profiles WHERE 1=1';
    const queryParams = [];

    if (status) {
      countQuery += ' AND user_status = ?';
      dataQuery += ' AND user_status = ?';
      queryParams.push(status);
    }

    if (classId) {
      countQuery += ' AND class_name = (SELECT name FROM classes WHERE id = ?)';
      dataQuery += ' AND class_name = (SELECT name FROM classes WHERE id = ?)';
      queryParams.push(classId);
    }

    if (sectionId) {
      countQuery += ' AND section_name = (SELECT name FROM sections WHERE id = ?)';
      dataQuery += ' AND section_name = (SELECT name FROM sections WHERE id = ?)';
      queryParams.push(sectionId);
    }

    if (search) {
      countQuery += ' AND (name LIKE ? OR roll_number LIKE ? OR admission_no LIKE ? OR email LIKE ?)';
      dataQuery += ' AND (name LIKE ? OR roll_number LIKE ? OR admission_no LIKE ? OR email LIKE ?)';
      const searchWild = `%${search}%`;
      queryParams.push(searchWild, searchWild, searchWild, searchWild);
    }

    // Get total count
    const [counts] = await db.query(countQuery, queryParams);
    const total = counts[0].total;

    // Add pagination to data query
    dataQuery += ' ORDER BY student_id DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const [students] = await db.query(dataQuery, queryParams);

    res.json({
      students,
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
    const [students] = await db.query('SELECT * FROM view_student_profiles WHERE student_id = ?', [id]);
    if (students.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get detailed record
    const [studentDetails] = await db.query('SELECT * FROM students WHERE id = ?', [id]);
    const [userDetails] = await db.query('SELECT name, email, phone, avatar FROM users WHERE id = ?', [studentDetails[0].user_id]);

    res.json({
      student: studentDetails[0],
      user: userDetails[0]
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
    father_name, father_phone, father_occupation, mother_name, mother_phone, mother_occupation, address
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Create User
    const hashedPassword = await bcrypt.hash(password || 'student123', 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'student', phone, 'active']
    );
    const userId = userResult.insertId;

    // 2. Handle Parent (Create parent user and parent profile if it's new, otherwise link)
    let parentId = null;
    if (father_name) {
      const parentEmail = `parent_${roll_number}@eskooly.com`; // auto-generated unique parent email if not provided
      const parentPassword = await bcrypt.hash('parent123', 10);
      
      const [parentUserResult] = await conn.query(
        'INSERT INTO users (name, email, password, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
        [father_name, parentEmail, parentPassword, 'parent', father_phone, 'active']
      );
      const parentUserId = parentUserResult.insertId;

      const [parentProfileResult] = await conn.query(
        `INSERT INTO parents (user_id, father_name, father_phone, father_occupation, mother_name, mother_phone, mother_occupation, address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [parentUserId, father_name, father_phone, father_occupation, mother_name, mother_phone, mother_occupation, address]
      );
      parentId = parentProfileResult.insertId;
    }

    // 3. Create Student
    const admissionDate = new Date().toISOString().slice(0, 10);
    await conn.query(
      `INSERT INTO students (user_id, parent_id, roll_number, admission_no, admission_date, class_id, section_id, gender, dob, blood_group, medical_history, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, parentId, roll_number, admission_no || `ADM-${Date.now()}`, admissionDate, class_id, section_id, gender, dob, blood_group, medical_history, 'active']
    );

    await conn.commit();
    res.status(201).json({ message: 'Student admitted successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error during admission: ' + err.message });
  } finally {
    conn.release();
  }
};

// Update student profile
exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const {
    name, email, phone, gender, dob, roll_number, class_id, section_id,
    blood_group, medical_history, status, photo
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [student] = await conn.query('SELECT user_id FROM students WHERE id = ?', [id]);
    if (student.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    const userId = student[0].user_id;

    // Update User
    await conn.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone, userId]
    );

    // Update Student
    await conn.query(
      `UPDATE students 
       SET roll_number = ?, class_id = ?, section_id = ?, gender = ?, dob = ?, blood_group = ?, medical_history = ?, status = ?, photo = ?
       WHERE id = ?`,
      [roll_number, class_id, section_id, gender, dob, blood_group, medical_history, status || 'active', photo || null, id]
    );

    // Also sync user status
    if (status === 'inactive') {
      await conn.query('UPDATE users SET status = "inactive" WHERE id = ?', [userId]);
    } else {
      await conn.query('UPDATE users SET status = "active" WHERE id = ?', [userId]);
    }

    await conn.commit();
    res.json({ message: 'Student updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error updating student' });
  } finally {
    conn.release();
  }
};

// Promote Student (bulk or single)
exports.promoteStudents = async (req, res) => {
  const { studentIds, targetClassId, targetSectionId } = req.body;
  if (!studentIds || !Array.isArray(studentIds) || !targetClassId || !targetSectionId) {
    return res.status(400).json({ message: 'Invalid promotion data' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const studentId of studentIds) {
      // Update student's class and section
      await conn.query(
        'UPDATE students SET class_id = ?, section_id = ?, status = "active" WHERE id = ?',
        [targetClassId, targetSectionId, studentId]
      );
    }

    await conn.commit();
    res.json({ message: `${studentIds.length} students promoted successfully` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error promoting students' });
  } finally {
    conn.release();
  }
};

// Delete student (Soft Delete by setting status to inactive)
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;
  try {
    const [student] = await db.query('SELECT user_id FROM students WHERE id = ?', [id]);
    if (student.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Set user and student status to inactive
    await db.query('UPDATE users SET status = "inactive" WHERE id = ?', [student[0].user_id]);
    await db.query('UPDATE students SET status = "inactive" WHERE id = ?', [id]);

    res.json({ message: 'Student set to inactive successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting student' });
  }
};
