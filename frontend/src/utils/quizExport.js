import * as XLSX from 'xlsx';

/**
 * Ekspor data seluruh peserta yang telah mengerjakan kuis/ujian ke file Excel (.xlsx)
 * Menyertakan:
 * - Sheet 1: Rekap Nilai & Status Kelulusan Mahasiswa
 * - Sheet 2: Rincian Jawaban per Butir Soal untuk setiap Mahasiswa
 * 
 * @param {Object} quiz - Metadata ujian/kuis
 * @param {Object} submissionsData - Data peserta & submission dari backend
 */
export function exportQuizParticipantsToExcel(quiz, submissionsData) {
  const submissions = submissionsData?.submissions || [];
  if (!submissions || submissions.length === 0) {
    throw new Error('Belum ada mahasiswa yang mengumpulkan ujian ini.');
  }

  const passingScore = Number(quiz?.passing_score ?? 70);
  const totalQuestions = quiz?.question_count || '-';

  // ─── Sheet 1: Rekap Nilai Peserta ───────────────────────────────────────────
  const summaryRows = submissions.map((att, idx) => {
    let durationStr = '-';
    if (att.started_at && att.submitted_at) {
      const diffMs = new Date(att.submitted_at).getTime() - new Date(att.started_at).getTime();
      if (diffMs > 0) {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        durationStr = `${mins} Menit ${secs} Detik`;
      }
    }

    const correctCount = att.answers?.filter((a) => a.is_correct).length ?? '-';

    const formatDateTime = (iso) => {
      if (!iso) return '-';
      try {
        const d = new Date(iso);
        return d.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } catch {
        return iso;
      }
    };

    return {
      'No': idx + 1,
      'Nama Mahasiswa': att.student_name || 'Tanpa Nama',
      'NIM / NIP': att.nim || '-',
      'Email': att.email || '-',
      'Nilai Akhir (0-100)': Number(att.score) || 0,
      'KKM Minimal': `${passingScore}%`,
      'Status': att.is_passed ? 'LULUS' : 'REMEDIAL',
      'Waktu Mulai': formatDateTime(att.started_at),
      'Waktu Submit': formatDateTime(att.submitted_at),
      'Durasi Pengerjaan': durationStr,
      'Jawaban Benar (PG)': correctCount,
      'Total Soal': totalQuestions,
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 6 },   // No
    { wch: 28 },  // Nama Mahasiswa
    { wch: 18 },  // NIM / NIP
    { wch: 28 },  // Email
    { wch: 18 },  // Nilai Akhir
    { wch: 14 },  // KKM
    { wch: 14 },  // Status
    { wch: 22 },  // Waktu Mulai
    { wch: 22 },  // Waktu Submit
    { wch: 18 },  // Durasi Pengerjaan
    { wch: 18 },  // Jawaban Benar
    { wch: 12 },  // Total Soal
  ];

  // ─── Sheet 2: Rincian Jawaban Soal ──────────────────────────────────────────
  const detailRows = [];
  submissions.forEach((att, sIdx) => {
    const answers = att.answers || [];
    answers.forEach((ans, qIdx) => {
      let resultLabel = 'Evaluasi Dosen';
      if (ans.question_type !== 'essay') {
        resultLabel = ans.is_correct ? 'Benar' : 'Salah';
      }

      detailRows.push({
        'No Peserta': sIdx + 1,
        'Nama Mahasiswa': att.student_name || 'Tanpa Nama',
        'NIM': att.nim || '-',
        'No Soal': qIdx + 1,
        'Tipe Soal': ans.question_type === 'essay' ? 'Essay' : 'Pilihan Ganda',
        'Pertanyaan': ans.question_text || '-',
        'Jawaban Mahasiswa': ans.question_type === 'essay'
          ? (ans.text_answer || '(Tidak dijawab)')
          : (ans.selected_option_text || '(Tidak dijawab)'),
        'Hasil': resultLabel
      });
    });
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Rekap Nilai Peserta');

  if (detailRows.length > 0) {
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail['!cols'] = [
      { wch: 12 },  // No Peserta
      { wch: 28 },  // Nama Mahasiswa
      { wch: 18 },  // NIM
      { wch: 10 },  // No Soal
      { wch: 16 },  // Tipe Soal
      { wch: 55 },  // Pertanyaan
      { wch: 45 },  // Jawaban Mahasiswa
      { wch: 18 },  // Hasil
    ];
    XLSX.utils.book_append_sheet(workbook, wsDetail, 'Rincian Jawaban');
  }

  // Bersihkan nama file dari karakter khusus
  const cleanTitle = (quiz?.title || 'Ujian')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 40);
  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `Rekap_Ujian_${cleanTitle}_${nowStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
