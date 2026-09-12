import React, { useState, useEffect, useRef, useCallback } from 'react';
import { quizAPI } from '../services/api';
import {
  Clock, AlertTriangle, CheckCircle2, AlertCircle, X, ShieldAlert,
  PlayCircle, HelpCircle, FileText, ArrowRight, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Modal Pengerjaan Ujian dengan Proteksi:
 * 1. Lock jika belum mencapai tanggal/jam mulai
 * 2. Hitung mundur waktu ujian (dibatasi jam selesai) — persisten via localStorage
 * 3. Notifikasi konfirmasi briefing sebelum mulai
 * 4. Peringatan keluar (jika keluar dianggap selesai & tidak dapat mengulang)
 * 5. Single attempt (tidak dapat mengerjakan kembali setelah submit/keluar)
 * 6. Timer & status ujian tetap berjalan meski browser di-refresh
 */

// Key untuk menyimpan sesi ujian aktif ke localStorage
const makeSessionKey = (quizId) => `exam_session_${quizId}`;
const makeAnswersKey = (quizId) => `exam_answers_${quizId}`;

export default function ExamTakingModal({
  quiz,
  isOpen,
  onClose,
  onComplete,
  isPrivileged = false
}) {
  const [quizDetails, setQuizDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Exam Progress State
  const [isStarted, setIsStarted] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // Warning Leave Dialog State
  const [showExitWarning, setShowExitWarning] = useState(false);

  // Countdown to Start Time (if locked)
  const [countdownToStart, setCountdownToStart] = useState('');
  const [isTimeLocked, setIsTimeLocked] = useState(false);
  const [isTimeExpired, setIsTimeExpired] = useState(false);

  const answersRef = useRef(quizAnswers);
  answersRef.current = quizAnswers;

  // ---------- Session Persistence Helpers ----------
  const saveSession = useCallback((quizId, startedAt, endAt) => {
    try {
      localStorage.setItem(makeSessionKey(quizId), JSON.stringify({ startedAt, endAt }));
    } catch { /* ignore */ }
  }, []);

  const loadSession = useCallback((quizId) => {
    try {
      const raw = localStorage.getItem(makeSessionKey(quizId));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }, []);

  const clearSession = useCallback((quizId) => {
    try {
      localStorage.removeItem(makeSessionKey(quizId));
      localStorage.removeItem(makeAnswersKey(quizId));
    } catch { /* ignore */ }
  }, []);

  const saveAnswers = useCallback((quizId, answers) => {
    try {
      localStorage.setItem(makeAnswersKey(quizId), JSON.stringify(answers));
    } catch { /* ignore */ }
  }, []);

  const loadAnswers = useCallback((quizId) => {
    try {
      const raw = localStorage.getItem(makeAnswersKey(quizId));
      if (!raw) return {};
      return JSON.parse(raw);
    } catch { return {}; }
  }, []);

  // ---------- Load Quiz ----------
  useEffect(() => {
    if (isOpen && quiz) {
      loadQuiz();
    } else {
      resetState();
    }
  }, [isOpen, quiz]);

  const resetState = () => {
    setQuizDetails(null);
    setIsStarted(false);
    setQuizAnswers({});
    setTimeLeft(null);
    setQuizResult(null);
    setShowExitWarning(false);
    setIsTimeLocked(false);
    setIsTimeExpired(false);
  };

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const res = await quizAPI.getById(quiz.id);
      const data = res.data?.data;
      setQuizDetails(data);

      // Check if user already submitted
      if (data.my_attempt && !isPrivileged) {
        setQuizResult({
          attempt_id: data.my_attempt.id,
          score: data.my_attempt.score,
          is_passed: Boolean(data.my_attempt.is_passed),
          already_completed: true
        });
        clearSession(quiz.id);
        setLoading(false);
        return;
      }

      // Check Time Scheduling
      const now = new Date(data.server_time || new Date());
      const startTime = data.start_time ? new Date(data.start_time) : null;
      const endTime = data.end_time ? new Date(data.end_time) : null;

      if (!isPrivileged) {
        if (startTime && startTime > now) {
          setIsTimeLocked(true);
          setLoading(false);
          return;
        } else if (endTime && endTime < now) {
          setIsTimeExpired(true);
          setLoading(false);
          return;
        }
      }

      // ---- Restore session if exists (browser was refreshed during exam) ----
      const session = loadSession(quiz.id);
      if (session && !isPrivileged) {
        const nowMs = Date.now();
        const endAtMs = new Date(session.endAt).getTime();
        const remainSecs = Math.floor((endAtMs - nowMs) / 1000);

        if (remainSecs > 0) {
          // Session still valid — restore exam state
          const savedAnswers = loadAnswers(quiz.id);
          setQuizAnswers(savedAnswers);
          setTimeLeft(remainSecs);
          setIsStarted(true); // ← jump straight to exam mode (skip briefing)
          setLoading(false);
          toast('Sesi ujian Anda telah dipulihkan.', { icon: '🔄' });
          return;
        } else {
          // Session expired — auto-submit
          clearSession(quiz.id);
          const savedAnswers = loadAnswers(quiz.id);
          setQuizAnswers(savedAnswers);
          setIsStarted(true);
          setTimeLeft(0);
          setLoading(false);
          return;
        }
      }

      // ---- New exam: calculate initial timeLeft ----
      if (data.time_limit_minutes > 0) {
        let maxSecs = data.time_limit_minutes * 60;
        if (endTime && endTime > now) {
          const secsUntilEnd = Math.floor((endTime - now) / 1000);
          if (secsUntilEnd < maxSecs) maxSecs = secsUntilEnd;
        }
        setTimeLeft(Math.max(10, maxSecs));
      }

    } catch (err) {
      console.error('Fetch quiz detail error:', err);
      toast.error('Gagal memuat data ujian');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Live Countdown Effect ----------
  useEffect(() => {
    let timer = null;

    // 1. Countdown to Start Time (if locked)
    if (isTimeLocked && quizDetails?.start_time) {
      const targetTime = new Date(quizDetails.start_time).getTime();
      const updateLockCountdown = () => {
        const diff = targetTime - Date.now();
        if (diff <= 0) {
          setIsTimeLocked(false);
          loadQuiz();
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const mins = Math.floor((diff / 1000 / 60) % 60);
          const secs = Math.floor((diff / 1000) % 60);
          let str = '';
          if (days > 0) str += `${days} hari `;
          str += `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          setCountdownToStart(str);
        }
      };
      updateLockCountdown();
      timer = setInterval(updateLockCountdown, 1000);
    }

    // 2. Countdown Exam Taking (if started)
    if (isStarted && timeLeft !== null && timeLeft > 0 && !quizResult) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoSubmitOnTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => { if (timer) clearInterval(timer); };
  }, [isTimeLocked, isStarted, timeLeft, quizResult, quizDetails]);

  // ---------- Auto-save answers to localStorage ----------
  useEffect(() => {
    if (isStarted && quiz?.id && !quizResult) {
      saveAnswers(quiz.id, quizAnswers);
    }
  }, [quizAnswers, isStarted, quizResult]);

  // ---------- Anti-Tab Close / Refresh Protection ----------
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isStarted && !quizResult && !isPrivileged) {
        e.preventDefault();
        e.returnValue = 'Ujian sedang berlangsung! Jika Anda keluar, jawaban Anda tetap tersimpan sementara dan timer terus berjalan.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isStarted, quizResult, isPrivileged]);

  // ---------- Handler: Start Exam from Briefing ----------
  const handleConfirmStart = () => {
    if (!quiz?.id || !quizDetails) return;

    // Calculate exam end time based on duration
    const now = Date.now();
    const durationMs = (quizDetails.time_limit_minutes || 60) * 60 * 1000;
    let endAt = now + durationMs;

    // Cap by quiz end_time if exists
    if (quizDetails.end_time) {
      const quizEndMs = new Date(quizDetails.end_time).getTime();
      if (quizEndMs < endAt) endAt = quizEndMs;
    }

    // Save session to localStorage so refresh can restore it
    saveSession(quiz.id, new Date(now).toISOString(), new Date(endAt).toISOString());

    setIsStarted(true);
    toast.success('Sesi ujian telah dimulai. Selamat mengerjakan!');
  };

  // ---------- Handler: Try Close Modal ----------
  const handleAttemptClose = () => {
    if (quizResult || !isStarted || isPrivileged) {
      onClose();
      return;
    }
    setShowExitWarning(true);
  };

  // ---------- Handler: Force Exit & Auto Submit ----------
  const handleConfirmExitAndSubmit = () => {
    setShowExitWarning(false);
    toast.error('Anda memilih keluar. Lembar ujian dikumpulkan secara otomatis.');
    executeSubmit(true);
  };

  const handleAutoSubmitOnTimeOut = () => {
    toast.error('Waktu pengerjaan telah habis! Lembar ujian dikumpulkan otomatis.');
    executeSubmit(false);
  };

  // ---------- Submit Handler ----------
  const handleManualSubmit = (e) => {
    if (e) e.preventDefault();
    if (!quizDetails || !quizDetails.questions) return;

    const unanswered = quizDetails.questions.filter((q) => {
      if (q.question_type === 'essay') return !quizAnswers[q.id] || quizAnswers[q.id].trim() === '';
      return !quizAnswers[q.id];
    }).length;

    if (unanswered > 0) {
      if (!window.confirm(`Perhatian: Masih terdapat ${unanswered} butir soal yang belum dijawab. Apakah Anda yakin ingin mengumpulkan ujian sekarang?`)) {
        return;
      }
    }
    executeSubmit(false);
  };

  const executeSubmit = async (isForcedExit = false) => {
    if (!quizDetails) return;

    const answersPayload = quizDetails.questions.map((q) => ({
      question_id: q.id,
      selected_option_id: q.question_type !== 'essay' ? answersRef.current[q.id] || null : null,
      text_answer: q.question_type === 'essay' ? answersRef.current[q.id] || '' : null,
    }));

    setSubmitting(true);
    try {
      const res = await quizAPI.submit({
        quiz_id: quizDetails.id,
        answers: answersPayload,
      });
      clearSession(quiz.id); // clear local session after successful submit
      setQuizResult(res.data.data);
      setIsStarted(false);
      if (onComplete) onComplete();
      toast.success(res.data.message || 'Jawaban ujian berhasil dikumpulkan!');
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err.response?.data?.message || 'Gagal mengumpulkan jawaban ujian.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Helpers ----------
  const formatTimer = (secs) => {
    if (secs === null) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDateTime = (dtStr) => {
    if (!dtStr) return '-';
    try {
      return new Date(dtStr).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return dtStr; }
  };

  const answeredCount = Object.keys(quizAnswers).length;
  const totalQuestions = quizDetails?.questions?.length || 0;

  if (!isOpen) return null;

  return (
    <div className="exam-modal-backdrop">
      <div className="exam-modal-dialog card animate-fadeIn" style={{ maxWidth: '840px', position: 'relative' }}>

        {/* Modal Header */}
        <div className="exam-modal-header">
          <div style={{ minWidth: 0 }}>
            <span className="exam-modal-course">{quiz.course_title || 'Mata Kuliah'}</span>
            <h2 style={{ fontSize: 'clamp(1rem, 3vw, 1.4rem)', lineHeight: 1.3 }}>{quiz.title}</h2>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            className="btn btn-ghost btn-sm modal-close-btn"
            title="Tutup"
            style={{ flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="loading-center" style={{ padding: '48px' }}>
            <div className="spinner" />
            <p style={{ marginTop: '14px', color: 'var(--text-muted)' }}>Memuat sesi ujian...</p>
          </div>

        ) : isTimeLocked ? (
          /* ─── CASE 1: TIME LOCKED ─── */
          <div className="quiz-result-view animate-fadeIn" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{
              display: 'inline-flex', padding: '20px',
              borderRadius: 'var(--radius-full)',
              background: 'hsla(38, 95%, 52%, 0.15)',
              color: 'hsl(38, 95%, 65%)', marginBottom: '16px'
            }}>
              <Lock size={54} />
            </div>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Ujian Belum Dibuka
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 20px' }}>
              Naskah soal ujian ini terkunci otomatis sampai tanggal dan jam pelaksanaan resmi dimulai.
            </p>
            <div style={{
              display: 'inline-block', padding: '16px 28px',
              background: 'hsla(220, 24%, 12%, 0.8)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)', marginBottom: '24px'
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Hitung Mundur Waktu Dibuka:
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', color: 'hsl(38, 95%, 65%)' }}>
                {countdownToStart || 'Menghitung...'}
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Jadwal Mulai: <strong>{formatDateTime(quizDetails?.start_time)}</strong>
              </span>
            </div>
            <div>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Kembali ke Daftar Ujian
              </button>
            </div>
          </div>

        ) : isTimeExpired ? (
          /* ─── CASE 2: TIME EXPIRED ─── */
          <div className="quiz-result-view animate-fadeIn" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{
              display: 'inline-flex', padding: '20px',
              borderRadius: 'var(--radius-full)',
              background: 'hsla(0, 75%, 60%, 0.15)',
              color: 'hsl(0, 75%, 65%)', marginBottom: '16px'
            }}>
              <ShieldAlert size={54} />
            </div>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Jadwal Ujian Telah Berakhir
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 20px' }}>
              Batas akhir pengerjaan ujian ini telah lewat ({formatDateTime(quizDetails?.end_time)}).
            </p>
            <button type="button" onClick={onClose} className="btn btn-secondary">Tutup</button>
          </div>

        ) : quizResult ? (
          /* ─── CASE 3: HASIL UJIAN ─── */
          <div className="quiz-result-view animate-fadeIn">
            <div className={`quiz-result-card ${quizResult.score !== null ? (quizResult.is_passed ? 'passed' : 'failed') : 'review'}`} style={quizResult.score === null ? { borderColor: 'hsla(38, 90%, 52%, 0.4)' } : {}}>
              {quizResult.score !== null ? (
                quizResult.is_passed ? <CheckCircle2 size={56} /> : <AlertCircle size={56} />
              ) : (
                <FileText size={56} style={{ color: 'hsl(38, 95%, 65%)' }} />
              )}
              <h3>
                {quizResult.score !== null
                  ? (quizResult.is_passed ? 'Selamat! Anda Telah Lulus' : 'Ujian Telah Diselesaikan')
                  : 'Jawaban Berhasil Dikumpulkan'}
              </h3>
              {quizResult.score !== null ? (
                <div className="quiz-score-display">
                  <span className="score-number">{quizResult.score}</span>
                  <span className="score-total">/ 100</span>
                </div>
              ) : (
                <div style={{ margin: '14px 0', padding: '10px 18px', background: 'hsla(38, 90%, 52%, 0.12)', border: '1px solid hsla(38, 90%, 52%, 0.3)', borderRadius: 'var(--radius-md)', color: 'hsl(38, 95%, 70%)', fontSize: '0.95rem', fontWeight: 600 }}>
                  📝 Soal Esai: Menunggu Penilaian &amp; Koreksi Dosen
                </div>
              )}
              <p className="quiz-score-sub">
                {quizResult.total_mc_questions > 0 && (
                  <span>Jawaban Pilihan Ganda Benar: <strong>{quizResult.correct_count}</strong> dari {quizResult.total_mc_questions} butir.<br/></span>
                )}
                {quizResult.has_essay && (
                  <span style={{ color: 'hsl(215, 90%, 80%)' }}>
                    ✨ Lembar jawaban esai Anda telah tersimpan rapi dan akan dikoreksi oleh dosen pengampu.
                  </span>
                )}
                {quizResult.already_completed && (
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                    Sesuai kebijakan akademik, ujian ini telah diselesaikan dan tidak dapat dikerjakan ulang.
                  </span>
                )}
              </p>
              <div style={{ marginTop: '6px', fontSize: '0.8rem', opacity: 0.8 }}>
                Status: Tersimpan di Database • Attempt #{quizResult.attempt_id}
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button type="button" onClick={onClose} className="btn btn-primary">
                Tutup Lembar Ujian
              </button>
            </div>
          </div>

        ) : !isStarted ? (
          /* ─── CASE 4: BRIEFING PRA-UJIAN ─── */
          <div className="exam-briefing-view animate-fadeIn">
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '16px 20px',
              background: 'hsla(215, 85%, 55%, 0.12)',
              border: '1px solid hsla(215, 85%, 55%, 0.3)',
              borderRadius: 'var(--radius-md)', marginBottom: '20px'
            }}>
              <PlayCircle size={28} style={{ color: 'hsl(215, 90%, 75%)', flexShrink: 0 }} />
              <div>
                <h4 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '0.98rem' }}>
                  Konfirmasi Memulai Ujian: {quiz.title}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '4px 0 0' }}>
                  Silakan baca dengan saksama seluruh aturan dan ketentuan pengerjaan di bawah ini.
                </p>
              </div>
            </div>

            {/* Spesifikasi Ujian */}
            <div className="exam-specs" style={{ marginBottom: '20px' }}>
              <div className="exam-spec-item" title="Durasi Pengerjaan">
                <Clock size={16} />
                <span>Durasi: <strong>{quiz.time_limit_minutes > 0 ? `${quiz.time_limit_minutes} Menit` : 'Fleksibel'}</strong></span>
              </div>
              <div className="exam-spec-item" title="Passing Score Minimal">
                <CheckCircle2 size={16} />
                <span>KKM: <strong>{quiz.passing_score}%</strong></span>
              </div>
              <div className="exam-spec-item" title="Jumlah Butir Soal">
                <HelpCircle size={16} />
                <span>Jumlah: <strong>{quizDetails?.questions?.length || 0} Soal</strong></span>
              </div>
              {quiz.end_time && (
                <div className="exam-spec-item" title="Batas Akhir Jam Selesai">
                  <AlertCircle size={16} />
                  <span>Batas Selesai: <strong>{formatDateTime(quiz.end_time)}</strong></span>
                </div>
              )}
            </div>

            {/* KOTAK PERINGATAN */}
            <div style={{
              padding: '18px 20px',
              background: 'hsla(0, 80%, 55%, 0.12)',
              border: '1px solid hsla(0, 80%, 55%, 0.35)',
              borderRadius: 'var(--radius-md)', marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(0, 80%, 75%)', fontWeight: 700, marginBottom: '8px' }}>
                <AlertTriangle size={18} />
                <span>ATURAN & KETENTUAN PENTING SELAMA UJIAN:</span>
              </div>
              <ul style={{ paddingLeft: '20px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                <li>Setelah Anda mengklik <strong>"Lanjutkan & Mulai Ujian"</strong>, waktu pengerjaan akan langsung berjalan mundur.</li>
                <li><strong>Jika Anda menutup atau me-refresh browser:</strong> Timer tetap berjalan di latar belakang. Anda dapat membuka kembali ujian dan melanjutkan dari posisi terakhir.</li>
                <li>Ujian akan <strong>OTOMATIS DIKUMPULKAN</strong> saat waktu habis.</li>
                <li>Anda <strong>TIDAK DAPAT MENGERJAKAN KEMBALI</strong> ujian ini setelah dikumpulkan. Pastikan koneksi internet Anda stabil.</li>
              </ul>
            </div>

            {/* Tombol Aksi Briefing */}
            <div className="exam-briefing-actions">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmStart}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
              >
                <span>Lanjutkan &amp; Mulai Ujian</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

        ) : (
          /* ─── CASE 5: FORM LEMBAR UJIAN AKTIF ─── */
          <form onSubmit={handleManualSubmit} className="quiz-form">

            {/* Top Bar with Timer & Count */}
            <div className="exam-taking-top-meta">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Terjawab: <strong>{answeredCount}</strong> / {totalQuestions}
                </span>
              </div>
              {timeLeft !== null && (
                <div className={`exam-countdown-timer ${timeLeft < 300 ? 'timer-danger' : ''}`}>
                  <Clock size={16} />
                  <span>Sisa Waktu: {formatTimer(timeLeft)}</span>
                </div>
              )}
            </div>

            <div className="exam-guidelines-banner" style={{ background: 'hsla(38, 90%, 52%, 0.1)', borderColor: 'hsla(38, 90%, 52%, 0.3)', color: 'hsl(38, 90%, 75%)' }}>
              <AlertTriangle size={16} />
              <span>
                Sesi Ujian Sedang Aktif. Jangan menutup atau meninggalkan halaman ini agar ujian tidak otomatis terkumpul.
              </span>
            </div>

            {/* Question Quick Navigation */}
            {quizDetails.questions && quizDetails.questions.length > 1 && (
              <div className="question-nav-bar" style={{ padding: '10px 14px', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Navigasi Cepat Nomor Soal:
                </span>
                <div className="question-number-grid" style={{ maxHeight: '80px' }}>
                  {quizDetails.questions.map((q, qIdx) => {
                    const isAnswered = q.question_type === 'essay'
                      ? Boolean(quizAnswers[q.id]?.trim())
                      : Boolean(quizAnswers[q.id]);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        className={`num-btn ${isAnswered ? 'filled' : ''}`}
                        onClick={() => {
                          const el = document.getElementById(`exam-q-anchor-${q.id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                      >
                        {qIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* List of Questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '52vh', overflowY: 'auto', paddingRight: '4px' }}>
              {quizDetails.questions?.map((q, qIdx) => (
                <div key={q.id} id={`exam-q-anchor-${q.id}`} className="question-block card">
                  <div className="question-block-header">
                    <h4 className="question-title" style={{ margin: 0 }}>
                      {qIdx + 1}. {q.question_text}
                    </h4>
                    <span className="question-type-badge">
                      {q.question_type === 'essay' ? 'Essay' : 'Pilihan Ganda'} • {q.points || 1} Poin
                    </span>
                  </div>

                  {q.question_type === 'essay' ? (
                    <div>
                      <textarea
                        className="form-input essay-answer-textarea"
                        placeholder="Ketikkan lembar jawaban esai Anda secara lengkap di sini..."
                        value={quizAnswers[q.id] || ''}
                        onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                        rows={4}
                        required
                      />
                    </div>
                  ) : (
                    <div className="options-list">
                      {q.options?.map((opt) => (
                        <label key={opt.id} className={`option-label ${quizAnswers[q.id] === opt.id ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name={`active_q_${q.id}`}
                            value={opt.id}
                            checked={quizAnswers[q.id] === opt.id}
                            onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt.id })}
                            required
                          />
                          <span className="option-text">{opt.option_text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Exam Actions — responsive mobile-friendly */}
            <div className="exam-modal-actions">
              <button
                type="button"
                onClick={handleAttemptClose}
                className="btn btn-secondary exam-action-exit"
                disabled={submitting}
              >
                <X size={16} />
                <span>Keluar</span>
              </button>
              <button
                type="submit"
                className="btn btn-primary exam-action-submit"
                disabled={submitting || !quizDetails.questions?.length}
              >
                {submitting
                  ? 'Mengumpulkan...'
                  : <><FileText size={16} /><span>Kumpulkan ({answeredCount}/{totalQuestions})</span></>
                }
              </button>
            </div>
          </form>
        )}

        {/* ─── MODAL PERINGATAN KELUAR UJIAN ─── */}
        {showExitWarning && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="card animate-scaleUp" style={{
              maxWidth: '520px', padding: '28px',
              background: 'var(--bg-surface)',
              border: '2px solid hsla(0, 80%, 55%, 0.6)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
            }}>
              <div style={{
                display: 'inline-flex', padding: '16px',
                borderRadius: 'var(--radius-full)',
                background: 'hsla(0, 80%, 55%, 0.15)',
                color: 'hsl(0, 80%, 75%)', marginBottom: '16px'
              }}>
                <ShieldAlert size={48} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'hsl(0, 80%, 80%)', marginBottom: '10px' }}>
                PERINGATAN: ANDA INGIN KELUAR?
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                Jika Anda keluar atau menutup halaman ini sekarang, sesi ujian Anda akan{' '}
                <strong>OTOMATIS DIANGGAP SELESAI</strong> dan seluruh jawaban Anda saat ini langsung dikumpulkan ke sistem.
                <br/><br/>
                <strong style={{ color: 'hsl(0, 80%, 75%)' }}>
                  ⚠️ Anda TIDAK DAPAT mengerjakan kembali ujian ini!
                </strong>
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowExitWarning(false)}
                  style={{ fontWeight: 700 }}
                >
                  Tetap Lanjutkan Ujian
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleConfirmExitAndSubmit}
                  style={{ borderColor: 'hsla(0, 75%, 60%, 0.5)', color: 'hsl(0, 75%, 75%)' }}
                >
                  Keluar &amp; Selesai
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
