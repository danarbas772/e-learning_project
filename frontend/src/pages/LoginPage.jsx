import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';
import './Auth.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');

  useEffect(() => {
    const msg = sessionStorage.getItem('session_message');
    if (msg) {
      setSessionNotice(msg);
      sessionStorage.removeItem('session_message');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSessionNotice('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Email atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Background decorations */}
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />

      <div className="auth-container animate-fadeIn">
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <GraduationCap size={28} />
          </div>
          <h1 className="auth-brand-name">Bas Learning</h1>
        </div>

        {/* Card */}
        <div className="auth-card glass-card">
          <div className="auth-card-header">
            <h2>Selamat Datang Kembali 👋</h2>
            <p>Masuk untuk melanjutkan belajar</p>
          </div>

          {sessionNotice && (
            <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
              <span>{sessionNotice}</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <div className="input-icon-wrap">
                <Mail size={16} className="input-icon" />
                <input
                  id="login-email"
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
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="input-icon-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="form-input input-with-icon input-with-action"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="input-action-btn"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                  Masuk...
                </span>
              ) : (
                <>Masuk ke Akun <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <p>Akun didaftarkan langsung oleh Administrator / Akademik.</p>
          </div>
        </div>
        <Footer className="auth-footer" />
      </div>
    </div>
  );
}
