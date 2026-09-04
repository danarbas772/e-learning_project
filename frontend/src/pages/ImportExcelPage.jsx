import { useState } from 'react';
import { userAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

export default function ImportExcelPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

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
      setError('Gagal mendownload template Excel');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setError('Pilih file Excel terlebih dahulu');

    setError('');
    setResult(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await userAPI.importExcel(formData);
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal import file Excel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-content">
        <div className="container" style={{ padding: '32px 24px' }}>
          <div className="page-header animate-fadeIn">
            <h1>Import Data dari <span className="gradient-text">Excel</span></h1>
            <p>Upload data mahasiswa dan dosen secara massal dengan file Excel (.xlsx / .xls)</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '20px' }}>
            {/* Step 1: Template */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Download size={24} style={{ color: 'var(--color-primary)' }} />
                <h3>1. Unduh Template Excel</h3>
              </div>
              <p style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
                Gunakan format template yang sudah disediakan agar kolom (email, password, nama, NIM/NIP, role, jurusan) terbaca dengan benar oleh sistem.
              </p>
              <button onClick={handleDownloadTemplate} className="btn btn-secondary">
                <FileSpreadsheet size={18} />
                Download Template (.xlsx)
              </button>
            </div>

            {/* Step 2: Upload */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Upload size={24} style={{ color: 'var(--color-accent)' }} />
                <h3>2. Upload File Excel</h3>
              </div>

              {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

              <form onSubmit={handleUpload}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="form-input"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={loading || !file}>
                  {loading ? 'Mengimport Data...' : 'Import Data ke Database'}
                </button>
              </form>
            </div>
          </div>

          {/* Results Display */}
          {result && (
            <div className="card animate-fadeIn" style={{ padding: '24px', marginTop: '24px' }}>
              <h3>Hasil Import</h3>
              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                  <CheckCircle size={20} />
                  <span><strong>{result.success}</strong> Berhasil ditambahkan</span>
                </div>
                {result.failed > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
                    <AlertCircle size={20} />
                    <span><strong>{result.failed}</strong> Gagal</span>
                  </div>
                )}
              </div>

              {result.errors?.length > 0 && (
                <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.85rem' }}>Detail Error:</p>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {result.errors.map((err, idx) => (
                      <li key={idx}>{err.email}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
}
