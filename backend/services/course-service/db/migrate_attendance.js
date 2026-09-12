const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('../config/db');

async function migrate() {
  try {
    // 1. Tambahkan kolom attendance_active pada tabel sections jika belum ada
    const [cols] = await pool.query('SHOW COLUMNS FROM sections LIKE "attendance_active"');
    if (cols.length === 0) {
      await pool.query('ALTER TABLE sections ADD COLUMN attendance_active BOOLEAN DEFAULT FALSE');
      console.log('✅ Added column attendance_active to sections table');
    } else {
      console.log('ℹ️ Column attendance_active already exists in sections');
    }

    // 2. Buat tabel attendance
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        section_id INT NOT NULL,
        course_id INT NOT NULL,
        student_id INT NOT NULL,
        student_name VARCHAR(255),
        student_nim VARCHAR(50),
        attended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_section_student (section_id, student_id),
        INDEX idx_section (section_id),
        INDEX idx_course (course_id),
        INDEX idx_student (student_id),
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ attendance table verified/created successfully');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

migrate();
