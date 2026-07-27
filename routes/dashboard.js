const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/stats', async (req, res) => {
  const { role, id: userId } = req.user;
  const today = new Date().toISOString().slice(0, 10);

  try {
    // 1. ADMIN & LEADERSHIP STATS
    if (['super_admin', 'school_admin', 'principal', 'vice_principal'].includes(role)) {
      const [[studentCount]] = await db.query('SELECT COUNT(*) as count FROM students WHERE status = "active"');
      const [[teacherCount]] = await db.query('SELECT COUNT(*) as count FROM teachers WHERE status = "active"');
      const [[classCount]] = await db.query('SELECT COUNT(*) as count FROM classes');
      const [[noticeCount]] = await db.query('SELECT COUNT(*) as count FROM notices');
      
      // Today's Attendance
      const [[attCount]] = await db.query('SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = "Present"', [today]);
      const attendanceRate = studentCount.count > 0 ? Math.round((attCount.count / studentCount.count) * 100) : 100;

      // Fees Collected & Expenses
      const [[totalIncome]] = await db.query('SELECT SUM(amount) as total FROM accounts_ledger WHERE type = "Income"');
      const [[totalExpense]] = await db.query('SELECT SUM(amount) as total FROM accounts_ledger WHERE type = "Expense"');

      return res.json({
        role,
        stats: [
          { label: 'Total Students', value: studentCount.count, icon: 'students', color: 'blue' },
          { label: 'Active Teachers', value: teacherCount.count, icon: 'teachers', color: 'green' },
          { label: 'Total Classes', value: classCount.count, icon: 'classes', color: 'purple' },
          { label: 'Attendance Today', value: `${attendanceRate}%`, icon: 'attendance', color: 'orange' }
        ],
        finance: {
          income: parseFloat(totalIncome.total || 0),
          expense: parseFloat(totalExpense.total || 0),
          balance: parseFloat(totalIncome.total || 0) - parseFloat(totalExpense.total || 0)
        },
        noticesCount: noticeCount.count
      });
    }

    // 2. TEACHER STATS
    if (role === 'teacher') {
      const [[teacherProfile]] = await db.query('SELECT id FROM teachers WHERE user_id = ?', [userId]);
      const teacherId = teacherProfile ? teacherProfile.id : 0;

      const [classesTaught] = await db.query(
        `SELECT COUNT(DISTINCT class_id) as count FROM class_subjects WHERE teacher_id = ?`,
        [userId]
      );
      
      const [todayClasses] = await db.query(
        `SELECT t.*, c.name as class_name, s.name as section_name, sub.name as subject_name 
         FROM timetables t
         JOIN classes c ON t.class_id = c.id
         JOIN sections s ON t.section_id = s.id
         JOIN subjects sub ON t.subject_id = sub.id
         WHERE t.teacher_id = ? AND t.day_of_week = DAYNAME(NOW())
         ORDER BY t.start_time ASC`,
        [userId]
      );

      const [[pendingHomework]] = await db.query(
        `SELECT COUNT(*) as count FROM homework_submissions hs
         JOIN homework h ON hs.homework_id = h.id
         WHERE h.teacher_id = ? AND hs.status = "Pending"`,
        [userId]
      );

      return res.json({
        role,
        stats: [
          { label: 'My Classes', value: classesTaught[0].count, icon: 'classes', color: 'blue' },
          { label: 'Classes Today', value: todayClasses.length, icon: 'calendar', color: 'green' },
          { label: 'Pending Evaluations', value: pendingHomework.count, icon: 'homework', color: 'orange' }
        ],
        todayClasses
      });
    }

    // 3. STUDENT STATS
    if (role === 'student') {
      const [[student]] = await db.query(
        `SELECT s.id, s.class_id, s.section_id, c.name as class_name, sec.name as section_name 
         FROM students s 
         JOIN classes c ON s.class_id = c.id
         JOIN sections sec ON s.section_id = sec.id
         WHERE s.user_id = ?`,
        [userId]
      );

      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      // Attendance rate
      const [[totalDays]] = await db.query('SELECT COUNT(*) as count FROM attendance WHERE user_id = ?', [userId]);
      const [[presentDays]] = await db.query('SELECT COUNT(*) as count FROM attendance WHERE user_id = ? AND status = "Present"', [userId]);
      const attendanceRate = totalDays.count > 0 ? Math.round((presentDays.count / totalDays.count) * 100) : 100;

      // Pending homework
      const [pendingHomework] = await db.query(
        `SELECT h.*, sub.name as subject_name 
         FROM homework h
         JOIN subjects sub ON h.subject_id = sub.id
         WHERE h.class_id = ? AND h.section_id = ?
         AND h.id NOT IN (SELECT homework_id FROM homework_submissions WHERE student_id = ?)`,
        [student.class_id, student.section_id, student.id]
      );

      // Fee Invoices
      const [[unpaidFees]] = await db.query(
        'SELECT COUNT(*) as count FROM fee_invoices WHERE student_id = ? AND status != "Paid"',
        [student.id]
      );

      return res.json({
        role,
        studentDetails: student,
        stats: [
          { label: 'Attendance Rate', value: `${attendanceRate}%`, icon: 'attendance', color: 'green' },
          { label: 'Pending Homework', value: pendingHomework.length, icon: 'homework', color: 'orange' },
          { label: 'Unpaid Invoices', value: unpaidFees.count, icon: 'fees', color: 'red' }
        ],
        pendingHomework
      });
    }

    // 4. PARENT STATS
    if (role === 'parent') {
      const [[parent]] = await db.query('SELECT id FROM parents WHERE user_id = ?', [userId]);
      if (!parent) return res.status(404).json({ message: 'Parent profile not found' });

      const [children] = await db.query(
        `SELECT s.id, u.name, c.name as class_name, sec.name as section_name, s.user_id
         FROM students s
         JOIN users u ON s.user_id = u.id
         JOIN classes c ON s.class_id = c.id
         JOIN sections sec ON s.section_id = sec.id
         WHERE s.parent_id = ?`,
        [parent.id]
      );

      const childrenDetails = await Promise.all(
        children.map(async (child) => {
          // Attendance
          const [[tot]] = await db.query('SELECT COUNT(*) as count FROM attendance WHERE user_id = ?', [child.user_id]);
          const [[pres]] = await db.query('SELECT COUNT(*) as count FROM attendance WHERE user_id = ? AND status = "Present"', [child.user_id]);
          const attRate = tot.count > 0 ? Math.round((pres.count / tot.count) * 100) : 100;

          // Fees
          const [[unpaid]] = await db.query('SELECT SUM(total_amount - paid_amount) as due FROM fee_invoices WHERE student_id = ? AND status != "Paid"', [child.id]);

          return {
            ...child,
            attendanceRate: attRate,
            dueFees: parseFloat(unpaid.due || 0)
          };
        })
      );

      return res.json({
        role,
        stats: [
          { label: 'Registered Children', value: children.length, icon: 'students', color: 'blue' }
        ],
        children: childrenDetails
      });
    }

    // 5. ACCOUNTANT STATS
    if (role === 'accountant') {
      const [[totalIncome]] = await db.query('SELECT SUM(amount) as total FROM accounts_ledger WHERE type = "Income"');
      const [[totalExpense]] = await db.query('SELECT SUM(amount) as total FROM accounts_ledger WHERE type = "Expense"');
      const [[unpaidInvoices]] = await db.query('SELECT COUNT(*) as count FROM fee_invoices WHERE status != "Paid"');

      return res.json({
        role,
        stats: [
          { label: 'Total Income', value: `\u20B9${parseFloat(totalIncome.total || 0).toFixed(2)}`, icon: 'fees', color: 'green' },
          { label: 'Total Expenses', value: `\u20B9${parseFloat(totalExpense.total || 0).toFixed(2)}`, icon: 'expenses', color: 'red' },
          { label: 'Pending Invoices', value: unpaidInvoices.count, icon: 'classes', color: 'orange' }
        ]
      });
    }

    // 6. LIBRARIAN STATS
    if (role === 'librarian') {
      const [[totalBooks]] = await db.query('SELECT SUM(quantity) as count FROM library_books');
      const [[issuedBooks]] = await db.query('SELECT COUNT(*) as count FROM library_issues WHERE status = "Issued"');
      const [[overdueBooks]] = await db.query('SELECT COUNT(*) as count FROM library_issues WHERE status = "Issued" AND due_date < CURDATE()');

      return res.json({
        role,
        stats: [
          { label: 'Total Books', value: totalBooks.count || 0, icon: 'classes', color: 'blue' },
          { label: 'Books Issued', value: issuedBooks.count, icon: 'students', color: 'green' },
          { label: 'Overdue Books', value: overdueBooks.count, icon: 'attendance', color: 'red' }
        ]
      });
    }

    // Default Fallback
    res.json({ role, stats: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching dashboard stats' });
  }
});

module.exports = router;
