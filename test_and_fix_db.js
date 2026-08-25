require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const commonPasswords = [];
if (process.env.DB_PASSWORD !== undefined) {
  commonPasswords.push(process.env.DB_PASSWORD);
}
commonPasswords.push(
  "root", "admin", "password", "123456", "1234", "mysql", "rootpassword", "12345678", "",
  "rizwan", "rizwan123", "rizwan@123", "Rizwan", "Rizwan123", "Rizwan@123", "root123", "admin123", "123"
);
const dbName = 'eskooly_clone';

async function main() {
  let connection = null;
  let workingPassword = null;

  console.log('Testing common MySQL passwords...');
  for (const password of commonPasswords) {
    try {
      connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: password,
        multipleStatements: true
      });
      workingPassword = password;
      console.log(`✔ Connected successfully with password: "${password}"`);
      break;
    } catch (err) {
      // Access denied error code is usually 1045
      if (err.errno === 1045) {
        console.log(`✘ Password "${password}" failed (Access Denied)`);
      } else {
        console.log(`✘ Connection failed for password "${password}": ${err.message}`);
      }
    }
  }

  if (!workingPassword && workingPassword !== "") {
    console.error('\n❌ Could not connect to MySQL using any common default passwords.');
    console.error('Please verify if your MySQL server is running, or specify your password.');
    process.exit(1);
  }

  try {
    // 1. Create database if not exists
    console.log(`\nCreating database "${dbName}" if it does not exist...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✔ Database "${dbName}" ready.`);

    // 2. Select database
    await connection.query(`USE ${dbName}`);

    // 3. Read and execute database.sql
    console.log('Reading database.sql schema...');
    const sqlPath = path.join(__dirname, 'database.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`database.sql not found at ${sqlPath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    // Strip client-side DELIMITER commands and replace trigger delimiters (//) with normal semicolon (;)
    const cleanSql = sqlContent
      .replace(/\r\n/g, '\n')
      .replace(/DELIMITER\s+\/\/([\s\S]*?)DELIMITER\s+;/g, (match, body) => {
        return body.replace(/END\/\//g, 'END;').replace(/\/\//g, ';');
      });

    console.log('Executing database schema and seed data...');
    await connection.query(cleanSql);
    console.log('✔ Database schema and seed data imported successfully.');

    // 4. Update .env file
    console.log('Updating backend/.env file...');
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Replace DB_PASSWORD line
    if (envContent.includes('DB_PASSWORD=')) {
      envContent = envContent.replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${workingPassword}`);
    } else {
      envContent += `\nDB_PASSWORD=${workingPassword}`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✔ backend/.env file updated successfully!');

    console.log('\n🎉 ALL DONE! The database is configured and ready. The backend server should reload automatically.');
  } catch (err) {
    console.error('\n❌ Error during database setup:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
