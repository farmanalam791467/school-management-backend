const db = require('../config/db');

// Get all classes
exports.getClasses = async (req, res) => {
  try {
    const [classes] = await db.query('SELECT * FROM classes ORDER BY name ASC');
    
    // For each class, fetch its sections and student count
    const classesWithDetails = await Promise.all(
      classes.map(async (cls) => {
        const [sections] = await db.query('SELECT * FROM sections WHERE class_id = ?', [cls.id]);
        const [studentsCount] = await db.query('SELECT COUNT(*) as count FROM students WHERE class_id = ? AND status = "active"', [cls.id]);
        return {
          ...cls,
          sections,
          studentCount: studentsCount[0].count
        };
      })
    );

    res.json({ classes: classesWithDetails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching classes' });
  }
};

// Create class
exports.createClass = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Class name is required' });
  try {
    const [result] = await db.query('INSERT INTO classes (name) VALUES (?) ON DUPLICATE KEY UPDATE name=name', [name]);
    res.status(201).json({ message: 'Class created successfully', classId: result.insertId || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating class' });
  }
};

// Get sections
exports.getSections = async (req, res) => {
  const { classId } = req.query;
  try {
    let query = 'SELECT s.*, c.name as class_name FROM sections s JOIN classes c ON s.class_id = c.id';
    const params = [];
    if (classId) {
      query += ' WHERE s.class_id = ?';
      params.push(classId);
    }
    const [sections] = await db.query(query, params);
    res.json({ sections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching sections' });
  }
};

// Create section
exports.createSection = async (req, res) => {
  const { class_id, name, room_no, capacity } = req.body;
  if (!class_id || !name) return res.status(400).json({ message: 'Class ID and Section Name are required' });
  try {
    await db.query(
      'INSERT INTO sections (class_id, name, room_no, capacity) VALUES (?, ?, ?, ?)',
      [class_id, name, room_no, capacity || 30]
    );
    res.status(201).json({ message: 'Section created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating section' });
  }
};

// Get subjects
exports.getSubjects = async (req, res) => {
  try {
    const [subjects] = await db.query('SELECT * FROM subjects ORDER BY name ASC');
    res.json({ subjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching subjects' });
  }
};

// Create subject
exports.createSubject = async (req, res) => {
  const { name, code, type } = req.body;
  if (!name || !code) return res.status(400).json({ message: 'Subject Name and Code are required' });
  try {
    await db.query('INSERT INTO subjects (name, code, type) VALUES (?, ?, ?)', [name, code, type || 'Theory']);
    res.status(201).json({ message: 'Subject created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating subject' });
  }
};

// Get class subjects (mappings)
exports.getClassSubjects = async (req, res) => {
  const { classId, sectionId } = req.query;
  try {
    let query = `
      SELECT cs.id, cs.class_id, cs.section_id, cs.subject_id, c.name AS class_name, s.name AS section_name, sub.name AS subject_name, sub.code AS subject_code, sub.type AS subject_type, u.name AS teacher_name, cs.teacher_id
      FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.id
      JOIN sections s ON cs.section_id = s.id
      JOIN subjects sub ON cs.subject_id = sub.id
      LEFT JOIN users u ON cs.teacher_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (classId) {
      query += ' AND cs.class_id = ?';
      params.push(classId);
    }
    if (sectionId) {
      query += ' AND cs.section_id = ?';
      params.push(sectionId);
    }

    const [classSubjects] = await db.query(query, params);
    res.json({ classSubjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching class subjects' });
  }
};

// Assign subject and teacher to class/section
exports.assignSubjectTeacher = async (req, res) => {
  const { class_id, section_id, subject_id, teacher_id } = req.body;
  if (!class_id || !section_id || !subject_id) {
    return res.status(400).json({ message: 'Class, Section, and Subject are required' });
  }

  try {
    await db.query(
      `INSERT INTO class_subjects (class_id, section_id, subject_id, teacher_id) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id)`,
      [class_id, section_id, subject_id, teacher_id || null]
    );
    res.json({ message: 'Subject and Teacher assigned to class/section successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error assigning subject/teacher' });
  }
};

// Get Timetable slots
exports.getTimetable = async (req, res) => {
  const { classId, sectionId } = req.query;
  if (!classId || !sectionId) {
    return res.status(400).json({ message: 'Class ID and Section ID are required' });
  }
  try {
    const [timetable] = await db.query(
      `SELECT t.*, sub.name as subject_name, u.name as teacher_name
       FROM timetables t
       JOIN subjects sub ON t.subject_id = sub.id
       JOIN users u ON t.teacher_id = u.id
       WHERE t.class_id = ? AND t.section_id = ?
       ORDER BY t.start_time ASC`,
      [classId, sectionId]
    );
    res.json({ timetable });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching timetable' });
  }
};

// Create Timetable Slot
exports.createTimetableSlot = async (req, res) => {
  const { class_id, section_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_no } = req.body;
  if (!class_id || !section_id || !subject_id || !teacher_id || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    await db.query(
      `INSERT INTO timetables (class_id, section_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_no) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [class_id, section_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_no || '']
    );
    res.status(201).json({ message: 'Timetable slot created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error scheduling slot: ' + err.message });
  }
};

