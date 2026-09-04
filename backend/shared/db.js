// backend/shared/db.js
// Utility untuk koneksi MySQL - dipakai oleh semua service
const mysql = require('mysql2/promise');

/**
 * Membuat pool koneksi MySQL
 * @param {string} database - nama database/schema
 */
function createPool(database) {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

module.exports = { createPool };
