const pool = require('../config/db');

// ─── Create Quiz ──────────────────────────────────────────────────────────────
async function createQuiz(req, res) {
  const { course_id, section_id, title, description, time_limit_minutes = 0, passing_score = 70 } = req.body;
  const created_by = req.user.id;

  if (!course_id || !title) {
    return res.status(400).json({ success: false, message: 'course_id dan title wajib diisi' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO quizzes (course_id, section_id, title, description, time_limit_minutes, passing_score, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [course_id, section_id || null, title, description, time_limit_minutes, passing_score, created_by]
    );
    res.status(201).json({ success: true, message: 'Quiz berhasil dibuat', data: { id: result.insertId } });
  } catch (err) {
    console.error('Create quiz error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Get Quizzes by Course ────────────────────────────────────────────────────
async function getQuizzesByCourse(req, res) {
  const { courseId } = req.params;
  try {
    const [quizzes] = await pool.query(
      'SELECT id, course_id, section_id, title, description, time_limit_minutes, passing_score, is_published, created_at FROM quizzes WHERE course_id = ? AND is_published = TRUE',
      [courseId]
    );
    res.json({ success: true, data: quizzes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Get Quiz Detail + Soal ───────────────────────────────────────────────────
async function getQuizById(req, res) {
  const { id } = req.params;
  try {
    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE id = ?', [id]);
    if (quizzes.length === 0) return res.status(404).json({ success: false, message: 'Quiz tidak ditemukan' });

    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC',
      [id]
    );

    for (const q of questions) {
      const [options] = await pool.query(
        // Jangan tampilkan is_correct saat mahasiswa mengambil quiz
        req.user.role === 'instructor' || req.user.role === 'admin'
          ? 'SELECT * FROM answer_options WHERE question_id = ?'
          : 'SELECT id, question_id, option_text FROM answer_options WHERE question_id = ?',
        [q.id]
      );
      q.options = options;
    }

    res.json({ success: true, data: { ...quizzes[0], questions } });
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Add Question ─────────────────────────────────────────────────────────────
async function addQuestion(req, res) {
  const { quiz_id, question_text, question_type = 'multiple_choice', points = 1, order_index = 0, options } = req.body;

  if (!quiz_id || !question_text) {
    return res.status(400).json({ success: false, message: 'quiz_id dan question_text wajib diisi' });
  }

  try {
    const [qResult] = await pool.query(
      'INSERT INTO questions (quiz_id, question_text, question_type, points, order_index) VALUES (?, ?, ?, ?, ?)',
      [quiz_id, question_text, question_type, points, order_index]
    );
    const questionId = qResult.insertId;

    // Tambahkan opsi jawaban
    if (options && Array.isArray(options)) {
      for (const opt of options) {
        await pool.query(
          'INSERT INTO answer_options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
          [questionId, opt.option_text, opt.is_correct || false]
        );
      }
    }

    res.status(201).json({ success: true, message: 'Soal berhasil ditambahkan', data: { id: questionId } });
  } catch (err) {
    console.error('Add question error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── Submit Quiz ──────────────────────────────────────────────────────────────
async function submitQuiz(req, res) {
  const { quiz_id, answers } = req.body;
  const user_id = req.user.id;

  if (!quiz_id || !answers) {
    return res.status(400).json({ success: false, message: 'quiz_id dan answers wajib diisi' });
  }

  try {
    // Ambil quiz info
    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE id = ?', [quiz_id]);
    if (quizzes.length === 0) return res.status(404).json({ success: false, message: 'Quiz tidak ditemukan' });
    const quiz = quizzes[0];

    // Buat attempt
    const [attemptResult] = await pool.query(
      'INSERT INTO quiz_attempts (quiz_id, user_id, submitted_at) VALUES (?, ?, NOW())',
      [quiz_id, user_id]
    );
    const attemptId = attemptResult.insertId;

    let totalScore = 0;
    let maxScore = 0;

    // Proses setiap jawaban
    for (const answer of answers) {
      const { question_id, selected_option_id, text_answer } = answer;

      // Ambil soal dan cek jawaban benar
      const [questions] = await pool.query('SELECT * FROM questions WHERE id = ?', [question_id]);
      if (questions.length === 0) continue;
      const question = questions[0];
      maxScore += question.points;

      let is_correct = false;

      if (selected_option_id) {
        const [options] = await pool.query(
          'SELECT is_correct FROM answer_options WHERE id = ? AND question_id = ?',
          [selected_option_id, question_id]
        );
        if (options.length > 0 && options[0].is_correct) {
          is_correct = true;
          totalScore += question.points;
        }
      }

      await pool.query(
        'INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, text_answer, is_correct) VALUES (?, ?, ?, ?, ?)',
        [attemptId, question_id, selected_option_id || null, text_answer || null, is_correct]
      );
    }

    const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const is_passed = scorePercent >= quiz.passing_score;

    // Update attempt dengan skor
    await pool.query(
      'UPDATE quiz_attempts SET score = ?, max_score = ?, is_passed = ? WHERE id = ?',
      [scorePercent, maxScore, is_passed, attemptId]
    );

    res.json({
      success: true,
      message: is_passed ? '🎉 Selamat! Anda lulus quiz ini.' : '😔 Anda belum mencapai nilai minimum.',
      data: {
        attempt_id: attemptId,
        score: scorePercent,
        max_score: 100,
        raw_score: totalScore,
        raw_max: maxScore,
        is_passed,
        passing_score: quiz.passing_score,
      },
    });
  } catch (err) {
    console.error('Submit quiz error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
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

// ─── Get All Quizzes ──────────────────────────────────────────────────────────
async function getAllQuizzes(req, res) {
  try {
    const isStudent = req.user.role === 'student';
    let sql = `
      SELECT q.*, c.title as course_title, c.course_code,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count
      FROM quizzes q
      LEFT JOIN elearning_courses.courses c ON q.course_id = c.id
    `;
    if (isStudent) {
      sql += ' WHERE q.is_published = TRUE';
    }
    sql += ' ORDER BY q.created_at DESC';

    const [quizzes] = await pool.query(sql);
    res.json({ success: true, data: quizzes });
  } catch (err) {
    console.error('Get all quizzes error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { createQuiz, getQuizzesByCourse, getQuizById, addQuestion, submitQuiz, getMyAttempts, togglePublish, getAllQuizzes };

