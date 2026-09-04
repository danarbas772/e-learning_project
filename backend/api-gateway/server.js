require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
// Note: express.json() should NOT be used in API Gateway before proxy middleware
// because it consumes the request body stream and causes proxied POST/PUT requests to hang.

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti.' },
});
app.use(limiter);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Gateway berjalan',
    timestamp: new Date().toISOString(),
    services: {
      auth: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
      user: process.env.USER_SERVICE_URL || 'http://localhost:5002',
      course: process.env.COURSE_SERVICE_URL || 'http://localhost:5003',
      enrollment: process.env.ENROLLMENT_SERVICE_URL || 'http://localhost:5004',
      quiz: process.env.QUIZ_SERVICE_URL || 'http://localhost:5005',
    },
  });
});

// ─── Proxy Routes ─────────────────────────────────────────────────────────────
const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      console.error(`[Proxy Error] ${target}:`, err.message);
      res.status(503).json({ success: false, message: `Service tidak tersedia: ${target}` });
    },
  },
});

// Auth Service → /api/auth/*
app.use('/api/auth', createProxyMiddleware(proxyOptions(
  process.env.AUTH_SERVICE_URL || 'http://localhost:5001'
)));

// User Service → /api/users/*
app.use('/api/users', createProxyMiddleware(proxyOptions(
  process.env.USER_SERVICE_URL || 'http://localhost:5002'
)));

// Course Service → /api/courses/*
app.use('/api/courses', createProxyMiddleware(proxyOptions(
  process.env.COURSE_SERVICE_URL || 'http://localhost:5003'
)));

// Enrollment Service → /api/enrollments/*
app.use('/api/enrollments', createProxyMiddleware(proxyOptions(
  process.env.ENROLLMENT_SERVICE_URL || 'http://localhost:5004'
)));

// Quiz Service → /api/quizzes/*
app.use('/api/quizzes', createProxyMiddleware(proxyOptions(
  process.env.QUIZ_SERVICE_URL || 'http://localhost:5005'
)));

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route tidak ditemukan: ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway berjalan di http://localhost:${PORT}`);
});
