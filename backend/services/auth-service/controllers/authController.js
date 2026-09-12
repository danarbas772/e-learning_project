const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'elearning_secret_key_2024';
const USER_DB = process.env.DB_NAME_USER || process.env.USER_DB_NAME || process.env.DB_NAME || 'elearning_users';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

// ─── Register ─────────────────────────────────────────────────────────────────
async function register(req, res) {
  const { email, password, role = 'student' } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
  }

  // Validasi role yang diperbolehkan
  const allowedRoles = ['student', 'instructor'];
  const finalRole = allowedRoles.includes(role) ? role : 'student';

  try {
    // Cek apakah email sudah ada
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, password_hash, finalRole]
    );

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: { id: result.insertId, email, role: finalRole },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    // Ambil Nama Lengkap dari elearning_users.profiles jika ada
    let fullName = user.email;
    try {
      const [profs] = await pool.query(
        `SELECT full_name FROM ${USER_DB}.profiles WHERE user_id = ?`,
        [user.id]
      );
      if (profs.length > 0 && profs[0].full_name && profs[0].full_name.trim()) {
        fullName = profs[0].full_name.trim();
      }
    } catch (e) {
      console.warn('Could not fetch user profile on login:', e.message);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: fullName },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        user: { id: user.id, email: user.email, role: user.role, full_name: fullName },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Verify Token ─────────────────────────────────────────────────────────────
async function verifyToken(req, res) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Ambil full_name terbaru dari profile jika belum ada
    try {
      const [profs] = await pool.query(
        `SELECT full_name FROM ${USER_DB}.profiles WHERE user_id = ?`,
        [decoded.id]
      );
      if (profs.length > 0 && profs[0].full_name && profs[0].full_name.trim()) {
        decoded.full_name = profs[0].full_name.trim();
      }
    } catch (e) {}
    res.json({ success: true, data: decoded });
  } catch (err) {
    res.status(403).json({ success: false, message: 'Token tidak valid' });
  }
}

// ─── Get All Users (Admin only) ───────────────────────────────────────────────
async function getAllUsers(req, res) {
  try {
    const [users] = await pool.query(
      'SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Update User Status (Admin only) ─────────────────────────────────────────
async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active, id]);
    res.json({ success: true, message: 'Status pengguna diperbarui' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { register, login, verifyToken, getAllUsers, updateUserStatus };
