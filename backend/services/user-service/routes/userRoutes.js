const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const { getProfile, updateProfile, getAllProfiles, createUser, updateUserAdmin, deleteUser, getAdminUserStats, importFromExcel, downloadTemplate } = require('../controllers/userController');

const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer setup untuk upload Excel
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `excel-${Date.now()}${path.extname(file.originalname)}`),
});
const uploadExcel = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') return cb(null, true);
    cb(new Error('Hanya file Excel (.xlsx/.xls) yang diperbolehkan'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

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

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Hanya admin yang diizinkan' });
  next();
}

// Routes
router.get('/profile/:userId', auth, getProfile);
router.put('/profile/:userId', auth, updateProfile);

// Admin routes
router.get('/all', auth, adminOnly, getAllProfiles);
router.get('/stats/admin', auth, adminOnly, getAdminUserStats);
router.post('/create', auth, adminOnly, createUser);
router.put('/:userId', auth, adminOnly, updateUserAdmin);
router.delete('/:userId', auth, adminOnly, deleteUser);
router.get('/template', auth, adminOnly, downloadTemplate);
router.post('/import-excel', auth, adminOnly, uploadExcel.single('file'), importFromExcel);

module.exports = router;
