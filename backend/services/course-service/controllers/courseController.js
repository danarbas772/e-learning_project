const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

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

  // Filter akses untuk role student DAN instructor (non-admin):
  // (1) Pembuat matkul (instructor_id) selalu bisa akses course-nya sendiri
  // (2) Matkul tanpa aturan akses (publik) → bisa diakses semua
  // (3) Matkul dengan aturan akses → hanya yang cocok (ID, Angkatan, atau Nama)
  if (user_role === 'student' || user_role === 'instructor') {
    let currentUserId = user_id;
    if (!currentUserId && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'elearning_secret_key_2024');
        currentUserId = decoded.id;
      } catch (e) {}
    }

    const sId = currentUserId ? parseInt(currentUserId, 10) : -1;
    const sYear = user_academic_year ? String(user_academic_year).trim() : '';
    const sName = user_name ? String(user_name).trim() : '';

    query += ` AND (
      instructor_id = ?
      OR NOT EXISTS (SELECT 1 FROM course_access_rules WHERE course_id = courses.id)
      OR EXISTS (
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
      )
    )`;
    params.push(
      sId,
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
  // Untuk instructor: lihat semua kursus yang dibuat
  const instructorId = req.user.id;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM courses WHERE instructor_id = ? ORDER BY created_at DESC',
      [instructorId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
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
    } catch (e) {}
  }

  try {
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    if (courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Mata kuliah tidak ditemukan' });
    }

    // Cek aturan akses jika student atau instructor
    if (user_role === 'student' || user_role === 'instructor') {
      // Pembuat matkul selalu punya akses
      const isCreator = Number(courses[0].instructor_id) === Number(studentUserId);
      if (!isCreator) {
        const [rules] = await pool.query('SELECT * FROM course_access_rules WHERE course_id = ?', [id]);
        if (rules.length > 0) {
          const hasAccess = rules.some((rule) => {
            // 1. Cocokkan ID user (student atau instructor)
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
      }
    }


    // Ambil sections & materials
    let [sections] = await pool.query(
       'SELECT * FROM sections WHERE course_id = ? ORDER BY order_index ASC',
       [id]
     );

    // Jika sections belum ada, auto buatkan berdasarkan total_sessions mata kuliah
    if (sections.length === 0) {
      const sessionCount = parseInt(courses[0].total_sessions, 10) || 16;
      for (let i = 1; i <= sessionCount; i++) {
        await pool.query(
          'INSERT INTO sections (course_id, title, order_index) VALUES (?, ?, ?)',
          [id, `PERTEMUAN ${toRoman(i)}`, i]
        );
      }
      const [newSections] = await pool.query(
        'SELECT * FROM sections WHERE course_id = ? ORDER BY order_index ASC',
        [id]
      );
      sections = newSections;
    }

    for (const section of sections) {
      const [materials] = await pool.query(
        'SELECT id, title, description, material_type, file_url, file_name, file_size, external_url, content, order_index, is_downloadable, created_at FROM materials WHERE section_id = ? ORDER BY order_index ASC',
        [section.id]
      );
      section.materials = materials;
    }

    const course = { ...courses[0], sections };
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

// ─── MATERIALS ────────────────────────────────────────────────────────────────

async function uploadMaterial(req, res) {
  const { section_id, course_id, title, description, material_type, external_url, content, order_index, is_downloadable } = req.body;
  const uploaded_by = req.user.id;

  if (!section_id || !course_id || !title || !material_type) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'section_id, course_id, title, material_type wajib diisi' });
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
      [section_id, course_id, title, description, material_type, file_url, file_name, file_size, external_url, content, order_index || 0, is_downloadable !== false, uploaded_by]
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
    let query = 'SELECT * FROM comments WHERE course_id = ?';
    const params = [courseId];

    if (session_id) {
      query += ' AND session_id = ?';
      params.push(session_id);
    } else if (announcement_id) {
      query += ' AND announcement_id = ?';
      params.push(announcement_id);
    }

    query += ' ORDER BY created_at ASC';
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
  const finalUserName = user_name || req.user.email || 'Pengguna';

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
       LEFT JOIN elearning_users.profiles p ON r.user_id = p.user_id
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
           FROM elearning_users.profiles 
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
        // Cocokkan dengan data user di database (elearning_users.profiles)
        const [matchedStudents] = await pool.query(
          `SELECT user_id, full_name, nim_nip, academic_year, semester 
           FROM elearning_users.profiles 
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
  uploadMaterial, downloadMaterial, deleteMaterial,
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  getComments, createComment, deleteComment,
  getAccessRules, addAccessRule, deleteAccessRule,
};
