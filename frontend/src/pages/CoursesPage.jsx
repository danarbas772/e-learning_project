import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { courseAPI, userAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import {
  Search, BookOpen, Plus,
  Award, CheckCircle2, AlertCircle, X, Layers, Calendar, GraduationCap,
  Edit2, Trash2, Hash, Building2, ShieldCheck, Lock, Users, Info
} from 'lucide-react';
import './Courses.css';

const SEMESTERS = ['Semua', '1', '2', '3', '4', '5', '6', '7', '8'];
const SKS_LIST = ['Semua', '2', '3', '4', '6'];

// Helper: konversi judul matkul menjadi URL slug
const toSlug = (str) => (str || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

function CourseCard({ course, onEdit, onDelete, onManageAccess, canManage, isAdmin }) {
  return (
    <div className="course-card card">
      <div className="course-card-thumbnail">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} />
        ) : (
          <div className="course-card-thumb-placeholder">
            <BookOpen size={40} />
            <span>{course.department || course.category || 'Mata Kuliah'}</span>
          </div>
        )}
        <div className="course-card-badges">
          {course.is_published !== undefined && (
            <span className={`badge ${course.is_published ? 'badge-success' : 'badge-danger'}`}>
              {course.is_published ? 'Aktif' : 'Non-Aktif'}
            </span>
          )}
        </div>
      </div>

      <div className="course-card-body">
        <div className="course-meta-top">
          <span className="course-code-pill">
            {course.course_code || course.curriculum || 'KODE-MK'}
          </span>
          <span className="course-card-category" style={{ margin: 0, textTransform: 'none' }}>
            {course.department || course.category || 'Program Studi'}
          </span>
        </div>

        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-desc">{course.description || 'Tidak ada deskripsi matkul'}</p>

        {/* Academic Attributes Badges */}
        <div className="course-academic-grid">
          <div className="academic-badge" title="Jumlah SKS">
            <Award size={13} />
            <span>{course.sks || 3} SKS</span>
          </div>
          <div className="academic-badge" title="Semester">
            <Calendar size={13} />
            <span>Semester {course.semester || 1}</span>
          </div>
          <div className="academic-badge" title="Total Pertemuan">
            <Layers size={13} />
            <span>{course.total_sessions || 16} Pertemuan</span>
          </div>
        </div>

        {course.instructor_name && (
          <p className="course-card-instructor">
            <GraduationCap size={15} /> {course.instructor_name}
          </p>
        )}

        <div className="course-card-footer">
          <Link to={`/courses/${toSlug(course.title)}`} className="btn-forum-link">
            Lihat Forum & Materi
          </Link>

          {canManage && (
            <div className="course-card-actions">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onManageAccess(course)}
                  className="btn-action-access"
                  title="Kelola Hak Akses Mahasiswa"
                >
                  <ShieldCheck size={14} />
                  <span>Akses</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onEdit(course)}
                className="btn-action-edit"
                title="Edit Mata Kuliah"
              >
                <Edit2 size={14} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(course)}
                className="btn-action-delete"
                title="Hapus Mata Kuliah"
              >
                <Trash2 size={14} />
                <span>Hapus</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const { user, isAdmin, isInstructor } = useAuth();
  // Hanya Admin yang dapat menambah, mengedit, atau menghapus mata kuliah
  const canManage = isAdmin;

  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('Semua');
  const [sksFilter, setSksFilter] = useState('Semua');

  // Profil Mahasiswa (untuk filter akses)
  const [studentProfile, setStudentProfile] = useState(null);

  // Modal State (Create & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal Kelola Hak Akses Terbatas Matkul
  const [accessModal, setAccessModal] = useState({
    isOpen: false,
    course: null,
    rules: [],
    loading: false,
    submitting: false,
    error: '',
    success: '',
    inputText: '',
  });

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    course_code: '',
    description: '',
    department: '',
    semester: 1,
    sks: 3,
    total_sessions: 16,
    is_published: true,
    instructor_id: '',
    instructor_name: '',
  });

  // Modal Confirm Delete State
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    courseId: null,
    courseTitle: '',
    loading: false,
  });

  // Load profil jika login sebagai student
  useEffect(() => {
    if (user?.role === 'student' && user?.id) {
      userAPI.getProfile(user.id)
        .then((res) => setStudentProfile(res.data?.data || null))
        .catch((err) => console.error('Get student profile error:', err));
    }
  }, [user]);

  useEffect(() => {
    fetchCourses();
    if (isAdmin) {
      fetchInstructors();
    }
  }, [isAdmin, semesterFilter, sksFilter, studentProfile]);

  const fetchInstructors = async () => {
    try {
      const res = await userAPI.getAllProfiles({ role: 'instructor' });
      setInstructors(res.data?.data || []);
    } catch (err) {
      console.error('Fetch instructors error:', err);
    }
  };

  const fetchCourses = async () => {
    // Jika mahasiswa, tunggu profil dimuat dulu agar filter akses bekerja
    if (user?.role === 'student' && !studentProfile) {
      return;
    }

    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (semesterFilter !== 'Semua') params.semester = semesterFilter;
      if (sksFilter !== 'Semua') params.sks = sksFilter;
      if (isAdmin) params.all_status = 'true';

      // Parameter akses untuk mahasiswa
      if (user?.role === 'student') {
        params.user_role = 'student';
        if (studentProfile) {
          params.user_name = studentProfile.full_name;
          params.user_academic_year = studentProfile.academic_year;
          params.user_semester = studentProfile.semester || 1;
        }
      }

      // Parameter akses untuk dosen (hanya tampilkan mata kuliah yang diampu)
      if (user?.role === 'instructor') {
        params.user_role = 'instructor';
        if (user.id) params.user_id = user.id;
      }

      const res = await courseAPI.getAll(params);
      setCourses(res.data.data || []);
    } catch (err) {
      console.error('Fetch courses error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler Modal Kelola Hak Akses
  const handleOpenAccessModal = async (course) => {
    setAccessModal({
      isOpen: true,
      course,
      rules: [],
      loading: true,
      submitting: false,
      error: '',
      success: '',
      inputText: '',
    });

    try {
      const res = await courseAPI.getAccessRules(course.id);
      setAccessModal((prev) => ({
        ...prev,
        rules: res.data?.data || [],
        loading: false,
      }));
    } catch (err) {
      setAccessModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || 'Gagal memuat daftar akses mata kuliah',
      }));
    }
  };

  const handleAddAccessRule = async (e) => {
    e.preventDefault();
    if (!accessModal.inputText.trim()) {
      setAccessModal((prev) => ({ ...prev, error: 'Masukkan nama mahasiswa atau tahun angkatan terlebih dahulu', success: '' }));
      return;
    }

    setAccessModal((prev) => ({ ...prev, submitting: true, error: '', success: '' }));
    try {
      const addRes = await courseAPI.addAccessRule(accessModal.course.id, {
        input_text: accessModal.inputText.trim(),
      });

      const res = await courseAPI.getAccessRules(accessModal.course.id);
      setAccessModal((prev) => ({
        ...prev,
        rules: res.data?.data || [],
        submitting: false,
        success: addRes.data?.message || 'Akses berhasil diperbarui!',
        inputText: '',
      }));
    } catch (err) {
      setAccessModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Gagal menambahkan aturan akses',
      }));
    }
  };

  const handleDeleteAccessRule = async (ruleId) => {
    try {
      await courseAPI.deleteAccessRule(ruleId);
      setAccessModal((prev) => ({
        ...prev,
        rules: prev.rules.filter((r) => r.id !== ruleId),
        success: 'Aturan akses berhasil dihapus',
        error: '',
      }));
    } catch (err) {
      setAccessModal((prev) => ({
        ...prev,
        error: err.response?.data?.message || 'Gagal menghapus aturan akses',
      }));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCourses();
  };

  const handleOpenCreateModal = () => {
    setEditingCourseId(null);
    setErrorMsg('');
    setSuccessMsg('');
    setFormData({
      title: '',
      course_code: '',
      description: '',
      department: '',
      semester: 1,
      sks: 3,
      total_sessions: 16,
      is_published: true,
      instructor_id: instructors.length > 0 ? instructors[0].user_id : '',
      instructor_name: instructors.length > 0 ? (instructors[0].full_name || instructors[0].email) : '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (course) => {
    setEditingCourseId(course.id);
    setErrorMsg('');
    setSuccessMsg('');
    setFormData({
      title: course.title || '',
      course_code: course.course_code || course.curriculum || '',
      description: course.description || '',
      department: course.department || course.category || '',
      semester: course.semester || 1,
      sks: course.sks || 3,
      total_sessions: course.total_sessions || 16,
      is_published: course.is_published !== undefined ? Boolean(course.is_published) : true,
      instructor_id: course.instructor_id || (instructors.length > 0 ? instructors[0].user_id : ''),
      instructor_name: course.instructor_name || '',
    });
    setIsModalOpen(true);
  };

  const handleInstructorChange = (e) => {
    const selectedId = e.target.value;
    const inst = instructors.find(i => String(i.user_id) === String(selectedId));
    setFormData({
      ...formData,
      instructor_id: selectedId,
      instructor_name: inst ? (inst.full_name || inst.email) : '',
    });
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    const payload = {
      title: formData.title,
      course_code: formData.course_code,
      description: formData.description,
      department: formData.department,
      category: formData.department,
      curriculum: formData.course_code,
      semester: Number(formData.semester),
      sks: Number(formData.sks),
      total_sessions: Number(formData.total_sessions),
      is_published: formData.is_published,
      instructor_id: formData.instructor_id,
      instructor_name: formData.instructor_name,
    };

    try {
      if (editingCourseId) {
        await courseAPI.update(editingCourseId, payload);
        setSuccessMsg('Mata kuliah berhasil diperbarui!');
      } else {
        await courseAPI.create(payload);
        setSuccessMsg('Mata kuliah berhasil ditambahkan!');
      }

      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg('');
        fetchCourses();
      }, 1000);
    } catch (err) {
      console.error('Submit course error:', err);
      setErrorMsg(err.response?.data?.message || 'Gagal menyimpan mata kuliah');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Course
  const handleOpenDeleteModal = (course) => {
    setDeleteModal({
      isOpen: true,
      courseId: course.id,
      courseTitle: course.title,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.courseId) return;
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      await courseAPI.delete(deleteModal.courseId);
      setCourses((prev) => prev.filter((c) => c.id !== deleteModal.courseId));
      setDeleteModal({ isOpen: false, courseId: null, courseTitle: '', loading: false });
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus mata kuliah');
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <div className="container">
          {/* Header */}
          <div className="page-header courses-page-header animate-fadeIn">
            <div>
              <h1>Jelajahi <span className="gradient-text">Mata Kuliah</span></h1>
              <p>Kurikulum akademik, materi perkuliahan, dan daftar mata kuliah aktif</p>
            </div>

            {canManage && (
              <button onClick={handleOpenCreateModal} className="btn btn-primary btn-add-matkul">
                <Plus size={18} />
                <span>Buat Mata Kuliah Baru</span>
              </button>
            )}
          </div>

          {/* Search & Filter (Semester & SKS saja) */}
          <div className="courses-filter glass-card animate-fadeIn">
            <form onSubmit={handleSearch} className="courses-search">
              <div className="input-icon-wrap courses-search-input">
                <Search size={16} className="input-icon" />
                <input
                  id="course-search"
                  type="text"
                  className="form-input input-with-icon"
                  placeholder="Cari nama mata kuliah, kode matkul, atau prodi..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">Cari</button>
            </form>

            {/* Filter Dropdowns (Semester & SKS) */}
            <div className="courses-filter-dropdowns">
              <div className="filter-dropdown-group">
                <label htmlFor="filter-semester" className="filter-dropdown-label">
                  <Calendar size={15} />
                  <span>Semester</span>
                </label>
                <div className="filter-select-wrapper">
                  <select
                    id="filter-semester"
                    className="filter-select"
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                  >
                    {SEMESTERS.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem === 'Semua' ? 'Semua Semester' : `Semester ${sem}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="filter-dropdown-group">
                <label htmlFor="filter-sks" className="filter-dropdown-label">
                  <Award size={15} />
                  <span>SKS</span>
                </label>
                <div className="filter-select-wrapper">
                  <select
                    id="filter-sks"
                    className="filter-select"
                    value={sksFilter}
                    onChange={(e) => setSksFilter(e.target.value)}
                  >
                    {SKS_LIST.map((sks) => (
                      <option key={sks} value={sks}>
                        {sks === 'Semua' ? 'Semua SKS' : `${sks} SKS`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(semesterFilter !== 'Semua' || sksFilter !== 'Semua') && (
                <button
                  type="button"
                  onClick={() => {
                    setSemesterFilter('Semua');
                    setSksFilter('Semua');
                  }}
                  className="btn-reset-filters"
                  title="Reset Filter ke Default"
                >
                  <X size={14} />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="animate-fadeIn">
            <p className="courses-count">
              {loading ? 'Memuat data mata kuliah...' : `${courses.length} mata kuliah ditemukan`}
            </p>

            {loading ? (
              <div className="loading-center">
                <div className="spinner" />
              </div>
            ) : courses.length === 0 ? (
              <div className="empty-state">
                <BookOpen size={60} />
                <h3>Tidak ada mata kuliah ditemukan</h3>
                <p>Coba ubah filter atau kata kunci pencarian Anda</p>
              </div>
            ) : (
              <div className="grid-courses">
                {courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    canManage={canManage}
                    isAdmin={isAdmin}
                    onEdit={handleOpenEditModal}
                    onDelete={handleOpenDeleteModal}
                    onManageAccess={handleOpenAccessModal}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <Footer />
      </main>

      {/* Modal Form Tambah / Edit Mata Kuliah */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog card">
            <div className="modal-header">
              <div>
                <h2>{editingCourseId ? 'Edit Data Mata Kuliah' : 'Tambah Mata Kuliah Baru'}</h2>
                <p className="modal-subtitle">
                  {editingCourseId
                    ? 'Perbarui informasi akademik mata kuliah dan dosen pengampu'
                    : 'Lengkapi data akademik mata kuliah dan tentukan dosen pengampu'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="modal-close-btn">
                <X size={20} />
              </button>
            </div>

            {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}

            <form onSubmit={handleSubmitCourse} className="matkul-form">
              <div className="form-group">
                <label>Nama Mata Kuliah *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pemrograman Berbasis Web"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Deskripsi Mata Kuliah</label>
                <textarea
                  rows="3"
                  placeholder="Penjelasan ringkas materi dan capaian pembelajaran..."
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Grid Baris 1: Kode Matkul & Program Studi */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Kode Matkul *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: IF-301, TIF-102"
                    value={formData.course_code}
                    onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Program Studi *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Teknik Informatika, Sistem Informasi"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Grid Baris 2: Semester, SKS, Total Pertemuan */}
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    className="form-input"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Jumlah SKS</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    className="form-input"
                    value={formData.sks}
                    onChange={(e) => setFormData({ ...formData, sks: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Total Pertemuan</label>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    className="form-input"
                    value={formData.total_sessions}
                    onChange={(e) => setFormData({ ...formData, total_sessions: e.target.value })}
                  />
                </div>
              </div>

              {/* Grid Baris 3: Status & Dosen Pengampu */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Status Publikasi</label>
                  <select
                    className="form-input"
                    value={formData.is_published ? '1' : '0'}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.value === '1' })}
                  >
                    <option value="1">Aktif (Dapat diakses Mahasiswa)</option>
                    <option value="0">Non-Aktif (Draft / Arsip)</option>
                  </select>
                </div>

                {isAdmin && (
                  <div className="form-group">
                    <label>Dosen Pengampu</label>
                    <select
                      className="form-input"
                      value={formData.instructor_id}
                      onChange={handleInstructorChange}
                    >
                      <option value="">-- Pilih Dosen Pengampu --</option>
                      {instructors.map((inst) => (
                        <option key={inst.user_id} value={inst.user_id}>
                          {inst.full_name || inst.email} ({inst.department || 'Dosen'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Menyimpan...'
                    : editingCourseId
                      ? 'Simpan Perubahan'
                      : 'Simpan Mata Kuliah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Hak Akses Terbatas Matkul */}
      {accessModal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog card access-modal-dialog">
            <div className="modal-header">
              <div className="access-modal-header-info">
                <div className="access-header-icon">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h2>Kelola Hak Akses Mata Kuliah</h2>
                  <p className="access-course-subtitle">
                    <strong>{accessModal.course?.title}</strong> ({accessModal.course?.course_code || accessModal.course?.curriculum || 'KODE-MK'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccessModal((prev) => ({ ...prev, isOpen: false }))}
                className="modal-close-btn"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <div className="access-modal-body">
              {/* Alert Status */}
              {accessModal.rules.length === 0 ? (
                <div className="access-status-banner status-restricted" style={{ borderColor: 'hsla(38, 90%, 50%, 0.4)', background: 'hsla(38, 90%, 50%, 0.08)' }}>
                  <Lock size={20} style={{ color: 'hsl(38, 90%, 65%)' }} />
                  <div>
                    <strong style={{ color: 'hsl(38, 90%, 75%)' }}>Status: Belum Ada Izin Akses (Terkunci)</strong>
                    <p>Mata kuliah ini belum memiliki daftar izin akses, sehingga <strong>tidak ada mahasiswa yang dapat mengaksesnya</strong>. Masukkan nama mahasiswa atau tahun angkatan di bawah untuk memberikan akses.</p>
                  </div>
                </div>
              ) : (
                <div className="access-status-banner status-restricted">
                  <Lock size={20} />
                  <div>
                    <strong>Status: Akses Terbatas ({accessModal.rules.length} Mahasiswa Diizinkan)</strong>
                    <p>Hanya mahasiswa yang profilnya cocok dengan Nama, Angkatan, dan Semester di bawah ini yang dapat melihat dan membuka mata kuliah ini.</p>
                  </div>
                </div>
              )}

              {/* Form Tambah Akses (1 Input An Saja) */}
              <div className="access-form-section">
                <h4><Users size={16} /> Input Izin Akses Mahasiswa atau Angkatan</h4>
                <p className="access-form-desc">
                  Masukkan nama mahasiswa atau tahun angkatan. Sistem akan otomatis mencocokkan dengan data akun di database.
                </p>

                {accessModal.error && (
                  <div className="modal-alert modal-alert-error animate-shake">
                    <AlertCircle size={16} />
                    <span>{accessModal.error}</span>
                  </div>
                )}
                {accessModal.success && (
                  <div className="modal-alert modal-alert-success animate-fadeIn">
                    <CheckCircle2 size={16} />
                    <span>{accessModal.success}</span>
                  </div>
                )}

                <form onSubmit={handleAddAccessRule} className="access-rule-form">
                  <div className="access-single-form-wrap">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="access-single-input" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600 }}>Nama Mahasiswa atau Tahun Angkatan *</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Bisa input lebih dari 1 (satu per baris)
                        </span>
                      </label>
                      <textarea
                        id="access-single-input"
                        className="form-input access-textarea"
                        rows={4}
                        placeholder={"danar\nayu wardani\ndiah saputri\natau ketik tahun angkatan:\n2024"}
                        value={accessModal.inputText}
                        onChange={(e) =>
                          setAccessModal((prev) => ({
                            ...prev,
                            inputText: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="access-form-action-row">
                      <div className="access-input-hint">
                        <Info size={14} />
                        <span>Contoh: input <strong>danar</strong>, <strong>ayu wardani</strong>, atau ketik <strong>2024</strong> untuk seluruh mahasiswa angkatan 2024.</span>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary btn-add-access"
                        disabled={accessModal.submitting}
                      >
                        <Plus size={16} />
                        <span>{accessModal.submitting ? 'Memproses...' : 'Izinkan Akses'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Tabel Aturan Akses yang Aktif */}
              <div className="access-table-section">
                <h4>Daftar Mahasiswa & Angkatan yang Memiliki Akses ({accessModal.rules.length})</h4>
                {accessModal.loading ? (
                  <div className="loading-center" style={{ padding: '24px' }}>
                    <div className="spinner" />
                  </div>
                ) : accessModal.rules.length === 0 ? (
                  <div className="access-empty-state">
                    <Users size={36} />
                    <p>Belum ada mahasiswa yang ditambahkan secara spesifik.</p>
                    <small>Gunakan form di atas untuk membatasi akses mata kuliah ini ke mahasiswa tertentu.</small>
                  </div>
                ) : (
                  <div className="table-responsive access-table-wrap">
                    <table className="access-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>No</th>
                          <th>Nama / Sasaran Akses</th>
                          <th>NIM</th>
                          <th>Angkatan</th>
                          <th>Tipe Akses</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessModal.rules.map((rule, idx) => (
                          <tr key={rule.id}>
                            <td className="text-muted">{idx + 1}</td>
                            <td>
                              <strong>{rule.full_name}</strong>
                              {rule.department && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {rule.department}
                                </div>
                              )}
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                                {rule.nim_nip || '-'}
                              </span>
                            </td>
                            <td>
                              {rule.academic_year ? (
                                <span className="badge badge-academic-year">
                                  {rule.academic_year}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              {rule.rule_type === 'year' ? (
                                <span className="badge badge-access-type year">
                                  Seluruh Angkatan
                                </span>
                              ) : rule.user_id ? (
                                <span className="badge badge-access-type student">
                                  Mahasiswa Terdaftar
                                </span>
                              ) : (
                                <span className="badge badge-access-type name">
                                  Nama Khusus
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteAccessRule(rule.id)}
                                className="btn-action-delete"
                                title="Hapus Akses Mahasiswa Ini"
                              >
                                <Trash2 size={13} />
                                <span>Hapus</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions access-modal-footer">
              <button
                type="button"
                onClick={() => setAccessModal((prev) => ({ ...prev, isOpen: false }))}
                className="btn btn-secondary"
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Hapus Modern */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, courseId: null, courseTitle: '', loading: false })}
        onConfirm={handleConfirmDelete}
        title="Hapus Mata Kuliah"
        message={`Apakah Anda yakin ingin menghapus mata kuliah "${deleteModal.courseTitle}"? Semua materi perkuliahan dan sesi di dalamnya akan terhapus secara permanen.`}
        confirmText="Ya, Hapus Matkul"
        cancelText="Batal"
        loading={deleteModal.loading}
        type="danger"
      />
    </div>
  );
}
