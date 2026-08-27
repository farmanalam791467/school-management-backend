require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'eskooly_clone';
  const useSSL = process.env.DB_SSL === 'true';

  console.log(`Connecting to database at ${dbHost}:${dbPort}...`);
  console.log(`User: ${dbUser}, Database: ${dbName}, SSL: ${useSSL}`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      multipleStatements: true,
      ssl: useSSL ? { rejectUnauthorized: false } : undefined
    });
    console.log('✔ Successfully connected to MySQL database.');
  } catch (err) {
    console.error('❌ Failed to connect to MySQL database:', err.message);
    console.error('\nPlease double check your env variables in backend/.env:');
    console.error(`DB_HOST=${dbHost}`);
    console.error(`DB_PORT=${dbPort}`);
    console.error(`DB_USER=${dbUser}`);
    console.error(`DB_NAME=${dbName}`);
    console.error(`DB_SSL=${useSSL}`);
    process.exit(1);
  }

  try {
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
    // We run it as a single query since multipleStatements is true
    await connection.query(cleanSql);
    console.log('✔ Database schema and seed data imported successfully!');
    console.log('\n🎉 Setup completed successfully. Your remote database is ready!');
  } catch (err) {
    console.error('❌ Error during database schema import:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
