const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
const pool = require('../config/db');
const USER_DB = process.env.DB_NAME_USER || 'elearning_users';

(async () => {
  try {
    const instructorId = 13;
    const [courses] = await pool.query('SELECT * FROM courses WHERE instructor_id = ?', [instructorId]);
    const courseIds = courses.map(c => c.id);
    const [rules] = await pool.query('SELECT course_id, user_id, full_name, nim_nip, academic_year, rule_type FROM course_access_rules WHERE course_id IN (?)', [courseIds]);
    const [students] = await pool.query(`SELECT user_id, full_name, nim_nip, academic_year, semester FROM ${USER_DB}.profiles WHERE role = 'student'`);

    console.log('Course IDs:', courseIds);
    console.log('Total rules:', rules.length);
    console.log('Students in database:', students.map(s => ({ id: s.user_id, name: s.full_name, year: s.academic_year })));

    const allAllowedStudentIds = new Set();

    for (const course of courses) {
      const cRules = rules.filter(r => r.course_id === course.id);
      const courseStudentIds = new Set();
      console.log(`Course ${course.id} (${course.title}) rules:`, cRules.length);

      if (cRules.length === 0) {
        course.enrolled_count = 0;
      } else {
        students.forEach(st => {
          const hasAccess = cRules.some(rule => {
            if (rule.user_id && Number(rule.user_id) === Number(st.user_id)) return true;
            if (rule.rule_type === 'year' && rule.academic_year && st.academic_year && String(rule.academic_year).trim() === String(st.academic_year).trim()) return true;
            if ((rule.rule_type === 'name' || rule.rule_type === 'student') && !rule.user_id && rule.full_name && st.full_name) {
              const rName = rule.full_name.toLowerCase().trim();
              const uName = st.full_name.toLowerCase().trim();
              if (rName === uName || rName.includes(uName)) return true;
            }
            return false;
          });

          if (hasAccess) {
            courseStudentIds.add(st.user_id);
            allAllowedStudentIds.add(st.user_id);
          }
        });
        course.enrolled_count = courseStudentIds.size;
      }

      console.log(`Course ${course.title} enrolled_count:`, course.enrolled_count);
    }

    console.log('Total unique students taught:', allAllowedStudentIds.size, 'IDs:', Array.from(allAllowedStudentIds));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
