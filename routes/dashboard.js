const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Notice = require('../models/Notice');
const Attendance = require('../models/Attendance');
const AccountsLedger = require('../models/AccountsLedger');
const ClassSubject = require('../models/ClassSubject');
const Timetable = require('../models/Timetable');
const Homework = require('../models/Homework');
const FeeInvoice = require('../models/FeeInvoice');
const Parent = require('../models/Parent');
const LibraryBook = require('../models/LibraryBook');
const User = require('../models/User');

const getMidnightUTC = (date) => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
};

router.get('/stats', async (req, res) => {
  const { role, id: userId } = req.user;
  const today = getMidnightUTC(new Date());

  try {
    // 1. ADMIN & LEADERSHIP STATS
    if (['super_admin', 'school_admin', 'principal', 'vice_principal'].includes(role)) {
      const studentCount = await Student.countDocuments({ status: 'active' });
      const teacherCount = await Teacher.countDocuments({ status: 'active' });
      const classCount = await Class.countDocuments();
      const noticeCount = await Notice.countDocuments();
      
      // Today's Attendance
      const attCount = await Attendance.countDocuments({ date: today, status: 'Present' });
      const attendanceRate = studentCount > 0 ? Math.round((attCount / studentCount) * 100) : 100;

      // Fees Collected & Expenses
      const incomeResult = await AccountsLedger.aggregate([
        { $match: { type: 'Income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalIncome = incomeResult.length > 0 ? incomeResult[0].total : 0;

      const expenseResult = await AccountsLedger.aggregate([
        { $match: { type: 'Expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalExpense = expenseResult.length > 0 ? expenseResult[0].total : 0;

      return res.json({
        role,
        stats: [
          { label: 'Total Students', value: studentCount, icon: 'students', color: 'blue' },
          { label: 'Active Teachers', value: teacherCount, icon: 'teachers', color: 'green' },
          { label: 'Total Classes', value: classCount, icon: 'classes', color: 'purple' },
          { label: 'Attendance Today', value: `${attendanceRate}%`, icon: 'attendance', color: 'orange' }
        ],
        finance: {
          income: totalIncome,
          expense: totalExpense,
          balance: totalIncome - totalExpense
        },
        noticesCount: noticeCount
      });
    }

    // 2. TEACHER STATS
    if (role === 'teacher') {
      const teacher = await Teacher.findOne({ user: userId });
      const teacherId = teacher ? teacher._id : null;

      const classesTaught = await ClassSubject.distinct('class', { teacher: teacherId });
      
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeekName = days[new Date().getDay()];

      const timetableSlots = await Timetable.find({
        teacher: teacherId,
        day_of_week: dayOfWeekName
      }).populate('class', 'name').populate('section', 'name').populate('subject', 'name').sort({ start_time: 1 });

      const todayClasses = timetableSlots.map(t => ({
        id: t._id.toString(),
        class_id: t.class ? t.class._id.toString() : null,
        class_name: t.class ? t.class.name : '',
        section_id: t.section.toString(),
        section_name: t.section ? t.section.name : '',
        subject_id: t.subject ? t.subject._id.toString() : null,
        subject_name: t.subject ? t.subject.name : '',
        start_time: t.start_time,
        end_time: t.end_time,
        room_no: t.room_no
      }));

      const teacherHws = await Homework.find({ teacher: teacherId });
      let pendingHomeworkCount = 0;
      teacherHws.forEach(hw => {
        pendingHomeworkCount += hw.submissions.filter(sub => sub.status === 'Pending').length;
      });

      return res.json({
        role,
        stats: [
          { label: 'My Classes', value: classesTaught.length, icon: 'classes', color: 'blue' },
          { label: 'Classes Today', value: todayClasses.length, icon: 'calendar', color: 'green' },
          { label: 'Pending Evaluations', value: pendingHomeworkCount, icon: 'homework', color: 'orange' }
        ],
        todayClasses
      });
    }

    // 3. STUDENT STATS
    if (role === 'student') {
      const student = await Student.findOne({ user: userId })
        .populate('class', 'name')
        .populate('section', 'name');

      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      // Attendance rate
      const totalDays = await Attendance.countDocuments({ user: userId });
      const presentDays = await Attendance.countDocuments({ user: userId, status: 'Present' });
      const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

      // Pending homework
      const allHomework = await Homework.find({
        class: student.class._id,
        section: student.section._id
      }).populate('subject', 'name');

      const pendingHomework = allHomework.filter(hw => {
        return !hw.submissions.some(sub => sub.student.toString() === student._id.toString());
      }).map(hw => ({
        id: hw._id.toString(),
        title: hw.title,
        due_date: hw.due_date,
        subject_name: hw.subject ? hw.subject.name : ''
      }));

      // Fee Invoices
      const unpaidFees = await FeeInvoice.countDocuments({
        student: student._id,
        status: { $ne: 'Paid' }
      });

      return res.json({
        role,
        studentDetails: {
          id: student._id.toString(),
          class_id: student.class ? student.class._id.toString() : null,
          section_id: student.section ? student.section._id.toString() : null,
          class_name: student.class ? student.class.name : '',
          section_name: student.section ? student.section.name : ''
        },
        stats: [
          { label: 'Attendance Rate', value: `${attendanceRate}%`, icon: 'attendance', color: 'green' },
          { label: 'Pending Homework', value: pendingHomework.length, icon: 'homework', color: 'orange' },
          { label: 'Unpaid Invoices', value: unpaidFees, icon: 'fees', color: 'red' }
        ],
        pendingHomework
      });
    }

    // 4. PARENT STATS
    if (role === 'parent') {
      const parent = await Parent.findOne({ user: userId });
      if (!parent) return res.status(404).json({ message: 'Parent profile not found' });

      const children = await Student.find({ parent: parent._id })
        .populate('user', 'name')
        .populate('class', 'name')
        .populate('section', 'name');

      const childrenDetails = await Promise.all(
        children.map(async (child) => {
          // Attendance
          const tot = await Attendance.countDocuments({ user: child.user._id });
          const pres = await Attendance.countDocuments({ user: child.user._id, status: 'Present' });
          const attRate = tot > 0 ? Math.round((pres / tot) * 100) : 100;

          // Fees
          const unpaidInvoices = await FeeInvoice.find({
            student: child._id,
            status: { $ne: 'Paid' }
          });
          const dueFees = unpaidInvoices.reduce((acc, inv) => acc + (inv.total - (inv.paid_amount || 0)), 0);

          return {
            id: child._id.toString(),
            name: child.user ? child.user.name : '',
            class_name: child.class ? child.class.name : '',
            section_name: child.section ? child.section.name : '',
            user_id: child.user ? child.user._id.toString() : null,
            attendanceRate: attRate,
            dueFees
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
      const incomeResult = await AccountsLedger.aggregate([
        { $match: { type: 'Income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalIncome = incomeResult.length > 0 ? incomeResult[0].total : 0;

      const expenseResult = await AccountsLedger.aggregate([
        { $match: { type: 'Expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalExpense = expenseResult.length > 0 ? expenseResult[0].total : 0;

      const unpaidInvoices = await FeeInvoice.countDocuments({ status: { $ne: 'Paid' } });

      return res.json({
        role,
        stats: [
          { label: 'Total Income', value: `\u20B9${totalIncome.toFixed(2)}`, icon: 'fees', color: 'green' },
          { label: 'Total Expenses', value: `\u20B9${totalExpense.toFixed(2)}`, icon: 'expenses', color: 'red' },
          { label: 'Pending Invoices', value: unpaidInvoices, icon: 'classes', color: 'orange' }
        ]
      });
    }

    // 6. LIBRARIAN STATS
    if (role === 'librarian') {
      const books = await LibraryBook.find({});
      
      const totalBooks = books.reduce((acc, b) => acc + (b.quantity || 0), 0);
      
      let issuedBooks = 0;
      let overdueBooks = 0;
      
      const now = new Date();

      books.forEach(book => {
        book.issues.forEach(issue => {
          if (issue.status === 'Issued') {
            issuedBooks++;
            if (issue.due_date < now) {
              overdueBooks++;
            }
          }
        });
      });

      return res.json({
        role,
        stats: [
          { label: 'Total Books', value: totalBooks, icon: 'classes', color: 'blue' },
          { label: 'Books Issued', value: issuedBooks, icon: 'students', color: 'green' },
          { label: 'Overdue Books', value: overdueBooks, icon: 'attendance', color: 'red' }
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
