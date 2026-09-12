import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { GraduationCap, Mail, Lock, User, ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';
import './Auth.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', role: 'student' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      return setError('Password dan konfirmasi password tidak cocok');
    }
    if (form.password.length < 6) {
      return setError('Password minimal 6 karakter');
    }

    setLoading(true);
    try {
      await authAPI.register({ email: form.email, password: form.password, role: form.role });
      setSuccess('Registrasi berhasil! Silakan login.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />

      <div className="auth-container animate-fadeIn">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <GraduationCap size={28} />
          </div>
          <h1 className="auth-brand-name">Bas Learning</h1>
        </div>

        <div className="auth-card glass-card">
          <div className="auth-card-header">
            <h2>Buat Akun Baru 🚀</h2>
            <p>Bergabung dan mulai belajar hari ini</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Role Selection */}
            <div className="form-group">
              <label className="form-label">Saya adalah</label>
              <div className="auth-role-grid">
                <button
                  type="button"
                  className={`auth-role-option ${form.role === 'student' ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, role: 'student' })}
                >
                  <span className="auth-role-icon">🎓</span>
                  Mahasiswa
                </button>
                <button
                  type="button"
                  className={`auth-role-option ${form.role === 'instructor' ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, role: 'instructor' })}
                >
                  <span className="auth-role-icon">👨‍🏫</span>
                  Dosen
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email</label>
              <div className="input-icon-wrap">
                <Mail size={16} className="input-icon" />
                <input
                  id="reg-email"
                  type="email"
                  className="form-input input-with-icon"
                  placeholder="email@contoh.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <div className="input-icon-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  id="reg-password"
                  type="password"
                  className="form-input input-with-icon"
                  placeholder="Minimal 6 karakter"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Konfirmasi Password</label>
              <div className="input-icon-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  id="reg-confirm"
                  type="password"
                  className="form-input input-with-icon"
                  placeholder="Ulangi password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>

            <button
              id="register-submit-btn"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                  Mendaftar...
                </span>
              ) : (
                <>Daftar Sekarang <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <p className="auth-redirect">
            Sudah punya akun?{' '}
            <Link to="/login" className="auth-link">Masuk di sini</Link>
          </p>
        </div>
        <Footer className="auth-footer" />
      </div>
    </div>
  );
}
