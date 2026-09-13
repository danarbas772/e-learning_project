// backend/shared/errorHandler.js
// Global error handler middleware

function errorHandler(err, req, res, next) {
  console.error('🔥 [Backend Error]:', err.stack || err.message);

  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? err.message : err.stack,
  });
}

function notFound(req, res, next) {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.status(404).json({ success: false, message: `Route tidak ditemukan: ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };
