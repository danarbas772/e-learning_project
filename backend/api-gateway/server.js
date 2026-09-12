// backend/api-gateway/server.js
// Catatan: Sesuai refactoring Modular Monolith, reverse-proxy HTTP antar-service
// telah digantikan oleh in-memory router mounting pada backend/server.js.
// File ini dipertahankan untuk backward-compatibility jika dijalankan langsung.

require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// In-memory routers dari services
const authRoutes = require('../services/auth-service/routes/authRoutes');
const userRoutes = require('../services/user-service/routes/userRoutes');
const courseRoutes = require('../services/course-service/routes/courseRoutes');
const enrollmentRoutes = require('../services/enrollment-service/routes/enrollmentRoutes');
const quizRoutes = require('../services/quiz-service/routes/quizRoutes');
const { errorHandler, notFound } = require('../shared/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti.' },
});
app.use(limiter);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Gateway (In-Memory Routing) berjalan',
    timestamp: new Date().toISOString(),
    mode: 'in-memory-modular',
  });
});

// In-Memory Routes (Tanpa Reverse Proxy HTTP)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/quizzes', quizRoutes);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 API Gateway (In-Memory) berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
