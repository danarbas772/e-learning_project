require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME_COURSE || process.env.COURSE_DB_NAME || process.env.DB_NAME || 'elearning_courses',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
