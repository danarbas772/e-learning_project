const pool = require('../config/db');

const COURSE_DB = process.env.DB_NAME_COURSE || process.env.COURSE_DB_NAME || process.env.DB_NAME || 'elearning_courses';
const AUTH_DB = process.env.DB_NAME_AUTH || process.env.AUTH_DB_NAME || process.env.DB_NAME || 'elearning_auth';
const USER_DB = process.env.DB_NAME_USER || process.env.USER_DB_NAME || process.env.DB_NAME || 'elearning_users';

// ─── Create Quiz (Dapat Membuat Langsung Beserta Soal Manual / Import) ────────
async function createQuiz(req, res) {
  const {
    course_id,
    section_id,
    title,
    description,
    quiz_type = 'multiple_choice',
    time_limit_minutes = 60,
    passing_score = 70,
    start_time,
    end_time,
    is_published = true,
    questions = []
  } = req.body;

  const created_by = req.user.id;

  if (!course_id || !title) {
    return res.status(400).json({ success: false, message: 'Mata kuliah (course_id) dan Judul Ujian wajib diisi' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validasi mata kuliah aktif & hak akses pengampu
    const [courses] = await conn.query(`SELECT id, instructor_id, is_published FROM ${COURSE_DB}.courses WHERE id = ?`, [course_id]);
    if (courses.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Mata kuliah tidak ditemukan' });
    }
    if (!courses[0].is_published) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Tidak dapat membuat ujian untuk mata kuliah yang sedang non-aktif.' });
    }
    if (req.user.role === 'instructor' && Number(courses[0].instructor_id) !== Number(req.user.id)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Anda hanya dapat membuat ujian pada mata kuliah yang Anda ampu.' });
    }

    const [quizResult] = await conn.query(
      `INSERT INTO quizzes 
        (course_id, section_id, title, description, quiz_type, time_limit_minutes, passing_score, start_time, end_time, created_by, is_published) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course_id,
        section_id || null,
        title,
        description || '',
        quiz_type,
        time_limit_minutes,
        passing_score,
        start_time ? new Date(start_time) : null,
        end_time ? new Date(end_time) : null,
        created_by,
        is_published ? 1 : 0
      ]
    );
    const quizId = quizResult.insertId;

    // Simpan butir-butir pertanyaan (bisa sampai 50 soal atau lebih)
    if (Array.isArray(questions) && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qText = q.question_text || q.question || `Soal No. ${i + 1}`;
        const qType = q.question_type || (quiz_type === 'essay' ? 'essay' : 'multiple_choice');
        const qPoints = q.points || 1;
        const qOrder = q.order_index !== undefined ? q.order_index : i;

        const [qResult] = await conn.query(
          'INSERT INTO questions (quiz_id, question_text, question_type, points, order_index) VALUES (?, ?, ?, ?, ?)',
          [quizId, qText, qType, qPoints, qOrder]
        );
        const questionId = qResult.insertId;

        // Jika soal pilihan ganda, simpan pilihan opsi A, B, C, D, E
        if (q.options && Array.isArray(q.options) && q.options.length > 0) {
          for (const opt of q.options) {
            const optText = typeof opt === 'string' ? opt : (opt.option_text || '');
            const isCorrect = typeof opt === 'object' ? (opt.is_correct ? 1 : 0) : 0;
            if (optText.trim() !== '') {
              await conn.query(
                'INSERT INTO answer_options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
                [questionId, optText, isCorrect]
              );
            }
          }
        }
      }
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: `Quiz/Ujian "${title}" berhasil dibuat dengan ${questions.length} butir soal`,
      data: { id: quizId, title, total_questions: questions.length }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Create quiz error:', err);
    res.status(500).json({ success: false, message: 'Gagal membuat quiz/ujian: ' + err.message });
  } finally {
    conn.release();
  }
}

// ─── Get Quizzes by Course ────────────────────────────────────────────────────
async function getQuizzesByCourse(req, res) {
  const { courseId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const isStudent = userRole === 'student';
  const isInstructor = userRole === 'instructor';

  try {
    let sql = `
      SELECT q.*, c.is_published AS course_is_published,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
             (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) AS submission_count,
             (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND user_id = ?) AS my_attempt_count,
             (SELECT score FROM quiz_attempts WHERE quiz_id = q.id AND user_id = ? ORDER BY submitted_at DESC LIMIT 1) AS my_score,
             (SELECT is_passed FROM quiz_attempts WHERE quiz_id = q.id AND user_id = ? ORDER BY submitted_at DESC LIMIT 1) AS my_is_passed
      FROM quizzes q
      INNER JOIN ${COURSE_DB}.courses c ON q.course_id = c.id
      WHERE q.course_id = ? AND c.is_published = TRUE
    `;
    const params = [userId, userId, userId, courseId];

    if (isStudent) {
      sql += ' AND q.is_published = TRUE';
    } else if (isInstructor) {
      // Dosen hanya dapat melihat ujian pada mata kuliah miliknya sendiri
      sql += ' AND (c.instructor_id = ? OR q.created_by = ?)';
      params.push(userId, userId);
    }
    sql += ' ORDER BY q.created_at DESC';

    const [quizzes] = await pool.query(sql, params);
    res.json({ success: true, data: quizzes, server_time: new Date().toISOString() });
  } catch (err) {
    console.error('Get quizzes by course error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Get All Quizzes ──────────────────────────────────────────────────────────
async function getAllQuizzes(req, res) {
  const userId = req.user.id;
  const userRole = req.user.role;
  const isStudent = userRole === 'student';
  const isInstructor = userRole === 'instructor';

  try {
    // Sembunyikan ujian jika matakuliah dinonaktifkan (c.is_published = FALSE)
    let sql = `
      SELECT q.*, c.title as course_title, c.course_code, c.is_published as course_is_published,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id AND question_type = 'essay') as essay_question_count,
             (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as submission_count,
             (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND user_id = ?) AS my_attempt_count,
             (SELECT score FROM quiz_attempts WHERE quiz_id = q.id AND user_id = ? ORDER BY submitted_at DESC LIMIT 1) AS my_score,
             (SELECT is_passed FROM quiz_attempts WHERE quiz_id = q.id AND user_id = ? ORDER BY submitted_at DESC LIMIT 1) AS my_is_passed
      FROM quizzes q
      INNER JOIN ${COURSE_DB}.courses c ON q.course_id = c.id
      WHERE c.is_published = TRUE
    `;
    const params = [userId, userId, userId];

    if (isStudent) {
      sql += ' AND q.is_published = TRUE';
    } else if (isInstructor) {
      // Dosen hanya dapat melihat ujian pada mata kuliah miliknya sendiri atau yang ia buat
      sql += ' AND (c.instructor_id = ? OR q.created_by = ?)';
      params.push(userId, userId);
    }
    sql += ' ORDER BY q.created_at DESC';

    const [quizzes] = await pool.query(sql, params);
    res.json({ success: true, data: quizzes, server_time: new Date().toISOString() });
  } catch (err) {
    console.error('Get all quizzes error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Get Quiz Detail + Soal ───────────────────────────────────────────────────
async function getQuizById(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const isPrivileged = req.user.role === 'instructor' || req.user.role === 'admin';

  try {
    const [quizzes] = await pool.query(
      `SELECT q.*, c.title as course_title, c.course_code, c.instructor_id as course_instructor_id, c.is_published as course_is_published
       FROM quizzes q
       LEFT JOIN ${COURSE_DB}.courses c ON q.course_id = c.id
       WHERE q.id = ?`,
      [id]
    );
    if (quizzes.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz tidak ditemukan' });
    }

    const quiz = quizzes[0];

    // Proteksi: Jika matakuliah non-aktif, mahasiswa dilarang mengakses soal ujian
    if (!isPrivileged && (quiz.course_is_published === 0 || quiz.course_is_published === false)) {
      return res.status(403).json({
        success: false,
        message: 'Mata kuliah ini sedang dinonaktifkan sehingga ujian tidak dapat diakses atau dikerjakan.'
      });
    }

    // Proteksi: Jika ujian dinonaktifkan / draft, mahasiswa dilarang mengakses
    if (!isPrivileged && (quiz.is_published === 0 || quiz.is_published === false)) {
      return res.status(403).json({
        success: false,
        message: 'Ujian ini sedang dinonaktifkan / berstatus draft dan belum dibuka untuk mahasiswa.'
      });
    }

    // Proteksi: Dosen hanya dapat mengakses ujian miliknya sendiri atau mata kuliah yang diampunya
    if (req.user.role === 'instructor') {
      const isOwner = Number(quiz.created_by) === Number(userId) || Number(quiz.course_instructor_id) === Number(userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Anda bukan pengampu atau pembuat ujian ini. Akses dibatasi.'
        });
      }
    }
    const now = new Date();
    const startTime = quiz.start_time ? new Date(quiz.start_time) : null;
    const endTime = quiz.end_time ? new Date(quiz.end_time) : null;

    // Ambil attempt terakhir pengguna
    let my_attempt = null;
    const [attempts] = await pool.query(
      'SELECT * FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? ORDER BY started_at DESC LIMIT 1',
      [userId, id]
    );
    if (attempts.length > 0) {
      my_attempt = attempts[0];
    }

    // Untuk mahasiswa: Proteksi Waktu (Lock jika belum mulai)
    if (!isPrivileged) {
      if (startTime && startTime > now) {
        return res.json({
          success: true,
          data: {
            ...quiz,
            is_locked: true,
            lock_reason: 'not_started',
            server_time: now.toISOString(),
            questions: [],
            my_attempt
          }
        });
      }

      if (endTime && endTime < now && !my_attempt) {
        return res.json({
          success: true,
          data: {
            ...quiz,
            is_locked: true,
            lock_reason: 'ended',
            server_time: now.toISOString(),
            questions: [],
            my_attempt
          }
        });
      }
    }

    const [questions] = await pool.query(
      'SELECT id, quiz_id, question_text, question_type, points, order_index FROM questions WHERE quiz_id = ? ORDER BY order_index ASC, id ASC',
      [id]
    );

    for (const q of questions) {
      if (q.question_type !== 'essay') {
        const [options] = await pool.query(
          isPrivileged
            ? 'SELECT id, question_id, option_text, is_correct FROM answer_options WHERE question_id = ? ORDER BY id ASC'
            : 'SELECT id, question_id, option_text FROM answer_options WHERE question_id = ? ORDER BY id ASC',
          [q.id]
        );
        q.options = options;
      } else {
        q.options = [];
      }
    }

    res.json({
      success: true,
      data: {
        ...quiz,
        questions,
        my_attempt,
        server_time: now.toISOString()
      }
    });
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Submit Quiz (Mahasiswa Mengerjakan & Nilai/Jawaban Disimpan di DB) ────────
async function submitQuiz(req, res) {
  const { quiz_id, answers } = req.body;
  const user_id = req.user.id;
  const isPrivileged = req.user.role === 'instructor' || req.user.role === 'admin';

  if (!quiz_id || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ success: false, message: 'quiz_id dan answers wajib diisi' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [quizzes] = await conn.query(
      `SELECT q.*, c.is_published as course_is_published 
       FROM quizzes q 
       LEFT JOIN ${COURSE_DB}.courses c ON q.course_id = c.id 
       WHERE q.id = ?`,
      [quiz_id]
    );
    if (quizzes.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Quiz tidak ditemukan' });
    }
    const quiz = quizzes[0];

    // Proteksi: Mahasiswa dilarang mengerjakan / mengumpulkan ujian dari matakuliah non-aktif
    if (quiz.course_is_published === 0 || quiz.course_is_published === false) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        message: 'Mata kuliah ini sedang dinonaktifkan sehingga ujian tidak dapat dikerjakan atau dikumpulkan.'
      });
    }

    // Proteksi: Mahasiswa dilarang mengerjakan ujian yang dinonaktifkan / draft
    if (!isPrivileged && (quiz.is_published === 0 || quiz.is_published === false)) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        message: 'Ujian ini sedang dinonaktifkan sehingga tidak dapat dikerjakan atau dikumpulkan.'
      });
    }

    // Cek apakah mahasiswa sudah pernah submit ujian ini sebelumnya (One attempt rule)
    if (!isPrivileged) {
      const [existingAttempts] = await conn.query(
        'SELECT id, score, is_passed FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?',
        [quiz_id, user_id]
      );
      if (existingAttempts.length > 0) {
        await conn.rollback();
        return res.status(403).json({
          success: false,
          message: 'Anda sudah pernah mengerjakan ujian ini. Sesuai aturan akademik, ujian hanya dapat dikerjakan satu kali dan tidak dapat diulang.'
        });
      }
    }

    // Buat attempt baru
    const [attemptResult] = await conn.query(
      'INSERT INTO quiz_attempts (quiz_id, user_id, started_at, submitted_at) VALUES (?, ?, NOW(), NOW())',
      [quiz_id, user_id]
    );
    const attemptId = attemptResult.insertId;

    let totalScore = 0;
    let maxScore = 0;
    let mcCount = 0;
    let correctCount = 0;
    let essayCount = 0;

    // Proses setiap jawaban
    for (const answer of answers) {
      const { question_id, selected_option_id, text_answer } = answer;

      const [questions] = await conn.query('SELECT * FROM questions WHERE id = ?', [question_id]);
      if (questions.length === 0) continue;
      const question = questions[0];
      const points = question.points || 1;

      let is_correct = false;

      if (question.question_type === 'essay') {
        essayCount++;
        // Untuk essay, jawaban teks disimpan, status is_correct null / menunggu review dosen
        await conn.query(
          'INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, text_answer, is_correct) VALUES (?, ?, NULL, ?, NULL)',
          [attemptId, question_id, text_answer || '']
        );
      } else {
        // Pilihan ganda
        mcCount++;
        maxScore += points;

        if (selected_option_id) {
          const [options] = await conn.query(
            'SELECT is_correct FROM answer_options WHERE id = ? AND question_id = ?',
            [selected_option_id, question_id]
          );
          if (options.length > 0 && Boolean(options[0].is_correct)) {
            is_correct = true;
            correctCount++;
            totalScore += points;
          }
        }

        await conn.query(
          'INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, text_answer, is_correct) VALUES (?, ?, ?, NULL, ?)',
          [attemptId, question_id, selected_option_id || null, is_correct ? 1 : 0]
        );
      }
    }

    // Hitung persentase nilai jika hanya pilihan ganda (tanpa essay)
    let scorePercent = null;
    let is_passed = null;

    if (essayCount === 0 && mcCount > 0 && maxScore > 0) {
      scorePercent = Math.round((totalScore / maxScore) * 100);
      is_passed = scorePercent >= (quiz.passing_score || 70) ? 1 : 0;
    } else {
      // Jika terdapat soal essay (atau murni essay), tidak ada nilai otomatis (menunggu penilaian/koreksi manual dosen)
      scorePercent = null;
      is_passed = null;
    }

    // Update attempt dengan skor final
    await conn.query(
      'UPDATE quiz_attempts SET score = ?, max_score = ?, is_passed = ? WHERE id = ?',
      [scorePercent, maxScore || null, is_passed, attemptId]
    );

    await conn.commit();

    res.json({
      success: true,
      message: essayCount > 0
        ? '📋 Jawaban esai Anda telah berhasil dikumpulkan dan tersimpan di sistem untuk menunggu penilaian dosen.'
        : (is_passed === 1
          ? '🎉 Selamat! Anda telah menyelesaikan ujian dan dinyatakan LULUS.'
          : '📋 Jawaban Anda telah berhasil dikumpulkan dan tersimpan di sistem.'),
      data: {
        attempt_id: attemptId,
        score: scorePercent,
        raw_score: totalScore,
        raw_max: maxScore,
        correct_count: correctCount,
        total_mc_questions: mcCount,
        total_essay_questions: essayCount,
        is_passed,
        passing_score: quiz.passing_score,
        has_essay: essayCount > 0,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Submit quiz error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
}

// ─── Toggle Publish / Unpublish ───────────────────────────────────────────────
async function togglePublish(req, res) {
  const { id } = req.params;
  const { is_published } = req.body;
  const userId = req.user.id;

  try {
    if (req.user.role === 'instructor') {
      const [qRows] = await pool.query(
        `SELECT q.id, q.created_by, c.instructor_id 
         FROM quizzes q 
         LEFT JOIN ${COURSE_DB}.courses c ON q.course_id = c.id 
         WHERE q.id = ?`,
        [id]
      );
      if (qRows.length === 0) return res.status(404).json({ success: false, message: 'Quiz tidak ditemukan' });
      const isOwner = Number(qRows[0].created_by) === Number(userId) || Number(qRows[0].instructor_id) === Number(userId);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses untuk mengubah status ujian ini' });
      }
    }

    const publishedVal = Boolean(is_published);
    await pool.query('UPDATE quizzes SET is_published = ? WHERE id = ?', [publishedVal ? 1 : 0, id]);
    res.json({
      success: true,
      message: `Ujian berhasil ${publishedVal ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: { id: Number(id), is_published: publishedVal }
    });
  } catch (err) {
    console.error('Toggle publish error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Delete Quiz ──────────────────────────────────────────────────────────────
async function deleteQuiz(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    if (req.user.role === 'instructor') {
      const [qRows] = await pool.query(
        `SELECT q.id, q.created_by, c.instructor_id 
         FROM quizzes q 
         LEFT JOIN ${COURSE_DB}.courses c ON q.course_id = c.id 
         WHERE q.id = ?`,
        [id]
      );
      if (qRows.length === 0) return res.status(404).json({ success: false, message: 'Quiz tidak ditemukan' });
      const isOwner = Number(qRows[0].created_by) === Number(userId) || Number(qRows[0].instructor_id) === Number(userId);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Anda tidak memiliki izin untuk menghapus ujian ini' });
      }
    }

    await pool.query('DELETE FROM quizzes WHERE id = ?', [id]);
    res.json({ success: true, message: 'Kuis/Ujian berhasil dihapus' });
  } catch (err) {
    console.error('Delete quiz error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// ─── Get Quiz Submissions (Rekap Peserta & Nilai Ujian untuk Dosen / Admin) ────
async function getQuizSubmissions(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [quizRows] = await pool.query(
      `SELECT q.*, c.instructor_id,
              (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id AND question_type = 'essay') as essay_question_count,
              (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count
       FROM quizzes q 
       LEFT JOIN ${COURSE_DB}.courses c ON q.course_id = c.id 
       WHERE q.id = ?`,
      [id]
    );
    if (quizRows.length === 0) return res.status(404).json({ success: false, message: 'Quiz tidak ditemukan' });
    const quiz = quizRows[0];

    if (req.user.role === 'instructor') {
      const isOwner = Number(quiz.created_by) === Number(userId) || Number(quiz.instructor_id) === Number(userId);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Anda tidak berhak melihat rekap ujian ini' });
      }
    }

    const [attempts] = await pool.query(
      `SELECT a.*, 
              u.email, 
              COALESCE(p.full_name, u.email) AS student_name,
              p.nim_nip AS nim
       FROM quiz_attempts a
       LEFT JOIN ${AUTH_DB}.users u ON a.user_id = u.id
       LEFT JOIN ${USER_DB}.profiles p ON a.user_id = p.user_id
       WHERE a.quiz_id = ?
       ORDER BY a.submitted_at DESC`,
      [id]
    );

    // Ambil rincian jawaban untuk setiap attempt
    for (const att of attempts) {
      const [answers] = await pool.query(
        `SELECT aa.*, q.question_text, q.question_type, opt.option_text AS selected_option_text
         FROM attempt_answers aa
         LEFT JOIN questions q ON aa.question_id = q.id
         LEFT JOIN answer_options opt ON aa.selected_option_id = opt.id
         WHERE aa.attempt_id = ?`,
        [att.id]
      );
      att.answers = answers;
    }

    res.json({
      success: true,
      data: {
        quiz,
        submissions: attempts,
        total_participants: attempts.length
      }
    });
  } catch (err) {
    console.error('Get submissions error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// ─── Get My Attempts ──────────────────────────────────────────────────────────
async function getMyAttempts(req, res) {
  const user_id = req.user.id;
  const { quizId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? ORDER BY started_at DESC',
      [user_id, quizId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = {
  createQuiz,
  getQuizzesByCourse,
  getQuizById,
  submitQuiz,
  getMyAttempts,
  togglePublish,
  deleteQuiz,
  getAllQuizzes,
  getQuizSubmissions
};
