const pool = require('../services/course-service/config/db');

async function runAutoMigration() {
  try {
    console.log('🔄 Checking database schema migrations...');

    const migrations = [
      // 1. sections: attendance_active & attendance_open
      {
        table: 'sections',
        column: 'attendance_active',
        sql: 'ALTER TABLE sections ADD COLUMN attendance_active BOOLEAN DEFAULT FALSE',
      },
      {
        table: 'sections',
        column: 'attendance_open',
        sql: 'ALTER TABLE sections ADD COLUMN attendance_open BOOLEAN DEFAULT FALSE',
      },
      {
        table: 'sections',
        column: 'attendance_started_at',
        sql: 'ALTER TABLE sections ADD COLUMN attendance_started_at TIMESTAMP NULL',
      },

      // 2. attendance: student_name & student_nim
      {
        table: 'attendance',
        column: 'student_name',
        sql: 'ALTER TABLE attendance ADD COLUMN student_name VARCHAR(255) NULL',
      },
      {
        table: 'attendance',
        column: 'student_nim',
        sql: 'ALTER TABLE attendance ADD COLUMN student_nim VARCHAR(50) NULL',
      },

      // 3. announcements: author_id, author_name, file_size, created_by nullable
      {
        table: 'announcements',
        column: 'author_id',
        sql: 'ALTER TABLE announcements ADD COLUMN author_id INT NULL',
      },
      {
        table: 'announcements',
        column: 'author_name',
        sql: 'ALTER TABLE announcements ADD COLUMN author_name VARCHAR(255) NULL',
      },
      {
        table: 'announcements',
        column: 'file_size',
        sql: 'ALTER TABLE announcements ADD COLUMN file_size BIGINT NULL',
      },
      {
        table: 'announcements',
        column: 'created_by',
        sql: 'ALTER TABLE announcements ADD COLUMN created_by INT NULL',
      },

      // 4. comments: announcement_id & user_role
      {
        table: 'comments',
        column: 'announcement_id',
        sql: 'ALTER TABLE comments ADD COLUMN announcement_id INT NULL',
      },
      {
        table: 'comments',
        column: 'user_role',
        sql: "ALTER TABLE comments ADD COLUMN user_role VARCHAR(50) DEFAULT 'student'",
      },

      // 5. quizzes: quiz_type, start_time, end_time
      {
        table: 'quizzes',
        column: 'quiz_type',
        sql: "ALTER TABLE quizzes ADD COLUMN quiz_type VARCHAR(50) DEFAULT 'multiple_choice'",
      },
      {
        table: 'quizzes',
        column: 'start_time',
        sql: 'ALTER TABLE quizzes ADD COLUMN start_time DATETIME NULL',
      },
      {
        table: 'quizzes',
        column: 'end_time',
        sql: 'ALTER TABLE quizzes ADD COLUMN end_time DATETIME NULL',
      },
    ];

    for (const item of migrations) {
      try {
        const [cols] = await pool.query(
          `SHOW COLUMNS FROM \`${item.table}\` LIKE ?`,
          [item.column]
        );
        if (cols.length === 0) {
          await pool.query(item.sql);
          console.log(`✅ [Migration] Added column ${item.table}.${item.column}`);
        }
      } catch (colErr) {
        // Table might not exist yet or specific DB permission
        if (colErr.code !== 'ER_NO_SUCH_TABLE') {
          console.warn(`⚠️ [Migration] Error checking ${item.table}.${item.column}:`, colErr.message);
        }
      }
    }

    // Sync attendance_active with attendance_open if both exist
    try {
      await pool.query('UPDATE sections SET attendance_active = attendance_open WHERE attendance_active = 0 AND attendance_open = 1');
    } catch (e) {}

    // Make created_by in announcements nullable if it exists
    try {
      await pool.query('ALTER TABLE announcements MODIFY COLUMN created_by INT NULL');
    } catch (e) {}

    // Ensure questions question_type enum includes 'essay'
    try {
      await pool.query(
        "ALTER TABLE questions MODIFY COLUMN question_type ENUM('multiple_choice', 'true_false', 'short_answer', 'essay') DEFAULT 'multiple_choice'"
      );
    } catch (e) {}

    console.log('✅ Database schema check & auto-migration completed.');
  } catch (err) {
    console.warn('⚠️ Auto-migration skipped or encountered error:', err.message);
  }
}

module.exports = { runAutoMigration };
