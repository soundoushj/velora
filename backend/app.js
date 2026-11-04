const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { config } = require('./config');
const createLimiters = require('./middleware/rateLimiters');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');

/** Builds the Express app. (A factory so automated tests can create a fresh app with fresh rate-limit counters.) */
function createApp({ rateLimit = config.rateLimit } = {}) {
  const app = express();
  const limiters = createLimiters(rateLimit);

  if (config.trustProxy) app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);

  // ---- Secure HTTP headers (Helmet) ----
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          // product photos are served by the React shop, so allow that origin for the admin thumbnails
          'img-src': ["'self'", 'data:', config.frontendUrl],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          // on plain http://localhost this directive would break the admin page, so only enable it in production
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
    })
  );

  // ---- CORS: only the listed front-end origins may call the API from a browser ----
  app.use(
    cors((req, cb) => {
      const origin = req.get('Origin');
      const sameOrigin = origin && origin === `${req.protocol}://${req.get('host')}`; // the admin dashboard calling its own API
      const allowed = !origin || sameOrigin || config.corsOrigins.includes(origin); // no Origin = Postman/curl
      if (!allowed) return cb(new Error('CORS: origin not allowed'));
      cb(null, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600,
      });
    })
  );

  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use(sanitize);

  // ---- Separate administration dashboard (static files, protected by the API it calls) ----
  app.use('/admin', express.static(path.join(__dirname, 'admin'), { index: 'index.html' }));

  // ---- API ----
  app.get('/', (_req, res) => res.json({ name: 'Velora API', status: 'ok', docs: '/api/health', admin: '/admin/' }));
  app.use('/api', limiters.apiLimiter); // general limit: 100 requests / 15 min / IP
  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString(), frontendUrl: config.frontendUrl }));
  app.use('/api/auth', require('./routes/authRoutes')(limiters));
  app.use('/api/products', require('./routes/productRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
