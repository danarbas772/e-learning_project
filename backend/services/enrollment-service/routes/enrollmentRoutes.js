const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { enrollCourse, getMyCourses, checkEnrollment, updateProgress, getCourseProgress, getCourseStudents } = require('../controllers/enrollmentController');

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

router.post('/enroll', auth, enrollCourse);
router.get('/my-courses', auth, getMyCourses);
router.get('/check/:courseId', auth, checkEnrollment);
router.put('/progress', auth, updateProgress);
router.get('/progress/:courseId', auth, getCourseProgress);
router.get('/students/:courseId', auth, getCourseStudents);

module.exports = router;
