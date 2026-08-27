const Exam = require('../models/Exam');
const ExamMark = require('../models/ExamMark');
const Student = require('../models/Student');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Grade = require('../models/Grade');

// ==========================================================
// ONLINE EXAMS
// ==========================================================

// Get all exams (with filters)
exports.getExams = async (req, res) => {
  const { classId, type } = req.query;
  try {
    const filter = {};
    if (classId) filter.class = classId;
    if (type) filter.type = type;

    const exams = await Exam.find(filter).populate('class', 'name').sort({ created_at: -1 });

    const formattedExams = exams.map(e => ({
      id: e._id.toString(),
      name: e.name,
      type: e.type,
      class_id: e.class ? e.class._id.toString() : null,
      class_name: e.class ? e.class.name : '',
      start_date: e.start_date,
      end_date: e.end_date,
      total_marks: e.total_marks,
      passing_marks: e.passing_marks,
      status: e.status
    }));

    res.json({ exams: formattedExams });
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
    const newExam = new Exam({
      name,
      type,
      class: class_id,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      total_marks: parseFloat(total_marks),
      passing_marks: parseFloat(passing_marks),
      status: 'scheduled'
    });
    await newExam.save();
    res.status(201).json({ message: 'Exam created successfully', examId: newExam._id.toString() });
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

  try {
    const exam = await Exam.findById(exam_id);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    for (const q of questions) {
      exam.questions.push({
        question_text: q.question_text,
        type: q.type || 'MCQ',
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        marks: parseFloat(q.marks || 1),
        negative_marks: parseFloat(q.negative_marks || 0)
      });
    }

    await exam.save();
    res.json({ message: 'Questions added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error adding questions' });
  }
};

// Get exam with questions (For students taking the exam)
exports.getExamQuestions = async (req, res) => {
  const { examId } = req.params;
  try {
    const exam = await Exam.findById(examId).populate('class', 'name');
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Map questions, hide correct_option if student is requesting
    const formattedQuestions = exam.questions.map(q => {
      const qObj = {
        id: q._id.toString(),
        question_text: q.question_text,
        type: q.type,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        marks: q.marks,
        negative_marks: q.negative_marks
      };
      
      if (req.user.role !== 'student') {
        qObj.correct_option = q.correct_option;
      }
      return qObj;
    });

    const formattedExam = {
      id: exam._id.toString(),
      name: exam.name,
      type: exam.type,
      class_id: exam.class ? exam.class._id.toString() : null,
      class_name: exam.class ? exam.class.name : '',
      start_date: exam.start_date,
      end_date: exam.end_date,
      total_marks: exam.total_marks,
      passing_marks: exam.passing_marks,
      status: exam.status
    };

    res.json({ exam: formattedExam, questions: formattedQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching exam details' });
  }
};

// Submit Online Exam (Grading Engine)
exports.submitExam = async (req, res) => {
  const { exam_id, answers } = req.body; // answers: Map of { question_id: student_answer }
  const studentUserId = req.user.id;

  try {
    const student = await Student.findOne({ user: studentUserId });
    if (!student) {
      return res.status(404).json({ message: 'Student record not found' });
    }

    const exam = await Exam.findById(exam_id);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if already submitted
    const alreadySubmitted = exam.submissions.some(
      sub => sub.student.toString() === student._id.toString()
    );
    if (alreadySubmitted) {
      return res.status(400).json({ message: 'You have already submitted this exam' });
    }

    let totalScore = 0;
    const studentAnswers = [];

    // Grade each question
    for (const q of exam.questions) {
      const qIdStr = q._id.toString();
      const studentAns = answers[qIdStr] || '';
      let marksObtained = 0;

      if (q.type === 'MCQ') {
        if (studentAns === q.correct_option) {
          marksObtained = parseFloat(q.marks);
        } else if (studentAns !== '') {
          marksObtained = -parseFloat(q.negative_marks);
        }
      }

      totalScore += marksObtained;
      studentAnswers.push({
        question_id: q._id,
        student_answer: studentAns,
        marks_obtained: marksObtained
      });
    }

    exam.submissions.push({
      student: student._id,
      end_time: new Date(),
      status: 'Submitted',
      total_score: totalScore,
      answers: studentAnswers
    });

    await exam.save();
    res.json({ message: 'Exam submitted and graded successfully', score: totalScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error submitting exam: ' + err.message });
  }
};

// Get Student Exam Results
exports.getExamResults = async (req, res) => {
  const { examId } = req.params;
  try {
    const exam = await Exam.findById(examId)
      .populate({
        path: 'submissions.student',
        populate: { path: 'user', select: 'name' }
      });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const results = exam.submissions.map(sub => ({
      id: sub._id.toString(),
      student_id: sub.student ? sub.student._id.toString() : null,
      end_time: sub.end_time,
      status: sub.status,
      total_score: sub.total_score,
      student_name: sub.student && sub.student.user ? sub.student.user.name : '',
      roll_number: sub.student ? sub.student.roll_number : ''
    })).sort((a, b) => b.total_score - a.total_score);

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

  try {
    for (const entry of marks) {
      await ExamMark.findOneAndUpdate(
        { exam: exam_id, student: entry.student_id, subject: subject_id },
        {
          marks_obtained: parseFloat(entry.marks_obtained),
          remarks: entry.remarks || ''
        },
        { upsert: true, new: true }
      );
    }

    res.json({ message: 'Marks recorded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error entering marks' });
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
    const student = await Student.findById(studentId)
      .populate('user', 'name email phone avatar status')
      .populate('class', 'name')
      .populate('section', 'name');

    if (!student) return res.status(404).json({ message: 'Student not found' });

    const formattedStudent = {
      student_id: student._id.toString(),
      user_id: student.user ? student.user._id.toString() : null,
      name: student.user ? student.user.name : '',
      email: student.user ? student.user.email : '',
      phone: student.user ? student.user.phone : '',
      roll_number: student.roll_number,
      admission_no: student.admission_number,
      class_name: student.class ? student.class.name : '',
      section_name: student.section ? student.section.name : '',
      user_status: student.user ? student.user.status : 'inactive'
    };

    // Get exam details
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const formattedExam = {
      id: exam._id.toString(),
      name: exam.name,
      type: exam.type,
      total_marks: exam.total_marks,
      passing_marks: exam.passing_marks
    };

    // Get marks obtained
    const marks = await ExamMark.find({ student: studentId, exam: examId })
      .populate('subject', 'name code');

    // Fetch grading scale
    const grades = await Grade.find().sort({ point: -1 });

    // Calculate Grade for each subject
    const reportDetails = marks.map(m => {
      const percentage = (parseFloat(m.marks_obtained) / parseFloat(exam.total_marks)) * 100;
      let gradeName = 'F';
      let gradePoint = 0.00;

      for (const g of grades) {
        if (percentage >= g.mark_from && percentage <= g.mark_upto) {
          gradeName = g.name;
          gradePoint = parseFloat(g.point);
          break;
        }
      }

      return {
        id: m._id.toString(),
        exam_id: m.exam.toString(),
        student_id: m.student.toString(),
        subject_id: m.subject ? m.subject._id.toString() : null,
        marks_obtained: m.marks_obtained,
        remarks: m.remarks || '',
        subject_name: m.subject ? m.subject.name : '',
        subject_code: m.subject ? m.subject.code : '',
        percentage,
        grade: gradeName,
        gp: gradePoint
      };
    });

    // Calculate overall GPA
    const totalGPs = reportDetails.reduce((acc, curr) => acc + curr.gp, 0);
    const gpa = reportDetails.length > 0 ? (totalGPs / reportDetails.length).toFixed(2) : '0.00';

    res.json({
      student: formattedStudent,
      exam: formattedExam,
      marks: reportDetails,
      gpa
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating report card' });
  }
};
