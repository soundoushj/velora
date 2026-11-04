const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../services/tokenService');
const User = require('../models/User');

/**
 * Protects a route. Expects:   Authorization: Bearer <JWT_TOKEN>
 * On success, req.user holds the user loaded FROM THE DATABASE (so deleted users or changed roles
 * take effect immediately, even if an old token is still unexpired).
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!/^Bearer$/i.test(scheme || '') || !token) {
    throw new ApiError(401, 'Authentication required. Send "Authorization: Bearer <token>".');
  }
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token has expired. Please log in again.' : 'Invalid token.';
    throw new ApiError(401, message);
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'Invalid token.');
  req.user = user;
  next();
});

/** Must run AFTER authenticate. Role comes from the database record, never from the token or the request. */
const requireAdmin = (req, _res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ApiError(403, 'Administrator access required.'));
  }
  next();
};

module.exports = { authenticate, requireAdmin };
