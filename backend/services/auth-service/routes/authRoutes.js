const express = require('express');
const router = express.Router();
const { register, login, verifyToken, getAllUsers, updateUserStatus } = require('../controllers/authController');
const jwt = require('jsonwebtoken');

// Middleware autentikasi inline
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
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Hanya admin' });
  next();
}

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyToken);

// Admin routes
router.get('/users', auth, adminOnly, getAllUsers);
router.put('/users/:id/status', auth, adminOnly, updateUserStatus);

module.exports = router;
