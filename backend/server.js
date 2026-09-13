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

// ─── Global CORS & Preflight Middleware ────────────────────────────────────────
// Selalu pasang header CORS pada SEMUA request agar browser tidak pernah memblokir
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Izinkan origin dari domain basdev.online, webdev.online, localhost, atau jika ada FRONTEND_URL
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Jika browser mengirim preflight request OPTIONS, langsung jawab 200 OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Explicit wildcard OPTIONS route
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  return res.status(200).end();
});

app.use(cors({
  origin: (origin, callback) => callback(null, true),
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

// ─── Health Check & DB Diagnostics ──────────────────────────────────────────
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

app.get('/api/test-db', async (req, res) => {
  try {
    const authDb = require('./services/auth-service/config/db');
    const [test] = await authDb.query('SELECT 1 as connected');
    const [tables] = await authDb.query('SHOW TABLES');
    let userCount = 0;
    try {
      const [u] = await authDb.query('SELECT COUNT(*) as cnt FROM users');
      userCount = u[0].cnt;
    } catch (e) {
      userCount = `Tabel users belum ada: ${e.message}`;
    }
    res.json({
      success: true,
      message: 'Database terhubung dengan sukses!',
      status: test,
      user_count: userCount,
      tables: tables.map((t) => Object.values(t)[0]),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Koneksi database GAGAL: ${err.message}`,
      code: err.code,
      errno: err.errno,
      db_user: process.env.DB_USER,
      db_name: process.env.DB_NAME_AUTH || process.env.DB_NAME,
      db_host: process.env.DB_HOST,
    });
  }
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
