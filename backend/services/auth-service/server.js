require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const pool = require('./config/db');

// Standalone execution check (hanya dijalankan jika file ini dieksekusi langsung)
if (require.main === module) {
  const app = express();
  const PORT = process.env.PORT || 5001;

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ success: true, service: 'auth-service', status: 'UP', db: 'connected' });
    } catch {
      res.status(503).json({ success: false, service: 'auth-service', status: 'DOWN', db: 'disconnected' });
    }
  });

  // Routes
  app.use('/api/auth', authRoutes);

  // 404
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route tidak ditemukan' });
  });

  app.listen(PORT, () => {
    console.log(`🔐 Auth Service berjalan di http://localhost:${PORT}`);
  });
}

module.exports = authRoutes;
