const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { config } = require('../config');
const { createGoogleClient } = require('../config/google');
const { signAccessToken } = require('../services/tokenService');
const { issueCode, consumeCode } = require('../services/oauthState');

// A REAL bcrypt hash of a random string, generated once at start-up. We compare against it when the
// email is unknown so "wrong email" and "wrong password" take the same time (stops user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), config.bcryptRounds);

const authPayload = (user) => ({
  token: signAccessToken(user),
  tokenType: 'Bearer',
  expiresIn: config.jwt.expiresIn,
  user,
});

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body; // NOTE: "role" in the body is deliberately ignored.
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists.');

  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    role: 'customer', // nobody can self-register as an administrator
    authProvider: 'local',
  });
  res.status(201).json({ success: true, message: 'Account created.', data: authPayload(user) });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const hash = user && user.passwordHash ? user.passwordHash : DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!user || !user.passwordHash || !ok) {
    throw new ApiError(401, 'Invalid email or password.'); // same message for every failure
  }
  res.json({ success: true, message: 'Login successful.', data: authPayload(user) });
});

// GET /api/auth/me
exports.me = (req, res) => res.json({ success: true, data: { user: req.user } });

// ---------------------------------------------------------------------------
// Google OAuth 2.0 + OpenID Connect, Authorization Code flow with PKCE (S256)
// ---------------------------------------------------------------------------
const OAUTH_COOKIE = 'velora_oauth';
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax', // the cookie must come back on the redirect from accounts.google.com
  secure: config.isProduction,
  path: '/api/auth/google',
  maxAge: 10 * 60 * 1000,
});
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const failRedirect = (res, code) => res.redirect(`${config.frontendUrl}/account?error=${encodeURIComponent(code)}`);

// GET /api/auth/google   -> sends the browser to Google's consent screen
exports.googleStart = asyncHandler(async (req, res) => {
  const client = createGoogleClient();
  if (!client) {
    throw new ApiError(501, 'Google sign-in is not configured on this server yet.');
  }
  const state = crypto.randomBytes(24).toString('hex'); // CSRF protection
  const nonce = crypto.randomBytes(24).toString('hex'); // binds the ID token to this request
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync(); // PKCE
  // "?response=json" lets you see the result as JSON (handy for screenshots/tests). Disabled in production.
  const json = !config.isProduction && req.query.response === 'json';

  // The secret values live in a short-lived, signed, httpOnly cookie, so the server needs no session store.
  const packed = jwt.sign({ state, nonce, cv: codeVerifier, json }, config.jwt.secret, { expiresIn: '10m', algorithm: 'HS256' });
  res.cookie(OAUTH_COOKIE, packed, cookieOptions());

  const url = client.generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  res.redirect(url);
});

// GET /api/auth/google/callback   <- Google redirects here with ?code=...&state=...
exports.googleCallback = asyncHandler(async (req, res) => {
  const client = createGoogleClient();
  if (!client) throw new ApiError(501, 'Google sign-in is not configured on this server yet.');

  let saved;
  try {
    saved = jwt.verify(req.cookies[OAUTH_COOKIE] || '', config.jwt.secret, { algorithms: ['HS256'] });
  } catch {
    return failRedirect(res, 'oauth_session_expired');
  }
  res.clearCookie(OAUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });

  const { code, state, error } = req.query;
  if (error) return failRedirect(res, 'oauth_denied');
  if (typeof code !== 'string' || typeof state !== 'string' || !safeEqual(state, saved.state)) {
    return failRedirect(res, 'oauth_state_mismatch');
  }

  let payload;
  try {
    // Exchange the code (with the PKCE verifier) for tokens, directly with Google (server to server).
    const { tokens } = await client.getToken({ code, codeVerifier: saved.cv, redirect_uri: config.google.redirectUri });
    // Verify the ID token's signature, issuer, expiry and audience (= our client id).
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.google.clientId });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('[oauth] token exchange/verification failed:', err.message);
    return failRedirect(res, 'oauth_verification_failed');
  }
  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true || !safeEqual(payload.nonce || '', saved.nonce)) {
    return failRedirect(res, 'oauth_verification_failed');
  }

  const email = payload.email.toLowerCase();
  // Account linking rules (safe by design):
  //  1. Known Google account (same "sub") -> log in.
  //  2. Email already used by a password account -> DO NOT silently merge (that could let someone who
  //     pre-registered a victim's email take over the Google login). The user must sign in with the password.
  //  3. Otherwise -> create a new CUSTOMER account. Google can never create or become an administrator.
  let user = await User.findOne({ googleId: payload.sub });
  if (!user) {
    if (await User.exists({ email })) return failRedirect(res, 'account_exists_use_password');
    user = await User.create({
      name: (payload.name || email.split('@')[0]).slice(0, 60),
      email,
      googleId: payload.sub,
      authProvider: 'google',
      role: 'customer',
    });
  }

  if (saved.json && !config.isProduction) {
    return res.json({ success: true, message: 'Google login successful.', data: authPayload(user) });
  }
  res.redirect(`${config.frontendUrl}/auth/callback?code=${issueCode(user._id)}`);
});

// POST /api/auth/oauth/exchange   { code }  -> { token, user }
exports.oauthExchange = asyncHandler(async (req, res) => {
  const userId = consumeCode(req.body.code);
  const user = userId && (await User.findById(userId));
  if (!user) throw new ApiError(400, 'Invalid or expired login code.');
  res.json({ success: true, message: 'Login successful.', data: authPayload(user) });
});
