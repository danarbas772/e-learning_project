const pool = require('./config/db');

async function updateCourses() {
  try {
    await pool.query(`
      UPDATE courses 
      SET 
        course_code = CASE 
          WHEN id = 1 THEN 'IF-301'
          WHEN id = 2 THEN 'DS-202'
          WHEN id = 3 THEN 'AI-401'
          ELSE CONCAT('MK-0', id)
        END,
        department = CASE 
          WHEN id = 1 THEN 'Teknik Informatika'
          WHEN id = 2 THEN 'Sains Data'
          WHEN id = 3 THEN 'Sistem Informasi'
          ELSE 'Teknik Informatika'
        END
    `);
    console.log('✅ Updated existing courses');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updateCourses();
