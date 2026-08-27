const mysql = require('mysql2');
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
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Test the connection
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
    connection.release();
  }
});

module.exports = pool.promise();
