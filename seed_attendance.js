const db = require('./config/db');

async function seed() {
  console.log('Seeding attendance records for July 2026...');

  const studentUserId = 7; // Bob Johnson (Student)
  const teacherUserId = 5; // John Doe (Teacher)
  const targetYear = 2026;
  const targetMonth = 7; // July

  const daysInMonth = 23; // Seed up to yesterday July 23

  const statuses = ['Present', 'Present', 'Present', 'Present', 'Late', 'Present', 'Absent', 'Half Day', 'Present', 'Present'];

  try {
    // Clear existing attendance for these users in July 2026
    await db.query(
      `DELETE FROM attendance WHERE user_id IN (?, ?) AND date BETWEEN ? AND ?`,
      [studentUserId, teacherUserId, '2026-07-01', '2026-07-31']
    );
    console.log('Cleared existing July 2026 attendance records.');

    let seededCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${targetYear}-07-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(targetYear, targetMonth - 1, day);
      const dayOfWeek = dateObj.getDay();

      // Skip Sundays (0) and Saturdays (6)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      // Determine statuses
      // Student status
      const studentStatus = statuses[seededCount % statuses.length];
      const studentRemarks = studentStatus === 'Present' 
        ? 'Regular check-in' 
        : studentStatus === 'Late' 
          ? 'Late arrival due to transit' 
          : studentStatus === 'Half Day' 
            ? 'Dental appointment' 
            : 'Unexcused absence';

      // Teacher status
      const teacherStatus = day % 12 === 0 ? 'Absent' : day % 7 === 0 ? 'Late' : 'Present';
      const teacherRemarks = teacherStatus === 'Present' ? 'Checked in at gate' : teacherStatus === 'Late' ? 'Heavy traffic' : 'Sick leave';

      // Insert Student Attendance
      await db.query(
        `INSERT INTO attendance (user_id, date, status, remarks, checked_by, qr_code_used) 
         VALUES (?, ?, ?, ?, 2, ?)`,
        [studentUserId, dateString, studentStatus, studentRemarks, Math.random() > 0.5]
      );

      // Insert Teacher Attendance
      await db.query(
        `INSERT INTO attendance (user_id, date, status, remarks, checked_by, qr_code_used) 
         VALUES (?, ?, ?, ?, 2, ?)`,
        [teacherUserId, dateString, teacherStatus, teacherRemarks, false]
      );

      seededCount++;
    }

    console.log(`Successfully seeded ${seededCount} days of attendance for Student (ID 7) and Teacher (ID 5).`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding attendance:', err.message);
    process.exit(1);
  }
}

// Wait database connection to establish
setTimeout(seed, 1000);
