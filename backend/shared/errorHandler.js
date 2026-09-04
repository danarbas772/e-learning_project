// backend/shared/errorHandler.js
// Global error handler middleware

function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
}

function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route tidak ditemukan: ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };
