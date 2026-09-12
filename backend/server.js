require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// ─── Import Routers dari Masing-Masing Service ────────────────────────────────
const authRoutes = require('./services/auth-service/routes/authRoutes');
const userRoutes = require('./services/user-service/routes/userRoutes');
const courseRoutes = require('./services/course-service/routes/courseRoutes');
const enrollmentRoutes = require('./services/enrollment-service/routes/enrollmentRoutes');
const quizRoutes = require('./services/quiz-service/routes/quizRoutes');

// Shared Error Handler
const { errorHandler, notFound } = require('./shared/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Pastikan direktori uploads ada
const courseUploads = path.join(__dirname, 'services/course-service/uploads');
const userUploads = path.join(__dirname, 'services/user-service/uploads');
if (!fs.existsSync(courseUploads)) fs.mkdirSync(courseUploads, { recursive: true });
if (!fs.existsSync(userUploads)) fs.mkdirSync(userUploads, { recursive: true });

// ─── Global Middleware ────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://e-learning.webdev.online',
];
app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (misal: curl, Postman) atau dari allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  message: { success: false, message: 'Terlalu banyak request, silakan coba lagi nanti.' },
});
app.use(limiter);

// ─── Static Files ─────────────────────────────────────────────────────────────
// Serve file statis materi kursus & forum
app.use('/uploads', express.static(courseUploads));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'E-Learning Backend Modular Monolith berjalan normal',
    port: PORT,
    timestamp: new Date().toISOString(),
    modules: {
      auth: 'mounted (/api/auth)',
      users: 'mounted (/api/users)',
      courses: 'mounted (/api/courses)',
      enrollments: 'mounted (/api/enrollments)',
      quizzes: 'mounted (/api/quizzes)',
    },
  });
});

// ─── In-Memory Router Mounting ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/quizzes', quizRoutes);

// ─── 404 & Error Handling ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Single app.listen() Entry Point ─────────────────────────────────────────
let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`🚀 [Modular Monolith] E-Learning Backend berjalan di http://localhost:${PORT}`);
    console.log(`📡 Endpoints mounted:`);
    console.log(`   - /api/auth`);
    console.log(`   - /api/users`);
    console.log(`   - /api/courses`);
    console.log(`   - /api/enrollments`);
    console.log(`   - /api/quizzes`);
    console.log(`📁 Static files: /uploads`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} sedang digunakan oleh proses lain.`);
      console.error(`💡 Hentikan proses yang sedang berjalan di port ${PORT} terlebih dahulu.`);
    } else {
      console.error(`❌ Server error:`, err.message);
    }
  });
}

module.exports = app;
