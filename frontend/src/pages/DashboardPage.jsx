import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { enrollmentAPI, courseAPI, userAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBarClock from '../components/TopBarClock';
import Footer from '../components/Footer';
import {
  BookOpen, ClipboardList, TrendingUp, Users, ArrowRight,
  Award, CheckCircle, XCircle, GraduationCap, BarChart2,
  PieChart, Calendar
} from 'lucide-react';
import './Dashboard.css';

function StatCard({ icon: Icon, label, value, color, change }) {
  return (
    <div className="stat-card card">
      <div className="stat-card-icon" style={{ '--stat-color': color }}>
        <Icon size={22} />
      </div>
      <div className="stat-card-info">
        <p className="stat-card-label">{label}</p>
        <h3 className="stat-card-value">{value}</h3>
        {change && <p className="stat-card-change">{change}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isStudent, isInstructor, isAdmin } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [adminStats, setAdminStats] = useState({
    totalStudents: 0,
    totalCourses: 0,
    activeCourses: 0,
    inactiveCourses: 0,
    batchData: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (isStudent) {
          const res = await enrollmentAPI.getMyCourses();
          setEnrolledCourses(res.data.data || []);
        }
        if (isInstructor) {
          const res = await courseAPI.getMyCourses();
          setMyCourses(res.data.data || []);
        }
        if (isAdmin) {
          const [userStatsRes, courseStatsRes] = await Promise.all([
            userAPI.getAdminStats().catch(() => ({ data: { data: {} } })),
            courseAPI.getAdminStats().catch(() => ({ data: { data: {} } })),
          ]);

          const uData = userStatsRes.data?.data || {};
          const cData = courseStatsRes.data?.data || {};

          setAdminStats({
            totalStudents: Number(uData.total_students || 0),
            totalCourses: Number(cData.total_courses || 0),
            activeCourses: Number(cData.active_courses || 0),
            inactiveCourses: Number(cData.inactive_courses || 0),
            batchData: uData.students_by_batch || [],
          });
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isStudent, isInstructor, isAdmin]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 17) return 'Selamat Siang';
    return 'Selamat Malam';
  };

  const roleLabel = { admin: 'Administrator', instructor: 'Dosen', student: 'Mahasiswa' };

  // Hitung persentase untuk grafik donat / visualisasi status matkul
  const totalCourses = adminStats.totalCourses || 0;
  const activePercent = totalCourses > 0 ? Math.round((adminStats.activeCourses / totalCourses) * 100) : 0;
  const inactivePercent = totalCourses > 0 ? 100 - activePercent : 0;

  // Temukan nilai maksimum batch untuk penskalaan bar chart
  const maxBatchCount = Math.max(1, ...(adminStats.batchData?.map(b => b.count) || [1]));

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <TopBarClock />
        <div className="container">
          {/* Hero Greeting */}
          <div className="dashboard-hero animate-fadeIn">
            <div className="dashboard-blob dashboard-blob-1" />
            <div className="dashboard-blob dashboard-blob-2" />
            <div className="dashboard-hero-content">
              <div>
                <p className="dashboard-greeting">{greeting()},</p>
                <h1 className="dashboard-username">
                  {user?.email?.split('@')[0]} <span className="wave-emoji">👋</span>
                </h1>
                <p className="dashboard-role-badge">
                  <span className={`badge badge-primary`}>{roleLabel[user?.role]}</span>
                </p>
              </div>
              <div className="dashboard-hero-art animate-float">
                <div className="dashboard-art-circle">
                  <GradientIcon />
                </div>
              </div>
            </div>
          </div>

          {/* ADMIN DASHBOARD: 4 Kartu Numerik & Grafik Lengkap */}
          {isAdmin && (
            <>
              {/* 4 Kartu Numerik Admin */}
              <section className="dashboard-section animate-fadeIn">
                <h2 className="section-title">Ringkasan Analitik Sistem</h2>
                <div className="dashboard-stats admin-stats-grid">
                  <StatCard
                    icon={GraduationCap}
                    label="Total Mahasiswa"
                    value={adminStats.totalStudents}
                    color="hsl(210, 100%, 56%)"
                  />
                  <StatCard
                    icon={BookOpen}
                    label="Total Mata Kuliah"
                    value={adminStats.totalCourses}
                    color="var(--color-primary)"
                  />
                  <StatCard
                    icon={CheckCircle}
                    label="Matkul Aktif"
                    value={adminStats.activeCourses}
                    color="var(--color-success)"
                    change={`${activePercent}% dari total`}
                  />
                  <StatCard
                    icon={XCircle}
                    label="Matkul Non-Aktif"
                    value={adminStats.inactiveCourses}
                    color="hsl(350, 80%, 60%)"
                    change={`${inactivePercent}% dari total`}
                  />
                </div>
              </section>

              {/* Grafik Analitik Admin */}
              <section className="dashboard-section animate-fadeIn">
                <div className="analytics-grid">
                  {/* Grafik 1: Distribusi Status Mata Kuliah */}
                  <div className="card analytics-card">
                    <div className="analytics-card-header">
                      <div className="header-title-wrap">
                        <PieChart size={20} className="analytics-icon" />
                        <h3>Status Mata Kuliah</h3>
                      </div>
                      <span className="badge badge-info">{totalCourses} Total Matkul</span>
                    </div>

                    <div className="matkul-donut-container">
                      <div className="donut-chart-box">
                        <svg viewBox="0 0 36 36" className="donut-svg">
                          <path
                            className="donut-ring"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="donut-segment"
                            strokeDasharray={`${activePercent}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="donut-center-text">
                          <span className="donut-number">{activePercent}%</span>
                          <span className="donut-label">Aktif</span>
                        </div>
                      </div>

                      <div className="donut-legend">
                        <div className="legend-row">
                          <span className="legend-indicator" style={{ background: 'var(--color-success)' }} />
                          <div className="legend-info">
                            <span className="legend-name">Matkul Aktif</span>
                            <span className="legend-count">{adminStats.activeCourses} Matkul ({activePercent}%)</span>
                          </div>
                        </div>

                        <div className="legend-row">
                          <span className="legend-indicator" style={{ background: 'hsl(350, 80%, 60%)' }} />
                          <div className="legend-info">
                            <span className="legend-name">Matkul Non-Aktif</span>
                            <span className="legend-count">{adminStats.inactiveCourses} Matkul ({inactivePercent}%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grafik 2: Total Mahasiswa per Angkatan */}
                  <div className="card analytics-card">
                    <div className="analytics-card-header">
                      <div className="header-title-wrap">
                        <BarChart2 size={20} className="analytics-icon" />
                        <h3>Mahasiswa per Angkatan</h3>
                      </div>
                      <span className="badge badge-primary">{adminStats.totalStudents} Mahasiswa</span>
                    </div>

                    <div className="batch-chart-container">
                      {adminStats.batchData?.length === 0 ? (
                        <div className="empty-chart-text">
                          <Calendar size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                          <p>Belum ada data angkatan mahasiswa terdaftar.</p>
                        </div>
                      ) : (
                        <div className="batch-bars-wrap">
                          {adminStats.batchData.map((item, idx) => {
                            const barHeight = Math.max(12, Math.round((item.count / maxBatchCount) * 100));
                            return (
                              <div key={idx} className="batch-bar-column">
                                <span className="batch-bar-count">{item.count}</span>
                                <div className="batch-bar-track">
                                  <div
                                    className="batch-bar-fill"
                                    style={{ height: `${barHeight}%` }}
                                    title={`${item.count} Mahasiswa`}
                                  />
                                </div>
                                <span className="batch-bar-label">{item.batch}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Dosen Stats */}
          {isInstructor && (
            <section className="dashboard-section animate-fadeIn">
              <div className="dashboard-stats">
                <StatCard
                  icon={BookOpen}
                  label="Total Mata Kuliah"
                  value={myCourses.length}
                  color="var(--color-primary)"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Matkul Aktif"
                  value={myCourses.filter(c => c.is_published).length}
                  color="var(--color-success)"
                />
                <StatCard
                  icon={Users}
                  label="Mahasiswa Terdaftar"
                  value={myCourses.reduce((sum, c) => sum + (c.enrolled_count || 0), 0)}
                  color="var(--color-accent)"
                />
              </div>
            </section>
          )}

          {/* Mahasiswa Stats */}
          {isStudent && (
            <section className="dashboard-section animate-fadeIn">
              <div className="dashboard-stats">
                <StatCard
                  icon={BookOpen}
                  label="Matkul Terdaftar"
                  value={enrolledCourses.length}
                  color="var(--color-primary)"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Sedang Berjalan"
                  value={enrolledCourses.filter(e => e.status === 'active').length}
                  color="var(--color-accent)"
                />
                <StatCard
                  icon={Award}
                  label="Matkul Selesai"
                  value={enrolledCourses.filter(e => e.status === 'completed').length}
                  color="var(--color-success)"
                />
              </div>
            </section>
          )}

          {/* Quick Actions */}
          <section className="dashboard-section animate-fadeIn">
            <h2 className="section-title">Aksi Cepat</h2>
            <div className="quick-actions">
              {isStudent && (
                <>
                  <Link to="/courses" className="quick-action-card card">
                    <BookOpen size={24} className="quick-action-icon" />
                    <div>
                      <h4>Jelajahi Mata Kuliah</h4>
                      <p>Temukan mata kuliah baru</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                  <Link to="/my-courses" className="quick-action-card card">
                    <ClipboardList size={24} className="quick-action-icon" />
                    <div>
                      <h4>Matkul Saya</h4>
                      <p>Lanjutkan pembelajaran</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                </>
              )}

              {isInstructor && (
                <>
                  <Link to="/manage-courses" className="quick-action-card card">
                    <BookOpen size={24} className="quick-action-icon" />
                    <div>
                      <h4>Kelola Mata Kuliah</h4>
                      <p>Buat atau edit mata kuliah</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                  <Link to="/upload-material" className="quick-action-card card">
                    <ClipboardList size={24} className="quick-action-icon" />
                    <div>
                      <h4>Upload Materi</h4>
                      <p>Upload PDF/PPT sesi matkul</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                </>
              )}

              {isAdmin && (
                <>
                  <Link to="/courses" className="quick-action-card card">
                    <BookOpen size={24} className="quick-action-icon" />
                    <div>
                      <h4>Katalog Mata Kuliah</h4>
                      <p>Kelola & buat mata kuliah baru</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                  <Link to="/admin/users" className="quick-action-card card">
                    <Users size={24} className="quick-action-icon" />
                    <div>
                      <h4>Kelola Pengguna</h4>
                      <p>Tambah Dosen & Mahasiswa</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                  <Link to="/admin/import" className="quick-action-card card">
                    <ClipboardList size={24} className="quick-action-icon" />
                    <div>
                      <h4>Import Excel</h4>
                      <p>Import pengguna massal</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                </>
              )}
            </div>
          </section>

          {/* Recent Courses (Student) */}
          {isStudent && !loading && enrolledCourses.length > 0 && (
            <section className="dashboard-section animate-fadeIn">
              <div className="section-header">
                <h2 className="section-title">Mata Kuliah Terakhir</h2>
                <Link to="/my-courses" className="section-link">Lihat semua →</Link>
              </div>
              <div className="recent-courses">
                {enrolledCourses.slice(0, 3).map(enrollment => (
                  <div key={enrollment.id} className="recent-course-card glass-card">
                    <div className="recent-course-info">
                      <BookOpen size={16} />
                      <span>Mata Kuliah #{enrollment.course_id}</span>
                    </div>
                    <span className={`badge badge-${enrollment.status === 'completed' ? 'success' : 'primary'}`}>
                      {enrollment.status === 'completed' ? 'Selesai' : 'Aktif'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {loading && (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
}

function GradientIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="36" stroke="url(#grad1)" strokeWidth="2" opacity="0.3"/>
      <circle cx="40" cy="40" r="24" fill="url(#grad2)" opacity="0.4"/>
      <path d="M28 38l8 8 16-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="grad1" x1="0" y1="0" x2="80" y2="80">
          <stop stopColor="hsl(250, 85%, 60%)"/>
          <stop offset="1" stopColor="hsl(180, 80%, 48%)"/>
        </linearGradient>
        <linearGradient id="grad2" x1="0" y1="0" x2="80" y2="80">
          <stop stopColor="hsl(250, 85%, 60%)"/>
          <stop offset="1" stopColor="hsl(180, 80%, 48%)"/>
        </linearGradient>
      </defs>
    </svg>
  );
}
