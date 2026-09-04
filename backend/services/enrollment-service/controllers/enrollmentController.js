const pool = require('../config/db');

// ─── Enroll ke Kursus ─────────────────────────────────────────────────────────
async function enrollCourse(req, res) {
  const user_id = req.user.id;
  const { course_id } = req.body;

  if (!course_id) return res.status(400).json({ success: false, message: 'course_id wajib diisi' });

  try {
    const [existing] = await pool.query(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Anda sudah terdaftar di kursus ini' });
    }

    const [result] = await pool.query(
      'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
      [user_id, course_id]
    );
    res.status(201).json({ success: true, message: 'Berhasil mendaftar ke kursus', data: { id: result.insertId } });
  } catch (err) {
    console.error('Enroll error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Kursus Saya ──────────────────────────────────────────────────────────────
async function getMyCourses(req, res) {
  const user_id = req.user.id;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM enrollments WHERE user_id = ? ORDER BY enrolled_at DESC',
      [user_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Cek Status Enrollment ────────────────────────────────────────────────────
async function checkEnrollment(req, res) {
  const user_id = req.user.id;
  const { courseId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [user_id, courseId]
    );
    res.json({ success: true, enrolled: rows.length > 0, data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Update Progress Materi ───────────────────────────────────────────────────
async function updateProgress(req, res) {
  const user_id = req.user.id;
  const { material_id, course_id, is_completed } = req.body;

  if (!material_id || !course_id) {
    return res.status(400).json({ success: false, message: 'material_id dan course_id wajib diisi' });
  }

  try {
    // Cek apakah user terdaftar di kursus
    const [enrollment] = await pool.query(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );
    if (enrollment.length === 0) {
      return res.status(403).json({ success: false, message: 'Anda belum terdaftar di kursus ini' });
    }

    // Upsert progress
    await pool.query(
      `INSERT INTO material_progress (user_id, material_id, course_id, is_completed, completed_at) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE is_completed = ?, completed_at = ?`,
      [user_id, material_id, course_id, is_completed, is_completed ? new Date() : null,
       is_completed, is_completed ? new Date() : null]
    );

    res.json({ success: true, message: 'Progress berhasil diperbarui' });
  } catch (err) {
    console.error('Update progress error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Get Progress Kursus ──────────────────────────────────────────────────────
async function getCourseProgress(req, res) {
  const user_id = req.user.id;
  const { courseId } = req.params;

  try {
    const [progress] = await pool.query(
      'SELECT * FROM material_progress WHERE user_id = ? AND course_id = ?',
      [user_id, courseId]
    );
    const completedCount = progress.filter(p => p.is_completed).length;
    res.json({
      success: true,
      data: { progress, completedCount, totalTracked: progress.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Daftar Mahasiswa per Kursus (untuk instructor) ───────────────────────────
async function getCourseStudents(req, res) {
  const { courseId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM enrollments WHERE course_id = ? ORDER BY enrolled_at DESC',
      [courseId]
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { enrollCourse, getMyCourses, checkEnrollment, updateProgress, getCourseProgress, getCourseStudents };
