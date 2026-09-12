const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const USER_DB = process.env.DB_NAME_USER || process.env.USER_DB_NAME || process.env.DB_NAME || 'elearning_users';

// ─── COURSES ──────────────────────────────────────────────────────────────────

async function getAllCourses(req, res) {
  const {
    category, department, level, search, semester, sks, instructor_id, status, all_status,
    user_name, user_academic_year, user_semester, user_role, user_id
  } = req.query;

  let query = 'SELECT * FROM courses WHERE 1=1';
  const params = [];

  if (status === 'active') {
    query += ' AND is_published = TRUE';
  } else if (status === 'inactive') {
    query += ' AND is_published = FALSE';
  } else if (all_status !== 'true') {
    // Default untuk mahasiswa: hanya yang aktif
    query += ' AND is_published = TRUE';
  }

  if (department) { query += ' AND (department = ? OR category = ?)'; params.push(department, department); }
  else if (category) { query += ' AND (category = ? OR department = ?)'; params.push(category, category); }

  if (semester) { query += ' AND semester = ?'; params.push(semester); }
  if (sks) { query += ' AND sks = ?'; params.push(sks); }
  if (level) { query += ' AND level = ?'; params.push(level); }
  if (instructor_id) { query += ' AND instructor_id = ?'; params.push(instructor_id); }
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ? OR course_code LIKE ? OR department LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Filter akses berdasarkan role (admin melihat semua):
  // (A) Role Instructor (Dosen): HANYA dapat melihat mata kuliah miliknya sendiri (sesuai dosen pengampu yang dipilih)
  // (B) Role Student (Mahasiswa):
  //     (1) Matkul tanpa aturan akses (publik) → bisa diakses mahasiswa aktif
  //     (2) Matkul dengan aturan akses → hanya mahasiswa yang cocok (ID, Angkatan, atau Nama)
  if (user_role === 'instructor') {
    let currentUserId = user_id;
    if (!currentUserId && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'elearning_secret_key_2024');
        currentUserId = decoded.id;
      } catch (e) { }
    }
    const instructorId = currentUserId ? parseInt(currentUserId, 10) : -1;
    query += ' AND instructor_id = ?';
    params.push(instructorId);
  } else if (user_role === 'student') {
    let currentUserId = user_id;
    if (!currentUserId && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'elearning_secret_key_2024');
        currentUserId = decoded.id;
      } catch (e) { }
    }

    const sId = currentUserId ? parseInt(currentUserId, 10) : -1;
    const sYear = user_academic_year ? String(user_academic_year).trim() : '';
    const sName = user_name ? String(user_name).trim() : '';

    // Jika matkul tidak memiliki aturan akses sama sekali, mahasiswa tidak diberi akses (harus diberi izin spesifik)
    query += ` AND EXISTS (
      SELECT 1 FROM course_access_rules
      WHERE course_id = courses.id
        AND (
          (user_id IS NOT NULL AND user_id = ?)
          OR (rule_type = 'year' AND ? != '' AND academic_year = ?)
          OR (rule_type IN ('name', 'student') AND user_id IS NULL AND ? != '' AND (
            LOWER(full_name) = LOWER(?)
            OR LOWER(full_name) LIKE CONCAT('%', LOWER(?), '%')
          ))
        )
    )`;
    params.push(
      sId,
      sYear, sYear,
      sName, sName, sName
    );
  }

  query += ' ORDER BY created_at DESC';

  try {
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    console.error('Get all courses error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function getAdminCourseStats(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as total_courses,
        COALESCE(SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END), 0) as active_courses,
        COALESCE(SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END), 0) as inactive_courses
      FROM courses
    `);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Course admin stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function getMyCourses(req, res) {
  // Untuk instructor: lihat semua kursus yang dibuat/diampu
  const instructorId = req.user.id;
  try {
    const [courses] = await pool.query(
      'SELECT * FROM courses WHERE instructor_id = ? ORDER BY created_at DESC',
      [instructorId]
    );

    if (courses.length === 0) {
      return res.json({ success: true, data: [], total_students: 0 });
    }

    const courseIds = courses.map(c => c.id);

    // Ambil seluruh aturan akses untuk mata kuliah dosen ini
    const [rules] = await pool.query(
      'SELECT course_id, user_id, full_name, nim_nip, academic_year, rule_type FROM course_access_rules WHERE course_id IN (?)',
      [courseIds]
    );

    // Ambil seluruh data profil mahasiswa terdaftar
    let students = [];
    try {
      const [stuRows] = await pool.query(
        `SELECT user_id, full_name, nim_nip, academic_year, semester 
         FROM ${USER_DB}.profiles 
         WHERE role = 'student'`
      );
      students = stuRows;
    } catch (e) {
      console.warn('Could not query profiles from USER_DB:', e.message);
    }

    // Set mahasiswa unik yang diajarkan oleh dosen ini di seluruh matkulnya
    const allAllowedStudentIds = new Set();

    for (const course of courses) {
      const cRules = rules.filter(r => r.course_id === course.id);
      const courseStudentIds = new Set();

      if (cRules.length === 0) {
        // Jika belum ada akses sama sekali, mahasiswa tidak diberi akses (0 mahasiswa)
        course.enrolled_count = 0;
      } else {
        students.forEach(st => {
          const hasAccess = cRules.some(rule => {
            if (rule.user_id && Number(rule.user_id) === Number(st.user_id)) return true;
            if (rule.rule_type === 'year' && rule.academic_year && st.academic_year &&
              String(rule.academic_year).trim() === String(st.academic_year).trim()) return true;
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
    }

    res.json({
      success: true,
      data: courses,
      total_students: allAllowedStudentIds.size,
    });
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Helper: convert title to URL slug
function toSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function getCourseById(req, res) {
  const { id } = req.params;
  const { user_role, user_name, user_academic_year, user_semester, user_id } = req.query;

  let studentUserId = user_id;
  if (!studentUserId && req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'elearning_secret_key_2024');
      studentUserId = decoded.id;
    } catch (e) { }
  }

  try {
    let courses;
    // Jika param berupa angka, cari by ID; jika slug, cari by slug dari title
    if (/^\d+$/.test(id)) {
      [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    } else {
      // Slug lookup: ambil semua lalu cocokkan slug dari title
      const [allCourses] = await pool.query('SELECT * FROM courses');
      courses = allCourses.filter(c => toSlug(c.title || '') === id);
    }
    if (!courses || courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Mata kuliah tidak ditemukan' });
    }

    // Jika mata kuliah dinonaktifkan, mahasiswa tidak dapat mengaksesnya
    if (user_role === 'student' && (!courses[0].is_published || courses[0].is_published === 0)) {
      return res.status(403).json({
        success: false,
        message: 'Mata kuliah ini sedang dinonaktifkan sehingga tidak dapat diakses oleh mahasiswa.'
      });
    }

    // Cek hak akses untuk Dosen (instructor)
    if (user_role === 'instructor') {
      const isAssignedInstructor = Number(courses[0].instructor_id) === Number(studentUserId);
      if (!isAssignedInstructor) {
        return res.status(403).json({
          success: false,
          message: 'Anda bukan dosen pengampu untuk mata kuliah ini. Akses dibatasi.'
        });
      }
    }

    // Gunakan ID numerik DB (bukan slug)
    const courseId = courses[0].id;

    // Cek aturan akses jika mahasiswa (student)
    if (user_role === 'student') {
      const [rules] = await pool.query('SELECT * FROM course_access_rules WHERE course_id = ?', [courseId]);
      // Jika mata kuliah belum memiliki aturan akses sama sekali, mahasiswa tidak diberi akses
      if (rules.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Mata kuliah ini belum dibuka atau belum diberikan izin akses untuk mahasiswa.'
        });
      }

      const hasAccess = rules.some((rule) => {
        // 1. Cocokkan ID user mahasiswa
        if (rule.user_id && studentUserId && Number(rule.user_id) === Number(studentUserId)) return true;
        // 2. Cocokkan Angkatan (hanya rule_type = 'year')
        if (rule.rule_type === 'year' && rule.academic_year && user_academic_year &&
          String(rule.academic_year).trim() === String(user_academic_year).trim()) return true;
        // 3. Cocokkan Nama (hanya rule_type = 'name' atau 'student' tanpa user_id)
        if ((rule.rule_type === 'name' || rule.rule_type === 'student') && !rule.user_id && user_name && rule.full_name) {
          const rName = rule.full_name.toLowerCase().trim();
          const uName = user_name.toLowerCase().trim();
          if (rName === uName || rName.includes(uName)) return true;
        }
        return false;
      });

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Mata kuliah ini memiliki akses terbatas. Akun Anda belum terdaftar untuk mengakses mata kuliah ini.'
        });
      }
    }


    // Ambil sections & materials
    let [sections] = await pool.query(
      'SELECT * FROM sections WHERE course_id = ? ORDER BY order_index ASC',
      [courseId]
    );

    // Jika sections belum ada, auto buatkan berdasarkan total_sessions mata kuliah
    if (sections.length === 0) {
      const sessionCount = parseInt(courses[0].total_sessions, 10) || 16;
      for (let i = 1; i <= sessionCount; i++) {
        await pool.query(
          'INSERT INTO sections (course_id, title, order_index) VALUES (?, ?, ?)',
          [courseId, `PERTEMUAN ${toRoman(i)}`, i]
        );
      }
      const [newSections] = await pool.query(
        'SELECT * FROM sections WHERE course_id = ? ORDER BY order_index ASC',
        [courseId]
      );
      sections = newSections;
    }

    // Jika user adalah student, ambil daftar section_id yang sudah ia hadiri
    let attendedSectionIds = [];
    if (studentUserId) {
      const [attendedRows] = await pool.query(
        'SELECT section_id FROM attendance WHERE course_id = ? AND student_id = ?',
        [courseId, studentUserId]
      );
      attendedSectionIds = attendedRows.map((r) => r.section_id);
    }

    for (const section of sections) {
      const [materials] = await pool.query(
        'SELECT id, title, description, material_type, file_url, file_name, file_size, external_url, content, order_index, is_downloadable, created_at FROM materials WHERE section_id = ? ORDER BY order_index ASC',
        [section.id]
      );
      section.materials = materials;
      section.has_attended = attendedSectionIds.includes(section.id);
    }

    const course = { ...courses[0], sections, attended_section_ids: attendedSectionIds };
    res.json({ success: true, data: course });
  } catch (err) {
    console.error('Get course by ID error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function createCourse(req, res) {
  const {
    title, course_code, description, category, department, level, is_free, price,
    curriculum, semester, sks, total_sessions, is_published,
    instructor_id, instructor_name
  } = req.body;

  // Jika admin membuat matkul dan memilih dosen, gunakan ID & nama dosen tsb
  const finalInstructorId = (req.user.role === 'admin' && instructor_id) ? instructor_id : req.user.id;
  const finalInstructorName = instructor_name || (req.user.role === 'instructor' ? req.user.email : 'Dosen Pengampu');

  if (!title) {
    return res.status(400).json({ success: false, message: 'Nama mata kuliah wajib diisi' });
  }

  const finalIsPublished = is_published !== undefined ? Boolean(is_published) : true;
  const finalDepartment = department || category || 'Teknik Informatika';
  const finalCourseCode = course_code || curriculum || 'MK-01';

  try {
    const [result] = await pool.query(
      `INSERT INTO courses 
        (title, course_code, description, instructor_id, instructor_name, category, department, level, is_free, price, curriculum, semester, sks, total_sessions, is_published) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        finalCourseCode,
        description || '',
        finalInstructorId,
        finalInstructorName,
        finalDepartment,
        finalDepartment,
        level || 'beginner',
        is_free !== false,
        price || 0,
        finalCourseCode,
        semester || 1,
        sks || 3,
        total_sessions || 16,
        finalIsPublished,
      ]
    );

    const newCourseId = result.insertId;
    const sessionCount = parseInt(total_sessions, 10) || 16;
    for (let i = 1; i <= sessionCount; i++) {
      await pool.query(
        'INSERT INTO sections (course_id, title, order_index) VALUES (?, ?, ?)',
        [newCourseId, `PERTEMUAN ${toRoman(i)}`, i]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Mata kuliah berhasil dibuat',
      data: { id: newCourseId, title, instructor_id: finalInstructorId, instructor_name: finalInstructorName },
    });
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

function toRoman(num) {
  const romanMap = [
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let res = '';
  for (const [val, letter] of romanMap) {
    while (num >= val) {
      res += letter;
      num -= val;
    }
  }
  return res || num.toString();
}

async function updateCourse(req, res) {
  const { id } = req.params;
  const {
    title, course_code, description, category, department, level, is_free, price,
    curriculum, semester, sks, total_sessions, is_published,
    instructor_id, instructor_name
  } = req.body;
  const currentUserId = req.user.id;

  try {
    const [course] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    if (course.length === 0) return res.status(404).json({ success: false, message: 'Mata kuliah tidak ditemukan' });

    // Pastikan hanya instructor pemilik atau admin yang bisa edit
    if (req.user.role !== 'admin' && course[0].instructor_id !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses untuk mengedit mata kuliah ini' });
    }

    const finalInstructorId = (req.user.role === 'admin' && instructor_id) ? instructor_id : course[0].instructor_id;
    const finalInstructorName = instructor_name !== undefined ? instructor_name : course[0].instructor_name;
    const finalDept = department !== undefined ? department : (category !== undefined ? category : course[0].department);
    const finalCode = course_code !== undefined ? course_code : (curriculum !== undefined ? curriculum : course[0].course_code);

    await pool.query(
      `UPDATE courses SET 
        title = COALESCE(?, title),
        course_code = COALESCE(?, course_code),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        department = COALESCE(?, department),
        level = COALESCE(?, level),
        is_free = COALESCE(?, is_free),
        price = COALESCE(?, price),
        curriculum = COALESCE(?, curriculum),
        semester = COALESCE(?, semester),
        sks = COALESCE(?, sks),
        total_sessions = COALESCE(?, total_sessions),
        is_published = COALESCE(?, is_published),
        instructor_id = ?,
        instructor_name = ?
      WHERE id = ?`,
      [
        title, finalCode, description, finalDept, finalDept, level, is_free, price,
        finalCode, semester, sks, total_sessions, is_published,
        finalInstructorId, finalInstructorName, id
      ]
    );
    res.json({ success: true, message: 'Mata kuliah berhasil diperbarui' });
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

async function deleteCourse(req, res) {
  const { id } = req.params;
  const currentUserId = req.user.id;

  try {
    const [course] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    if (course.length === 0) return res.status(404).json({ success: false, message: 'Mata kuliah tidak ditemukan' });

    if (req.user.role !== 'admin' && course[0].instructor_id !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses' });
    }

    await pool.query('DELETE FROM courses WHERE id = ?', [id]);
    res.json({ success: true, message: 'Mata kuliah berhasil dihapus' });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

async function createSection(req, res) {
  const { course_id, title, order_index = 0 } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO sections (course_id, title, order_index) VALUES (?, ?, ?)',
      [course_id, title, order_index]
    );
    res.status(201).json({ success: true, message: 'Section berhasil dibuat', data: { id: result.insertId } });
  } catch (err) {
    console.error('Create section error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function updateSection(req, res) {
  const { id } = req.params;
  const { title, order_index } = req.body;
  try {
    await pool.query('UPDATE sections SET title = ?, order_index = ? WHERE id = ?', [title, order_index, id]);
    res.json({ success: true, message: 'Section berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function deleteSection(req, res) {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM sections WHERE id = ?', [id]);
    res.json({ success: true, message: 'Section berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── ATTENDANCE (PRESENSI) ───────────────────────────────────────────────────

// Toggle status presensi (Aktifkan / Nonaktifkan Presensi) oleh Dosen atau Admin
async function toggleAttendance(req, res) {
  const { id } = req.params; // section_id
  const { is_active } = req.body; // boolean opsional; jika undefined, toggle otomatis

  try {
    const [sections] = await pool.query('SELECT id, course_id, attendance_active FROM sections WHERE id = ?', [id]);
    if (sections.length === 0) {
      return res.status(404).json({ success: false, message: 'Pertemuan tidak ditemukan' });
    }

    const currentStatus = Boolean(sections[0].attendance_active);
    const newStatus = is_active !== undefined ? Boolean(is_active) : !currentStatus;

    await pool.query('UPDATE sections SET attendance_active = ? WHERE id = ?', [newStatus, id]);

    res.json({
      success: true,
      message: newStatus ? 'Presensi berhasil diaktifkan' : 'Presensi berhasil dinonaktifkan',
      data: {
        section_id: Number(id),
        attendance_active: newStatus,
      },
    });
  } catch (err) {
    console.error('Toggle attendance error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// Mahasiswa klik hadir 1x selamanya
async function submitAttendance(req, res) {
  const { id } = req.params; // section_id
  const studentId = req.user.id;
  const studentName = req.user.full_name || req.user.name || req.user.email || 'Mahasiswa';

  try {
    // 1. Cek apakah section ada dan attendance_active
    const [sections] = await pool.query('SELECT id, course_id, attendance_active, title FROM sections WHERE id = ?', [id]);
    if (sections.length === 0) {
      return res.status(404).json({ success: false, message: 'Pertemuan tidak ditemukan' });
    }

    const section = sections[0];
    if (!section.attendance_active) {
      return res.status(400).json({
        success: false,
        message: 'Presensi untuk pertemuan ini sedang dinonaktifkan atau belum dibuka oleh dosen pengampu.'
      });
    }

    // 2. Cek apakah sudah pernah hadir (klik 1x selamanya)
    const [existing] = await pool.query(
      'SELECT id, attended_at FROM attendance WHERE section_id = ? AND student_id = ?',
      [id, studentId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah mengisi presensi untuk pertemuan ini sebelumnya.',
        already_attended: true,
      });
    }

    // Ambil info nama lengkap & NIM dari profile jika ada
    let studentNim = null;
    let finalStudentName = studentName;
    try {
      const [userRows] = await pool.query(
        `SELECT full_name, nim_nip FROM ${USER_DB}.profiles WHERE user_id = ? LIMIT 1`,
        [studentId]
      );
      if (userRows.length > 0) {
        if (userRows[0].full_name) finalStudentName = userRows[0].full_name;
        if (userRows[0].nim_nip) studentNim = userRows[0].nim_nip;
      }
    } catch (e) {}

    // 3. Simpan ke database (UNIQUE constraint pada section_id + student_id menjamin integritas 1x)
    await pool.query(
      'INSERT INTO attendance (section_id, course_id, student_id, student_name, student_nim) VALUES (?, ?, ?, ?, ?)',
      [id, section.course_id, studentId, finalStudentName, studentNim]
    );

    res.status(201).json({
      success: true,
      message: 'Presensi berhasil dicatat. Anda terdata hadir.',
      data: {
        section_id: Number(id),
        attended: true,
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah mengisi presensi untuk pertemuan ini sebelumnya.',
        already_attended: true,
      });
    }
    console.error('Submit attendance error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// Get daftar hadir untuk keperluan database / dosen (internal)
async function getAttendance(req, res) {
  const { id } = req.params; // section_id
  try {
    const [rows] = await pool.query(
      'SELECT id, section_id, course_id, student_id, student_name, student_nim, attended_at FROM attendance WHERE section_id = ? ORDER BY attended_at ASC',
      [id]
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// Rekap lengkap presensi per mata kuliah untuk Halaman Presensi & Download Excel (Admin & Dosen)
async function getCourseAttendanceReport(req, res) {
  const { courseId } = req.params;
  const currentUserId = req.user.id;
  const currentUserRole = req.user.role;

  try {
    // 1. Ambil data mata kuliah
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Mata kuliah tidak ditemukan' });
    }

    const course = courses[0];

    // Jika dosen, pastikan hanya bisa membuka matkul miliknya
    if (currentUserRole === 'instructor' && Number(course.instructor_id) !== Number(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Anda bukan dosen pengampu untuk mata kuliah ini' });
    }

    // 2. Ambil seluruh sesi/pertemuan mata kuliah urut order_index
    const [sections] = await pool.query(
      'SELECT id, title, order_index, attendance_active, created_at FROM sections WHERE course_id = ? ORDER BY order_index ASC',
      [courseId]
    );

    // 3. Ambil daftar mahasiswa yang memiliki akses ke matkul ini
    const [rules] = await pool.query(
      'SELECT user_id, full_name, nim_nip, academic_year, rule_type FROM course_access_rules WHERE course_id = ?',
      [courseId]
    );

    let allStudents = [];
    try {
      const [stuRows] = await pool.query(
        `SELECT user_id, full_name, nim_nip, academic_year, semester 
         FROM ${USER_DB}.profiles 
         WHERE role = 'student' 
         ORDER BY full_name ASC`
      );
      allStudents = stuRows;
    } catch (e) {}

    // Saring mahasiswa yang diberi akses ke matkul ini
    let allowedStudents = [];
    if (rules.length > 0) {
      allowedStudents = allStudents.filter((st) => {
        return rules.some((r) => {
          if (r.user_id && Number(r.user_id) === Number(st.user_id)) return true;
          if (r.rule_type === 'year' && r.academic_year && st.academic_year &&
            String(r.academic_year).trim() === String(st.academic_year).trim()) return true;
          if ((r.rule_type === 'name' || r.rule_type === 'student') && !r.user_id && r.full_name && st.full_name) {
            const rName = r.full_name.toLowerCase().trim();
            const uName = st.full_name.toLowerCase().trim();
            if (rName === uName || rName.includes(uName)) return true;
          }
          return false;
        });
      });
    }

    // 4. Ambil seluruh log presensi kehadiran untuk matkul ini
    const [attendanceRows] = await pool.query(
      'SELECT id, section_id, student_id, student_name, student_nim, attended_at FROM attendance WHERE course_id = ?',
      [courseId]
    );

    // Buat map: { `${student_id}_${section_id}`: attended_at }
    const attendanceMap = {};
    attendanceRows.forEach((att) => {
      attendanceMap[`${att.student_id}_${att.section_id}`] = att.attended_at;
    });

    // Jika ada mahasiswa yang tercatat hadir di database tapi belum masuk allowedStudents (misal record lama), sertakan juga
    const existingStudentIds = new Set(allowedStudents.map((s) => s.user_id));
    attendanceRows.forEach((att) => {
      if (!existingStudentIds.has(att.student_id)) {
        existingStudentIds.add(att.student_id);
        allowedStudents.push({
          user_id: att.student_id,
          full_name: att.student_name || `Mahasiswa #${att.student_id}`,
          nim_nip: att.student_nim || '-',
          academic_year: '-',
          semester: '-',
        });
      }
    });

    // Urutkan mahasiswa berdasarkan nama
    allowedStudents.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

    // 5. Susun matriks kehadiran per mahasiswa
    const matrix = allowedStudents.map((st) => {
      let attendedCount = 0;
      const sessionStatus = {};

      sections.forEach((sec) => {
        const attendedAt = attendanceMap[`${st.user_id}_${sec.id}`] || null;
        if (attendedAt) attendedCount++;
        sessionStatus[sec.id] = {
          attended: Boolean(attendedAt),
          attended_at: attendedAt,
        };
      });

      const totalSessions = sections.length;
      const percentage = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;

      return {
        student_id: st.user_id,
        full_name: st.full_name,
        nim_nip: st.nim_nip || '-',
        academic_year: st.academic_year || '-',
        semester: st.semester || '-',
        attended_count: attendedCount,
        attendance_percentage: percentage,
        sessions: sessionStatus,
      };
    });

    res.json({
      success: true,
      data: {
        course: {
          id: course.id,
          title: course.title,
          course_code: course.course_code,
          instructor_name: course.instructor_name,
          department: course.department,
          semester: course.semester,
          sks: course.sks,
          total_sessions: course.total_sessions || sections.length,
        },
        sections,
        total_students: allowedStudents.length,
        matrix,
      },
    });
  } catch (err) {
    console.error('Get course attendance report error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// Statistik grafik kehadiran 4 pertemuan terakhir per mata kuliah untuk dosen
async function getInstructorAttendanceStats(req, res) {
  const instructorId = req.user.id;
  const userRole = req.user.role;

  try {
    // Ambil matkul yang diampu oleh dosen (atau semua jika admin)
    let coursesQuery = 'SELECT id, title, course_code FROM courses';
    let coursesParams = [];
    if (userRole !== 'admin') {
      coursesQuery += ' WHERE instructor_id = ?';
      coursesParams.push(instructorId);
    }
    coursesQuery += ' ORDER BY created_at DESC';

    const [courses] = await pool.query(coursesQuery, coursesParams);

    const resultCourses = [];

    for (const c of courses) {
      // Ambil seluruh pertemuan matkul ini urut order_index ASC
      const [sections] = await pool.query(
        'SELECT id, course_id, title, order_index, attendance_active FROM sections WHERE course_id = ? ORDER BY order_index ASC',
        [c.id]
      );

      if (sections.length === 0) continue;

      // Cari pertemuan tertinggi yang presensinya aktif atau sudah pernah diisi kehadiran
      const [attendedSections] = await pool.query(
        'SELECT DISTINCT section_id FROM attendance WHERE course_id = ?',
        [c.id]
      );
      const attendedSectionIdSet = new Set(attendedSections.map(a => a.section_id));

      // Indeks sesi aktif tertinggi (1-based)
      let maxActiveOrder = 0;
      sections.forEach((sec, idx) => {
        const order = sec.order_index || (idx + 1);
        if (sec.attendance_active || attendedSectionIdSet.has(sec.id)) {
          if (order > maxActiveOrder) {
            maxActiveOrder = order;
          }
        }
      });

      // Window 4 pertemuan terakhir:
      // Misal maxActiveOrder = 5 -> ambil order 2, 3, 4, 5 (pertemuan 1 tidak ditampilkan)
      // Misal maxActiveOrder <= 4 -> ambil order 1, 2, 3, 4 (atau 4 sesi pertama)
      let startOrder = 1;
      let endOrder = 4;
      if (maxActiveOrder > 4) {
        endOrder = maxActiveOrder;
        startOrder = maxActiveOrder - 3;
      }

      // Filter 4 sesi sesuai window
      const targetSections = sections.filter((sec, idx) => {
        const order = sec.order_index || (idx + 1);
        return order >= startOrder && order <= endOrder;
      });

      // Hitung jumlah mahasiswa hadir per section
      const sessionsData = [];
      for (const sec of targetSections) {
        const [countRow] = await pool.query(
          'SELECT COUNT(*) as hadir_count FROM attendance WHERE section_id = ?',
          [sec.id]
        );
        sessionsData.push({
          section_id: sec.id,
          title: sec.title,
          order_index: sec.order_index,
          is_active: Boolean(sec.attendance_active),
          hadir_count: Number(countRow[0]?.hadir_count || 0),
        });
      }

      resultCourses.push({
        course_id: c.id,
        course_title: c.title,
        course_code: c.course_code,
        sessions: sessionsData,
      });
    }

    res.json({ success: true, data: resultCourses });
  } catch (err) {
    console.error('Get instructor attendance stats error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// ─── MATERIALS ────────────────────────────────────────────────────────────────

async function uploadMaterial(req, res) {
  const { section_id, course_id, title, description, material_type, external_url, youtube_url, content, order_index, is_downloadable } = req.body;
  const uploaded_by = req.user.id;

  if (!section_id || !course_id || !title || !material_type) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'section_id, course_id, title, material_type wajib diisi' });
  }

  // Untuk tipe youtube, file tidak wajib — URL disimpan di external_url
  const resolvedExternalUrl = material_type === 'youtube'
    ? (youtube_url || external_url || null)
    : (external_url || null);

  if (material_type === 'youtube' && !resolvedExternalUrl) {
    return res.status(400).json({ success: false, message: 'youtube_url wajib diisi untuk tipe YouTube' });
  }

  let file_url = null, file_name = null, file_size = null;

  if (req.file) {
    file_url = `/uploads/${req.file.filename}`;
    file_name = req.file.originalname;
    file_size = req.file.size;
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO materials 
       (section_id, course_id, title, description, material_type, file_url, file_name, file_size, external_url, content, order_index, is_downloadable, uploaded_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [section_id, course_id, title, description, material_type, file_url, file_name, file_size, resolvedExternalUrl, content, order_index || 0, is_downloadable !== false, uploaded_by]
    );
    res.status(201).json({ success: true, message: 'Materi berhasil diupload', data: { id: result.insertId, file_url, file_name } });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Upload material error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function downloadMaterial(req, res) {
  const { id } = req.params;
  try {
    const [materials] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
    if (materials.length === 0) return res.status(404).json({ success: false, message: 'Materi tidak ditemukan' });

    const material = materials[0];

    if (!material.file_url) {
      return res.status(400).json({ success: false, message: 'Materi ini tidak memiliki file untuk didownload' });
    }

    if (!material.is_downloadable) {
      return res.status(403).json({ success: false, message: 'Materi ini tidak dapat didownload' });
    }

    const filePath = path.join(__dirname, '..', material.file_url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File tidak ditemukan di server' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${material.file_name}"`);
    res.download(filePath, material.file_name);
  } catch (err) {
    console.error('Download material error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function deleteMaterial(req, res) {
  const { id } = req.params;
  try {
    const [materials] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
    if (materials.length === 0) return res.status(404).json({ success: false, message: 'Materi tidak ditemukan' });

    const material = materials[0];

    // Hapus file jika ada
    if (material.file_url) {
      const filePath = path.join(__dirname, '..', material.file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM materials WHERE id = ?', [id]);
    res.json({ success: true, message: 'Materi berhasil dihapus' });
  } catch (err) {
    console.error('Delete material error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────

async function getAnnouncements(req, res) {
  const { courseId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM announcements WHERE course_id = ? ORDER BY created_at DESC',
      [courseId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get announcements error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function createAnnouncement(req, res) {
  const { courseId } = req.params;
  const { title, content } = req.body;
  const author_id = req.user.id;
  const author_name = req.user.email || 'Dosen / Admin';

  if (!title || !content) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'Judul dan konten announcement wajib diisi' });
  }

  let file_url = null, file_name = null, file_size = null;
  if (req.file) {
    file_url = `/uploads/${req.file.filename}`;
    file_name = req.file.originalname;
    file_size = req.file.size;
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO announcements (course_id, title, content, file_url, file_name, file_size, author_id, author_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [courseId, title, content, file_url, file_name, file_size, author_id, author_name]
    );
    res.status(201).json({
      success: true,
      message: 'Pengumuman berhasil diposting',
      data: { id: result.insertId, title, content, file_url, file_name, author_name }
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Create announcement error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function deleteAnnouncement(req, res) {
  const { id } = req.params;
  try {
    const [ann] = await pool.query('SELECT * FROM announcements WHERE id = ?', [id]);
    if (ann.length === 0) return res.status(404).json({ success: false, message: 'Announcement tidak ditemukan' });

    if (ann[0].file_url) {
      const filePath = path.join(__dirname, '..', ann[0].file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM announcements WHERE id = ?', [id]);
    res.json({ success: true, message: 'Announcement berhasil dihapus' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── COMMENTS (FORUM INTERACTIVE) ─────────────────────────────────────────────

async function getComments(req, res) {
  const { courseId } = req.params;
  const { session_id, announcement_id } = req.query;
  try {
    let query = `SELECT c.*, 
                        COALESCE(NULLIF(p.full_name, ''), c.user_name) AS user_name,
                        p.avatar_url
                 FROM comments c
                 LEFT JOIN ${USER_DB}.profiles p ON c.user_id = p.user_id
                 WHERE c.course_id = ?`;
    const params = [courseId];

    if (session_id) {
      query += ' AND c.session_id = ?';
      params.push(session_id);
    } else if (announcement_id) {
      query += ' AND c.announcement_id = ?';
      params.push(announcement_id);
    }

    query += ' ORDER BY c.created_at ASC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function createComment(req, res) {
  const { courseId } = req.params;
  const { session_id, announcement_id, comment_text, user_name, parent_id } = req.body;
  const user_id = req.user.id;
  const user_role = req.user.role || 'student';

  // Utamakan mengambil Nama Lengkap dari profile
  let finalUserName = user_name;
  try {
    const [prof] = await pool.query(
      `SELECT full_name FROM ${USER_DB}.profiles WHERE user_id = ?`,
      [user_id]
    );
    if (prof.length > 0 && prof[0].full_name && prof[0].full_name.trim()) {
      finalUserName = prof[0].full_name.trim();
    }
  } catch (e) {
    console.warn('Could not fetch user full_name for comment:', e.message);
  }

  if (!finalUserName || !finalUserName.trim()) {
    finalUserName = req.user.email || 'Pengguna';
  }

  if (!comment_text || !comment_text.trim()) {
    return res.status(400).json({ success: false, message: 'Komentar tidak boleh kosong' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO comments (course_id, session_id, announcement_id, user_id, user_name, user_role, comment_text, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [courseId, session_id || null, announcement_id || null, user_id, finalUserName, user_role, comment_text.trim(), parent_id || null]
    );
    res.status(201).json({
      success: true,
      message: 'Komentar berhasil dikirim',
      data: {
        id: result.insertId,
        course_id: courseId,
        session_id,
        announcement_id,
        user_id,
        user_name: finalUserName,
        user_role,
        comment_text: comment_text.trim(),
        parent_id: parent_id || null,
        created_at: new Date()
      }
    });
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function deleteComment(req, res) {
  const { id } = req.params;
  try {
    const [comm] = await pool.query('SELECT * FROM comments WHERE id = ?', [id]);
    if (comm.length === 0) return res.status(404).json({ success: false, message: 'Komentar tidak ditemukan' });

    // Hanya admin, instructor, atau pembuat komentar yang bisa hapus
    if (req.user.role !== 'admin' && req.user.role !== 'instructor' && comm[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Tidak dapat menghapus komentar ini' });
    }

    // Hapus balasan/replies terlebih dahulu, lalu komentar induk
    await pool.query('DELETE FROM comments WHERE parent_id = ?', [id]);
    await pool.query('DELETE FROM comments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Komentar berhasil dihapus' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── COURSE ACCESS RULES ──────────────────────────────────────────────────────

async function getAccessRules(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT r.*, 
        p.department,
        COALESCE(r.nim_nip, p.nim_nip) as nim_nip,
        COALESCE(r.academic_year, p.academic_year) as academic_year,
        COALESCE(r.semester, p.semester) as semester
       FROM course_access_rules r
       LEFT JOIN ${USER_DB}.profiles p ON r.user_id = p.user_id
       WHERE r.course_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    console.error('Get access rules error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function addAccessRule(req, res) {
  const { id } = req.params;
  const rawInput = req.body.input_text || req.body.query || req.body.full_name || '';

  if (!rawInput || !rawInput.trim()) {
    return res.status(400).json({ success: false, message: 'Input nama mahasiswa atau angkatan wajib diisi' });
  }

  try {
    // Cek matkul ada
    const [course] = await pool.query('SELECT id, title FROM courses WHERE id = ?', [id]);
    if (course.length === 0) {
      return res.status(404).json({ success: false, message: 'Mata kuliah tidak ditemukan' });
    }

    // Split input berdasarkan baris atau koma
    const lines = rawInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (lines.length === 0) {
      return res.status(400).json({ success: false, message: 'Input tidak boleh kosong' });
    }

    const addedList = [];
    const existingList = [];

    for (const item of lines) {
      // 1. Cek apakah input adalah Tahun / Angkatan (misal: 2024, 2023, 2022)
      const isYear = /^\d{4}$/.test(item);

      if (isYear) {
        // Ambil semua mahasiswa angkatan tsb dari database
        const [students] = await pool.query(
          `SELECT user_id, full_name, nim_nip, academic_year, semester 
           FROM ${USER_DB}.profiles 
           WHERE role = 'student' AND academic_year = ?`,
          [item]
        );

        // Tambah aturan global angkatan
        const [existingYearRule] = await pool.query(
          'SELECT id FROM course_access_rules WHERE course_id = ? AND rule_type = "year" AND academic_year = ?',
          [id, item]
        );

        if (existingYearRule.length === 0) {
          await pool.query(
            `INSERT INTO course_access_rules (course_id, user_id, full_name, nim_nip, academic_year, semester, rule_type)
             VALUES (?, NULL, ?, NULL, ?, NULL, 'year')`,
            [id, `Semua Mahasiswa Angkatan ${item}`, item]
          );
        }

        // Tambahkan juga data mahasiswa yang ditemukan di database (jika belum ada)
        let newCount = 0;
        for (const st of students) {
          const [exists] = await pool.query(
            'SELECT id FROM course_access_rules WHERE course_id = ? AND (user_id = ? OR LOWER(full_name) = LOWER(?))',
            [id, st.user_id, st.full_name]
          );
          if (exists.length === 0) {
            await pool.query(
              `INSERT INTO course_access_rules (course_id, user_id, full_name, nim_nip, academic_year, semester, rule_type)
               VALUES (?, ?, ?, ?, ?, ?, 'student')`,
              [id, st.user_id, st.full_name, st.nim_nip, st.academic_year, st.semester]
            );
            newCount++;
          }
        }

        addedList.push(`Angkatan ${item} (${students.length} mahasiswa)`);
      } else {
        // 2. Input adalah Nama Mahasiswa atau NIM
        // Cocokkan dengan data user di database (profiles)
        const [matchedStudents] = await pool.query(
          `SELECT user_id, full_name, nim_nip, academic_year, semester 
           FROM ${USER_DB}.profiles 
           WHERE role = 'student' AND (
             LOWER(full_name) LIKE LOWER(?) 
             OR (nim_nip IS NOT NULL AND nim_nip = ?)
           )`,
          [`%${item}%`, item]
        );

        if (matchedStudents.length > 0) {
          for (const st of matchedStudents) {
            const [exists] = await pool.query(
              'SELECT id FROM course_access_rules WHERE course_id = ? AND (user_id = ? OR LOWER(full_name) = LOWER(?))',
              [id, st.user_id, st.full_name]
            );

            if (exists.length === 0) {
              await pool.query(
                `INSERT INTO course_access_rules (course_id, user_id, full_name, nim_nip, academic_year, semester, rule_type)
                 VALUES (?, ?, ?, ?, ?, ?, 'student')`,
                [id, st.user_id, st.full_name, st.nim_nip, st.academic_year, st.semester]
              );
              addedList.push(`${st.full_name}${st.academic_year ? ' (Angkatan ' + st.academic_year + ')' : ''}`);
            } else {
              existingList.push(st.full_name);
            }
          }
        } else {
          // Jika belum terdaftar di database, simpan sebagai aturan nama khusus
          const [exists] = await pool.query(
            'SELECT id FROM course_access_rules WHERE course_id = ? AND LOWER(full_name) = LOWER(?)',
            [id, item]
          );
          if (exists.length === 0) {
            await pool.query(
              `INSERT INTO course_access_rules (course_id, user_id, full_name, nim_nip, academic_year, semester, rule_type)
               VALUES (?, NULL, ?, NULL, NULL, NULL, 'name')`,
              [id, item]
            );
            addedList.push(`${item} (nama baru)`);
          } else {
            existingList.push(item);
          }
        }
      }
    }

    let message = '';
    if (addedList.length > 0) {
      message = `Berhasil memberikan akses untuk: ${addedList.join(', ')}.`;
    }
    if (existingList.length > 0) {
      message += ` (${existingList.join(', ')} sudah memiliki akses).`;
    }

    res.status(201).json({
      success: true,
      message,
      data: { added: addedList, existing: existingList },
    });
  } catch (err) {
    console.error('Add access rule error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

async function deleteAccessRule(req, res) {
  const { ruleId } = req.params;
  try {
    const [rule] = await pool.query('SELECT id FROM course_access_rules WHERE id = ?', [ruleId]);
    if (rule.length === 0) {
      return res.status(404).json({ success: false, message: 'Aturan akses tidak ditemukan' });
    }
    await pool.query('DELETE FROM course_access_rules WHERE id = ?', [ruleId]);
    res.json({ success: true, message: 'Aturan akses berhasil dihapus' });
  } catch (err) {
    console.error('Delete access rule error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = {
  getAllCourses, getMyCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  getAdminCourseStats,
  createSection, updateSection, deleteSection,
  toggleAttendance, submitAttendance, getAttendance, getInstructorAttendanceStats, getCourseAttendanceReport,
  uploadMaterial, downloadMaterial, deleteMaterial,
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  getComments, createComment, deleteComment,
  getAccessRules, addAccessRule, deleteAccessRule,
};
