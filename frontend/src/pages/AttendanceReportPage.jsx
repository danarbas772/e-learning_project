import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { courseAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import {
  UserCheck, Download, FileSpreadsheet, CheckCircle,
  XCircle, BookOpen, Layers, Users, Calendar, AlertCircle,
  Clock, Search, Filter
} from 'lucide-react';
import './AttendanceReport.css';

export default function AttendanceReportPage() {
  const { user, isAdmin, isInstructor } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Ambil daftar mata kuliah yang dapat diakses (Admin: semua matkul, Dosen: matkul miliknya)
  useEffect(() => {
    fetchCourseOptions();
  }, [user]);

  const fetchCourseOptions = async () => {
    setLoadingCourses(true);
    setErrorMsg('');
    try {
      let res;
      if (isAdmin) {
        res = await courseAPI.getAll({ all_status: 'true' });
      } else {
        res = await courseAPI.getMyCourses();
      }

      const list = res.data?.data || [];
      setCourses(list);

      if (list.length > 0) {
        setSelectedCourseId(String(list[0].id));
      }
    } catch (err) {
      console.error('Fetch course options error:', err);
      setErrorMsg('Gagal memuat daftar mata kuliah.');
    } finally {
      setLoadingCourses(false);
    }
  };

  // 2. Ketika selectedCourseId berubah, ambil data rekap presensi
  useEffect(() => {
    if (selectedCourseId) {
      fetchAttendanceReport(selectedCourseId);
    } else {
      setReportData(null);
    }
  }, [selectedCourseId]);

  const fetchAttendanceReport = async (courseId) => {
    setLoadingReport(true);
    setErrorMsg('');
    try {
      const res = await courseAPI.getAttendanceReport(courseId);
      setReportData(res.data?.data || null);
    } catch (err) {
      console.error('Fetch attendance report error:', err);
      setErrorMsg(err.response?.data?.message || 'Gagal memuat data rekap presensi.');
      setReportData(null);
    } finally {
      setLoadingReport(false);
    }
  };

  // 3. Export Excel (.xlsx) per mata kuliah
  const handleExportExcel = () => {
    if (!reportData || !reportData.matrix || reportData.matrix.length === 0) {
      alert('Tidak ada data presensi mahasiswa untuk diexport.');
      return;
    }

    const { course, sections, matrix } = reportData;

    // Format Header Baris Excel
    const excelRows = matrix.map((student, idx) => {
      const rowObj = {
        'No': idx + 1,
        'NIM': student.nim_nip || '-',
        'Nama Mahasiswa': student.full_name,
        'Angkatan': student.academic_year || '-',
        'Semester': student.semester || '-',
      };

      // Kolom per pertemuan
      sections.forEach((sec, sIdx) => {
        const colTitle = sec.title || `Pertemuan ${sIdx + 1}`;
        const secStatus = student.sessions[sec.id];
        if (secStatus && secStatus.attended) {
          const timeStr = secStatus.attended_at 
            ? new Date(secStatus.attended_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : '';
          rowObj[colTitle] = `Hadir ${timeStr ? `(${timeStr})` : ''}`.trim();
        } else {
          rowObj[colTitle] = 'Tidak Hadir';
        }
      });

      rowObj['Total Hadir'] = student.attended_count;
      rowObj['Persentase Kehadiran'] = `${student.attendance_percentage}%`;

      return rowObj;
    });

    // Buat worksheet dan workbook dengan SheetJS
    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Auto-lebar kolom
    const colWidths = [
      { wch: 6 },   // No
      { wch: 15 },  // NIM
      { wch: 30 },  // Nama
      { wch: 12 },  // Angkatan
      { wch: 10 },  // Semester
    ];
    sections.forEach(() => colWidths.push({ wch: 18 }));
    colWidths.push({ wch: 14 }); // Total Hadir
    colWidths.push({ wch: 20 }); // Persentase
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    const sheetName = (course.course_code || 'Presensi').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Nama file: Rekap_Presensi_[KodeMatkul]_[Judul].xlsx
    const cleanTitle = (course.title || 'MataKuliah').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Rekap_Presensi_${course.course_code || 'MK'}_${cleanTitle}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  // Filter pencarian mahasiswa pada tabel
  const filteredMatrix = (reportData?.matrix || []).filter((st) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (st.full_name || '').toLowerCase().includes(q) ||
      (st.nim_nip || '').toLowerCase().includes(q) ||
      String(st.academic_year || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <div className="container attendance-page-container">
          {/* Header */}
          <div className="page-header attendance-header animate-fadeIn">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span className="attendance-badge-icon">
                  <UserCheck size={20} />
                </span>
                <h1 style={{ margin: 0 }}>
                  Rekap <span className="gradient-text">Presensi Kehadiran</span>
                </h1>
              </div>
              <p>Kelola, tinjau catatan kehadiran pertemuan mahasiswa, dan unduh data per mata kuliah dalam format Excel.</p>
            </div>

            {/* Tombol Unduh Excel */}
            {reportData && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="btn btn-export-excel animate-fadeIn"
                disabled={loadingReport || !reportData.matrix || reportData.matrix.length === 0}
                title="Unduh rekap presensi mata kuliah ini (.xlsx)"
              >
                <FileSpreadsheet size={18} />
                <span>Unduh Excel (.xlsx)</span>
              </button>
            )}
          </div>

          {/* Filter Bar: Pilihan Mata Kuliah & Search Mahasiswa */}
          <div className="card attendance-filter-card animate-fadeIn">
            <div className="attendance-controls-row">
              {/* Dropdown Pemilihan Mata Kuliah */}
              <div className="course-select-group">
                <label htmlFor="course-selector" className="control-label">
                  <BookOpen size={16} />
                  <span>Pilih Mata Kuliah</span>
                </label>
                <div className="select-wrapper">
                  <select
                    id="course-selector"
                    className="form-input attendance-course-select"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    disabled={loadingCourses || courses.length === 0}
                  >
                    {courses.length === 0 ? (
                      <option value="">Tidak ada mata kuliah yang diampu</option>
                    ) : (
                      courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.course_code ? `[${c.course_code}] ` : ''}{c.title} {c.instructor_name ? `• ${c.instructor_name}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Input Pencarian Mahasiswa */}
              <div className="student-search-group">
                <label htmlFor="student-search" className="control-label">
                  <Search size={16} />
                  <span>Cari Mahasiswa</span>
                </label>
                <div className="input-icon-wrap">
                  <Search size={15} className="input-icon" />
                  <input
                    id="student-search"
                    type="text"
                    className="form-input input-with-icon"
                    placeholder="Ketik Nama, NIM, atau Angkatan..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Ringkasan Singkat Matkul Terpilih */}
            {reportData && (
              <div className="course-meta-summary">
                <div className="meta-pill">
                  <span className="meta-label">Kode:</span>
                  <span className="meta-val">{reportData.course.course_code || '-'}</span>
                </div>
                <div className="meta-pill">
                  <span className="meta-label">Semester:</span>
                  <span className="meta-val">{reportData.course.semester || 1}</span>
                </div>
                <div className="meta-pill">
                  <span className="meta-label">Total Sesi:</span>
                  <span className="meta-val">{reportData.sections.length} Pertemuan</span>
                </div>
                <div className="meta-pill">
                  <span className="meta-label">Mahasiswa Diberi Akses:</span>
                  <span className="meta-val" style={{ color: 'hsl(150, 80%, 70%)' }}>
                    {reportData.total_students} Mahasiswa
                  </span>
                </div>
                {reportData.course.instructor_name && (
                  <div className="meta-pill">
                    <span className="meta-label">Dosen:</span>
                    <span className="meta-val">{reportData.course.instructor_name}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pesan Kesalahan / Peringatan */}
          {errorMsg && (
            <div className="modal-alert modal-alert-error" style={{ marginBottom: '20px' }}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Loading State */}
          {loadingReport && (
            <div className="loading-center" style={{ padding: '60px 0' }}>
              <div className="spinner" />
              <p style={{ marginTop: '14px', color: 'var(--text-muted)' }}>Memuat data presensi mata kuliah...</p>
            </div>
          )}

          {/* Konten Tabel Matriks Presensi */}
          {!loadingReport && reportData && (
            <div className="card attendance-table-card animate-fadeIn">
              <div className="table-card-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} style={{ color: 'var(--color-primary-light)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    Matriks Presensi Per Pertemuan
                  </h3>
                </div>
                <span className="badge badge-primary">
                  {filteredMatrix.length} Mahasiswa
                </span>
              </div>

              {reportData.matrix.length === 0 ? (
                <div className="empty-attendance-box">
                  <UserCheck size={44} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <h4>Belum Ada Mahasiswa Diberikan Akses</h4>
                  <p>Mata kuliah ini belum memiliki daftar izin akses mahasiswa atau belum ada mahasiswa yang terdaftar.</p>
                </div>
              ) : (
                <div className="attendance-matrix-wrapper">
                  <table className="attendance-table">
                    <thead>
                      <tr>
                        <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                        <th style={{ minWidth: '110px' }}>NIM</th>
                        <th style={{ minWidth: '180px' }}>Nama Mahasiswa</th>
                        <th style={{ minWidth: '90px', textAlign: 'center' }}>Angkatan</th>
                        {/* Kolom Tiap Pertemuan */}
                        {reportData.sections.map((sec, sIdx) => (
                          <th key={sec.id} style={{ minWidth: '85px', textAlign: 'center' }}>
                            <div className="th-session-title" title={sec.title}>
                              {sec.title.replace('PERTEMUAN', 'P.').trim()}
                            </div>
                            {sec.attendance_active ? (
                              <span className="badge-active-tag" title="Presensi dibuka">Buka</span>
                            ) : (
                              <span className="badge-closed-tag" title="Presensi ditutup">Tutup</span>
                            )}
                          </th>
                        ))}
                        <th style={{ minWidth: '95px', textAlign: 'center' }}>Total Hadir</th>
                        <th style={{ minWidth: '100px', textAlign: 'center' }}>% Hadir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatrix.length === 0 ? (
                        <tr>
                          <td colSpan={reportData.sections.length + 6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                            Tidak ada mahasiswa yang cocok dengan pencarian "{searchFilter}".
                          </td>
                        </tr>
                      ) : (
                        filteredMatrix.map((student, idx) => (
                          <tr key={student.student_id || idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {student.nim_nip || '-'}
                            </td>
                            <td>
                              <strong style={{ color: 'var(--text-primary)' }}>{student.full_name}</strong>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="year-pill">{student.academic_year || '-'}</span>
                            </td>

                            {/* Status Kehadiran Per Sesi */}
                            {reportData.sections.map((sec) => {
                              const sStatus = student.sessions[sec.id];
                              const isAttended = sStatus && sStatus.attended;
                              const timeString = sStatus?.attended_at
                                ? new Date(sStatus.attended_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                : null;

                              return (
                                <td key={sec.id} style={{ textAlign: 'center' }}>
                                  {isAttended ? (
                                    <div className="attendance-cell-present" title={`Hadir ${timeString ? `pada ${timeString}` : ''}`}>
                                      <CheckCircle size={18} className="icon-present" />
                                      {timeString && <span className="cell-time">{timeString}</span>}
                                    </div>
                                  ) : (
                                    <div className="attendance-cell-absent" title="Tidak Hadir">
                                      <span className="dash-absent">-</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}

                            {/* Total Hadir & Persentase */}
                            <td style={{ textAlign: 'center' }}>
                              <span className="total-attended-badge">
                                {student.attended_count} / {reportData.sections.length}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className={`percentage-pill ${
                                  student.attendance_percentage >= 75
                                    ? 'pct-high'
                                    : student.attendance_percentage >= 50
                                    ? 'pct-mid'
                                    : 'pct-low'
                                }`}
                              >
                                {student.attendance_percentage}%
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* State jika belum ada mata kuliah sama sekali */}
          {!loadingCourses && courses.length === 0 && (
            <div className="card empty-state" style={{ padding: '48px', textAlign: 'center' }}>
              <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <h3>Tidak Ada Mata Kuliah</h3>
              <p>Belum ada mata kuliah yang Anda ampu atau tersedia di sistem.</p>
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
}
