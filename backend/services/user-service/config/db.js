require('dotenv').config();
const mysql = require('mysql2/promise');

// Pool untuk database profil user
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'elearning_users',
  waitForConnections: true,
  connectionLimit: 10,
});

// Pool untuk database auth (untuk registrasi bulk dari Excel)
const authPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.AUTH_DB_NAME || 'elearning_auth',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = { pool, authPool };
