require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME_AUTH || process.env.AUTH_DB_NAME || process.env.DB_NAME || 'elearning_auth',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
