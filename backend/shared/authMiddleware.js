// backend/shared/authMiddleware.js
// Middleware JWT - dipakai di semua service yang butuh autentikasi
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'elearning_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa' });
    }
    req.user = user;
    next();
  });
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: role tidak mencukupi' });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles };
