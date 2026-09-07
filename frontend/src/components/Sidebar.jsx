import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen, LayoutDashboard, Users, Award, Calendar,
  FileText, LogOut, GraduationCap, Menu, X
} from 'lucide-react';
import './Sidebar.css';

const navItems = {
  student: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: BookOpen, label: 'Mata Kuliah', path: '/courses' },
    { icon: Award, label: 'Ujian', path: '/exams' },
    { icon: Calendar, label: 'Kalender', path: '/calendar' },
  ],
  instructor: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: BookOpen, label: 'Mata Kuliah', path: '/courses' },
    { icon: Award, label: 'Ujian', path: '/exams' },
    { icon: Calendar, label: 'Kalender', path: '/calendar' },
  ],
  admin: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Kelola Pengguna', path: '/admin/users' },
    { icon: BookOpen, label: 'Mata Kuliah', path: '/courses' },
    { icon: Award, label: 'Ujian', path: '/exams' },
    { icon: Calendar, label: 'Kalender', path: '/calendar' },
    { icon: FileText, label: 'Laporan', path: '/admin/reports' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = navItems[user?.role] || navItems.student;

  // Tutup sidebar mobile otomatis saat pindah halaman
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel = {
    admin: 'Administrator',
    instructor: 'Dosen',
    student: 'Mahasiswa',
  };

  return (
    <>
      {/* Mobile overlay backdrop - klik untuk menutup */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating hamburger button khusus smartphone saat sidebar tertutup */}
      <button
        type="button"
        className={`sidebar-fab ${mobileOpen ? 'sidebar-fab-hidden' : ''}`}
        onClick={() => setMobileOpen(true)}
        aria-label="Buka menu navigasi"
      >
        <Menu size={22} />
      </button>

      {/* Sidebar drawer */}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo" onClick={() => setMobileOpen(false)}>
            <div className="sidebar-logo-icon">
              <GraduationCap size={22} />
            </div>
            <span className="sidebar-logo-text">EduSpace</span>
          </Link>

          {/* Tombol tutup khusus tampilan smartphone */}
          <button
            type="button"
            className="sidebar-mobile-close btn btn-ghost btn-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup navigasi"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Info — Dapat diklik untuk membuka & mengedit profil akun sendiri */}
        <Link
          to="/profile"
          className="sidebar-user-link"
          title="Lihat Profil & Edit Akun"
          onClick={() => setMobileOpen(false)}
        >
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {(user?.full_name || user?.email)?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <p className="sidebar-user-name" style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontSize: '0.88rem', lineHeight: 1.25 }}>
                {user?.full_name || user?.email}
              </p>
              {user?.full_name && user?.full_name !== user?.email && (
                <p className="sidebar-user-email" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0', wordBreak: 'break-all' }}>
                  {user?.email}
                </p>
              )}
              <span className="badge badge-primary" style={{ marginTop: '4px', alignSelf: 'flex-start' }}>
                {roleLabel[user?.role] || user?.role}
              </span>
            </div>
          </div>
        </Link>

        <div className="sidebar-divider" />

        {/* Navigation */}
        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} className="sidebar-nav-icon" />
                <span className="sidebar-nav-label">{item.label}</span>
                {isActive && <div className="sidebar-nav-indicator" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="sidebar-footer">
          <button className="sidebar-logout btn btn-ghost btn-full" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
