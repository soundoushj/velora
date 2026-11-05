const rateLimit = require('express-rate-limit');

function build({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // RateLimit-* headers so clients (and Postman) can see the remaining quota
    legacyHeaders: false,
    // Applied per client IP address (the default key). Returns HTTP 429 when exceeded.
    handler: (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, message });
    },
  });
}

/** A fresh set of limiters per app instance (counters are kept in memory). */
module.exports = function createLimiters(rl) {
  return {
    // General API: 100 requests / 15 minutes
    apiLimiter: build({ windowMs: rl.windowMs, max: rl.apiMax, message: 'Too many requests. Please try again later.' }),
    // Login: 5 requests / 15 minutes per IP (brute-force protection)
    loginLimiter: build({ windowMs: rl.windowMs, max: rl.loginMax, message: 'Too many login attempts. Please try again in 15 minutes.' }),
    // Public order creation: 10 orders / 15 minutes per IP (falls back to 10 if a caller does not pass orderMax)
    orderLimiter: build({ windowMs: rl.windowMs, max: rl.orderMax || 10, message: 'Too many order attempts. Please try again in a few minutes.' }),
  };
};