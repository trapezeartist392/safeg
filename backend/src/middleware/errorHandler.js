// ── errorHandler.js
const logger = require('../utils/logger');

exports.errorHandler = (err, req, res, next) => {
  let status  = err.statusCode || 500;
  let message = err.message   || 'Internal server error';
  let errors  = err.errors    || null;

  // Postgres errors
  if (err.code === '23505') { status = 409; message = 'Duplicate entry — record already exists'; }
  if (err.code === '23503') { status = 400; message = 'Referenced record does not exist'; }
  if (err.code === '22P02') { status = 400; message = 'Invalid UUID format'; }

  if (status >= 500) logger.error(`[${req.requestId}] ${err.stack}`);

  res.status(status).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && status >= 500 && { stack: err.stack }),
    requestId: req.requestId,
  });
};

exports.notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};
