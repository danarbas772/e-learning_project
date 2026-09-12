require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const quizRoutes = require('./routes/quizRoutes');

// Standalone execution check (hanya dijalankan jika file ini dieksekusi langsung)
if (require.main === module) {
  const app = express();
  const PORT = process.env.PORT || 5005;

  app.use(cors());
  app.use(express.json());

  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ success: true, service: 'quiz-service', status: 'UP', db: 'connected' });
    } catch {
      res.status(503).json({ success: false, service: 'quiz-service', status: 'DOWN', db: 'disconnected' });
    }
  });

  app.use('/api/quizzes', quizRoutes);

  app.use((req, res) => res.status(404).json({ success: false, message: 'Route tidak ditemukan' }));

  app.listen(PORT, () => {
    console.log(`🧪 Quiz Service berjalan di http://localhost:${PORT}`);
  });
}

module.exports = quizRoutes;
