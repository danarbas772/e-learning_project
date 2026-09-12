require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require('./config/db');
const courseRoutes = require('./routes/courseRoutes');

// Buat folder uploads jika belum ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Standalone execution check (hanya dijalankan jika file ini dieksekusi langsung)
if (require.main === module) {
  const app = express();
  const PORT = process.env.PORT || 5003;

  app.use(cors());
  app.use(express.json());

  // Serve file statis
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Health check
  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ success: true, service: 'course-service', status: 'UP', db: 'connected' });
    } catch {
      res.status(503).json({ success: false, service: 'course-service', status: 'DOWN', db: 'disconnected' });
    }
  });

  // Routes
  app.use('/api/courses', courseRoutes);

  // 404
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route tidak ditemukan' });
  });

  app.listen(PORT, () => {
    console.log(`📚 Course Service berjalan di http://localhost:${PORT}`);
  });
}

module.exports = courseRoutes;
