const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const {
  getAllCourses, getMyCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  getAdminCourseStats,
  createSection, updateSection, deleteSection,
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

// Multer untuk file materi & announcement (PDF, PPT, PPTX, video, doc)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
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
router.get('/my-courses', auth, instructorOrAdmin, getMyCourses);
router.get('/:id', getCourseById);
router.post('/', auth, instructorOrAdmin, createCourse);
router.put('/:id', auth, instructorOrAdmin, updateCourse);
router.delete('/:id', auth, instructorOrAdmin, deleteCourse);

// ─── Section Routes ───────────────────────────────────────────────────────────
router.post('/sections', auth, instructorOrAdmin, createSection);
router.put('/sections/:id', auth, instructorOrAdmin, updateSection);
router.delete('/sections/:id', auth, instructorOrAdmin, deleteSection);

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
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Hanya admin yang dapat mengelola akses mata kuliah' });
  }
  next();
}

router.get('/:id/access-rules', auth, instructorOrAdmin, getAccessRules);
router.post('/:id/access-rules', auth, adminOnly, addAccessRule);
router.delete('/access-rules/:ruleId', auth, adminOnly, deleteAccessRule);

module.exports = router;
