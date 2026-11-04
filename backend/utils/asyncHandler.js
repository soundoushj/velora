// Express 4 does not catch rejected promises by itself; this wrapper forwards them to the error handler.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
