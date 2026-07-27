const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Get all teachers
exports.getTeachers = async (req, res) => {
  const search = req.query.search || '';
  const status = req.query.status || 'active';

  try {
    let query = `
      SELECT *
      FROM view_teacher_profiles
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND user_status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (name LIKE ? OR employee_id LIKE ? OR email LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    query += ' ORDER BY id DESC';

    const [teachers] = await db.query(query, params);
    res.json({ teachers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching teachers' });
  }
};

// Get teacher by ID
exports.getTeacherById = async (req, res) => {
  const { id } = req.params;
  try {
    const [teachers] = await db.query(
      `SELECT * FROM view_teacher_profiles WHERE id = ?`,
      [id]
    );

    if (teachers.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Fetch classes taught by this teacher
    const [classes] = await db.query(
      `SELECT cs.id AS mapping_id, c.name AS class_name, s.name AS section_name, sub.name AS subject_name, sub.code AS subject_code
       FROM class_subjects cs
       JOIN classes c ON cs.class_id = c.id
       JOIN sections s ON cs.section_id = s.id
       JOIN subjects sub ON cs.subject_id = sub.id
       WHERE cs.teacher_id = ?`,
      [teachers[0].user_id]
    );

    res.json({
      teacher: teachers[0],
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

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Create User
    const hashedPassword = await bcrypt.hash(password || 'teacher123', 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'teacher', phone, 'active']
    );
    const userId = userResult.insertId;

    // 2. Create Teacher Profile
    await conn.query(
      `INSERT INTO teachers (user_id, employee_id, designation, department, qualification, experience, salary, hire_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, employee_id || `EMP-${Date.now()}`, designation, department, qualification, experience, salary || 0.00, hire_date || new Date().toISOString().slice(0,10), 'active']
    );

    await conn.commit();
    res.status(201).json({ message: 'Teacher registered successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error registering teacher: ' + err.message });
  } finally {
    conn.release();
  }
};

// Update teacher profile
exports.updateTeacher = async (req, res) => {
  const { id } = req.params;
  const {
    name, email, phone, designation, department, qualification,
    experience, salary, hire_date, status
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [teacher] = await conn.query('SELECT user_id FROM teachers WHERE id = ?', [id]);
    if (teacher.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    const userId = teacher[0].user_id;

    // Update User
    await conn.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone, userId]
    );

    // Update Teacher
    await conn.query(
      `UPDATE teachers 
       SET designation = ?, department = ?, qualification = ?, experience = ?, salary = ?, hire_date = ?, status = ?
       WHERE id = ?`,
      [designation, department, qualification, experience, salary, hire_date, status || 'active', id]
    );

    // Update User Status
    if (status === 'inactive') {
      await conn.query('UPDATE users SET status = "inactive" WHERE id = ?', [userId]);
    } else {
      await conn.query('UPDATE users SET status = "active" WHERE id = ?', [userId]);
    }

    await conn.commit();
    res.json({ message: 'Teacher updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error updating teacher' });
  } finally {
    conn.release();
  }
};

// Delete teacher (soft delete)
exports.deleteTeacher = async (req, res) => {
  const { id } = req.params;
  try {
    const [teacher] = await db.query('SELECT user_id FROM teachers WHERE id = ?', [id]);
    if (teacher.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    await db.query('UPDATE users SET status = "inactive" WHERE id = ?', [teacher[0].user_id]);
    await db.query('UPDATE teachers SET status = "inactive" WHERE id = ?', [id]);

    res.json({ message: 'Teacher set to inactive successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting teacher' });
  }
};
