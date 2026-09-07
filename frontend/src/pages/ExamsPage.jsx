import React, { useState, useEffect } from 'react';
import { quizAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import TopBarClock from '../components/TopBarClock';
import Footer from '../components/Footer';
import CreateQuizModal from '../components/CreateQuizModal';
import ExamTakingModal from '../components/ExamTakingModal';
import ConfirmModal from '../components/ConfirmModal';
import {
  Award, Clock, CheckCircle2, HelpCircle, XCircle,
  PlayCircle, AlertCircle, BookOpen, X, Search, Filter,
  Plus, Users, Trash2, Calendar, FileText, Check, Lock, ShieldAlert,
  Download, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportQuizParticipantsToExcel } from '../utils/quizExport';
import './Exams.css';

export default function ExamsPage() {
  const { user, isAdmin, isInstructor, isStudent } = useAuth();
  const isPrivileged = isAdmin || isInstructor;

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('Semua');

  // Create Quiz Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Exam Taking Modal State (Menggunakan ExamTakingModal komprehensif)
  const [activeQuiz, setActiveQuiz] = useState(null);

  // Submissions Modal State (Dosen / Admin)
  const [submissionsQuiz, setSubmissionsQuiz] = useState(null);
  const [submissionsData, setSubmissionsData] = useState(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [expandedAttemptId, setExpandedAttemptId] = useState(null);
  const [exportingQuizId, setExportingQuizId] = useState(null);

  // Confirm Delete State
  const [confirmDelete, setConfirmDelete] = useState({
    isOpen: false,
    quizId: null,
    title: ''
  });

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res = await quizAPI.getAll();
      setQuizzes(res.data?.data || []);
    } catch (err) {
      console.error('Fetch quizzes error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Submissions Modal (Rekap Nilai)
  const handleOpenSubmissions = async (quiz) => {
    setSubmissionsQuiz(quiz);
    setLoadingSubmissions(true);
    try {
      const res = await quizAPI.getSubmissions(quiz.id);
      setSubmissionsData(res.data?.data);
    } catch (err) {
      console.error('Failed to get submissions:', err);
      toast.error('Gagal memuat rekap peserta ujian');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Direct Export Submissions to Excel
  const handleDirectExport = async (quiz) => {
    setExportingQuizId(quiz.id);
    try {
      const res = await quizAPI.getSubmissions(quiz.id);
      const data = res.data?.data;
      if (!data || !data.submissions || data.submissions.length === 0) {
        toast.error(`Belum ada mahasiswa yang mengumpulkan ujian "${quiz.title}".`);
        return;
      }
      exportQuizParticipantsToExcel(quiz, data);
      toast.success(`Data peserta ujian "${quiz.title}" berhasil diexport ke Excel!`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengekspor data peserta: ' + (err.response?.data?.message || err.message));
    } finally {
      setExportingQuizId(null);
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = (quiz) => {
    setConfirmDelete({
      isOpen: true,
      quizId: quiz.id,
      title: quiz.title
    });
  };

  const executeDelete = async () => {
    try {
      await quizAPI.delete(confirmDelete.quizId);
      toast.success('Ujian/Kuis berhasil dihapus');
      fetchQuizzes();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Gagal menghapus ujian/kuis');
    } finally {
      setConfirmDelete({ isOpen: false, quizId: null, title: '' });
    }
  };

  const formatSchedule = (dtStr) => {
    if (!dtStr) return null;
    try {
      const d = new Date(dtStr);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dtStr;
    }
  };

  const uniqueCourses = ['Semua', ...new Set(quizzes.map((q) => q.course_title).filter(Boolean))];

  const filteredQuizzes = quizzes.filter((q) => {
    const matchSearch =
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      (q.course_title && q.course_title.toLowerCase().includes(search.toLowerCase())) ||
      (q.description && q.description.toLowerCase().includes(search.toLowerCase()));

    const matchCourse = filterCourse === 'Semua' || q.course_title === filterCourse;
    return matchSearch && matchCourse;
  });

  const now = new Date();

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <TopBarClock />
        <div className="container" style={{ padding: '24px' }}>
          
          {/* Header */}
          <div className="page-header animate-fadeIn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1>Portal <span className="gradient-text">Ujian & Evaluasi</span></h1>
              <p>Daftar evaluasi kompetensi, Ujian Tengah Semester (UTS), dan kuis akademik aktif</p>
            </div>

            {isPrivileged && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
              >
                <Plus size={18} /> Buat Ujian Baru
              </button>
            )}
          </div>

          {/* Filter & Pencarian */}
          <div className="exams-filter glass-card animate-fadeIn">
            <div className="exams-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Cari ujian, kuis, atau nama mata kuliah..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="exams-course-chips">
              <span className="chips-label">
                <Filter size={14} /> Mata Kuliah:
              </span>
              {uniqueCourses.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`course-chip ${filterCourse === c ? 'active' : ''}`}
                  onClick={() => setFilterCourse(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* List Kartu Ujian */}
          {loading ? (
            <div className="loading-center" style={{ padding: '48px' }}>
              <div className="spinner" />
              <p style={{ marginTop: '14px', color: 'var(--text-muted)' }}>Memuat daftar ujian...</p>
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="exams-empty card animate-fadeIn">
              <Award size={48} className="empty-icon" />
              <h3>Belum Ada Ujian yang Tersedia</h3>
              <p>Tidak ada jadwal ujian atau kuis aktif yang cocok dengan kriteria pencarian.</p>
              {isPrivileged && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: '16px' }}
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus size={16} /> Buat Ujian Sekarang
                </button>
              )}
            </div>
          ) : (
            <div className="exams-grid animate-fadeIn">
              {filteredQuizzes.map((quiz) => {
                const hasAttempted = (quiz.my_attempt_count > 0);
                const isNotStarted = quiz.start_time && new Date(quiz.start_time) > now;
                const isEnded = quiz.end_time && new Date(quiz.end_time) < now;

                return (
                  <div key={quiz.id} className="exam-card card">
                    <div className="exam-card-header">
                      <div className="exam-type-tag">
                        <Award size={14} />
                        <span>
                          {quiz.quiz_type === 'essay' ? 'ESSAY' : quiz.quiz_type === 'mixed' ? 'CAMPURAN' : 'PILIHAN GANDA'}
                        </span>
                      </div>
                      {quiz.course_title && (
                        <span className="exam-course-name" title={quiz.course_title}>
                          {quiz.course_code ? `[${quiz.course_code}] ` : ''}{quiz.course_title}
                        </span>
                      )}
                    </div>

                    <h3 className="exam-title">{quiz.title}</h3>
                    <p className="exam-desc">
                      {quiz.description || 'Evaluasi pemahaman materi perkuliahan yang telah dipelajari.'}
                    </p>

                    {/* Schedule Info if Available */}
                    {(quiz.start_time || quiz.end_time) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: isNotStarted ? 'hsl(38, 95%, 65%)' : 'var(--text-muted)', marginBottom: '12px' }}>
                        {isNotStarted ? <Lock size={13} /> : <Calendar size={13} />}
                        <span>
                          {isNotStarted ? 'Buka: ' : ''}
                          {quiz.start_time ? formatSchedule(quiz.start_time) : 'Sekarang'} s/d {quiz.end_time ? formatSchedule(quiz.end_time) : 'Seterusnya'}
                        </span>
                      </div>
                    )}

                    <div className="exam-specs">
                      <div className="exam-spec-item" title="Durasi Waktu">
                        <Clock size={14} />
                        <span>{quiz.time_limit_minutes > 0 ? `${quiz.time_limit_minutes} Menit` : 'Fleksibel'}</span>
                      </div>
                      <div className="exam-spec-item" title="Skor Kelulusan Minimal (KKM)">
                        <CheckCircle2 size={14} />
                        <span>KKM: {quiz.passing_score}%</span>
                      </div>
                      <div className="exam-spec-item" title="Jumlah Soal">
                        <HelpCircle size={14} />
                        <span>{quiz.question_count || 0} Soal</span>
                      </div>
                      {isPrivileged && quiz.submission_count !== undefined && (
                        <div className="exam-spec-item" title="Jumlah Mahasiswa yang Mengumpulkan" style={{ color: 'hsl(160, 80%, 75%)' }}>
                          <Users size={14} />
                          <span>{quiz.submission_count} Peserta</span>
                        </div>
                      )}
                    </div>

                    <div className="exam-card-footer" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {isPrivileged ? (
                        /* ─── ROLE ADMIN / DOSEN: Rekap & Export Data Peserta (Tanpa Tombol Preview Naskah) ─── */
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-full btn-start-exam"
                            onClick={() => handleOpenSubmissions(quiz)}
                            title="Lihat Rekap Nilai & Lembar Jawaban Peserta"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <Users size={16} />
                            <span>Rekap Nilai ({quiz.submission_count || 0})</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-primary btn-start-exam"
                            onClick={() => handleDirectExport(quiz)}
                            disabled={exportingQuizId === quiz.id}
                            title="Export Data Seluruh Mahasiswa yang Telah Ujian (.xlsx)"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '10px 14px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {exportingQuizId === quiz.id ? (
                              <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', display: 'inline-block' }} />
                            ) : (
                              <FileSpreadsheet size={16} />
                            )}
                            <span>Export Excel</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDeleteQuiz(quiz)}
                            title="Hapus Ujian"
                            style={{ color: 'hsl(0, 75%, 65%)', padding: '0 10px', height: '40px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        /* ─── ROLE MAHASISWA: Mulai Ujian / Status Pengerjaan ─── */
                        <>
                          {hasAttempted ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-full btn-start-exam"
                              onClick={() => setActiveQuiz(quiz)}
                              style={{ borderColor: 'hsla(160, 80%, 45%, 0.4)', color: 'hsl(160, 80%, 75%)' }}
                            >
                              <CheckCircle2 size={16} />
                              <span>Sudah Dikerjakan (Nilai: {quiz.my_score !== null ? quiz.my_score : '-'})</span>
                            </button>
                          ) : isNotStarted ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-full btn-start-exam"
                              onClick={() => setActiveQuiz(quiz)}
                              style={{ borderColor: 'hsla(38, 90%, 52%, 0.4)', color: 'hsl(38, 90%, 65%)' }}
                            >
                              <Lock size={16} />
                              <span>Ujian Terkunci (Lihat Jadwal)</span>
                            </button>
                          ) : isEnded ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-full btn-start-exam"
                              disabled
                              style={{ opacity: 0.6 }}
                            >
                              <AlertCircle size={16} />
                              <span>Ujian Telah Berakhir</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary btn-full btn-start-exam"
                              onClick={() => setActiveQuiz(quiz)}
                            >
                              <PlayCircle size={16} />
                              <span>Mulai Ujian Sekarang</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── MODAL PENGERJAAN UJIAN (LOCK, BRIEFING, HITUNG MUNDUR, PROTEKSI KELUAR) ─── */}
          <ExamTakingModal
            quiz={activeQuiz}
            isOpen={Boolean(activeQuiz)}
            onClose={() => setActiveQuiz(null)}
            onComplete={fetchQuizzes}
            isPrivileged={isPrivileged}
          />

          {/* ─── MODAL REKAP NILAI & JAWABAN MAHASISWA (DOSEN / ADMIN) ─── */}
          {submissionsQuiz && (
            <div className="exam-modal-backdrop">
              <div className="submissions-modal card animate-fadeIn">
                <div className="submissions-modal-header">
                  <div className="submissions-modal-title-wrap">
                    <span className="exam-modal-course">{submissionsQuiz.course_title}</span>
                    <h2>Rekap Hasil & Nilai Peserta: {submissionsQuiz.title}</h2>
                  </div>
                  <div className="submissions-modal-actions">
                    {submissionsData?.submissions?.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm btn-export-modal"
                        onClick={() => {
                          try {
                            exportQuizParticipantsToExcel(submissionsQuiz, submissionsData);
                            toast.success(`Data peserta ujian "${submissionsQuiz.title}" berhasil diexport ke Excel!`);
                          } catch (e) {
                            toast.error(e.message);
                          }
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <FileSpreadsheet size={15} />
                        <span>Export Excel (.xlsx)</span>
                      </button>
                    )}
                    <button onClick={() => setSubmissionsQuiz(null)} className="btn btn-ghost btn-sm modal-close-btn" aria-label="Tutup modal">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {loadingSubmissions ? (
                  <div className="loading-center" style={{ padding: '36px' }}>
                    <div className="spinner" />
                    <p style={{ marginTop: '12px' }}>Memuat rekap hasil ujian...</p>
                  </div>
                ) : !submissionsData || submissionsData.submissions?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                    <Users size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                    <h4>Belum Ada Mahasiswa yang Mengumpulkan</h4>
                    <p>Hasil nilai dan rincian jawaban mahasiswa akan muncul di sini begitu ujian disubmit.</p>
                  </div>
                ) : (
                  <div>
                    {/* Ringkasan Statistik Peserta */}
                    <div className="submissions-summary-grid">
                      <div className="glass-card submissions-summary-item">
                        <span className="summary-label">Total Pengumpul</span>
                        <h4 className="summary-value">{submissionsData.total_participants} Mahasiswa</h4>
                      </div>
                      <div className="glass-card submissions-summary-item">
                        <span className="summary-label">KKM Kelulusan</span>
                        <h4 className="summary-value" style={{ color: 'hsl(160, 80%, 75%)' }}>{submissionsQuiz.passing_score}%</h4>
                      </div>
                    </div>

                    {/* ─── DESKTOP TABLE VIEW (Laptop / PC) ─── */}
                    <div className="submissions-table-wrap">
                      <table className="submissions-table">
                        <thead>
                          <tr>
                            <th>Mahasiswa</th>
                            <th>NIM / NIP</th>
                            <th>Waktu Selesai</th>
                            <th>Nilai</th>
                            <th>Status</th>
                            <th>Rincian Jawaban</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissionsData.submissions.map((att) => (
                            <React.Fragment key={att.id}>
                              <tr>
                                <td>
                                  <strong>{att.student_name}</strong>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{att.email}</div>
                                </td>
                                <td>{att.nim || '-'}</td>
                                <td>{formatSchedule(att.submitted_at)}</td>
                                <td>
                                  <strong style={{ fontSize: '1.05rem', color: att.is_passed ? 'hsl(160, 80%, 75%)' : 'hsl(0, 75%, 75%)' }}>
                                    {att.score}
                                  </strong> / 100
                                </td>
                                <td>
                                  <span className={`exam-type-tag ${att.is_passed ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.7rem' }}>
                                    {att.is_passed ? 'LULUS' : 'REMEDIAL'}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setExpandedAttemptId(expandedAttemptId === att.id ? null : att.id)}
                                  >
                                    {expandedAttemptId === att.id ? 'Tutup Jawaban' : 'Lihat Jawaban'}
                                  </button>
                                </td>
                              </tr>

                              {/* Detail Jawaban Mahasiswa di Desktop Table */}
                              {expandedAttemptId === att.id && (
                                <tr>
                                  <td colSpan="6" style={{ background: 'hsla(220, 24%, 10%, 0.8)', padding: '16px' }}>
                                    <h4 style={{ fontSize: '0.88rem', color: 'var(--color-primary-light)', marginBottom: '12px' }}>
                                      Rincian Lembar Jawaban: {att.student_name}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      {att.answers?.map((ans, aIdx) => (
                                        <div key={ans.id} style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                          <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                                            {aIdx + 1}. {ans.question_text}
                                          </div>
                                          {ans.question_type === 'essay' ? (
                                            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                                              <strong>Jawaban Esai:</strong> {ans.text_answer || <span style={{ color: 'var(--text-muted)' }}>(Tidak dijawab)</span>}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span>Jawaban Mahasiswa: <strong>{ans.selected_option_text || '(Tidak dijawab)'}</strong></span>
                                              {ans.is_correct ? (
                                                <span style={{ color: 'hsl(160, 80%, 75%)', fontWeight: 600 }}>✓ Benar</span>
                                              ) : (
                                                <span style={{ color: 'hsl(0, 75%, 70%)', fontWeight: 600 }}>✗ Salah</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* ─── SMARTPHONE / MOBILE CARD VIEW ─── */}
                    <div className="submissions-mobile-cards">
                      {submissionsData.submissions.map((att) => (
                        <div key={att.id} className="sub-mobile-card">
                          <div className="sub-mobile-header">
                            <div className="sub-mobile-user">
                              <div className="sub-mobile-avatar">
                                {(att.student_name || 'U')[0].toUpperCase()}
                              </div>
                              <div className="sub-mobile-user-details">
                                <strong className="sub-mobile-name">{att.student_name}</strong>
                                <span className="sub-mobile-email">{att.email}</span>
                                {att.nim && (
                                  <span className="sub-mobile-nim">NIM: {att.nim}</span>
                                )}
                              </div>
                            </div>
                            <span className={`exam-type-tag ${att.is_passed ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                              {att.is_passed ? 'LULUS' : 'REMEDIAL'}
                            </span>
                          </div>

                          <div className="sub-mobile-metrics">
                            <div className="sub-mobile-metric-item">
                              <span className="sub-metric-label">Nilai Akhir:</span>
                              <strong className="sub-metric-score" style={{ color: att.is_passed ? 'hsl(160, 80%, 75%)' : 'hsl(0, 75%, 75%)' }}>
                                {att.score} <span className="sub-metric-total">/ 100</span>
                              </strong>
                            </div>
                            <div className="sub-mobile-metric-item">
                              <span className="sub-metric-label">Waktu Selesai:</span>
                              <span className="sub-metric-val">{formatSchedule(att.submitted_at)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-secondary btn-full sub-mobile-expand-btn"
                            onClick={() => setExpandedAttemptId(expandedAttemptId === att.id ? null : att.id)}
                          >
                            {expandedAttemptId === att.id ? '▲ Tutup Rincian Jawaban' : '▼ Lihat Rincian Jawaban'}
                          </button>

                          {/* Rincian Jawaban Smartphone */}
                          {expandedAttemptId === att.id && (
                            <div className="sub-mobile-answers animate-fadeIn">
                              <h5 className="sub-mobile-answers-title">
                                Lembar Jawaban: {att.student_name}
                              </h5>
                              <div className="sub-mobile-answers-list">
                                {att.answers?.map((ans, aIdx) => (
                                  <div key={ans.id} className="sub-mobile-ans-item">
                                    <div className="sub-mobile-q-text">
                                      {aIdx + 1}. {ans.question_text}
                                    </div>
                                    {ans.question_type === 'essay' ? (
                                      <div className="sub-mobile-essay-ans">
                                        <strong>Jawaban:</strong> {ans.text_answer || <span style={{ color: 'var(--text-muted)' }}>(Tidak dijawab)</span>}
                                      </div>
                                    ) : (
                                      <div className="sub-mobile-pg-ans">
                                        <span>Jawaban: <strong>{ans.selected_option_text || '(Tidak dijawab)'}</strong></span>
                                        {ans.is_correct ? (
                                          <span className="sub-ans-badge-correct">✓ Benar</span>
                                        ) : (
                                          <span className="sub-ans-badge-wrong">✗ Salah</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── MODAL BUAT UJIAN BARU ─── */}
          <CreateQuizModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={fetchQuizzes}
          />

          {/* ─── CONFIRM DELETE MODAL ─── */}
          <ConfirmModal
            isOpen={confirmDelete.isOpen}
            onClose={() => setConfirmDelete({ isOpen: false, quizId: null, title: '' })}
            onConfirm={executeDelete}
            title="Hapus Kuis / Ujian"
            message={`Apakah Anda yakin ingin menghapus ujian "${confirmDelete.title}"? Seluruh butir soal dan rekap nilai peserta akan terhapus permanen.`}
            confirmText="Ya, Hapus Ujian"
            cancelText="Batal"
            type="danger"
          />

        </div>
        <Footer />
      </main>
    </div>
  );
}
