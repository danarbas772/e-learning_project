import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { courseAPI, quizAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import CreateQuizModal from '../components/CreateQuizModal';
import ExamTakingModal from '../components/ExamTakingModal';
import Footer from '../components/Footer';
import {
  BookOpen, MessageSquare, Upload, FileText, Send, Trash2,
  Calendar, Layers, Award, ChevronDown, ChevronUp, Plus,
  FileSpreadsheet, Monitor, Download, Clock, AlertCircle, CheckCircle2,
  HelpCircle, CheckCircle, X, Lock, CornerDownRight, UserCheck, Radio
} from 'lucide-react';
import './CourseForumDetail.css';

export default function CourseForumDetailPage() {
  const { slug } = useParams();
  const { user, isAdmin, isInstructor } = useAuth();
  const isPrivileged = isAdmin || isInstructor;

  // Helper: title → URL slug
  const toSlug = (str) => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const [course, setCourse] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [commentsMap, setCommentsMap] = useState({}); // { [sessionId]: [] }
  const [openComments, setOpenComments] = useState({}); // { [sessionId]: boolean }
  const [commentInputs, setCommentInputs] = useState({});
  const [replyTo, setReplyTo] = useState({}); // { [sessionId]: { id, user_name } | null }
  const [replyInputs, setReplyInputs] = useState({}); // { [commentId]: string }
  const [loading, setLoading] = useState(true);

  // Modal Announcement State
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annFile, setAnnFile] = useState(null);
  const [submittingAnn, setSubmittingAnn] = useState(false);

  // Modal Upload Materi State (Per Sesi)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDesc, setMaterialDesc] = useState('');
  const [materialType, setMaterialType] = useState('ppt');
  const [materialFile, setMaterialFile] = useState(null);
  const [materialYoutubeUrl, setMaterialYoutubeUrl] = useState('');
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  // Helper: ekstrak YouTube video ID dari berbagai format URL
  const getYoutubeId = (url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return m[1];
    }
    return null;
  };

  // Helper: accept attribute untuk input file berdasarkan tipe
  const getFileAccept = (type) => {
    switch (type) {
      case 'ppt': return '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'pdf': return '.pdf,application/pdf';
      case 'doc': return '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'video': return '.mp4,.webm,.ogg,.mkv,.avi,.mov,video/*';
      default: return '*';
    }
  };

  // Modal Quiz Taking State (Untuk Mahasiswa / Ujian)
  const [activeQuizModal, setActiveQuizModal] = useState(null);
  const [quizDetails, setQuizDetails] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [showCreateQuizModal, setShowCreateQuizModal] = useState(false);

  // Access control state
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedMsg, setAccessDeniedMsg] = useState('');

  // Notification Toast
  const [toast, setToast] = useState({ type: '', message: '' });

  // Confirm delete modal state
  const [confirmDelete, setConfirmDelete] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  // Attendance state
  const [attendedSections, setAttendedSections] = useState(new Set());
  const [togglingAttendanceId, setTogglingAttendanceId] = useState(null);
  const [submittingAttendanceId, setSubmittingAttendanceId] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: '', message: '' }), 3500);
  };

  useEffect(() => {
    fetchCourseData();
  }, [slug]);

  const fetchCourseData = async () => {
    setLoading(true);
    setAccessDenied(false);
    try {
      let params = {};
      if (user?.role === 'student' && user?.id) {
        try {
          const pRes = await userAPI.getProfile(user.id);
          const prof = pRes.data?.data;
          if (prof) {
            params = {
              user_role: 'student',
              user_name: prof.full_name,
              user_academic_year: prof.academic_year,
              user_semester: prof.semester || 1,
            };
          }
        } catch (e) {}
      } else if (user?.role === 'instructor') {
        // Dosen dikirim user_role dan user_id agar filter akses hanya untuk dosen pengampu
        params = { user_role: 'instructor' };
        if (user?.id) params.user_id = user.id;
      }


      const [cRes, annRes, quizRes, commRes] = await Promise.all([
        courseAPI.getById(slug, params),
        courseAPI.getAnnouncements(slug).catch(() => ({ data: { data: [] } })),
        quizAPI.getByCourse(slug).catch(() => ({ data: { data: [] } })),
        courseAPI.getComments(slug).catch(() => ({ data: { data: [] } })),
      ]);

      const courseData = cRes.data.data;
      const courseNumericId = courseData?.id;
      setCourse(courseData);
      if (courseData?.attended_section_ids) {
        setAttendedSections(new Set(courseData.attended_section_ids));
      }

      // Refetch announcements/quizzes/comments with numeric ID for sub-resources
      const [annRes2, quizRes2, commRes2] = courseNumericId && courseNumericId !== slug
        ? await Promise.all([
            courseAPI.getAnnouncements(courseNumericId).catch(() => ({ data: { data: [] } })),
            quizAPI.getByCourse(courseNumericId).catch(() => ({ data: { data: [] } })),
            courseAPI.getComments(courseNumericId).catch(() => ({ data: { data: [] } })),
          ])
        : [annRes, quizRes, commRes];

      setAnnouncements(annRes2.data?.data || []);
      setQuizzes(quizRes2.data?.data || []);

      // Group comments by session_id
      const grouped = {};
      (commRes2.data?.data || []).forEach((c) => {
        const sId = c.session_id || 'general';
        if (!grouped[sId]) grouped[sId] = [];
        grouped[sId].push(c);
      });
      setCommentsMap(grouped);
    } catch (err) {
      console.error('Fetch course detail error:', err);
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setAccessDeniedMsg(err.response?.data?.message || 'Anda tidak memiliki hak akses untuk membuka mata kuliah ini');
      } else {
        showToast('error', 'Gagal memuat data mata kuliah');
      }
    } finally {
      setLoading(false);
    }
  };

  // Toggle comments expand per session
  const toggleSessionComments = (sessionId) => {
    setOpenComments((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  // Kirim Komentar atau Balasan
  const handleSendComment = async (sessionId, parentId = null) => {
    const text = parentId
      ? (replyInputs[parentId] || '').trim()
      : (commentInputs[sessionId] || '').trim();
    if (!text) return;

    try {
      const res = await courseAPI.createComment(course?.id, {
        session_id: sessionId,
        comment_text: text,
        user_name: user?.full_name || user?.email,
        parent_id: parentId || null,
      });

      const newComment = res.data.data;
      setCommentsMap((prev) => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] || []), newComment],
      }));

      if (parentId) {
        setReplyInputs((prev) => ({ ...prev, [parentId]: '' }));
        setReplyTo((prev) => ({ ...prev, [sessionId]: null }));
      } else {
        setCommentInputs((prev) => ({ ...prev, [sessionId]: '' }));
      }
      showToast('success', 'Komentar berhasil dikirim!');
    } catch (err) {
      console.error('Send comment error:', err);
      showToast('error', 'Gagal mengirim komentar');
    }
  };

  // Hapus Komentar (termasuk balasannya)
  const handleDeleteComment = (commentId, sessionId) => {
    setConfirmDelete({
      isOpen: true,
      title: 'Hapus Komentar',
      message: 'Apakah Anda yakin ingin menghapus komentar ini? Semua balasan juga akan dihapus.',
      onConfirm: async () => {
        try {
          await courseAPI.deleteComment(commentId);
          setCommentsMap((prev) => ({
            ...prev,
            // Hapus komentar induk + semua balasan (parent_id === commentId)
            [sessionId]: (prev[sessionId] || []).filter(
              (c) => c.id !== commentId && c.parent_id !== commentId
            ),
          }));
          showToast('success', 'Komentar telah dihapus');
        } catch (err) {
          showToast('error', 'Gagal menghapus komentar');
        } finally {
          setConfirmDelete((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Submit Announcement (Dosen / Admin)
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle || !annContent) return;

    setSubmittingAnn(true);
    const formData = new FormData();
    formData.append('title', annTitle);
    formData.append('content', annContent);
    if (annFile) {
      formData.append('file', annFile);
    }

    try {
      const res = await courseAPI.createAnnouncement(course?.id, formData);
      setAnnouncements((prev) => [res.data.data, ...prev]);
      setShowAnnModal(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnFile(null);
      showToast('success', 'Pengumuman berhasil diposting!');
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Gagal membuat pengumuman');
    } finally {
      setSubmittingAnn(false);
    }
  };

  // Hapus Announcement
  const handleDeleteAnnouncement = (annId) => {
    setConfirmDelete({
      isOpen: true,
      title: 'Hapus Pengumuman',
      message: 'Yakin ingin menghapus pengumuman ini?',
      onConfirm: async () => {
        try {
          await courseAPI.deleteAnnouncement(annId);
          setAnnouncements((prev) => prev.filter((a) => a.id !== annId));
          showToast('success', 'Pengumuman berhasil dihapus');
        } catch (err) {
          showToast('error', 'Gagal menghapus pengumuman');
        } finally {
          setConfirmDelete((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Submit Upload Materi (Per Sesi)
  const handleUploadMaterial = async (e) => {
    e.preventDefault();

    if (!materialTitle || !uploadSessionId) {
      return showToast('error', 'Lengkapi judul materi dan sesi');
    }

    // Validasi khusus per tipe
    if (materialType === 'youtube') {
      if (!materialYoutubeUrl.trim()) {
        return showToast('error', 'Masukkan link YouTube yang valid');
      }
      if (!getYoutubeId(materialYoutubeUrl)) {
        return showToast('error', 'Link YouTube tidak valid. Contoh: https://www.youtube.com/watch?v=...');
      }
    } else {
      if (!materialFile) {
        return showToast('error', 'Pilih file materi terlebih dahulu');
      }
      // Validasi ekstensi file sesuai tipe
      const fileName = materialFile.name.toLowerCase();
      const extMap = {
        ppt: ['.ppt', '.pptx'],
        pdf: ['.pdf'],
        doc: ['.doc', '.docx'],
        video: ['.mp4', '.webm', '.ogg', '.mkv', '.avi', '.mov'],
      };
      const allowed = extMap[materialType] || [];
      const valid = allowed.some(ext => fileName.endsWith(ext));
      if (!valid) {
        const labels = { ppt: 'PPT/PPTX', pdf: 'PDF', doc: 'DOC/DOCX', video: 'MP4/WEBM/OGG/MKV/AVI/MOV' };
        return showToast('error', `Tipe file tidak cocok. Untuk tipe ${materialType.toUpperCase()}, gunakan file: ${labels[materialType]}`);
      }
    }

    setSubmittingMaterial(true);
    const formData = new FormData();
    formData.append('section_id', uploadSessionId);
    formData.append('course_id', course?.id);
    formData.append('title', materialTitle);
    formData.append('description', materialDesc);
    formData.append('material_type', materialType);

    if (materialType === 'youtube') {
      formData.append('youtube_url', materialYoutubeUrl.trim());
    } else {
      formData.append('file', materialFile);
    }

    try {
      await courseAPI.uploadMaterial(formData);
      setShowUploadModal(false);
      setMaterialTitle('');
      setMaterialDesc('');
      setMaterialFile(null);
      setMaterialYoutubeUrl('');
      setMaterialType('ppt');
      fetchCourseData();
      showToast('success', materialType === 'youtube' ? 'Video YouTube berhasil ditambahkan!' : 'File materi berhasil diunggah ke pertemuan!');
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Gagal mengupload materi');
    } finally {
      setSubmittingMaterial(false);
    }
  };

  // Hapus Materi (Dosen / Admin)
  const handleDeleteMaterial = (materialId) => {
    setConfirmDelete({
      isOpen: true,
      title: 'Hapus Materi Perkuliahan',
      message: 'Apakah Anda yakin ingin menghapus materi perkuliahan ini?',
      onConfirm: async () => {
        try {
          await courseAPI.deleteMaterial(materialId);
          fetchCourseData();
          showToast('success', 'Materi berhasil dihapus');
        } catch (err) {
          showToast('error', 'Gagal menghapus materi');
        } finally {
          setConfirmDelete((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Presensi: Toggle Aktifkan / Nonaktifkan Presensi (Dosen / Admin)
  const handleToggleAttendance = async (sectionId, currentActive) => {
    setTogglingAttendanceId(sectionId);
    try {
      const res = await courseAPI.toggleAttendance(sectionId, !currentActive);
      const newStatus = res.data?.data?.attendance_active ?? !currentActive;
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: (prev.sections || []).map((sec) =>
            sec.id === sectionId ? { ...sec, attendance_active: newStatus } : sec
          ),
        };
      });
      showToast('success', newStatus ? 'Presensi berhasil diaktifkan untuk pertemuan ini' : 'Presensi berhasil dinonaktifkan');
    } catch (err) {
      console.error('Toggle attendance error:', err);
      showToast('error', err.response?.data?.message || 'Gagal mengubah status presensi');
    } finally {
      setTogglingAttendanceId(null);
    }
  };

  // Presensi: Mahasiswa klik Hadir 1x selamanya
  const handleSubmitAttendance = async (sectionId) => {
    if (attendedSections.has(sectionId)) {
      return showToast('info', 'Anda sudah tercatat hadir pada pertemuan ini');
    }

    setSubmittingAttendanceId(sectionId);
    try {
      const res = await courseAPI.submitAttendance(sectionId);
      setAttendedSections((prev) => new Set(prev).add(sectionId));
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: (prev.sections || []).map((sec) =>
            sec.id === sectionId ? { ...sec, has_attended: true } : sec
          ),
        };
      });
      showToast('success', res.data?.message || 'Presensi berhasil! Anda terdata hadir.');
    } catch (err) {
      if (err.response?.data?.already_attended) {
        setAttendedSections((prev) => new Set(prev).add(sectionId));
      }
      showToast('error', err.response?.data?.message || 'Gagal mengirim presensi');
    } finally {
      setSubmittingAttendanceId(null);
    }
  };

  // Buka Ujian / Quiz (Untuk Mahasiswa / Semua Role)
  const handleOpenQuizModal = (quiz) => {
    setActiveQuizModal(quiz);
  };

  // Hapus Quiz / Ujian (Dosen / Admin)
  const handleDeleteQuiz = (quizId) => {
    setConfirmDelete({
      isOpen: true,
      title: 'Hapus Kuis / Ujian',
      message: 'Apakah Anda yakin ingin menghapus kuis/ujian ini? Seluruh data pertanyaan dan nilai peserta akan terhapus permanen.',
      onConfirm: async () => {
        try {
          await quizAPI.delete(quizId);
          fetchCourseData();
          showToast('success', 'Kuis/Ujian berhasil dihapus');
        } catch (err) {
          showToast('error', 'Gagal menghapus kuis/ujian');
        } finally {
          setConfirmDelete((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content dashboard-content">
          <div className="loading-center">
            <div className="spinner" />
          </div>
        </main>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content dashboard-content">
          <div className="container" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '640px', margin: '40px auto' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'hsla(0, 80%, 55%, 0.12)',
              color: 'hsl(0, 80%, 65%)',
              border: '1px solid hsla(0, 80%, 55%, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Lock size={30} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '12px' }}>Akses Mata Kuliah Dibatasi</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {accessDeniedMsg || 'Mata kuliah ini memiliki pembatasan akses khusus. Akun Anda belum terdaftar dalam daftar mahasiswa yang diizinkan untuk mengakses materi dan forum perkuliahan ini.'}
            </p>
            <div style={{ marginTop: '28px' }}>
              <Link to="/courses" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={16} />
                <span>Kembali ke Katalog Mata Kuliah</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content dashboard-content">
          <div className="container" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <h2>Mata Kuliah Tidak Ditemukan</h2>
            <Link to="/courses" className="btn btn-primary" style={{ marginTop: '16px' }}>
              Kembali ke Katalog Mata Kuliah
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const sections = course.sections || [];
  const midPointIndex = Math.floor(sections.length / 2);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content forum-page">
        <div className="container" style={{ padding: '24px 20px' }}>
          {/* Breadcrumb Navigation seperti tangkapan layar user */}
          <div className="forum-breadcrumb">
            <Link to="/dashboard">Dashboard</Link>
            <span>&gt;</span>
            <Link to="/courses">Mata Kuliah</Link>
            <span>&gt;</span>
            <span className="forum-breadcrumb-current">{course.title}</span>
          </div>

          {/* Toast Banner */}
          {toast.message && (
            <div className={`alert alert-${toast.type} animate-fadeIn`} style={{ marginBottom: '20px' }}>
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{toast.message}</span>
            </div>
          )}

          {/* Header Hero Forum */}
          <div className="forum-hero-card card animate-fadeIn">
            <div className="forum-hero-icon-wrap">
              <Monitor size={36} />
            </div>
            <h1 className="forum-hero-title">{course.title}</h1>
            <p className="forum-hero-desc">
              {course.description || 'DAN DISINI DAPAT DI ISI PARAGRAF APA YANG AKAN DIPELAJARI SELAMA PEMBELAJARAN'}
            </p>

            <div className="forum-hero-meta">
              <span className="forum-meta-pill">
                <Calendar size={14} /> Semester {course.semester || 1}
              </span>
              <span className="forum-meta-pill">
                <Award size={14} /> {course.sks || 3} SKS
              </span>
              <span className="forum-meta-pill">
                <Layers size={14} /> {course.total_sessions || 16} Pertemuan
              </span>
              <span className="forum-meta-pill">
                Kode Matkul: <strong>{course.course_code || course.curriculum || '-'}</strong>
              </span>
              <span className="forum-meta-pill">
                Program Studi: <strong>{course.department || course.category || '-'}</strong>
              </span>
              <span className="forum-meta-pill">
                Dosen Pengampu: <strong>{course.instructor_name || 'Dosen Utama'}</strong>
              </span>
            </div>
          </div>

          {/* ─── BAGIAN ANNOUNCEMENTS / PENGUMUMAN ───────────────────────── */}
          <div className="announcement-section animate-fadeIn">
            <div className="announcement-header-bar">
              <div className="announcement-header-title">
                <MessageSquare size={22} color="var(--color-primary-light)" />
                <span>Announcements & Forum Pengumuman</span>
              </div>
              {isPrivileged && (
                <button onClick={() => setShowAnnModal(true)} className="btn btn-primary btn-sm">
                  <Plus size={16} />
                  <span>Bagikan Pengumuman / File</span>
                </button>
              )}
            </div>

            {announcements.length === 0 ? (
              <div className="announcement-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                Belum ada pengumuman yang dibagikan untuk mata kuliah ini.
              </div>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="announcement-card">
                  <div className="announcement-card-top">
                    <h3 className="announcement-title">{ann.title}</h3>
                    {isPrivileged && (
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        title="Hapus Pengumuman"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="announcement-author-time">
                    Oleh: <strong>{ann.author_name}</strong> • {new Date(ann.created_at).toLocaleString('id-ID')}
                  </div>
                  <p className="announcement-content">{ann.content}</p>
                  {ann.file_url && (
                    <a
                      href={ann.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="announcement-file-attachment"
                      download
                    >
                      <Download size={16} />
                      <span>Lampiran File: {ann.file_name || 'Download Berkas'}</span>
                    </a>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ─── DAFTAR SESI PERTEMUAN (PERTEMUAN I, II, ...) ─────────────── */}
          <div className="sessions-list">
            {sections.map((section, idx) => {
              const isMidtermPosition = idx === midPointIndex;
              const sectionComments = commentsMap[section.id] || [];
              const isCommentsOpen = openComments[section.id] || false;

              return (
                <div key={section.id}>
                  {/* UJIAN TENGAH SEMESTER (UTS) - Ditampilkan Tepat di Pertengahan Pertemuan */}
                  {isMidtermPosition && (
                    <div className="midterm-exam-card animate-fadeIn">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', width: '100%' }}>
                        <div>
                          <span className="midterm-badge">
                            <HelpCircle size={14} /> EVALUASI TENGAH SEMESTER
                          </span>
                          <h3 className="midterm-title">Ujian Tengah Semester (UTS) / Kuis Evaluasi</h3>
                          <p className="midterm-desc">
                            Sesi kuis dan ujian evaluasi pembelajaran mahasiswa untuk pertemuan I sampai {section.title}.
                          </p>
                        </div>

                        {isPrivileged && (
                          <button
                            type="button"
                            onClick={() => setShowCreateQuizModal(true)}
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                          >
                            <Plus size={16} /> Buat Ujian UTS / Kuis
                          </button>
                        )}
                      </div>

                      <div style={{ marginTop: '16px', width: '100%' }}>
                        {quizzes.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {quizzes.map((quiz) => (
                              <div
                                key={quiz.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '14px 18px',
                                  background: 'hsla(220, 20%, 12%, 0.7)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: 'var(--radius-md)',
                                  gap: '12px',
                                  flexWrap: 'wrap'
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{quiz.title}</strong>
                                    <span className="exam-type-tag" style={{ fontSize: '0.7rem' }}>
                                      {quiz.quiz_type === 'essay' ? 'ESSAY' : quiz.quiz_type === 'mixed' ? 'CAMPURAN' : 'PILIHAN GANDA'}
                                    </span>
                                    {quiz.time_limit_minutes > 0 && (
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} /> {quiz.time_limit_minutes} Menit
                                      </span>
                                    )}
                                    {quiz.question_count !== undefined && (
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        • {quiz.question_count} Soal
                                      </span>
                                    )}
                                  </div>
                                  {quiz.description && (
                                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                                      {quiz.description}
                                    </p>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {(() => {
                                    const now = new Date();
                                    const hasAttempted = (quiz.my_attempt_count > 0);
                                    const isNotStarted = quiz.start_time && new Date(quiz.start_time) > now;
                                    const isEnded = quiz.end_time && new Date(quiz.end_time) < now;

                                    if (hasAttempted) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenQuizModal(quiz)}
                                          className="btn btn-secondary btn-sm"
                                          style={{ borderColor: 'hsla(160, 80%, 45%, 0.4)', color: 'hsl(160, 80%, 75%)', fontWeight: 600 }}
                                        >
                                          <CheckCircle2 size={14} /> Selesai ({quiz.my_score !== null ? `${quiz.my_score}/100` : 'Terkumpul'})
                                        </button>
                                      );
                                    }
                                    if (!isPrivileged && isNotStarted) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenQuizModal(quiz)}
                                          className="btn btn-secondary btn-sm"
                                          style={{ borderColor: 'hsla(38, 90%, 52%, 0.4)', color: 'hsl(38, 90%, 65%)', fontWeight: 600 }}
                                        >
                                          <Lock size={14} /> Terkunci (Lihat Jadwal)
                                        </button>
                                      );
                                    }
                                    if (!isPrivileged && isEnded) {
                                      return (
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          disabled
                                          style={{ opacity: 0.6 }}
                                        >
                                          <AlertCircle size={14} /> Ujian Berakhir
                                        </button>
                                      );
                                    }
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenQuizModal(quiz)}
                                        className="btn btn-primary btn-sm"
                                        style={{ fontWeight: 'bold' }}
                                      >
                                        {isPrivileged ? 'Pratinjau / Kerjakan' : 'Masuk Ujian'}
                                      </button>
                                    );
                                  })()}
                                  {isPrivileged && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuiz(quiz.id)}
                                      className="btn btn-ghost btn-sm"
                                      style={{ color: 'hsl(0, 75%, 65%)' }}
                                      title="Hapus Ujian"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                            {isPrivileged
                              ? 'Klik tombol "+ Buat Ujian UTS / Kuis" di atas untuk membuat naskah soal (Pilihan Ganda / Essay, jadwal, atau via import Excel).'
                              : 'Soal UTS akan dibuka saat jadwal evaluasi berlangsung.'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* BOX PERTEMUAN */}
                  <div className="session-box">
                    {/* Header Abu-abu Gelap (Title: PERTEMUAN I, II, ...) */}
                    <div className="session-bar-header">
                      <span className="session-bar-title">{section.title}</span>
                      <div className="session-bar-actions">
                        {/* Tombol Presensi untuk Mahasiswa (Hadir 1x selamanya jika presensi aktif) */}
                        {!isPrivileged && (
                          section.attendance_active ? (
                            attendedSections.has(section.id) || section.has_attended ? (
                              <button
                                type="button"
                                className="btn btn-attendance-done btn-sm"
                                disabled
                                title="Anda sudah mengisi presensi pada pertemuan ini"
                              >
                                <CheckCircle2 size={14} />
                                <span>Sudah Hadir</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSubmitAttendance(section.id)}
                                disabled={submittingAttendanceId === section.id}
                                className="btn btn-attendance-action btn-sm"
                                title="Klik untuk mengisi presensi pertemuan ini (1x)"
                              >
                                <UserCheck size={14} />
                                <span>{submittingAttendanceId === section.id ? 'Memproses...' : 'Hadir'}</span>
                              </button>
                            )
                          ) : null
                        )}

                        {/* Tombol untuk Dosen / Admin */}
                        {isPrivileged && (
                          <>
                            {/* Toggle Aktifkan / Nonaktifkan Presensi */}
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(section.id, Boolean(section.attendance_active))}
                              disabled={togglingAttendanceId === section.id}
                              className={`btn btn-sm ${section.attendance_active ? 'btn-attendance-active' : 'btn-attendance-inactive'}`}
                              title={section.attendance_active ? 'Klik untuk menonaktifkan presensi' : 'Klik untuk mengaktifkan presensi'}
                            >
                              <Radio size={14} className={section.attendance_active ? 'attendance-pulse' : ''} />
                              <span>
                                {togglingAttendanceId === section.id
                                  ? 'Menyimpan...'
                                  : section.attendance_active
                                  ? 'Nonaktifkan Presensi'
                                  : 'Aktifkan Presensi'}
                              </span>
                            </button>

                            {/* Tombol Upload PPT / Materi */}
                            <button
                              onClick={() => {
                                setUploadSessionId(section.id);
                                setShowUploadModal(true);
                              }}
                              className="btn btn-primary btn-sm"
                            >
                              <Upload size={14} />
                              <span>Upload PPT / Materi</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Konten Materi Perkuliahan di Pertemuan ini */}
                    <div className="session-body">
                      {section.materials && section.materials.length > 0 ? (
                        <div className="session-materials-list">
                          {section.materials.map((mat) => {
                            const matType = (mat.material_type || 'ppt').toLowerCase();
                            // external_url menyimpan link YouTube; file_url untuk fallback
                            const ytId = matType === 'youtube' ? getYoutubeId(mat.external_url || mat.file_url || '') : null;
                            return (
                              <div key={mat.id} className="session-material-card">
                                <div className="session-material-header">
                                  <div className="session-material-title-wrap">
                                    <span className={`material-badge-pill ${matType}`}>
                                      {matType === 'youtube' ? '▶ YOUTUBE' : matType.toUpperCase()}
                                    </span>
                                    <h4 className="session-material-title">{mat.title}</h4>
                                  </div>

                                  <div className="session-material-actions">
                                    {isPrivileged && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMaterial(mat.id)}
                                        className="btn-action-icon delete"
                                        title="Hapus Materi"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {mat.description && (
                                  <div className="session-material-desc">
                                    <p>{mat.description}</p>
                                  </div>
                                )}

                                {/* Embedded YouTube Player */}
                                {matType === 'youtube' && ytId && (
                                  <div className="youtube-embed-wrapper">
                                    <iframe
                                      src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                                      title={mat.title}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      allowFullScreen
                                    />
                                  </div>
                                )}

                                {/* Jika youtube tapi ID tidak bisa diekstrak, tampilkan link */}
                                {matType === 'youtube' && !ytId && (mat.external_url || mat.file_url) && (
                                  <div className="session-material-attachment" style={{ marginTop: '10px' }}>
                                    <a
                                      href={mat.external_url || mat.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-attachment-download"
                                    >
                                      ▶ Buka di YouTube
                                    </a>
                                  </div>
                                )}

                                {/* File attachment untuk tipe bukan youtube */}
                                {matType !== 'youtube' && mat.file_name && (
                                  <div className="session-material-attachment">
                                    <div className="attachment-file-info">
                                      <FileText size={18} className="attachment-icon" />
                                      <div className="attachment-texts">
                                        <span className="attachment-filename">{mat.file_name}</span>
                                        {mat.file_size ? (
                                          <span className="attachment-filesize">
                                            {(mat.file_size / (1024 * 1024)).toFixed(2)} MB
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <a
                                      href={mat.file_url || `/api/courses/materials/${mat.id}/download`}
                                      download={mat.file_name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-attachment-download"
                                      title="Unduh Berkas"
                                    >
                                      <Download size={14} />
                                      <span>Unduh Berkas</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="session-empty-notice">
                          <FileText size={18} />
                          <span>Belum ada materi atau slide perkuliahan yang diunggah untuk {section.title}.</span>
                        </div>
                      )}

                      {/* ─── FORUM KOMENTAR PADA PERTEMUAN INI ───────────────── */}
                      <div className="session-comments-wrap">
                        <button
                          onClick={() => toggleSessionComments(section.id)}
                          className="comments-toggle-btn"
                        >
                          <MessageSquare size={16} />
                          <span>Forum Komentar & Diskusi ({sectionComments.filter(c => !c.parent_id).length})</span>
                          {isCommentsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isCommentsOpen && (() => {
                          // Pisahkan komentar induk dan balasan
                          const rootComments = sectionComments.filter(c => !c.parent_id);
                          const repliesMap = {};
                          sectionComments.filter(c => c.parent_id).forEach(r => {
                            if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = [];
                            repliesMap[r.parent_id].push(r);
                          });

                          return (
                            <div className="comments-box animate-fadeIn">
                              {/* Scrollable thread list - maks tampil 3 komentar induk */}
                              <div className="comments-scroll-area">
                                {rootComments.length === 0 ? (
                                  <p className="comments-empty-text">
                                    Belum ada diskusi pada pertemuan ini. Jadilah yang pertama memberikan komentar!
                                  </p>
                                ) : (
                                  rootComments.map((comm) => {
                                    const canDelete = isAdmin || isInstructor || comm.user_id === user?.id;
                                    const replies = repliesMap[comm.id] || [];
                                    const isReplying = replyTo[section.id]?.id === comm.id;

                                    return (
                                      <div key={comm.id} className="comment-thread">
                                        {/* Komentar Induk */}
                                        <div className="comment-bubble">
                                          <div className="comment-bubble-header">
                                            <div className="comment-user-wrap">
                                              <span className="comment-user-name">{comm.user_name}</span>
                                              <span className={`comment-role-tag comment-role-${comm.user_role}`}>
                                                {comm.user_role === 'admin' ? 'Admin' : comm.user_role === 'instructor' ? 'Dosen' : 'Mahasiswa'}
                                              </span>
                                            </div>
                                            <div className="comment-bubble-actions">
                                              <span className="comment-time">
                                                {new Date(comm.created_at).toLocaleString('id-ID')}
                                              </span>
                                              <button
                                                onClick={() => setReplyTo((prev) => ({
                                                  ...prev,
                                                  [section.id]: isReplying ? null : { id: comm.id, user_name: comm.user_name }
                                                }))}
                                                className="btn-comment-reply"
                                                title="Balas"
                                              >
                                                <CornerDownRight size={13} />
                                                <span>Balas</span>
                                              </button>
                                              {canDelete && (
                                                <button
                                                  onClick={() => handleDeleteComment(comm.id, section.id)}
                                                  className="btn btn-ghost btn-sm"
                                                  style={{ padding: '2px', color: 'var(--color-danger)' }}
                                                  title="Hapus Komentar"
                                                >
                                                  <Trash2 size={13} />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          <p className="comment-text">{comm.comment_text}</p>
                                        </div>

                                        {/* Balasan / Replies (indented) */}
                                        {replies.map((rep) => {
                                          const canDeleteReply = isAdmin || isInstructor || rep.user_id === user?.id;
                                          return (
                                            <div key={rep.id} className="comment-reply-bubble">
                                              <div className="comment-bubble-header">
                                                <div className="comment-user-wrap">
                                                  <CornerDownRight size={12} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
                                                  <span className="comment-user-name">{rep.user_name}</span>
                                                  <span className={`comment-role-tag comment-role-${rep.user_role}`}>
                                                    {rep.user_role === 'admin' ? 'Admin' : rep.user_role === 'instructor' ? 'Dosen' : 'Mahasiswa'}
                                                  </span>
                                                </div>
                                                <div className="comment-bubble-actions">
                                                  <span className="comment-time">
                                                    {new Date(rep.created_at).toLocaleString('id-ID')}
                                                  </span>
                                                  {canDeleteReply && (
                                                    <button
                                                      onClick={() => handleDeleteComment(rep.id, section.id)}
                                                      className="btn btn-ghost btn-sm"
                                                      style={{ padding: '2px', color: 'var(--color-danger)' }}
                                                      title="Hapus Balasan"
                                                    >
                                                      <Trash2 size={13} />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                              <p className="comment-text">{rep.comment_text}</p>
                                            </div>
                                          );
                                        })}

                                        {/* Form Balas (Inline, tampil saat klik Balas) */}
                                        {isReplying && (
                                          <form
                                            onSubmit={(e) => { e.preventDefault(); handleSendComment(section.id, comm.id); }}
                                            className="comment-reply-form"
                                          >
                                            <CornerDownRight size={14} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
                                            <input
                                              type="text"
                                              className="comment-input"
                                              placeholder={`Balas komentar ${comm.user_name}...`}
                                              value={replyInputs[comm.id] || ''}
                                              onChange={(e) => setReplyInputs((prev) => ({ ...prev, [comm.id]: e.target.value }))}
                                              autoFocus
                                            />
                                            <button type="submit" className="btn btn-primary btn-sm">
                                              <Send size={13} />
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-ghost btn-sm"
                                              onClick={() => setReplyTo((prev) => ({ ...prev, [section.id]: null }))}
                                            >
                                              <X size={13} />
                                            </button>
                                          </form>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {/* Form Input Komentar Baru */}
                              <form
                                onSubmit={(e) => { e.preventDefault(); handleSendComment(section.id); }}
                                className="comment-input-form"
                              >
                                <input
                                  type="text"
                                  className="comment-input"
                                  placeholder={`Tulis komentar untuk ${section.title}...`}
                                  value={commentInputs[section.id] || ''}
                                  onChange={(e) =>
                                    setCommentInputs({ ...commentInputs, [section.id]: e.target.value })
                                  }
                                />
                                <button type="submit" className="btn btn-primary btn-sm">
                                  <Send size={15} />
                                  <span>Kirim</span>
                                </button>
                              </form>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── MODAL BAGIKAN ANNOUNCEMENT (DOSEN / ADMIN) ────────────────── */}
        {showAnnModal && (
          <div className="forum-modal-backdrop">
            <div className="forum-modal-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3>Bagikan Pengumuman / Announcement</h3>
                <button onClick={() => setShowAnnModal(false)} className="btn btn-ghost btn-sm">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement}>
                <div className="form-group">
                  <label>Judul Pengumuman</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Jadwal Kuliah Pengganti & Bahan Sesi 3"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Isi Pesan / Paragraf</label>
                  <textarea
                    rows="4"
                    className="form-input"
                    placeholder="Tuliskan pengumuman lengkap untuk seluruh mahasiswa..."
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Lampiran Berkas / File (PPT/PDF/DOC, Opsional)</label>
                  <input
                    type="file"
                    className="form-input"
                    onChange={(e) => setAnnFile(e.target.files[0])}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAnnModal(false)}
                    className="btn btn-secondary"
                  >
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingAnn}>
                    {submittingAnn ? 'Mengirim...' : 'Posting Pengumuman'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL UPLOAD PPT / MATERI PERTEMUAN (DOSEN / ADMIN) ───────── */}
        {showUploadModal && (
          <div className="forum-modal-backdrop">
            <div className="forum-modal-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3>Upload Berkas Materi Perkuliahan</h3>
                <button onClick={() => setShowUploadModal(false)} className="btn btn-ghost btn-sm">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUploadMaterial}>
                <div className="form-group">
                  <label>Judul Materi</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Slide Presentasi Pertemuan - Arsitektur Web"
                    value={materialTitle}
                    onChange={(e) => setMaterialTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Tipe Berkas</label>
                  <select
                    className="form-input"
                    value={materialType}
                    onChange={(e) => {
                      setMaterialType(e.target.value);
                      setMaterialFile(null);
                      setMaterialYoutubeUrl('');
                    }}
                  >
                    <option value="ppt">📊 PowerPoint Presentation (.ppt, .pptx)</option>
                    <option value="pdf">📄 Dokumen PDF (.pdf)</option>
                    <option value="doc">📝 Word / Dokumen (.doc, .docx)</option>
                    <option value="video">🎬 Video Pembelajaran (.mp4, .webm, dst.)</option>
                    <option value="youtube">▶ Link YouTube (Tonton Langsung)</option>
                  </select>
                </div>

                {/* Input file (untuk semua tipe kecuali youtube) */}
                {materialType !== 'youtube' && (
                  <div className="form-group">
                    <label>
                      Pilih Berkas / File
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        {materialType === 'ppt' && '(Hanya .ppt / .pptx)'}
                        {materialType === 'pdf' && '(Hanya .pdf)'}
                        {materialType === 'doc' && '(Hanya .doc / .docx)'}
                        {materialType === 'video' && '(Hanya .mp4, .webm, .ogg, .mkv, dll.)'}
                      </span>
                    </label>
                    <input
                      type="file"
                      className="form-input"
                      accept={getFileAccept(materialType)}
                      onChange={(e) => setMaterialFile(e.target.files[0])}
                      required
                    />
                    {materialFile && (
                      <p style={{ fontSize: '0.8rem', color: 'hsl(160,70%,55%)', marginTop: '6px' }}>
                        ✔ File terpilih: {materialFile.name}
                      </p>
                    )}
                  </div>
                )}

                {/* Input URL YouTube */}
                {materialType === 'youtube' && (
                  <div className="form-group">
                    <label>Link YouTube</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="Contoh: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={materialYoutubeUrl}
                      onChange={(e) => setMaterialYoutubeUrl(e.target.value)}
                      required
                    />
                    {materialYoutubeUrl && getYoutubeId(materialYoutubeUrl) && (
                      <div style={{ marginTop: '10px', borderRadius: '8px', overflow: 'hidden', position: 'relative', paddingBottom: '35%', height: 0, background: '#000' }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${getYoutubeId(materialYoutubeUrl)}?rel=0&modestbranding=1`}
                          title="Preview YouTube"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                        />
                      </div>
                    )}
                    {materialYoutubeUrl && !getYoutubeId(materialYoutubeUrl) && (
                      <p style={{ fontSize: '0.8rem', color: 'hsl(0,70%,65%)', marginTop: '6px' }}>
                        ✖ Link tidak valid. Gunakan format: https://www.youtube.com/watch?v=...
                      </p>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Deskripsi Tambahan (Opsional)</label>
                  <textarea
                    rows="2"
                    className="form-input"
                    placeholder="Catatan bacaan wajib atau instruksi tugas..."
                    value={materialDesc}
                    onChange={(e) => setMaterialDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="btn btn-secondary"
                  >
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingMaterial}>
                    {submittingMaterial ? 'Mengunggah...' : 'Upload Materi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL PENGERJAAN UJIAN MAHASISWA (LOCK, BRIEFING, COUNTDOWN, ANTI-EXIT) ──────────────── */}
        <ExamTakingModal
          quiz={activeQuizModal}
          isOpen={Boolean(activeQuizModal)}
          onClose={() => setActiveQuizModal(null)}
          onComplete={fetchCourseData}
          isPrivileged={isPrivileged}
        />

        {/* Modal Buat Ujian & Kuis Baru */}
        <CreateQuizModal
          isOpen={showCreateQuizModal}
          onClose={() => setShowCreateQuizModal(false)}
          onSuccess={fetchCourseData}
          initialCourseId={course?.id}
          courseTitle={course?.title}
        />

        {/* Modal Konfirmasi Hapus Modern */}
        <ConfirmModal
          isOpen={confirmDelete.isOpen}
          onClose={() => setConfirmDelete((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDelete.onConfirm}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmText="Ya, Hapus"
          cancelText="Batal"
          type="danger"
        />
        <Footer />
      </main>
    </div>
  );
}
