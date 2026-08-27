const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eskooly_clone',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Test the connection and auto-initialize if empty
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const dbUser = process.env.DB_USER || 'root';
const dbName = process.env.DB_NAME || 'eskooly_clone';
const useSSL = process.env.DB_SSL === 'true';

console.log(`Database Connection attempt: host=${dbHost}, port=${dbPort}, user=${dbUser}, database=${dbName}, ssl=${useSSL}`);

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL database:');
    console.error(err);
  } else {
    console.log('Connected to MySQL database.');
    
    // Check if the 'users' table exists. If not, auto-import the database.sql schema
    connection.query("SHOW TABLES LIKE 'users'", (tablesErr, results) => {
      if (tablesErr) {
        console.error('Error checking for existing tables:', tablesErr);
        connection.release();
        return;
      }
      
      if (results.length === 0) {
        console.log('Database tables not found. Auto-initializing database schema from database.sql...');
        const sqlPath = path.join(__dirname, '..', 'database.sql');
        if (fs.existsSync(sqlPath)) {
          try {
            const sqlContent = fs.readFileSync(sqlPath, 'utf8');
            const cleanSql = sqlContent
              .replace(/\r\n/g, '\n')
              .replace(/DELIMITER\s+\/\/([\s\S]*?)DELIMITER\s+;/g, (match, body) => {
                return body.replace(/END\/\//g, 'END;').replace(/\/\//g, ';');
              });
              
            connection.query(cleanSql, (queryErr) => {
              if (queryErr) {
                console.error('❌ Error executing database.sql schema:', queryErr);
              } else {
                console.log('✔ Database schema and seed data auto-imported successfully!');
              }
              connection.release();
            });
          } catch (readErr) {
            console.error('Error reading database.sql:', readErr);
            connection.release();
          }
        } else {
          console.error(`database.sql not found at ${sqlPath}`);
          connection.release();
        }
      } else {
        console.log('Database tables already initialized. Skipping auto-import.');
        connection.release();
      }
    });
  }
});

module.exports = pool.promise();

