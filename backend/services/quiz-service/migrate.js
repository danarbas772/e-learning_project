const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'elearning_quizzes'
    });
    console.log('Connected to elearning_quizzes');

    const [cols] = await conn.query('SHOW COLUMNS FROM quizzes');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('start_time')) {
      await conn.query('ALTER TABLE quizzes ADD COLUMN start_time DATETIME NULL AFTER passing_score');
      console.log('Added start_time to quizzes');
    }
    if (!colNames.includes('end_time')) {
      await conn.query('ALTER TABLE quizzes ADD COLUMN end_time DATETIME NULL AFTER start_time');
      console.log('Added end_time to quizzes');
    }
    if (!colNames.includes('quiz_type')) {
      await conn.query("ALTER TABLE quizzes ADD COLUMN quiz_type ENUM('multiple_choice', 'essay', 'mixed') DEFAULT 'multiple_choice' AFTER end_time");
      console.log('Added quiz_type to quizzes');
    }

    await conn.query("ALTER TABLE questions MODIFY COLUMN question_type VARCHAR(32) DEFAULT 'multiple_choice'");
    console.log('Modified question_type to VARCHAR(32)');

    console.log('Quiz DB Migration success!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
