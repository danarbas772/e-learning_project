require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const enrollmentRoutes = require('./routes/enrollmentRoutes');

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, service: 'enrollment-service', status: 'UP', db: 'connected' });
  } catch {
    res.status(503).json({ success: false, service: 'enrollment-service', status: 'DOWN', db: 'disconnected' });
  }
});

app.use('/api/enrollments', enrollmentRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route tidak ditemukan' }));

app.listen(PORT, () => {
  console.log(`📋 Enrollment Service berjalan di http://localhost:${PORT}`);
});
