const express = require('express');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginRules } = require('../middleware/validators');

// Administrator authentication only. There is no customer registration or customer login on Velora:
// customers shop and order as guests.
module.exports = (limiters) => {
  const router = express.Router();
  router.post('/login', limiters.loginLimiter, loginRules, validate, ctrl.login); // strict: 5 / 15 min / IP
  router.get('/me', authenticate, ctrl.me);
  return router;
};
