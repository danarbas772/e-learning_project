const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
  createQuiz,
  getQuizzesByCourse,
  getQuizById,
  submitQuiz,
  getMyAttempts,
  togglePublish,
  deleteQuiz,
  getAllQuizzes,
  getQuizSubmissions
} = require('../controllers/quizController');

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'elearning_secret_key_2024');
    next();
  } catch {
    res.status(403).json({ success: false, message: 'Token tidak valid' });
  }
}

function instructorOrAdmin(req, res, next) {
  if (!['instructor', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Hanya instructor atau admin yang diizinkan' });
  }
  next();
}

// Public with Auth
router.get('/', auth, getAllQuizzes);
router.get('/course/:courseId', auth, getQuizzesByCourse);
router.get('/:id', auth, getQuizById);
router.get('/:quizId/my-attempts', auth, getMyAttempts);
router.post('/submit', auth, submitQuiz);

// Instructor / Admin Only
router.post('/', auth, instructorOrAdmin, createQuiz);
router.put('/:id/publish', auth, instructorOrAdmin, togglePublish);
router.delete('/:id', auth, instructorOrAdmin, deleteQuiz);
router.get('/:id/submissions', auth, instructorOrAdmin, getQuizSubmissions);

module.exports = router;
