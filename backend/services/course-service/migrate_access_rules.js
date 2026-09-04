const mysql = require('mysql2/promise');
require('dotenv').config();

const sql = `
CREATE TABLE IF NOT EXISTS course_access_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  academic_year VARCHAR(10) NOT NULL,
  semester INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course_access (course_id)
);
`;

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'elearning_courses'
  });
  await conn.execute(sql);
  console.log('Migration success: course_access_rules table created');
  await conn.end();
}

migrate().catch(err => { console.error('Migration error:', err.message); process.exit(1); });
