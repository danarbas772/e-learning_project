import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { enrollmentAPI, courseAPI, userAPI, quizAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBarClock from '../components/TopBarClock';
import Footer from '../components/Footer';
import {
  BookOpen, ClipboardList, TrendingUp, Users, ArrowRight,
  Award, CheckCircle, XCircle, GraduationCap, BarChart2,
  PieChart, Calendar, UserCheck, Radio
} from 'lucide-react';
import './Dashboard.css';

// Helper: konversi judul matkul ke URL slug
const toSlug = (str) => (str || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

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
  const [studentExams, setStudentExams] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [adminStats, setAdminStats] = useState({
    totalStudents: 0,
    totalCourses: 0,
    activeCourses: 0,
    inactiveCourses: 0,
    batchData: [],
  });
  const [instructorAttendanceStats, setInstructorAttendanceStats] = useState([]);
  const [instructorTotalStudents, setInstructorTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (isStudent) {
          let sProfile = null;
          if (user?.id) {
            try {
              const pRes = await userAPI.getProfile(user.id);
              sProfile = pRes.data?.data || null;
            } catch (err) {
              console.error('Fetch student profile error:', err);
            }
          }

          const params = { user_role: 'student' };
          if (user?.id) params.user_id = user.id;
          if (sProfile) {
            params.user_name = sProfile.full_name;
            params.user_academic_year = sProfile.academic_year;
            params.user_semester = sProfile.semester || 1;
          }

          const [courseRes, examRes] = await Promise.all([
            courseAPI.getAll(params).catch(() => ({ data: { data: [] } })),
            quizAPI.getAll().catch(() => ({ data: { data: [] } })),
          ]);

          setEnrolledCourses(courseRes.data?.data || []);
          setStudentExams(examRes.data?.data || []);
        }
        if (isInstructor) {
          const [myCoursesRes, attStatsRes] = await Promise.all([
            courseAPI.getMyCourses().catch(() => ({ data: { data: [] } })),
            courseAPI.getInstructorAttendanceStats().catch(() => ({ data: { data: [] } })),
          ]);
          setMyCourses(myCoursesRes.data?.data || []);
          setInstructorTotalStudents(
            myCoursesRes.data?.total_students !== undefined
              ? Number(myCoursesRes.data.total_students)
              : (myCoursesRes.data?.data || []).reduce((sum, c) => sum + (c.enrolled_count || 0), 0)
          );
          setInstructorAttendanceStats(attStatsRes.data?.data || []);
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
  }, [isStudent, isInstructor, isAdmin, user?.id]);

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
                  value={instructorTotalStudents}
                  color="var(--color-accent)"
                />
              </div>

              {/* ─── Grafik Presensi Kehadiran Mahasiswa (4 Pertemuan Terakhir Per Matkul) ─── */}
              <div className="attendance-analytics-section" style={{ marginTop: '24px' }}>
                <div className="section-header" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BarChart2 size={22} style={{ color: 'var(--color-primary-light)' }} />
                    <h2 className="section-title" style={{ margin: 0 }}>Grafik Presensi Kehadiran Mahasiswa (4 Pertemuan Terakhir)</h2>
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                    {instructorAttendanceStats.length} Mata Kuliah
                  </span>
                </div>

                {instructorAttendanceStats.length === 0 ? (
                  <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <UserCheck size={36} style={{ opacity: 0.35, marginBottom: '10px' }} />
                    <p style={{ margin: 0, fontSize: '0.92rem' }}>Belum ada data mata kuliah atau pertemuan untuk ditampilkan.</p>
                  </div>
                ) : (
                  <div className="instructor-attendance-grid">
                    {instructorAttendanceStats.map((courseItem) => {
                      const maxHadir = Math.max(1, ...(courseItem.sessions.map(s => s.hadir_count) || [1]));
                      const totalHadirCourse = courseItem.sessions.reduce((acc, s) => acc + s.hadir_count, 0);

                      return (
                        <div key={courseItem.course_id} className="card instructor-attendance-card animate-fadeIn">
                          <div className="attendance-card-header">
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span className="course-code-tag">{courseItem.course_code || 'MATKUL'}</span>
                                <h3 className="course-chart-title">{courseItem.course_title}</h3>
                              </div>
                              <p className="course-chart-subtitle">
                                4 Pertemuan Terakhir • Total Hadir: <strong>{totalHadirCourse} Mahasiswa</strong>
                              </p>
                            </div>
                            <Link to={`/courses/${toSlug(courseItem.course_title)}`} className="btn-detail-link" title="Buka detail mata kuliah">
                              Lihat Kelas →
                            </Link>
                          </div>

                          <div className="attendance-chart-container">
                            {courseItem.sessions.length === 0 ? (
                              <div className="empty-chart-text">
                                <p>Belum ada sesi pertemuan</p>
                              </div>
                            ) : (
                              <div className="attendance-bars-wrap">
                                {courseItem.sessions.map((session, sIdx) => {
                                  const barHeightPercent = session.hadir_count > 0
                                    ? Math.max(16, Math.round((session.hadir_count / maxHadir) * 100))
                                    : 8;

                                  return (
                                    <div key={session.section_id || sIdx} className="attendance-bar-column">
                                      <span className={`attendance-bar-count ${session.hadir_count > 0 ? 'has-count' : ''}`}>
                                        {session.hadir_count}
                                      </span>
                                      <div className="attendance-bar-track">
                                        <div
                                          className={`attendance-bar-fill ${session.is_active ? 'active-session-bar' : ''}`}
                                          style={{ height: `${barHeightPercent}%` }}
                                          title={`${session.title}: ${session.hadir_count} Mahasiswa Hadir${session.is_active ? ' (Presensi Aktif)' : ''}`}
                                        />
                                      </div>
                                      <div className="attendance-bar-label-wrap">
                                        <span className="attendance-bar-label" title={session.title}>
                                          {session.title.replace('PERTEMUAN', 'P.').trim()}
                                        </span>
                                        {session.is_active && (
                                          <span className="active-dot" title="Presensi sedang aktif" />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  value={enrolledCourses.filter(e => e.is_published === 1 || e.is_published === true).length}
                  color="var(--color-accent)"
                />
                <StatCard
                  icon={Award}
                  label="Ujian"
                  value={studentExams.length}
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
                      <h4>Mata Kuliah</h4>
                      <p>Lihat materi & perkuliahan Anda</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                  <Link to="/exams" className="quick-action-card card">
                    <Award size={24} className="quick-action-icon" />
                    <div>
                      <h4>Ujian</h4>
                      <p>Kerjakan kuis & evaluasi pembelajaran</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                  <Link to="/calendar" className="quick-action-card card">
                    <Calendar size={24} className="quick-action-icon" />
                    <div>
                      <h4>Kalender</h4>
                      <p>Jadwal perkuliahan & agenda</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                </>
              )}

              {isInstructor && (
                <>
                  <Link to="/courses" className="quick-action-card card">
                    <BookOpen size={24} className="quick-action-icon" />
                    <div>
                      <h4>Mata Kuliah</h4>
                      <p>Lihat & kelola mata kuliah Anda</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                  <Link to="/exams" className="quick-action-card card">
                    <Award size={24} className="quick-action-icon" />
                    <div>
                      <h4>Ujian</h4>
                      <p>Kelola soal & jadwal ujian</p>
                    </div>
                    <ArrowRight size={18} className="quick-action-arrow" />
                  </Link>
                  <Link to="/calendar" className="quick-action-card card">
                    <Calendar size={24} className="quick-action-icon" />
                    <div>
                      <h4>Kalender</h4>
                      <p>Jadwal perkuliahan & agenda</p>
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
      <circle cx="40" cy="40" r="36" stroke="url(#grad1)" strokeWidth="2" opacity="0.3" />
      <circle cx="40" cy="40" r="24" fill="url(#grad2)" opacity="0.4" />
      <path d="M28 38l8 8 16-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="grad1" x1="0" y1="0" x2="80" y2="80">
          <stop stopColor="hsl(250, 85%, 60%)" />
          <stop offset="1" stopColor="hsl(180, 80%, 48%)" />
        </linearGradient>
        <linearGradient id="grad2" x1="0" y1="0" x2="80" y2="80">
          <stop stopColor="hsl(250, 85%, 60%)" />
          <stop offset="1" stopColor="hsl(180, 80%, 48%)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
