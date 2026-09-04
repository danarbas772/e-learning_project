const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { createQuiz, getQuizzesByCourse, getQuizById, addQuestion, submitQuiz, getMyAttempts, togglePublish, getAllQuizzes } = require('../controllers/quizController');

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
    return res.status(403).json({ success: false, message: 'Hanya instructor atau admin' });
  }
  next();
}

// Public - dengan auth
router.get('/', auth, getAllQuizzes);
router.get('/course/:courseId', auth, getQuizzesByCourse);
router.get('/:id', auth, getQuizById);
router.get('/:quizId/my-attempts', auth, getMyAttempts);
router.post('/submit', auth, submitQuiz);

// Instructor/Admin
router.post('/', auth, instructorOrAdmin, createQuiz);
router.post('/questions', auth, instructorOrAdmin, addQuestion);
router.put('/:id/publish', auth, instructorOrAdmin, togglePublish);

module.exports = router;
