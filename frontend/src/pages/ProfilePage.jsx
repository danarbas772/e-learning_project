import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBarClock from '../components/TopBarClock';
import Footer from '../components/Footer';
import {
  User, Mail, Phone, BookOpen, Calendar, Lock,
  Save, CheckCircle2, AlertCircle, Shield, GraduationCap,
  Layers, KeyRound, Sparkles
} from 'lucide-react';
import './Profile.css';

export default function ProfilePage() {
  const { user, login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    bio: '',
    department: '',
    academic_year: '',
    semester: 1,
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (user?.id) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const res = await userAPI.getProfile(user.id);
      const data = res.data.data;
      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        email: user.email || '',
        phone: data.phone || '',
        bio: data.bio || '',
        department: data.department || '',
        academic_year: data.academic_year || '',
        semester: data.semester || 1,
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      console.error('Fetch profile error:', err);
      setAlert({ type: 'error', message: 'Gagal memuat data profil' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ type: '', message: '' });

    if (formData.new_password) {
      if (formData.new_password.length < 6) {
        return setAlert({ type: 'error', message: 'Password baru minimal 6 karakter' });
      }
      if (formData.new_password !== formData.confirm_password) {
        return setAlert({ type: 'error', message: 'Konfirmasi password tidak cocok' });
      }
    }

    setSaving(true);
    try {
      const payload = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        bio: formData.bio,
        department: formData.department,
        academic_year: formData.academic_year,
        semester: formData.semester,
      };

      if (formData.new_password) {
        payload.password = formData.new_password;
      }

      const res = await userAPI.updateProfile(user.id, payload);
      setAlert({ type: 'success', message: res.data.message || 'Profil berhasil diperbarui!' });

      // Perbarui email di localStorage jika diubah
      if (formData.email && formData.email !== user.email) {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        stored.email = formData.email;
        localStorage.setItem('user', JSON.stringify(stored));
      }

      setFormData((prev) => ({
        ...prev,
        new_password: '',
        confirm_password: '',
      }));

      fetchUserProfile();
    } catch (err) {
      console.error('Update profile error:', err);
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Gagal memperbarui profil akun',
      });
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = {
    admin: 'Administrator',
    instructor: 'Dosen Pengampu',
    student: 'Mahasiswa',
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <TopBarClock />
        <div className="container" style={{ padding: '24px', maxWidth: '1000px' }}>
          
          {/* Header Banner Profil */}
          <div className="profile-header-card glass-card animate-fadeIn">
            <div className="profile-header-left">
              <div className="profile-avatar-large">
                {formData.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="profile-header-info">
                <h1 className="profile-name">
                  {formData.full_name || user?.email?.split('@')[0]}
                </h1>
                <p className="profile-email">
                  <Mail size={14} /> {user?.email}
                </p>
                <div className="profile-badges">
                  <span className={`badge badge-${user?.role === 'admin' ? 'warning' : user?.role === 'instructor' ? 'primary' : 'info'}`}>
                    <Shield size={12} /> {roleLabel[user?.role] || user?.role}
                  </span>
                  {profile?.department && (
                    <span className="profile-tag">
                      <GraduationCap size={12} /> {profile.department}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Alert */}
          {alert.message && (
            <div className={`alert alert-${alert.type === 'success' ? 'success' : 'danger'} animate-fadeIn`} style={{ margin: '20px 0' }}>
              {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{alert.message}</span>
            </div>
          )}

          {/* Form Edit Profil */}
          <div className="profile-form-container card animate-fadeIn" style={{ marginTop: '20px' }}>
            <div className="profile-section-title">
              <User size={20} className="section-icon" />
              <div>
                <h3>Informasi Pribadi & Akun</h3>
                <p>Perbarui identitas diri, kontak, dan kredensial akun Anda</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Nama Lengkap Anda"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Alamat Email *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="email@elearning.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Nomor Telepon / WhatsApp</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: 081234567890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Program Studi</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Teknik Informatika / Manajemen"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
              </div>

              {user?.role === 'student' && (
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Tahun Angkatan</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: 2024"
                      value={formData.academic_year}
                      onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Semester</label>
                    <input
                      type="number"
                      min="1"
                      max="14"
                      className="form-input"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Bio / Catatan Diri</label>
                <textarea
                  rows="3"
                  className="form-input"
                  placeholder="Ceritakan sedikit tentang Anda, minat, atau bidang fokus..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>

              {/* Ganti Password Section */}
              <div className="password-section-divider">
                <div className="profile-section-title" style={{ border: 'none', padding: 0, margin: '20px 0 16px' }}>
                  <KeyRound size={20} className="section-icon" />
                  <div>
                    <h4>Ganti Password (Opsional)</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Kosongkan jika Anda tidak ingin mengubah kata sandi akun
                    </p>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Password Baru</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Minimal 6 karakter"
                      value={formData.new_password}
                      onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Ulangi password baru"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="profile-submit-row">
                <button
                  type="submit"
                  className="btn btn-primary btn-save-profile"
                  disabled={saving}
                >
                  <Save size={18} />
                  <span>{saving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Akun'}</span>
                </button>
              </div>
            </form>
          </div>

        </div>
        <Footer />
      </main>
    </div>
  );
}
