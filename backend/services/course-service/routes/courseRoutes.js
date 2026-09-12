const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const {
  getAllCourses, getMyCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  getAdminCourseStats,
  createSection, updateSection, deleteSection,
  toggleAttendance, submitAttendance, getAttendance, getInstructorAttendanceStats, getCourseAttendanceReport,
  uploadMaterial, downloadMaterial, deleteMaterial,
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  getComments, createComment, deleteComment,
  getAccessRules, addAccessRule, deleteAccessRule,
} = require('../controllers/courseController');

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'elearning_secret_key_2024');
    next();
  } catch {
    res.status(403).json({ success: false, message: 'Token tidak valid' });
  }
}

function instructorOrAdmin(req, res, next) {
  if (!['instructor', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Hanya instructor atau admin' });
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Hanya admin yang diizinkan untuk tindakan ini' });
  }
  next();
}

const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer untuk file materi & announcement (PDF, PPT, PPTX, video, doc)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `file-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const uploadFile = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.ppt', '.pptx', '.mp4', '.webm', '.avi', '.mkv', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Format file tidak didukung: ${ext}. Gunakan: ${allowed.join(', ')}`));
  },
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 }, // 50MB
});

// ─── Course Routes ────────────────────────────────────────────────────────────
router.get('/', getAllCourses);
router.get('/stats/admin', auth, instructorOrAdmin, getAdminCourseStats);
router.get('/stats/instructor-attendance', auth, instructorOrAdmin, getInstructorAttendanceStats);
router.get('/my-courses', auth, instructorOrAdmin, getMyCourses);
router.get('/:id', getCourseById);
// Menambah, mengedit, dan menghapus mata kuliah khusus role admin
router.post('/', auth, adminOnly, createCourse);
router.put('/:id', auth, adminOnly, updateCourse);
router.delete('/:id', auth, adminOnly, deleteCourse);

// ─── Section Routes ───────────────────────────────────────────────────────────
router.post('/sections', auth, instructorOrAdmin, createSection);
router.put('/sections/:id', auth, instructorOrAdmin, updateSection);
router.delete('/sections/:id', auth, instructorOrAdmin, deleteSection);

// ─── Attendance Routes (Presensi) ─────────────────────────────────────────────
// Dosen/Admin: Laporan presensi per matkul untuk halaman presensi & download excel
router.get('/:courseId/attendance-report', auth, instructorOrAdmin, getCourseAttendanceReport);
// Dosen/Admin: Aktifkan / Nonaktifkan Presensi per sesi
router.patch('/sections/:id/attendance-toggle', auth, instructorOrAdmin, toggleAttendance);
// Mahasiswa: Klik Hadir 1x selamanya
router.post('/sections/:id/attend', auth, submitAttendance);
// Dosen/Admin: Lihat daftar presensi (internal database)
router.get('/sections/:id/attendance', auth, instructorOrAdmin, getAttendance);

// ─── Material Routes ──────────────────────────────────────────────────────────
router.post('/materials/upload', auth, instructorOrAdmin, uploadFile.single('file'), uploadMaterial);
router.get('/materials/:id/download', auth, downloadMaterial);
router.delete('/materials/:id', auth, instructorOrAdmin, deleteMaterial);

// ─── Announcements Routes (Forum) ─────────────────────────────────────────────
router.get('/:courseId/announcements', auth, getAnnouncements);
router.post('/:courseId/announcements', auth, instructorOrAdmin, uploadFile.single('file'), createAnnouncement);
router.delete('/announcements/:id', auth, instructorOrAdmin, deleteAnnouncement);

// ─── Comments Routes (Forum - All Roles Can Comment) ───────────────────────────
router.get('/:courseId/comments', auth, getComments);
router.post('/:courseId/comments', auth, createComment);
router.delete('/comments/:id', auth, deleteComment);

// ─── Course Access Rules Routes (Admin Only) ──────────────────────────────────

router.get('/:id/access-rules', auth, instructorOrAdmin, getAccessRules);
router.post('/:id/access-rules', auth, adminOnly, addAccessRule);
router.delete('/access-rules/:ruleId', auth, adminOnly, deleteAccessRule);

module.exports = router;
