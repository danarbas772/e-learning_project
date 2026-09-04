import { useState, useEffect } from 'react';
import { quizAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import TopBarClock from '../components/TopBarClock';
import Footer from '../components/Footer';
import {
  Award, Clock, CheckCircle2, HelpCircle, XCircle,
  PlayCircle, AlertCircle, BookOpen, X, Search, Filter
} from 'lucide-react';
import './Exams.css';

export default function ExamsPage() {
  const { user, isStudent } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('Semua');

  // Exam Modal State
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizDetails, setQuizDetails] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

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

  const handleOpenQuizModal = async (quiz) => {
    setActiveQuiz(quiz);
    setQuizResult(null);
    setQuizAnswers({});
    try {
      const res = await quizAPI.getById(quiz.id);
      setQuizDetails(res.data?.data);
    } catch (err) {
      console.error('Fetch quiz detail error:', err);
    }
  };

  const handleSubmitQuiz = async (e) => {
    e.preventDefault();
    if (!quizDetails || !quizDetails.questions) return;

    const answersPayload = quizDetails.questions.map((q) => ({
      question_id: q.id,
      selected_option_id: quizAnswers[q.id] || null,
    }));

    setSubmittingQuiz(true);
    try {
      const res = await quizAPI.submit({
        quiz_id: quizDetails.id,
        answers: answersPayload,
      });
      setQuizResult(res.data.data);
    } catch (err) {
      console.error('Submit quiz error:', err);
    } finally {
      setSubmittingQuiz(false);
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

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <TopBarClock />
        <div className="container" style={{ padding: '24px' }}>
          
          {/* Header */}
          <div className="page-header animate-fadeIn">
            <div>
              <h1>Portal <span className="gradient-text">Ujian & Evaluasi</span></h1>
              <p>Daftar evaluasi kompetensi, Ujian Tengah Semester (UTS), dan kuis akademik aktif</p>
            </div>
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
            </div>
          ) : (
            <div className="exams-grid animate-fadeIn">
              {filteredQuizzes.map((quiz) => (
                <div key={quiz.id} className="exam-card card">
                  <div className="exam-card-header">
                    <div className="exam-type-tag">
                      <Award size={14} />
                      <span>{quiz.course_code || 'EVALUASI'}</span>
                    </div>
                    {quiz.course_title && (
                      <span className="exam-course-name" title={quiz.course_title}>
                        {quiz.course_title}
                      </span>
                    )}
                  </div>

                  <h3 className="exam-title">{quiz.title}</h3>
                  <p className="exam-desc">
                    {quiz.description || 'Evaluasi pemahaman materi perkuliahan yang telah dipelajari.'}
                  </p>

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
                      <span>{quiz.question_count || 5} Soal</span>
                    </div>
                  </div>

                  <div className="exam-card-footer">
                    <button
                      type="button"
                      className="btn btn-primary btn-full btn-start-exam"
                      onClick={() => handleOpenQuizModal(quiz)}
                    >
                      <PlayCircle size={16} />
                      <span>{isStudent ? 'Mulai Ujian Sekarang' : 'Preview Lembar Ujian'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── MODAL PENGERJAAN UJIAN ─── */}
          {activeQuiz && (
            <div className="exam-modal-backdrop">
              <div className="exam-modal-dialog card animate-fadeIn">
                <div className="exam-modal-header">
                  <div>
                    <span className="exam-modal-course">{activeQuiz.course_title || 'Mata Kuliah'}</span>
                    <h2>{activeQuiz.title}</h2>
                  </div>
                  <button onClick={() => setActiveQuiz(null)} className="btn btn-ghost btn-sm modal-close-btn">
                    <X size={20} />
                  </button>
                </div>

                {!quizDetails ? (
                  <div className="loading-center" style={{ padding: '36px' }}>
                    <div className="spinner" />
                    <p style={{ marginTop: '12px' }}>Memuat naskah soal ujian...</p>
                  </div>
                ) : quizResult ? (
                  /* Hasil Ujian */
                  <div className="quiz-result-view animate-fadeIn">
                    <div className={`quiz-result-card ${quizResult.passed ? 'passed' : 'failed'}`}>
                      {quizResult.passed ? <CheckCircle2 size={56} /> : <XCircle size={56} />}
                      <h3>{quizResult.passed ? 'Selamat! Anda Lulus' : 'Belum Mencapai KKM'}</h3>
                      <div className="quiz-score-display">
                        <span className="score-number">{quizResult.score}</span>
                        <span className="score-total">/ 100</span>
                      </div>
                      <p className="quiz-score-sub">
                        Jawaban benar: {quizResult.correct_count} dari {quizResult.total_questions} pertanyaan
                      </p>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                      <button onClick={() => setActiveQuiz(null)} className="btn btn-primary">
                        Selesai & Tutup
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form Lembar Ujian */
                  <form onSubmit={handleSubmitQuiz} className="quiz-form">
                    <div className="exam-guidelines-banner">
                      <AlertCircle size={16} />
                      <span>Pilihlah salah satu jawaban yang paling tepat untuk setiap butir pertanyaan di bawah ini.</span>
                    </div>

                    {quizDetails.questions && quizDetails.questions.length > 0 ? (
                      quizDetails.questions.map((q, qIdx) => (
                        <div key={q.id} className="question-block card">
                          <h4 className="question-title">
                            {qIdx + 1}. {q.question_text}
                          </h4>
                          <div className="options-list">
                            {q.options && q.options.map((opt) => (
                              <label key={opt.id} className={`option-label ${quizAnswers[q.id] === opt.id ? 'selected' : ''}`}>
                                <input
                                  type="radio"
                                  name={`question_${q.id}`}
                                  value={opt.id}
                                  checked={quizAnswers[q.id] === opt.id}
                                  onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt.id })}
                                  required
                                />
                                <span className="option-text">{opt.option_text}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="session-empty-notice">Belum ada butir soal pada ujian ini.</p>
                    )}

                    <div className="exam-modal-actions">
                      <button type="button" onClick={() => setActiveQuiz(null)} className="btn btn-secondary">
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submittingQuiz || !quizDetails.questions?.length}
                      >
                        {submittingQuiz ? 'Mengumpulkan...' : 'Kumpulkan Jawaban Ujian'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

        </div>
        <Footer />
      </main>
    </div>
  );
}
