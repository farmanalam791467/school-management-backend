const db = require('../config/db');

// ==========================================================
// ONLINE EXAMS
// ==========================================================

// Get all exams (with filters)
exports.getExams = async (req, res) => {
  const { classId, type } = req.query;
  try {
    let query = 'SELECT e.*, c.name as class_name FROM exams e JOIN classes c ON e.class_id = c.id WHERE 1=1';
    const params = [];

    if (classId) {
      query += ' AND e.class_id = ?';
      params.push(classId);
    }
    if (type) {
      query += ' AND e.type = ?';
      params.push(type);
    }

    query += ' ORDER BY e.id DESC';
    const [exams] = await db.query(query, params);
    res.json({ exams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching exams' });
  }
};

// Create an exam
exports.createExam = async (req, res) => {
  const { name, type, class_id, start_date, end_date, total_marks, passing_marks } = req.body;
  if (!name || !type || !class_id || !start_date || !end_date || !total_marks || !passing_marks) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO exams (name, type, class_id, start_date, end_date, total_marks, passing_marks) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, type, class_id, start_date, end_date, total_marks, passing_marks]
    );
    res.status(201).json({ message: 'Exam created successfully', examId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating exam' });
  }
};

// Add questions to an exam
exports.addQuestions = async (req, res) => {
  const { exam_id, questions } = req.body; // questions: Array of { question_text, type, option_a, option_b, option_c, option_d, correct_option, marks, negative_marks }
  if (!exam_id || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ message: 'Exam ID and questions list are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const q of questions) {
      await conn.query(
        `INSERT INTO exam_questions (exam_id, question_text, type, option_a, option_b, option_c, option_d, correct_option, marks, negative_marks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [exam_id, q.question_text, q.type || 'MCQ', q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks, q.negative_marks || 0.00]
      );
    }

    await conn.commit();
    res.json({ message: 'Questions added successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error adding questions' });
  } finally {
    conn.release();
  }
};

// Get exam with questions (For students taking the exam)
exports.getExamQuestions = async (req, res) => {
  const { examId } = req.params;
  try {
    const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
    if (exams.length === 0) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Get questions, hide correct_option if student is requesting
    let qQuery = 'SELECT id, question_text, type, option_a, option_b, option_c, option_d, marks, negative_marks FROM exam_questions WHERE exam_id = ?';
    if (req.user.role !== 'student') {
      qQuery = 'SELECT * FROM exam_questions WHERE exam_id = ?';
    }

    const [questions] = await db.query(qQuery, [examId]);
    res.json({ exam: exams[0], questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching exam details' });
  }
};

// Submit Online Exam (Grading Engine)
exports.submitExam = async (req, res) => {
  const { exam_id, answers } = req.body; // answers: Map of { question_id: student_answer }
  const studentUserId = req.user.id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch student profile
    const [students] = await conn.query('SELECT id FROM students WHERE user_id = ?', [studentUserId]);
    if (students.length === 0) {
      return res.status(404).json({ message: 'Student record not found' });
    }
    const studentId = students[0].id;

    // 2. Check if already submitted
    const [existingSub] = await conn.query('SELECT id FROM exam_submissions WHERE exam_id = ? AND student_id = ?', [exam_id, studentId]);
    if (existingSub.length > 0) {
      return res.status(400).json({ message: 'You have already submitted this exam' });
    }

    // 3. Fetch all questions for this exam to grade
    const [questions] = await conn.query('SELECT * FROM exam_questions WHERE exam_id = ?', [exam_id]);

    let totalScore = 0;

    // 4. Create submission record
    const [subResult] = await conn.query(
      'INSERT INTO exam_submissions (exam_id, student_id, end_time, status, total_score) VALUES (?, ?, NOW(), "Submitted", 0)',
      [exam_id, studentId]
    );
    const submissionId = subResult.insertId;

    // 5. Grade each question
    for (const q of questions) {
      const studentAns = answers[q.id] || '';
      let marksObtained = 0;

      if (q.type === 'MCQ') {
        if (studentAns === q.correct_option) {
          marksObtained = parseFloat(q.marks);
        } else if (studentAns !== '') {
          // Deduct negative marks if wrong and answered
          marksObtained = -parseFloat(q.negative_marks);
        }
      }

      totalScore += marksObtained;

      // Insert into exam_answers
      await conn.query(
        'INSERT INTO exam_answers (submission_id, question_id, student_answer, marks_obtained) VALUES (?, ?, ?, ?)',
        [submissionId, q.id, studentAns, marksObtained]
      );
    }

    // Update total score in submission
    await conn.query('UPDATE exam_submissions SET total_score = ? WHERE id = ?', [totalScore, submissionId]);

    await conn.commit();
    res.json({ message: 'Exam submitted and graded successfully', score: totalScore });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error submitting exam: ' + err.message });
  } finally {
    conn.release();
  }
};

// Get Student Exam Results
exports.getExamResults = async (req, res) => {
  const { examId } = req.params;
  try {
    const [results] = await db.query(
      `SELECT es.*, u.name as student_name, s.roll_number 
       FROM exam_submissions es
       JOIN students s ON es.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE es.exam_id = ? 
       ORDER BY es.total_score DESC`,
      [examId]
    );
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================================
// OFFLINE EXAMS (MARK SHEET & REPORT CARDS)
// ==========================================================

// Enter offline exam marks
exports.enterMarks = async (req, res) => {
  const { exam_id, subject_id, marks } = req.body; // marks: Array of { student_id, marks_obtained, remarks }
  if (!exam_id || !subject_id || !marks || !Array.isArray(marks)) {
    return res.status(400).json({ message: 'Exam ID, subject ID, and marks list are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const entry of marks) {
      await conn.query(
        `INSERT INTO exam_marks (exam_id, student_id, subject_id, marks_obtained, remarks) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained), remarks = VALUES(remarks)`,
        [exam_id, entry.student_id, subject_id, entry.marks_obtained, entry.remarks || '']
      );
    }

    await conn.commit();
    res.json({ message: 'Marks recorded successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error entering marks' });
  } finally {
    conn.release();
  }
};

// Get Report Card / Transcript for a student
exports.getReportCard = async (req, res) => {
  const { studentId, examId } = req.query;
  if (!studentId || !examId) {
    return res.status(400).json({ message: 'Student ID and Exam ID are required' });
  }

  try {
    // Get student details
    const [students] = await db.query('SELECT * FROM view_student_profiles WHERE student_id = ?', [studentId]);
    if (students.length === 0) return res.status(404).json({ message: 'Student not found' });

    // Get exam details
    const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
    if (exams.length === 0) return res.status(404).json({ message: 'Exam not found' });

    // Get marks obtained
    const [marks] = await db.query(
      `SELECT em.*, s.name as subject_name, s.code as subject_code
       FROM exam_marks em
       JOIN subjects s ON em.subject_id = s.id
       WHERE em.student_id = ? AND em.exam_id = ?`,
      [studentId, examId]
    );

    // Fetch grading scale
    const [grades] = await db.query('SELECT * FROM grades ORDER BY point DESC');

    // Calculate Grade for each subject
    const reportDetails = marks.map(m => {
      const percentage = (parseFloat(m.marks_obtained) / parseFloat(exams[0].total_marks)) * 100;
      let gradeName = 'F';
      let gradePoint = 0.00;

      for (const g of grades) {
        if (percentage >= g.mark_from && percentage <= g.mark_to) {
          gradeName = g.name;
          gradePoint = parseFloat(g.point);
          break;
        }
      }

      return {
        ...m,
        percentage,
        grade: gradeName,
        gp: gradePoint
      };
    });

    // Calculate overall GPA
    const totalGPs = reportDetails.reduce((acc, curr) => acc + curr.gp, 0);
    const gpa = reportDetails.length > 0 ? (totalGPs / reportDetails.length).toFixed(2) : '0.00';

    res.json({
      student: students[0],
      exam: exams[0],
      marks: reportDetails,
      gpa
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating report card' });
  }
};
