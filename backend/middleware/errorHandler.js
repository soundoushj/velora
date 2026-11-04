const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => next(new ApiError(404, 'Route not found.'));

// Central error handler: converts any error into a safe JSON response (no stack traces, no internals).
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  if (err.isApiError) {
    return res.status(err.status).json({ success: false, message: err.message, ...(err.errors && { errors: err.errors }) });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body too large.' });
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid identifier or value format.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'A record with this value already exists.' });
  }
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ success: false, message: 'Origin not allowed.' });
  }
  // Unknown problem: log the details on the server only.
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
};

module.exports = { notFound, errorHandler };
