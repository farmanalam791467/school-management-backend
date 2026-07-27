const db = require('../config/db');

// Get attendance for a class, section, and date
exports.getAttendance = async (req, res) => {
  const { classId, sectionId, date } = req.query;
  if (!classId || !sectionId || !date) {
    return res.status(400).json({ message: 'Class ID, Section ID, and Date are required' });
  }

  try {
    // Fetch all students in the class/section
    const [students] = await db.query(
      `SELECT s.id AS student_id, u.id AS user_id, u.name, s.roll_number 
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.class_id = ? AND s.section_id = ? AND s.status = "active"
       ORDER BY s.roll_number ASC`,
      [classId, sectionId]
    );

    // Fetch attendance for these students on the given date
    const [attendanceRecord] = await db.query(
      'SELECT user_id, status, remarks, qr_code_used FROM attendance WHERE date = ?',
      [date]
    );

    // Map attendance status to student list
    const attendanceMap = new Map(attendanceRecord.map(att => [att.user_id, att]));

    const studentsWithAttendance = students.map(student => {
      const record = attendanceMap.get(student.user_id);
      return {
        ...student,
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

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const item of attendanceList) {
      await conn.query(
        `INSERT INTO attendance (user_id, date, status, remarks, checked_by) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), checked_by = VALUES(checked_by)`,
        [item.user_id, date, item.status, item.remarks || '', req.user.id]
      );
    }

    await conn.commit();
    res.json({ message: 'Attendance saved successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error saving attendance' });
  } finally {
    conn.release();
  }
};

// QR Attendance Scan Check-in
exports.scanQRAttendance = async (req, res) => {
  const { userId } = req.body; // The QR code contains the user ID (e.g., student or teacher)
  const today = new Date().toISOString().slice(0, 10);

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Check if user exists and is active
    const [users] = await db.query('SELECT id, name, role FROM users WHERE id = ? AND status = "active"', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Active user not found' });
    }

    const user = users[0];

    // Mark attendance
    await db.query(
      `INSERT INTO attendance (user_id, date, status, remarks, qr_code_used, checked_by) 
       VALUES (?, ?, 'Present', 'QR Code Checked In', TRUE, ?)
       ON DUPLICATE KEY UPDATE status = 'Present', qr_code_used = TRUE`,
      [user.id, today, req.user.id]
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
    // Get number of days in the month
    const daysInMonth = new Date(year, month, 0).getDate();

    // Get all students
    const [students] = await db.query(
      `SELECT s.id AS student_id, u.id AS user_id, u.name, s.roll_number 
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.class_id = ? AND s.section_id = ? AND s.status = "active"
       ORDER BY s.roll_number ASC`,
      [classId, sectionId]
    );

    // Get all attendance for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

    const [records] = await db.query(
      `SELECT user_id, DAY(date) as day, status 
       FROM attendance 
       WHERE user_id IN (SELECT user_id FROM students WHERE class_id = ? AND section_id = ?)
       AND date BETWEEN ? AND ?`,
      [classId, sectionId, startDate, endDate]
    );

    // Group records by user_id
    const attendanceMap = {};
    records.forEach(rec => {
      if (!attendanceMap[rec.user_id]) {
        attendanceMap[rec.user_id] = {};
      }
      attendanceMap[rec.user_id][rec.day] = rec.status;
    });

    const report = students.map(student => {
      const days = {};
      let presents = 0;
      let absents = 0;
      let lates = 0;
      let halfDays = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const status = (attendanceMap[student.user_id] && attendanceMap[student.user_id][d]) || '-';
        days[d] = status;
        if (status === 'Present') presents++;
        else if (status === 'Absent') absents++;
        else if (status === 'Late') lates++;
        else if (status === 'Half Day') halfDays++;
      }

      const totalDays = presents + absents + lates + halfDays;
      const attendancePercentage = totalDays > 0 ? Math.round(((presents + lates*0.8 + halfDays*0.5) / totalDays) * 100) : 100;

      return {
        student_id: student.student_id,
        name: student.name,
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
    // If studentUserId is specified, check permission
    if (studentUserId) {
      const parsedStudentUserId = parseInt(studentUserId);
      if (role === 'parent') {
        // Verify child-parent relationship
        const [relation] = await db.query(
          `SELECT s.id 
           FROM students s 
           JOIN parents p ON s.parent_id = p.id 
           WHERE s.user_id = ? AND p.user_id = ?`,
          [parsedStudentUserId, loggedInUserId]
        );
        if (relation.length === 0) {
          return res.status(403).json({ message: 'Access denied: Selected student is not your child' });
        }
        targetUserId = parsedStudentUserId;
      } else if (role === 'student') {
        if (parsedStudentUserId !== loggedInUserId) {
          return res.status(403).json({ message: 'Access denied: Students can only view their own attendance' });
        }
        targetUserId = loggedInUserId;
      } else if (['super_admin', 'school_admin', 'principal', 'vice_principal', 'teacher'].includes(role)) {
        // Authorized roles can view any student's attendance
        targetUserId = parsedStudentUserId;
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : (new Date().getMonth() + 1);
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${daysInMonth}`;

    // Get attendance records for the target user in this date range
    const [records] = await db.query(
      `SELECT date, status, remarks, qr_code_used 
       FROM attendance 
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
      [targetUserId, startDate, endDate]
    );

    // Get overall stats for this user
    const [[allTimeStats]] = await db.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as presents,
         SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absents,
         SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as lates,
         SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) as half_days
       FROM attendance 
       WHERE user_id = ?`,
      [targetUserId]
    );

    // Calculate percentage
    const presents = parseInt(allTimeStats?.presents || 0);
    const absents = parseInt(allTimeStats?.absents || 0);
    const lates = parseInt(allTimeStats?.lates || 0);
    const halfDays = parseInt(allTimeStats?.half_days || 0);
    const total = parseInt(allTimeStats?.total || 0);

    const percentage = total > 0 
      ? Math.round(((presents + lates * 0.8 + halfDays * 0.5) / total) * 100)
      : 100;

    res.json({
      userId: targetUserId,
      year: targetYear,
      month: targetMonth,
      daysInMonth,
      records,
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
