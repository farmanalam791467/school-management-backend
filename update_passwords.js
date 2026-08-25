const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Farman@123456',
      database: 'eskooly_clone'
    });

    console.log('Generating bcrypt hash for "admin123"...');
    const hash = await bcrypt.hash('admin123', 10);
    console.log(`Generated Hash: ${hash}`);

    console.log('Updating all user passwords to the correct hash...');
    await conn.query('UPDATE users SET password = ?', [hash]);
    
    console.log('Checking updated passwords...');
    const [rows] = await conn.query('SELECT id, email, password FROM users LIMIT 3');
    console.log('Sample updated users:', rows);

    await conn.end();
    console.log('✔ Passwords updated successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
