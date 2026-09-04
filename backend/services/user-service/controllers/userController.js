const { pool, authPool } = require('../config/db');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const fs = require('fs');

// ─── Get Profile ──────────────────────────────────────────────────────────────
async function getProfile(req, res) {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profil tidak ditemukan' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Update Profile ───────────────────────────────────────────────────────────
async function updateProfile(req, res) {
  const { userId } = req.params;
  const { full_name, phone, bio, department, academic_year, semester, email, password } = req.body;

  // Hanya pemilik akun atau admin yang berhak mengedit
  if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses untuk mengedit akun ini' });
  }

  try {
    // 1. Update Email jika disertakan dan berbeda
    if (email && email.trim() !== '') {
      const [existingEmail] = await authPool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email.trim(), userId]
      );
      if (existingEmail.length > 0) {
        return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh akun lain' });
      }
      await authPool.query('UPDATE users SET email = ? WHERE id = ?', [email.trim(), userId]);
    }

    // 2. Update Password jika diisi
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password.trim(), salt);
      await authPool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, userId]);
    }

    // 3. Update Profiles Table
    const [existing] = await pool.query('SELECT id FROM profiles WHERE user_id = ?', [userId]);

    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO profiles (user_id, full_name, phone, bio, department, academic_year, semester, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, full_name || '', phone || null, bio || null, department || null, academic_year || null, semester || null, req.user.role]
      );
    } else {
      await pool.query(
        'UPDATE profiles SET full_name = ?, phone = ?, bio = ?, department = ?, academic_year = ?, semester = ? WHERE user_id = ?',
        [full_name, phone, bio, department, academic_year, semester, userId]
      );
    }

    // Ambil data terbaru untuk feedback
    const [updatedRows] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    const [updatedUser] = await authPool.query('SELECT id, email, role FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      message: 'Profil akun berhasil diperbarui',
      data: {
        ...updatedRows[0],
        email: updatedUser[0]?.email,
        role: updatedUser[0]?.role,
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// ─── Get All Users (Admin) ────────────────────────────────────────────────────
async function getAllProfiles(req, res) {
  const { role, department, search } = req.query;
  let query = `
    SELECT 
      u.id as user_id,
      u.email,
      u.role,
      u.is_active,
      u.created_at,
      p.id as profile_id,
      COALESCE(p.full_name, SUBSTRING_INDEX(u.email, '@', 1)) as full_name,
      p.nim_nip,
      p.avatar_url,
      p.phone,
      p.bio,
      p.department,
      p.academic_year
    FROM elearning_auth.users u
    LEFT JOIN elearning_users.profiles p ON u.id = p.user_id
    WHERE 1=1
  `;
  const params = [];

  if (role) { query += ' AND u.role = ?'; params.push(role); }
  if (department) { query += ' AND p.department LIKE ?'; params.push(`%${department}%`); }
  if (search) {
    query += ' AND (p.full_name LIKE ? OR p.nim_nip LIKE ? OR u.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY u.created_at DESC';

  try {
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    console.error('Get all profiles error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Create User Manual (Admin) ───────────────────────────────────────────────
async function createUser(req, res) {
  const { email, password, role = 'student', full_name, nim_nip, department, academic_year, phone, bio } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ success: false, message: 'Email, password, dan nama lengkap wajib diisi' });
  }

  const validRoles = ['student', 'instructor', 'admin'];
  const finalRole = validRoles.includes(role) ? role : 'student';

  try {
    // 1. Cek email sudah ada
    const [existing] = await authPool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Insert ke auth DB
    const [authResult] = await authPool.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, password_hash, finalRole]
    );
    const userId = authResult.insertId;

    // 4. Insert profil ke user DB
    await pool.query(
      'INSERT INTO profiles (user_id, full_name, nim_nip, role, department, academic_year, phone, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, full_name, nim_nip || null, finalRole, department || null, academic_year || null, phone || null, bio || null]
    );

    const roleName = finalRole === 'instructor' ? 'Dosen' : finalRole === 'admin' ? 'Admin' : 'Mahasiswa';
    res.status(201).json({
      success: true,
      message: `Akun ${roleName} (${full_name}) berhasil dibuat`,
      data: { user_id: userId, email, role: finalRole, full_name, nim_nip, department, academic_year, phone, bio },
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// ─── Update User (Admin) ──────────────────────────────────────────────────────
async function updateUserAdmin(req, res) {
  const { userId } = req.params;
  const { email, password, full_name, nim_nip, role, department, academic_year, phone, bio } = req.body;

  try {
    // 1. Cek user ada di auth DB
    const [userAuth] = await authPool.query('SELECT id, email, role FROM users WHERE id = ?', [userId]);
    if (userAuth.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    // 2. Jika email diubah, pastikan tidak duplikat
    if (email && email !== userAuth[0].email) {
      const [existingEmail] = await authPool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existingEmail.length > 0) {
        return res.status(409).json({ success: false, message: 'Email sudah digunakan oleh akun lain' });
      }
      await authPool.query('UPDATE users SET email = ? WHERE id = ?', [email, userId]);
    }

    // 3. Jika password diisi (opsional), hash dan update
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      await authPool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, userId]);
    }

    // 4. Update role jika valid
    const validRoles = ['admin', 'instructor', 'student'];
    const finalRole = role && validRoles.includes(role) ? role : userAuth[0].role;
    if (role && validRoles.includes(role)) {
      await authPool.query('UPDATE users SET role = ? WHERE id = ?', [finalRole, userId]);
    }

    // 5. Update atau insert profile
    const [profile] = await pool.query('SELECT id FROM profiles WHERE user_id = ?', [userId]);
    if (profile.length === 0) {
      await pool.query(
        'INSERT INTO profiles (user_id, full_name, nim_nip, role, department, academic_year, phone, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, full_name || '', nim_nip || null, finalRole, department || null, academic_year || null, phone || null, bio || null]
      );
    } else {
      await pool.query(
        `UPDATE profiles SET 
          full_name = COALESCE(?, full_name),
          nim_nip = ?,
          role = ?,
          department = ?,
          academic_year = ?,
          phone = ?,
          bio = ?
        WHERE user_id = ?`,
        [full_name, nim_nip || null, finalRole, department || null, academic_year || null, phone || null, bio || null, userId]
      );
    }

    res.json({
      success: true,
      message: 'Data pengguna berhasil diperbarui',
      data: { user_id: userId, email: email || userAuth[0].email, role: finalRole, full_name, nim_nip, department, academic_year, phone, bio }
    });
  } catch (err) {
    console.error('Update user admin error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// ─── Delete User (Admin) ──────────────────────────────────────────────────────
async function deleteUser(req, res) {
  const { userId } = req.params;

  try {
    await pool.query('DELETE FROM profiles WHERE user_id = ?', [userId]);
    await authPool.query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Admin User Stats ─────────────────────────────────────────────────────────
async function getAdminUserStats(req, res) {
  try {
    // Total Mahasiswa & Dosen
    const [authStats] = await authPool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END), 0) as total_students,
        COALESCE(SUM(CASE WHEN role = 'instructor' THEN 1 ELSE 0 END), 0) as total_instructors
      FROM users
    `);

    // Total Mahasiswa per Angkatan
    const [batchStats] = await pool.query(`
      SELECT 
        COALESCE(NULLIF(TRIM(academic_year), ''), 'Belum Ada Angkatan') as batch,
        COUNT(*) as count
      FROM profiles
      WHERE role = 'student'
      GROUP BY batch
      ORDER BY batch ASC
    `);

    res.json({
      success: true,
      data: {
        total_students: Number(authStats[0]?.total_students || 0),
        total_instructors: Number(authStats[0]?.total_instructors || 0),
        students_by_batch: batchStats,
      },
    });
  } catch (err) {
    console.error('User admin stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Import dari Excel ────────────────────────────────────────────────────────
/**
 * Format Excel yang diharapkan (header baris pertama):
 * | email | password | full_name | nim_nip | role | department | academic_year | phone |
 */
async function importFromExcel(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File Excel tidak ditemukan' });
  }

  const filePath = req.file.path;

  try {
    // Baca file Excel
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'File Excel kosong' });
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const row of data) {
      const { email, password, full_name, nim_nip, role = 'student', department, academic_year, phone } = row;

      if (!email || !password || !full_name) {
        results.failed++;
        results.errors.push({ email: email || 'N/A', error: 'email, password, full_name wajib diisi' });
        continue;
      }

      // Validasi role
      const validRoles = ['student', 'instructor', 'admin'];
      const finalRole = validRoles.includes(role) ? role : 'student';

      try {
        // 1. Cek apakah email sudah ada di auth DB
        const [existingAuth] = await authPool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingAuth.length > 0) {
          results.failed++;
          results.errors.push({ email, error: 'Email sudah terdaftar' });
          continue;
        }

        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(String(password), salt);

        // 3. Insert ke auth DB
        const [authResult] = await authPool.query(
          'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
          [email, password_hash, finalRole]
        );
        const newUserId = authResult.insertId;

        // 4. Insert profil ke user DB
        await pool.query(
          'INSERT INTO profiles (user_id, full_name, nim_nip, role, department, academic_year, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newUserId, full_name, nim_nip || null, finalRole, department || null, academic_year || null, phone || null]
        );

        results.success++;
      } catch (rowErr) {
        results.failed++;
        results.errors.push({ email, error: rowErr.message });
      }
    }

    // Hapus file temp
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Import selesai: ${results.success} berhasil, ${results.failed} gagal`,
      data: results,
    });
  } catch (err) {
    console.error('Import Excel error:', err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ success: false, message: 'Gagal memproses file Excel: ' + err.message });
  }
}

// ─── Download Template Excel ──────────────────────────────────────────────────
async function downloadTemplate(req, res) {
  const templateData = [
    {
      email: 'mahasiswa@example.com',
      password: 'Password123',
      full_name: 'Nama Lengkap Mahasiswa',
      nim_nip: '21234001',
      role: 'student',
      department: 'Teknik Informatika',
      academic_year: '2021',
      phone: '08123456789',
    },
    {
      email: 'dosen@example.com',
      password: 'Password123',
      full_name: 'Nama Lengkap Dosen',
      nim_nip: '198501012010011001',
      role: 'instructor',
      department: 'Teknik Informatika',
      academic_year: '',
      phone: '08987654321',
    },
  ];

  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(templateData);

  // Set lebar kolom
  worksheet['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 20 },
    { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
  ];

  xlsx.utils.book_append_sheet(workbook, worksheet, 'Template Import');

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=template_import_pengguna.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

module.exports = {
  getProfile,
  updateProfile,
  getAllProfiles,
  createUser,
  updateUserAdmin,
  deleteUser,
  getAdminUserStats,
  importFromExcel,
  downloadTemplate,
};

