import { useEffect, useState } from 'react';
import { userAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import Footer from '../components/Footer';
import {
  Users, UserPlus, FileSpreadsheet, Search, Filter,
  Trash2, Edit2, X, Mail, Phone, BookOpen, GraduationCap,
  Shield, CheckCircle, AlertCircle, Download, Upload,
  Briefcase, Hash, Calendar, Layers, Lock
} from 'lucide-react';
import './UserManagement.css';

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create' | 'import'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    userId: null,
    userName: '',
    loading: false,
  });

  // Form State untuk Tambah Manual
  const [selectedRole, setSelectedRole] = useState('instructor'); // 'instructor' | 'student' | 'admin'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    nim_nip: '',
    department: 'Teknik Informatika',
    academic_year: '2024',
    phone: '',
    bio: '',
  });
  const [submitLoading, setSubmitLoading] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    nim_nip: '',
    role: 'student',
    department: '',
    academic_year: '',
    phone: '',
    bio: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Excel Import State
  const [excelFile, setExcelFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [filterRole]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterRole !== 'all') params.role = filterRole;
      const res = await userAPI.getAllProfiles(params);
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Fetch users error:', err);
      showAlert('error', 'Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert({ type: '', message: '' }), 5000);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await userAPI.createUser({
        ...formData,
        role: selectedRole,
      });
      showAlert('success', `Berhasil menambahkan akun ${selectedRole === 'instructor' ? 'Dosen' : selectedRole === 'admin' ? 'Admin' : 'Mahasiswa'}!`);
      // Reset form
      setFormData({
        email: '',
        password: '',
        full_name: '',
        nim_nip: '',
        department: 'Teknik Informatika',
        academic_year: '2024',
        phone: '',
        bio: '',
      });
      setActiveTab('list');
      fetchUsers();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Gagal menambahkan pengguna');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenEdit = (user) => {
    setEditingUserId(user.user_id);
    setEditFormData({
      email: user.email || '',
      password: '', // Kosongkan, hanya diisi jika ingin ganti password
      full_name: user.full_name || '',
      nim_nip: user.nim_nip || '',
      role: user.role || 'student',
      department: user.department || 'Teknik Informatika',
      academic_year: user.academic_year || '2024',
      phone: user.phone || '',
      bio: user.bio || '',
    });
    setIsEditOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      await userAPI.updateUser(editingUserId, editFormData);
      showAlert('success', `Data pengguna "${editFormData.full_name}" berhasil diperbarui!`);
      setIsEditOpen(false);
      fetchUsers();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Gagal memperbarui pengguna');
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenDeleteModal = (userId, userName) => {
    setDeleteModal({
      isOpen: true,
      userId,
      userName,
      loading: false,
    });
  };

  const handleConfirmDeleteUser = async () => {
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      await userAPI.deleteUser(deleteModal.userId);
      showAlert('success', `Pengguna "${deleteModal.userName}" berhasil dihapus.`);
      setDeleteModal({ isOpen: false, userId: null, userName: '', loading: false });
      fetchUsers();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Gagal menghapus pengguna');
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await userAPI.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'template_import_pengguna.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showAlert('error', 'Gagal mendownload template Excel');
    }
  };

  const handleUploadExcel = async (e) => {
    e.preventDefault();
    if (!excelFile) return showAlert('error', 'Pilih file Excel terlebih dahulu');

    setImportLoading(true);
    setImportResult(null);

    const data = new FormData();
    data.append('file', excelFile);

    try {
      const res = await userAPI.importExcel(data);
      setImportResult(res.data.data);
      showAlert('success', 'File Excel berhasil diproses!');
      setExcelFile(null);
      fetchUsers();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Gagal mengimport Excel');
    } finally {
      setImportLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.nim_nip?.toLowerCase().includes(term) ||
      u.department?.toLowerCase().includes(term)
    );
  });

  const totalDosen = users.filter((u) => u.role === 'instructor').length;
  const totalMahasiswa = users.filter((u) => u.role === 'student').length;
  const totalAdmin = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <div className="container" style={{ padding: '32px 24px' }}>
          {/* Header */}
          <div className="user-page-header animate-fadeIn">
            <div>
              <h1>Kelola <span className="gradient-text">Pengguna</span></h1>
              <p>Manajemen data akun Dosen, Mahasiswa, dan Administrator</p>
            </div>
            <div className="user-header-actions">
              <button
                className={`btn ${activeTab === 'list' ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('list')}
              >
                <Users size={18} />
                Daftar Pengguna
              </button>
              <button
                className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('create')}
              >
                <UserPlus size={18} />
                Tambah Manual
              </button>
              <button
                className={`btn ${activeTab === 'import' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('import')}
              >
                <FileSpreadsheet size={18} />
                Import Excel
              </button>
            </div>
          </div>

          {/* Alert Notification */}
          {alert.message && (
            <div className={`alert alert-${alert.type} animate-fadeIn`} style={{ marginBottom: '20px' }}>
              {alert.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span>{alert.message}</span>
            </div>
          )}

          {/* TAB 1: LIST PENGGUNA */}
          {activeTab === 'list' && (
            <div className="animate-fadeIn">
              {/* Stats Bar */}
              <div className="user-stats-grid">
                <div className="user-stat-card card">
                  <div className="stat-icon-wrap" style={{ background: 'hsla(250, 85%, 60%, 0.15)', color: 'var(--color-primary-light)' }}>
                    <Briefcase size={22} />
                  </div>
                  <div>
                    <span className="stat-title">Total Dosen</span>
                    <h3 className="stat-num">{totalDosen}</h3>
                  </div>
                </div>

                <div className="user-stat-card card">
                  <div className="stat-icon-wrap" style={{ background: 'hsla(180, 80%, 48%, 0.15)', color: 'var(--color-accent-light)' }}>
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <span className="stat-title">Total Mahasiswa</span>
                    <h3 className="stat-num">{totalMahasiswa}</h3>
                  </div>
                </div>

                <div className="user-stat-card card">
                  <div className="stat-icon-wrap" style={{ background: 'hsla(38, 90%, 52%, 0.15)', color: 'hsl(38, 90%, 65%)' }}>
                    <Shield size={22} />
                  </div>
                  <div>
                    <span className="stat-title">Administrator</span>
                    <h3 className="stat-num">{totalAdmin}</h3>
                  </div>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="user-toolbar card">
                <div className="search-wrap">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    className="form-input search-input"
                    placeholder="Cari nama, NIP/NIM, email, atau jurusan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="filter-role-wrap">
                  <Filter size={16} className="filter-icon" />
                  <select
                    className="form-select filter-select"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="all">Semua Role</option>
                    <option value="instructor">👨‍🏫 Dosen</option>
                    <option value="student">🎓 Mahasiswa</option>
                    <option value="admin">🛡️ Administrator</option>
                  </select>
                </div>
              </div>

              {/* User Table */}
              <div className="user-table-card card">
                {loading ? (
                  <div className="loading-center" style={{ padding: '60px' }}>
                    <div className="spinner" />
                    <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Memuat data pengguna...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="empty-state" style={{ padding: '60px', textAlign: 'center' }}>
                    <Users size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <h4>Tidak ada pengguna ditemukan</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {searchTerm ? 'Coba ubah kata kunci pencarian.' : 'Tambahkan pengguna manual atau gunakan import Excel.'}
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Profil & Nama</th>
                          <th>Role</th>
                          <th>NIP / NIM</th>
                          <th>Program Studi</th>
                          <th>Kontak & Keahlian</th>
                          <th style={{ textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.user_id}>
                            <td>
                              <div className="user-row-profile">
                                <div className={`user-avatar ${u.role}`}>
                                  {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <span className="user-fullname">{u.full_name}</span>
                                  <span className="user-email">
                                    <Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                    {u.email}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`badge badge-${u.role === 'admin' ? 'warning' : u.role === 'instructor' ? 'primary' : 'info'}`}>
                                {u.role === 'instructor' ? '👨‍🏫 Dosen' : u.role === 'admin' ? '🛡️ Admin' : '🎓 Mahasiswa'}
                              </span>
                            </td>
                            <td>
                              <span className="user-id-number">{u.nim_nip || '-'}</span>
                            </td>
                            <td>
                              <span className="user-department">{u.department || '-'}</span>
                              {u.academic_year && <span className="user-subtext">Angkatan {u.academic_year}</span>}
                            </td>
                            <td>
                              <div className="user-contact-info">
                                {u.phone && (
                                  <span className="user-phone">
                                    <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                    {u.phone}
                                  </span>
                                )}
                                {u.bio && <span className="user-bio" title={u.bio}>{u.bio}</span>}
                                {!u.phone && !u.bio && <span style={{ color: 'var(--text-muted)' }}>-</span>}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="user-action-btns">
                                <button
                                  className="btn-action-edit"
                                  onClick={() => handleOpenEdit(u)}
                                  title="Edit Pengguna"
                                >
                                  <Edit2 size={16} />
                                </button>
                                {u.role !== 'admin' && (
                                  <button
                                    className="btn-action-delete"
                                    onClick={() => handleOpenDeleteModal(u.user_id, u.full_name)}
                                    title="Hapus Pengguna"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TAMBAH PENGGUNA MANUAL */}
          {activeTab === 'create' && (
            <div className="card animate-fadeIn" style={{ maxWidth: '800px', margin: '0 auto', padding: '32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h2>Tambah Pengguna Baru ✍️</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Lengkapi data identitas untuk mendaftarkan akun baru ke sistem
                </p>
              </div>

              {/* Role Selection */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px' }}>Pilih Peran (Role)</label>
                <div className="role-selector-grid">
                  <div
                    className={`role-option-box ${selectedRole === 'instructor' ? 'selected' : ''}`}
                    onClick={() => setSelectedRole('instructor')}
                  >
                    <span className="role-emoji">👨‍🏫</span>
                    <div>
                      <strong>Dosen / Pengajar</strong>
                      <p>Dapat mengelola mata kuliah, mengupload materi, dan membuat kuis</p>
                    </div>
                  </div>

                  <div
                    className={`role-option-box ${selectedRole === 'student' ? 'selected' : ''}`}
                    onClick={() => setSelectedRole('student')}
                  >
                    <span className="role-emoji">🎓</span>
                    <div>
                      <strong>Mahasiswa</strong>
                      <p>Dapat mendaftar mata kuliah, membaca materi, dan mengerjakan kuis</p>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreateUser}>
                <div className="form-grid-2">
                  {/* Nama Lengkap */}
                  <div className="form-group">
                    <label className="form-label">
                      {selectedRole === 'instructor' ? 'Nama Lengkap & Gelar' : 'Nama Lengkap Mahasiswa'} <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={selectedRole === 'instructor' ? 'Contoh: Dr. Budi Santoso, M.Kom.' : 'Contoh: Ahmad Rizki'}
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>

                  {/* NIP atau NIM */}
                  <div className="form-group">
                    <label className="form-label">
                      {selectedRole === 'instructor' ? 'NIP / NIDN Dosen' : 'NIM (Nomor Induk Mahasiswa)'}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={selectedRole === 'instructor' ? 'Contoh: 198501012010011001' : 'Contoh: 21234001'}
                      value={formData.nim_nip}
                      onChange={(e) => setFormData({ ...formData, nim_nip: e.target.value })}
                    />
                  </div>

                  {/* Email */}
                  <div className="form-group">
                    <label className="form-label">Email Akun <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="contoh@kampus.ac.id"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="form-group">
                    <label className="form-label">Password Default <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Minimal 6 karakter"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>

                  {/* Program Studi / Departemen */}
                  <div className="form-group">
                    <label className="form-label">Program Studi / Jurusan</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Teknik Informatika"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>

                  {/* No Telepon */}
                  <div className="form-group">
                    <label className="form-label">No. Telepon / WhatsApp</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: 08123456789"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  {/* Mahasiswa: Tahun Angkatan */}
                  {selectedRole === 'student' && (
                    <div className="form-group">
                      <label className="form-label">Tahun Masuk / Angkatan</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: 2024"
                        value={formData.academic_year}
                        onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Dosen: Keahlian / Bidang Riset */}
                  {selectedRole === 'instructor' && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Bidang Keahlian / Deskripsi Dosen</label>
                      <textarea
                        className="form-textarea"
                        placeholder="Contoh: Kecerdasan Buatan, Pengembangan Web, Rekayasa Perangkat Lunak"
                        rows="3"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '28px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('list')}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitLoading}
                  >
                    {submitLoading ? 'Menyimpan...' : 'Simpan Pengguna Baru'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: IMPORT DARI EXCEL */}
          {activeTab === 'import' && (
            <div className="animate-fadeIn" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Step 1: Download Template */}
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Download size={24} style={{ color: 'var(--color-primary-light)' }} />
                    <h3>1. Unduh Template Excel</h3>
                  </div>
                  <p style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Gunakan format template yang sudah disediakan. Anda dapat mengisi data Dosen (role: <code>instructor</code>) maupun Mahasiswa (role: <code>student</code>) sekaligus.
                  </p>
                  <button onClick={handleDownloadTemplate} className="btn btn-secondary">
                    <FileSpreadsheet size={18} />
                    Download Template (.xlsx)
                  </button>
                </div>

                {/* Step 2: Upload File */}
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Upload size={24} style={{ color: 'var(--color-accent-light)' }} />
                    <h3>2. Upload File Excel</h3>
                  </div>

                  <form onSubmit={handleUploadExcel}>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="form-input"
                        onChange={(e) => setExcelFile(e.target.files[0])}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-full"
                      disabled={importLoading || !excelFile}
                    >
                      {importLoading ? 'Memproses Import...' : 'Import Data Pengguna'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Import Results Summary */}
              {importResult && (
                <div className="card animate-fadeIn" style={{ padding: '24px' }}>
                  <h3>Hasil Import Excel</h3>
                  <div style={{ display: 'flex', gap: '24px', marginTop: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                      <CheckCircle size={20} />
                      <span><strong>{importResult.success}</strong> Pengguna Berhasil Ditambahkan</span>
                    </div>
                    {importResult.failed > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
                        <AlertCircle size={20} />
                        <span><strong>{importResult.failed}</strong> Gagal</span>
                      </div>
                    )}
                  </div>

                  {importResult.errors?.length > 0 && (
                    <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.85rem' }}>Detail Error:</p>
                      <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}><strong>{err.email}</strong>: {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <Footer />
      </main>

      {/* Modal Edit Pengguna */}
      {isEditOpen && (
        <div className="edit-modal-backdrop">
          <div className="edit-modal-dialog">
            <div className="edit-modal-header">
              <div>
                <h2>Edit Pengguna</h2>
                <p className="edit-modal-subtitle">Perbarui informasi profil dan data akun pengguna</p>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="edit-modal-close">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Role / Peran</label>
                <select
                  className="form-select"
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                >
                  <option value="student">🎓 Mahasiswa</option>
                  <option value="instructor">👨‍🏫 Dosen</option>
                  <option value="admin">🛡️ Administrator</option>
                </select>
              </div>

              <div className="form-grid-2" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label>Nama Lengkap & Gelar *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>{editFormData.role === 'instructor' ? 'NIP (Nomor Induk Pegawai)' : editFormData.role === 'student' ? 'NIM (Nomor Induk Mahasiswa)' : 'ID Pegawai'}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.nim_nip}
                    onChange={(e) => setEditFormData({ ...editFormData, nim_nip: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label>Email Akun *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Ganti Password <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(kosongkan jika tetap)</span></label>
                  <input
                    type="password"
                    placeholder="Masukkan password baru..."
                    className="form-input"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label>Program Studi / Departemen</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  />
                </div>

                {editFormData.role === 'student' ? (
                  <div className="form-group">
                    <label>Tahun Angkatan</label>
                    <input
                      type="text"
                      placeholder="Contoh: 2024"
                      className="form-input"
                      value={editFormData.academic_year}
                      onChange={(e) => setEditFormData({ ...editFormData, academic_year: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Nomor Telepon / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="08123456789"
                      className="form-input"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {editFormData.role === 'student' && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Nomor Telepon / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    className="form-input"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Bio / Keterangan Singkat</label>
                <textarea
                  rows="2"
                  placeholder="Keterangan singkat pengguna..."
                  className="form-input"
                  value={editFormData.bio}
                  onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                />
              </div>

              <div className="edit-modal-actions">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="btn btn-secondary"
                  disabled={editLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editLoading}
                >
                  {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern Confirmation Dialog untuk Hapus Pengguna */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, userId: null, userName: '', loading: false })}
        onConfirm={handleConfirmDeleteUser}
        title="Hapus Akun Pengguna"
        message={`Apakah Anda yakin ingin menghapus akun "${deleteModal.userName}"? Tindakan ini bersifat permanen dan data yang telah dihapus tidak dapat dipulihkan.`}
        type="danger"
        confirmText="Ya, Hapus Pengguna"
        cancelText="Batal"
        loading={deleteModal.loading}
      />
    </div>
  );
}
