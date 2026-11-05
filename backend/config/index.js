// =====================================================================
// Central configuration. Every value comes from environment variables
// (see .env.example). Nothing secret is ever written in source code.
// =====================================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
// Like int(), but 0 is allowed (e.g. a delivery fee of 0).
const nonNegInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const list = (value, fallback) =>
  value ? value.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean) : fallback;

const env = process.env.NODE_ENV || 'development';
const port = int(process.env.PORT, 5000);
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const backendUrl = (process.env.BACKEND_URL || `http://localhost:${port}`).replace(/\/$/, '');

const config = {
  env,
  isProduction: env === 'production',
  port,
  frontendUrl,
  backendUrl,
  corsOrigins: list(process.env.CORS_ORIGINS, [frontendUrl]),
  trustProxy: process.env.TRUST_PROXY || false, // e.g. "1" when deployed behind a reverse proxy

  mongoUri: process.env.MONGODB_URI,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'velora-api',
    audience: 'velora-clients',
  },

  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),

  // Rate limits required by the assignment: 100 req / 15 min (API) and 5 req / 15 min (login).
  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MINUTES, 15) * 60 * 1000,
    apiMax: int(process.env.API_RATE_LIMIT_MAX, 100),
    loginMax: int(process.env.LOGIN_RATE_LIMIT_MAX, 5),
    orderMax: int(process.env.ORDER_RATE_LIMIT_MAX, 10), // public order creation: 10 / 15 min / IP
  },

  // Delivery pricing. The BACKEND decides the delivery fee (the shop only displays it).
  // Defaults match the values the React shop already shows (600 DZD, free from 20 000 DZD).
  delivery: {
    fee: nonNegInt(process.env.DELIVERY_FEE, 600),
    freeThreshold: nonNegInt(process.env.FREE_DELIVERY_THRESHOLD, 20000),
  },

  lowStockThreshold: int(process.env.LOW_STOCK_THRESHOLD, 5),
};


/** Called once at start-up so the server refuses to run with a broken or unsafe setup. */
function validateConfig() {
  const problems = [];

  // =====================================================
  // USER ACTION REQUIRED
  // TODO: CREATE A FILE NAMED ".env" IN THE backend/ FOLDER (copy ".env.example").
  // TODO: PUT A LONG RANDOM SECRET IN JWT_SECRET. GENERATE ONE WITH:  npm run generate-secret
  // =====================================================
  if (!config.jwt.secret || config.jwt.secret.length < 32 || /CHANGE_ME|your[-_ ]?secret/i.test(config.jwt.secret)) {
    problems.push('JWT_SECRET is missing or too weak (needs 32+ random characters). Run "npm run generate-secret" and paste the result into backend/.env');
  }
  if (!config.mongoUri || /<password>|<db_password>|YOUR_/i.test(config.mongoUri)) {
    problems.push('MONGODB_URI is missing or still contains a placeholder. See backend/.env.example for how to get it from MongoDB Atlas.');
  }
  if (problems.length) {
    const err = new Error('Invalid configuration:\n - ' + problems.join('\n - '));
    err.isConfigError = true;
    throw err;
  }
}

module.exports = { config, validateConfig };