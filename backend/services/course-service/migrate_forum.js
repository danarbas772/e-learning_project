const pool = require('./config/db');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        file_url VARCHAR(512),
        file_name VARCHAR(255),
        file_size BIGINT,
        author_id INT NOT NULL,
        author_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_course (course_id)
      )
    `);
    console.log('✅ Created announcements table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_id INT NOT NULL,
        session_id INT NULL,
        announcement_id INT NULL,
        user_id INT NOT NULL,
        user_name VARCHAR(255),
        user_role VARCHAR(50),
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_course_session (course_id, session_id),
        INDEX idx_course_announcement (course_id, announcement_id)
      )
    `);
    console.log('✅ Created comments table');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
