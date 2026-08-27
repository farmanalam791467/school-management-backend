const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const User = require('../models/User');
const Parent = require('../models/Parent');

// Helper to normalize date to UTC midnight
const getMidnightUTC = (dateStr) => {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
};

// Get attendance for a class, section, and date
exports.getAttendance = async (req, res) => {
  const { classId, sectionId, date } = req.query;
  if (!classId || !sectionId || !date) {
    return res.status(400).json({ message: 'Class ID, Section ID, and Date are required' });
  }

  try {
    const queryDate = getMidnightUTC(date);

    // Fetch all students in the class/section
    const students = await Student.find({
      class: classId,
      section: sectionId,
      status: 'active'
    }).populate('user', 'name').sort({ roll_number: 1 });

    const studentUserIds = students.map(s => s.user ? s.user._id : null).filter(Boolean);

    // Fetch attendance for these students on the given date
    const attendanceRecords = await Attendance.find({
      user: { $in: studentUserIds },
      date: queryDate
    });

    // Map attendance status to student list
    const attendanceMap = new Map(attendanceRecords.map(att => [att.user.toString(), att]));

    const studentsWithAttendance = students.map(student => {
      const userIdStr = student.user ? student.user._id.toString() : '';
      const record = attendanceMap.get(userIdStr);
      return {
        student_id: student._id.toString(),
        user_id: userIdStr,
        name: student.user ? student.user.name : '',
        roll_number: student.roll_number,
        status: record ? record.status : 'Present', // Default to Present if not marked
        remarks: record ? record.remarks : '',
        qr_code_used: record ? !!record.qr_code_used : false,
        isMarked: !!record
      };
    });

    res.json({ attendance: studentsWithAttendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching attendance' });
  }
};

// Save/Update attendance (manual bulk marking)
exports.saveAttendance = async (req, res) => {
  const { date, attendanceList } = req.body; // attendanceList: Array of { user_id, status, remarks }
  if (!date || !attendanceList || !Array.isArray(attendanceList)) {
    return res.status(400).json({ message: 'Date and attendance list are required' });
  }

  try {
    const queryDate = getMidnightUTC(date);

    for (const item of attendanceList) {
      const student = await Student.findOne({ user: item.user_id });
      
      await Attendance.findOneAndUpdate(
        { user: item.user_id, date: queryDate },
        {
          user: item.user_id,
          class: student ? student.class : undefined,
          section: student ? student.section : undefined,
          date: queryDate,
          status: item.status,
          remarks: item.remarks || '',
          checked_by: req.user.id
        },
        { upsert: true, new: true }
      );
    }

    res.json({ message: 'Attendance saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error saving attendance' });
  }
};

// QR Attendance Scan Check-in
exports.scanQRAttendance = async (req, res) => {
  const { userId } = req.body;
  const today = getMidnightUTC(new Date());

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const user = await User.findOne({ _id: userId, status: 'active' });
    if (!user) {
      return res.status(404).json({ message: 'Active user not found' });
    }

    const student = await Student.findOne({ user: user._id });

    await Attendance.findOneAndUpdate(
      { user: user._id, date: today },
      {
        user: user._id,
        class: student ? student.class : undefined,
        section: student ? student.section : undefined,
        date: today,
        status: 'Present',
        remarks: 'QR Code Checked In',
        qr_code_used: true,
        checked_by: req.user.id
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Checked in: ${user.name} (${user.role})`,
      name: user.name,
      role: user.role,
      time: new Date().toLocaleTimeString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error marking QR attendance: ' + err.message });
  }
};

// Monthly Attendance Report (Register view)
exports.getMonthlyReport = async (req, res) => {
  const { classId, sectionId, year, month } = req.query; // month is 1-12
  if (!classId || !sectionId || !year || !month) {
    return res.status(400).json({ message: 'Class ID, Section ID, Year, and Month are required' });
  }

  try {
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month);
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    // Get all active students
    const students = await Student.find({
      class: classId,
      section: sectionId,
      status: 'active'
    }).populate('user', 'name').sort({ roll_number: 1 });

    const studentUserIds = students.map(s => s.user ? s.user._id : null).filter(Boolean);

    // Get all attendance for the month
    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(targetYear, targetMonth - 1, daysInMonth, 23, 59, 59, 999));

    const records = await Attendance.find({
      user: { $in: studentUserIds },
      date: { $gte: startDate, $lte: endDate }
    });

    // Group records by user_id and day
    const attendanceMap = {};
    records.forEach(rec => {
      const day = new Date(rec.date).getUTCDate();
      const userIdStr = rec.user.toString();
      if (!attendanceMap[userIdStr]) {
        attendanceMap[userIdStr] = {};
      }
      attendanceMap[userIdStr][day] = rec.status;
    });

    const report = students.map(student => {
      const userIdStr = student.user ? student.user._id.toString() : '';
      const days = {};
      let presents = 0;
      let absents = 0;
      let lates = 0;
      let halfDays = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const status = (attendanceMap[userIdStr] && attendanceMap[userIdStr][d]) || '-';
        days[d] = status;
        if (status === 'Present') presents++;
        else if (status === 'Absent') absents++;
        else if (status === 'Late') lates++;
        else if (status === 'Half Day') halfDays++;
      }

      const totalDays = presents + absents + lates + halfDays;
      const attendancePercentage = totalDays > 0 ? Math.round(((presents + lates * 0.8 + halfDays * 0.5) / totalDays) * 100) : 100;

      return {
        student_id: student._id.toString(),
        name: student.user ? student.user.name : '',
        roll_number: student.roll_number,
        days,
        stats: { presents, absents, lates, halfDays, percentage: attendancePercentage }
      };
    });

    res.json({ daysInMonth, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating monthly report' });
  }
};

// Get detailed personal attendance history for the logged-in user or their child
exports.getMyAttendance = async (req, res) => {
  const { year, month, studentUserId } = req.query;
  const role = req.user.role;
  const loggedInUserId = req.user.id;

  let targetUserId = loggedInUserId;

  try {
    if (studentUserId) {
      if (role === 'parent') {
        const parent = await Parent.findOne({ user: loggedInUserId });
        const childRelation = await Student.findOne({
          user: studentUserId,
          parent: parent ? parent._id : null
        });

        if (!childRelation) {
          return res.status(403).json({ message: 'Access denied: Selected student is not your child' });
        }
        targetUserId = studentUserId;
      } else if (role === 'student') {
        if (studentUserId !== loggedInUserId) {
          return res.status(403).json({ message: 'Access denied: Students can only view their own attendance' });
        }
        targetUserId = loggedInUserId;
      } else if (['super_admin', 'school_admin', 'principal', 'vice_principal', 'teacher'].includes(role)) {
        targetUserId = studentUserId;
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : (new Date().getMonth() + 1);
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(targetYear, targetMonth - 1, daysInMonth, 23, 59, 59, 999));

    const records = await Attendance.find({
      user: targetUserId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Fetch stats for all time
    const total = await Attendance.countDocuments({ user: targetUserId });
    const presents = await Attendance.countDocuments({ user: targetUserId, status: 'Present' });
    const absents = await Attendance.countDocuments({ user: targetUserId, status: 'Absent' });
    const lates = await Attendance.countDocuments({ user: targetUserId, status: 'Late' });
    const halfDays = await Attendance.countDocuments({ user: targetUserId, status: 'Half Day' });

    const percentage = total > 0
      ? Math.round(((presents + lates * 0.8 + halfDays * 0.5) / total) * 100)
      : 100;

    res.json({
      userId: targetUserId,
      year: targetYear,
      month: targetMonth,
      daysInMonth,
      records: records.map(rec => ({
        date: rec.date,
        status: rec.status,
        remarks: rec.remarks || '',
        qr_code_used: !!rec.qr_code_used
      })),
      stats: {
        total,
        presents,
        absents,
        lates,
        halfDays,
        percentage
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching personal attendance: ' + err.message });
  }
};
