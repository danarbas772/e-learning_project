import * as XLSX from 'xlsx';

/**
 * Menghasilkan file template Excel (.xlsx) untuk soal ujian (Pilihan Ganda & Essay)
 * @param {string} mode - 'multiple_choice' | 'essay' | 'mixed'
 */
export function downloadQuizTemplate(mode = 'multiple_choice') {
  const sampleData = [];

  if (mode === 'essay') {
    // Template khusus Essay (10 contoh baris pertama)
    for (let i = 1; i <= 10; i++) {
      sampleData.push({
        'No': i,
        'Tipe Soal': 'essay',
        'Pertanyaan': i === 1 
          ? 'Jelaskan perbedaan mendasar antara arsitektur Microservices dan arsitektur Monolithic!'
          : i === 2
          ? 'Bagaimanakah mekanisme autentikasi berbasis JSON Web Token (JWT) bekerja dalam aplikasi web modern?'
          : `Tuliskan butir soal essay nomor ${i}...`,
        'Pilihan A': '',
        'Pilihan B': '',
        'Pilihan C': '',
        'Pilihan D': '',
        'Pilihan E': '',
        'Kunci Jawaban (A/B/C/D/E)': '',
        'Bobot Poin': 10
      });
    }
  } else {
    // Template Pilihan Ganda (Bisa hingga 50 butir soal)
    const samples = [
      {
        q: 'Protokol apa yang digunakan secara default pada World Wide Web untuk transfer halaman web terenkripsi?',
        a: 'FTP', b: 'HTTP', c: 'HTTPS', d: 'SSH', e: 'SMTP', key: 'C'
      },
      {
        q: 'Tag HTML yang digunakan untuk membuat tautan / hyperlink ke halaman lain adalah...',
        a: '<link>', b: '<a>', c: '<href>', d: '<url>', e: '<nav>', key: 'B'
      },
      {
        q: 'Dalam database relasional, kolom yang unik dan digunakan untuk mengidentifikasi baris data disebut...',
        a: 'Foreign Key', b: 'Index Key', c: 'Candidate Key', d: 'Primary Key', e: 'Unique Column', key: 'D'
      },
      {
        q: 'Format pertukaran data standar yang berbasis teks dan mudah dibaca manusia serta mesin adalah...',
        a: 'JSON', b: 'BINARY', c: 'HEX', d: 'RAW', e: 'BLOB', key: 'A'
      },
      {
        q: 'Perintah Git untuk membuat commit perubahan lokal ke dalam repository adalah...',
        a: 'git push', b: 'git add', c: 'git commit -m', d: 'git fetch', e: 'git merge', key: 'C'
      }
    ];

    for (let i = 1; i <= 50; i++) {
      const sample = samples[i - 1];
      if (sample) {
        sampleData.push({
          'No': i,
          'Tipe Soal': 'multiple_choice',
          'Pertanyaan': sample.q,
          'Pilihan A': sample.a,
          'Pilihan B': sample.b,
          'Pilihan C': sample.c,
          'Pilihan D': sample.d,
          'Pilihan E': sample.e,
          'Kunci Jawaban (A/B/C/D/E)': sample.key,
          'Bobot Poin': 2
        });
      } else {
        sampleData.push({
          'No': i,
          'Tipe Soal': 'multiple_choice',
          'Pertanyaan': `Contoh butir pertanyaan nomor ${i}...`,
          'Pilihan A': 'Opsi A',
          'Pilihan B': 'Opsi B',
          'Pilihan C': 'Opsi C',
          'Pilihan D': 'Opsi D',
          'Pilihan E': 'Opsi E',
          'Kunci Jawaban (A/B/C/D/E)': 'A',
          'Bobot Poin': 2
        });
      }
    }
  }

  // Buat worksheet
  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Atur lebar kolom agar rapi
  worksheet['!cols'] = [
    { wch: 6 },   // No
    { wch: 16 },  // Tipe Soal
    { wch: 60 },  // Pertanyaan
    { wch: 25 },  // Pilihan A
    { wch: 25 },  // Pilihan B
    { wch: 25 },  // Pilihan C
    { wch: 25 },  // Pilihan D
    { wch: 25 },  // Pilihan E
    { wch: 26 },  // Kunci Jawaban
    { wch: 12 },  // Bobot Poin
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Soal Ujian');

  const fileName = mode === 'essay' 
    ? 'template_soal_ujian_essay.xlsx' 
    : 'template_soal_ujian_50_pilihan_ganda.xlsx';

  XLSX.writeFile(workbook, fileName);
}

/**
 * Mem-parse file Excel (.xlsx / .xls) atau CSV yang diunggah menjadi array questions standar
 * @param {File} file 
 * @returns {Promise<{ questions: Array, warnings: Array }>}
 */
export function parseQuizExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          throw new Error('File Excel kosong atau tidak memiliki data pada sheet pertama.');
        }

        const questions = [];
        const warnings = [];

        rows.forEach((row, index) => {
          // Cari properti terlepas dari case huruf
          const getVal = (patterns) => {
            const rowKeys = Object.keys(row);
            for (const pattern of patterns) {
              const matchedKey = rowKeys.find(k => k.toLowerCase().trim() === pattern.toLowerCase().trim());
              if (matchedKey && row[matchedKey] !== undefined) {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const qText = getVal(['Pertanyaan', 'Question', 'Soal', 'Teks Pertanyaan']);
          if (!qText) {
            // Lewati baris kosong
            return;
          }

          const rawType = getVal(['Tipe Soal', 'Type', 'Jenis Soal', 'Tipe']).toLowerCase();
          const isEssay = rawType === 'essay' || rawType === 'esai';
          const pointsVal = parseFloat(getVal(['Bobot Poin', 'Poin', 'Points', 'Bobot'])) || (isEssay ? 10 : 2);

          if (isEssay) {
            questions.push({
              question_text: qText,
              question_type: 'essay',
              points: pointsVal,
              order_index: index,
              options: []
            });
          } else {
            // Pilihan Ganda (A, B, C, D, E)
            const optA = getVal(['Pilihan A', 'Opsi A', 'A', 'Option A']);
            const optB = getVal(['Pilihan B', 'Opsi B', 'B', 'Option B']);
            const optC = getVal(['Pilihan C', 'Opsi C', 'C', 'Option C']);
            const optD = getVal(['Pilihan D', 'Opsi D', 'D', 'Option D']);
            const optE = getVal(['Pilihan E', 'Opsi E', 'E', 'Option E']);

            const keyRaw = getVal(['Kunci Jawaban (A/B/C/D/E)', 'Kunci Jawaban', 'Kunci', 'Answer', 'Key']).toUpperCase();

            const optionsList = [
              { label: 'A', text: optA },
              { label: 'B', text: optB },
              { label: 'C', text: optC },
              { label: 'D', text: optD },
              { label: 'E', text: optE },
            ].filter(o => o.text.trim() !== '');

            if (optionsList.length < 2) {
              warnings.push(`Baris ${index + 2}: Soal "${qText.substring(0, 30)}..." hanya memiliki kurang dari 2 pilihan jawaban.`);
            }

            const options = optionsList.map(o => ({
              option_text: o.text,
              is_correct: o.label === keyRaw || o.text.toUpperCase() === keyRaw
            }));

            // Jika tidak ada opsi yang cocok dengan kunci, default ke pilihan A atau peringatan
            const hasCorrect = options.some(o => o.is_correct);
            if (!hasCorrect && options.length > 0) {
              options[0].is_correct = true; // Fallback ke pilihan pertama jika belum ditentukan
              warnings.push(`Baris ${index + 2}: Kunci jawaban tidak cocok, diset ke pilihan A (${options[0].option_text.substring(0, 20)}).`);
            }

            questions.push({
              question_text: qText,
              question_type: 'multiple_choice',
              points: pointsVal,
              order_index: index,
              options
            });
          }
        });

        if (questions.length === 0) {
          throw new Error('Tidak ditemukan butir pertanyaan valid pada file Excel.');
        }

        resolve({ questions, warnings });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Gagal membaca file Excel.'));
    reader.readAsArrayBuffer(file);
  });
}
