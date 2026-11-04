const express = require('express');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerRules, loginRules, exchangeRules } = require('../middleware/validators');

module.exports = (limiters) => {
  const router = express.Router();
  router.post('/register', limiters.authLimiter, registerRules, validate, ctrl.register);
  router.post('/login', limiters.loginLimiter, loginRules, validate, ctrl.login); // strict: 5 / 15 min / IP
  router.get('/me', authenticate, ctrl.me);

  // Google OAuth 2.0 (Authorization Code + PKCE)
  router.get('/google', ctrl.googleStart);
  router.get('/google/callback', ctrl.googleCallback);
  router.post('/oauth/exchange', limiters.authLimiter, exchangeRules, validate, ctrl.oauthExchange);
  return router;
};
