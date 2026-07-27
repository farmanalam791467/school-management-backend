const mysql = require('mysql2/promise');

async function test() {
  const c = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Farman@123456',
    database: 'eskooly_clone'
  });
  
  try {
    const studentUserId = 7; // student@eskooly.com
    const query = `
      SELECT DISTINCT u.id, u.name, u.role, u.email, u.phone, u.avatar 
      FROM users u
      JOIN class_subjects cs ON cs.teacher_id = u.id
      JOIN students s ON s.class_id = cs.class_id AND s.section_id = cs.section_id
      WHERE s.user_id = ? AND u.status = "active"
    `;
    const [rows] = await c.query(query, [studentUserId]);
    console.log('Student Contacts:', rows);
    
    // Also test a regular user query (e.g. teacher id = 5)
    const [allUsers] = await c.query('SELECT id, name, role FROM users WHERE id != ? AND status = "active"', [5]);
    console.log('Teacher (id=5) Contacts Count:', allUsers.length);
  } catch (err) {
    console.error(err);
  } finally {
    await c.end();
  }
}

test();
