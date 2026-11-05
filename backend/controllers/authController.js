const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { config } = require('../config');
const { signAccessToken } = require('../services/tokenService');

// A REAL bcrypt hash of a random string, generated once at start-up. We compare against it when the
// email is unknown so "wrong email" and "wrong password" take the same time (stops user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), config.bcryptRounds);

const authPayload = (user) => ({
  token: signAccessToken(user),
  tokenType: 'Bearer',
  expiresIn: config.jwt.expiresIn,
  user,
});

// POST /api/auth/login   (administrators only)
// Any account that is not an administrator gets the same generic error as a wrong password,
// so the response never reveals whether an email belongs to an old customer account.
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const hash = user && user.passwordHash ? user.passwordHash : DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!user || !user.passwordHash || !ok || user.role !== 'admin') {
    throw new ApiError(401, 'Invalid email or password.'); // same message for every failure
  }
  res.json({ success: true, message: 'Login successful.', data: authPayload(user) });
});

// GET /api/auth/me
exports.me = (req, res) => res.json({ success: true, data: { user: req.user } });