import { useState, useEffect } from 'react';
import { quizAPI, courseAPI } from '../services/api';
import {
  X, Plus, Trash2, Upload, Download, FileSpreadsheet,
  CheckCircle2, AlertCircle, Clock, Calendar, HelpCircle,
  Sparkles, Layers, ListChecks, FileText, ChevronRight, ChevronLeft
} from 'lucide-react';
import { downloadQuizTemplate, parseQuizExcel } from '../utils/quizExcelTemplate';
import toast from 'react-hot-toast';

export default function CreateQuizModal({ isOpen, onClose, onSuccess, initialCourseId, courseTitle }) {
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Form State
  const [courseId, setCourseId] = useState(initialCourseId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quizType, setQuizType] = useState('multiple_choice'); // 'multiple_choice' | 'essay' | 'mixed'
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [passingScore, setPassingScore] = useState(70);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  // Questions Management
  const [inputTab, setInputTab] = useState('manual'); // 'manual' | 'import'
  const [questions, setQuestions] = useState([
    {
      question_text: '',
      question_type: 'multiple_choice',
      points: 2,
      order_index: 0,
      options: [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
      ]
    }
  ]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // Import & Custom Count State
  const [targetCountInput, setTargetCountInput] = useState(50);
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialCourseId) {
        setCourseId(initialCourseId);
      } else {
        loadCourses();
      }
      // Set default start_time to now (rounded to nearest 5 min) and end_time to +7 days
      const now = new Date();
      const in7Days = new Date();
      in7Days.setDate(in7Days.getDate() + 7);

      const formatDT = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      if (!startTime) setStartTime(formatDT(now));
      if (!endTime) setEndTime(formatDT(in7Days));
    }
  }, [isOpen, initialCourseId]);

  const loadCourses = async () => {
    setLoadingCourses(true);
    try {
      const res = await courseAPI.getAll();
      setCourses(res.data?.data || []);
      if (!courseId && res.data?.data?.length > 0) {
        setCourseId(res.data.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  // Helper: Create default blank question
  const createBlankQuestion = (index, type = quizType === 'essay' ? 'essay' : 'multiple_choice') => ({
    question_text: '',
    question_type: type,
    points: type === 'essay' ? 10 : 2,
    order_index: index,
    options: type === 'essay' ? [] : [
      { option_text: '', is_correct: true },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
    ]
  });

  // Dynamic Generate Custom Count of Questions
  const handleApplyQuestionCount = (desiredCount) => {
    const count = parseInt(desiredCount, 10);
    if (isNaN(count) || count < 1) {
      toast.error('Jumlah butir soal minimal adalah 1');
      return;
    }
    if (count > 200) {
      toast.error('Jumlah butir soal maksimal adalah 200');
      return;
    }

    const isEssay = quizType === 'essay';

    if (count === questions.length) {
      toast(`Jumlah butir soal sudah sesuai (${count} butir).`);
      return;
    }

    if (count > questions.length) {
      // Tambah slot baru tanpa menghapus soal yang sudah diketik
      const additional = [];
      for (let i = questions.length; i < count; i++) {
        additional.push(createBlankQuestion(i, isEssay ? 'essay' : 'multiple_choice'));
      }
      setQuestions([...questions, ...additional]);
      toast.success(`${count} Slot butir soal berhasil disiapkan!`);
    } else {
      // Mengurangi soal: beri konfirmasi jika ada soal terisi yang akan terhapus
      const willDeleteFilled = questions.slice(count).some(q => q.question_text.trim() !== '');
      if (willDeleteFilled) {
        if (!window.confirm(`Perhatian: Mengurangi jumlah butir soal menjadi ${count} akan menghapus beberapa butir soal yang telah diisi. Apakah Anda yakin ingin melanjutkan?`)) {
          return;
        }
      }
      const trimmed = questions.slice(0, count);
      setQuestions(trimmed);
      if (activeQuestionIndex >= count) {
        setActiveQuestionIndex(count - 1);
      }
      toast.success(`Jumlah butir soal disesuaikan menjadi ${count} butir.`);
    }
  };

  // Add 1 Question
  const handleAddQuestion = () => {
    const nextIdx = questions.length;
    setQuestions([...questions, createBlankQuestion(nextIdx)]);
    setActiveQuestionIndex(nextIdx);
  };

  // Remove Question
  const handleRemoveQuestion = (idx) => {
    if (questions.length <= 1) {
      toast.error('Kuis harus memiliki minimal 1 butir soal');
      return;
    }
    const updated = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i }));
    setQuestions(updated);
    setActiveQuestionIndex(Math.max(0, idx - 1));
  };

  // Update Active Question Field
  const updateActiveQuestion = (field, value) => {
    const updated = [...questions];
    updated[activeQuestionIndex] = {
      ...updated[activeQuestionIndex],
      [field]: value
    };
    setQuestions(updated);
  };

  // Update Option Text or is_correct
  const updateOption = (optIdx, text) => {
    const updated = [...questions];
    const q = updated[activeQuestionIndex];
    const newOptions = [...q.options];
    newOptions[optIdx] = { ...newOptions[optIdx], option_text: text };
    updated[activeQuestionIndex] = { ...q, options: newOptions };
    setQuestions(updated);
  };

  const setCorrectOption = (optIdx) => {
    const updated = [...questions];
    const q = updated[activeQuestionIndex];
    const newOptions = q.options.map((opt, i) => ({
      ...opt,
      is_correct: i === optIdx
    }));
    updated[activeQuestionIndex] = { ...q, options: newOptions };
    setQuestions(updated);
  };

  // Handle Excel File Upload & Parsing
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportLoading(true);
    setImportSummary(null);

    try {
      const result = await parseQuizExcel(file);
      if (result.questions && result.questions.length > 0) {
        setQuestions(result.questions);
        setActiveQuestionIndex(0);
        setImportSummary({
          total: result.questions.length,
          warnings: result.warnings || [],
          fileName: file.name
        });
        toast.success(`Berhasil mengimpor ${result.questions.length} butir soal dari Excel!`);
        // Switch back to manual tab so user can review the parsed questions
        setInputTab('manual');
      }
    } catch (err) {
      console.error('Import excel error:', err);
      toast.error(err.message || 'Gagal memproses file Excel.');
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!courseId) {
      toast.error('Silakan pilih mata kuliah');
      return;
    }
    if (!title.trim()) {
      toast.error('Judul kuis/ujian wajib diisi');
      return;
    }

    // Validasi soal
    if (!questions || questions.length === 0) {
      toast.error('Minimal harus ada 1 butir pertanyaan');
      return;
    }

    const invalidQuestions = questions.filter(q => !q.question_text.trim());
    if (invalidQuestions.length > 0) {
      toast.error(`Terdapat ${invalidQuestions.length} butir pertanyaan yang teksnya masih kosong.`);
      return;
    }

    // Check multiple choice questions have options and correct answer
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.question_type !== 'essay') {
        const filledOptions = q.options?.filter(o => o.option_text.trim() !== '') || [];
        if (filledOptions.length < 2) {
          toast.error(`Soal nomor ${i + 1} harus memiliki minimal 2 pilihan opsi jawaban.`);
          setActiveQuestionIndex(i);
          return;
        }
        const hasCorrect = q.options?.some(o => o.is_correct);
        if (!hasCorrect) {
          toast.error(`Soal nomor ${i + 1} belum ditentukan kunci jawaban yang benar.`);
          setActiveQuestionIndex(i);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        course_id: courseId,
        title,
        description,
        quiz_type: quizType,
        time_limit_minutes: parseInt(timeLimitMinutes, 10) || 60,
        passing_score: parseInt(passingScore, 10) || 70,
        start_time: startTime || null,
        end_time: endTime || null,
        is_published: isPublished,
        questions
      };

      const res = await quizAPI.create(payload);
      toast.success(res.data?.message || 'Ujian/Kuis berhasil dibuat!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Create quiz error:', err);
      toast.error(err.response?.data?.message || 'Gagal menyimpan ujian/kuis.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const activeQ = questions[activeQuestionIndex] || questions[0];

  return (
    <div className="create-quiz-backdrop animate-fadeIn">
      <div className="create-quiz-modal card animate-scaleUp">
        
        {/* Modal Header */}
        <div className="create-quiz-header">
          <div className="header-title-box">
            <span className="quiz-badge">
              <Sparkles size={14} /> FORMULIR PEMBUATAN UJIAN & KUIS
            </span>
            <h2>Pengaturan Naskah Ujian & Evaluasi</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-quiz-body">

          {/* ─── SECTION 1: INFORMASI UTAMA & JADWAL ─── */}
          <div className="create-quiz-section">
            <h3 className="section-title">
              <Layers size={18} /> 1. Informasi Ujian & Pengaturan Jadwal
            </h3>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Mata Kuliah <span className="text-danger">*</span></label>
                {initialCourseId ? (
                  <input
                    type="text"
                    className="form-input"
                    value={courseTitle || `Mata Kuliah #${initialCourseId}`}
                    disabled
                  />
                ) : (
                  <select
                    className="form-input"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Mata Kuliah --</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.course_code ? `[${c.course_code}] ` : ''}{c.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Tipe Soal Utama</label>
                <select
                  className="form-input"
                  value={quizType}
                  onChange={(e) => {
                    setQuizType(e.target.value);
                    // update default questions
                    const updated = questions.map(q => ({
                      ...q,
                      question_type: e.target.value === 'essay' ? 'essay' : 'multiple_choice'
                    }));
                    setQuestions(updated);
                  }}
                >
                  <option value="multiple_choice">Pilihan Ganda (A, B, C, D, E)</option>
                  <option value="essay">Essay / Uraian Bebas</option>
                  <option value="mixed">Campuran (Pilihan Ganda & Essay)</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Judul Ujian / Kuis <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Ujian Tengah Semester (UTS) Pemrograman Web"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Deskripsi / Petunjuk Pengerjaan</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Tuliskan petunjuk umum pengerjaan ujian bagi mahasiswa..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Grid Jadwal & Durasi */}
            <div className="form-grid-4" style={{ marginTop: '14px' }}>
              <div className="form-group">
                <label className="form-label">
                  <Calendar size={14} /> Tanggal & Jam Mulai
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Clock size={14} /> Tanggal & Jam Berakhir
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Durasi (Menit)</label>
                <input
                  type="number"
                  min="5"
                  max="360"
                  className="form-input"
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">KKM / Kelulusan (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-input"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ─── SECTION 2: BUTIR PERTANYAAN (MANUAL & IMPORT) ─── */}
          <div className="create-quiz-section" style={{ marginTop: '20px' }}>
            <div className="section-header-row">
              <h3 className="section-title">
                <ListChecks size={18} /> 2. Butir Pertanyaan ({questions.length} Butir Soal)
              </h3>

              {/* Tab Selector */}
              <div className="input-tab-pills">
                <button
                  type="button"
                  className={`tab-pill ${inputTab === 'manual' ? 'active' : ''}`}
                  onClick={() => setInputTab('manual')}
                >
                  <FileText size={14} /> Input Manual (Fleksibel)
                </button>
                <button
                  type="button"
                  className={`tab-pill ${inputTab === 'import' ? 'active' : ''}`}
                  onClick={() => setInputTab('import')}
                >
                  <FileSpreadsheet size={14} /> Import File Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* ─── TAB IMPORT EXCEL ─── */}
            {inputTab === 'import' && (
              <div className="import-excel-container animate-fadeIn">
                <div className="import-instruction-card">
                  <div className="instruction-icon">
                    <FileSpreadsheet size={40} />
                  </div>
                  <div className="instruction-text">
                    <h4>Upload Soal Secara Otomatis dari Excel</h4>
                    <p>
                      Anda dapat mengunggah file Excel berisi 50 butir soal pilihan ganda maupun essay sekaligus. 
                      Unduh contoh template format Excel resmi di bawah untuk memastikan data kolom sesuai.
                    </p>
                    <div className="template-download-row">
                      <button
                        type="button"
                        onClick={() => downloadQuizTemplate('multiple_choice')}
                        className="btn btn-secondary btn-sm"
                      >
                        <Download size={14} /> Unduh Template 50 Pilihan Ganda (.xlsx)
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadQuizTemplate('essay')}
                        className="btn btn-secondary btn-sm"
                      >
                        <Download size={14} /> Unduh Template Soal Essay (.xlsx)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="upload-dropzone">
                  <input
                    type="file"
                    id="excel-quiz-input"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="excel-quiz-input" className="dropzone-label">
                    <Upload size={36} className="upload-icon" />
                    <span className="dropzone-title">
                      {importLoading ? 'Memproses File Excel...' : 'Klik di sini untuk Memilih File Excel'}
                    </span>
                    <span className="dropzone-subtitle">Mendukung format .xlsx, .xls, atau .csv</span>
                  </label>
                </div>

                {importSummary && (
                  <div className="import-summary-card animate-fadeIn">
                    <CheckCircle2 size={24} className="text-success" />
                    <div>
                      <strong>Impor Berhasil: {importSummary.total} Soal Ditemukan!</strong>
                      <p>File "{importSummary.fileName}" telah dimuat. Anda dapat kembali ke tab Manual untuk meninjau atau merevisi butir soal.</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setInputTab('manual')}
                    >
                      Buka Review Soal
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB MANUAL ENTRY (1 S/D 50 SOAL) ─── */}
            {inputTab === 'manual' && (
              <div className="manual-entry-container animate-fadeIn">
                
                {/* Ribbon Navigasi Cepat Nomor 1 - 50 */}
                <div className="question-nav-bar">
                  <div className="nav-bar-header">
                    <span className="nav-bar-label">
                      Pilih Nomor Soal: <strong>{activeQuestionIndex + 1}</strong> dari {questions.length}
                    </span>
                    <div className="nav-bar-actions">
                      <div className="custom-count-box">
                        <span className="custom-count-label">Jumlah Soal:</span>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          className="custom-count-input"
                          value={targetCountInput}
                          onChange={(e) => setTargetCountInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyQuestionCount(targetCountInput);
                            }
                          }}
                          title="Ketik jumlah soal yang diinginkan lalu tekan Enter atau klik Terapkan"
                        />
                        <button
                          type="button"
                          className="btn-quick-gen"
                          onClick={() => handleApplyQuestionCount(targetCountInput)}
                          title={`Terapkan ${targetCountInput} butir soal`}
                        >
                          <Sparkles size={14} /> Terapkan {targetCountInput || ''} Soal
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={handleAddQuestion}
                        title="Tambah 1 butir soal lagi"
                      >
                        <Plus size={14} /> Tambah Soal
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scroll Grid of Question Numbers */}
                  <div className="question-number-grid">
                    {questions.map((q, idx) => {
                      const isAnswered = q.question_text.trim().length > 0;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`num-btn ${activeQuestionIndex === idx ? 'current' : ''} ${isAnswered ? 'filled' : ''}`}
                          onClick={() => setActiveQuestionIndex(idx)}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Question Editor Card */}
                {activeQ && (
                  <div className="active-question-card glass-card">
                    <div className="active-q-header">
                      <div className="q-badge-info">
                        <span className="q-number-pill">Soal #{activeQuestionIndex + 1}</span>
                        <select
                          className="form-input q-type-select"
                          value={activeQ.question_type}
                          onChange={(e) => updateActiveQuestion('question_type', e.target.value)}
                        >
                          <option value="multiple_choice">Pilihan Ganda (A, B, C, D, E)</option>
                          <option value="essay">Essay / Uraian</option>
                        </select>
                      </div>

                      <div className="q-points-box">
                        <label>Bobot Poin:</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          className="form-input points-input"
                          value={activeQ.points}
                          onChange={(e) => updateActiveQuestion('points', parseInt(e.target.value, 10) || 1)}
                        />
                        <button
                          type="button"
                          className="btn-delete-q"
                          onClick={() => handleRemoveQuestion(activeQuestionIndex)}
                          title="Hapus soal ini"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <div className="form-group" style={{ marginTop: '14px' }}>
                      <label className="form-label">
                        Teks Pertanyaan Soal #{activeQuestionIndex + 1} <span className="text-danger">*</span>
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        placeholder={`Tuliskan teks pertanyaan soal nomor ${activeQuestionIndex + 1}...`}
                        value={activeQ.question_text}
                        onChange={(e) => updateActiveQuestion('question_text', e.target.value)}
                        required
                      />
                    </div>

                    {/* Pilihan Ganda (A, B, C, D, E) */}
                    {activeQ.question_type !== 'essay' ? (
                      <div className="options-editor-section">
                        <div className="options-guideline">
                          <AlertCircle size={14} />
                          <span>Klik tombol radio bulat untuk menandai kunci jawaban yang benar:</span>
                        </div>

                        <div className="options-list-grid">
                          {['A', 'B', 'C', 'D', 'E'].map((letter, optIdx) => {
                            const opt = activeQ.options?.[optIdx] || { option_text: '', is_correct: false };
                            return (
                              <div key={letter} className={`option-edit-row ${opt.is_correct ? 'is-correct' : ''}`}>
                                <div className="opt-letter-tag">
                                  <label className="radio-container">
                                    <input
                                      type="radio"
                                      name={`correct_opt_${activeQuestionIndex}`}
                                      checked={Boolean(opt.is_correct)}
                                      onChange={() => setCorrectOption(optIdx)}
                                    />
                                    <span className="radio-checkmark"></span>
                                    <span className="letter-text">{letter}</span>
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  className="form-input opt-text-input"
                                  placeholder={`Masukkan teks pilihan jawaban ${letter}...`}
                                  value={opt.option_text}
                                  onChange={(e) => updateOption(optIdx, e.target.value)}
                                  required={optIdx < 2} // Minimal opsi A & B wajib
                                />
                                {opt.is_correct && (
                                  <span className="correct-badge-pill">
                                    <CheckCircle2 size={12} /> Kunci Jawaban
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* Essay Question Note */
                      <div className="essay-editor-notice">
                        <FileText size={18} />
                        <div>
                          <strong>Soal Tipe Essay / Uraian</strong>
                          <p>
                            Mahasiswa akan menjawab melalui kolom esai bebas. Jawaban teks mahasiswa akan tersimpan secara otomatis dan dapat Anda tinjau pada portal rekap hasil ujian.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Quick Prev / Next Question Navigation */}
                    <div className="q-footer-nav">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={activeQuestionIndex === 0}
                        onClick={() => setActiveQuestionIndex(activeQuestionIndex - 1)}
                      >
                        <ChevronLeft size={16} /> Soal Sebelumnya
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={activeQuestionIndex === questions.length - 1}
                        onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
                      >
                        Soal Berikutnya <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="create-quiz-footer">
            <div className="publish-toggle-box">
              <label className="checkbox-toggle">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Publikasikan Ujian ini Sekarang</span>
              </label>
            </div>

            <div className="footer-btns">
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan Ujian...' : `Simpan & Terbitkan Ujian (${questions.length} Soal)`}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
