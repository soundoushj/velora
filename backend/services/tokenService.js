const jwt = require('jsonwebtoken');
const { config } = require('../config');

/** Creates a signed access token. Only non-sensitive data goes in the payload. */
function signAccessToken(user) {
  return jwt.sign({ role: user.role }, config.jwt.secret, {
    subject: String(user._id),
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    algorithm: 'HS256',
  });
}

/** Verifies signature, expiry, issuer and audience. Only HS256 is accepted (blocks "alg: none" tricks). */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

module.exports = { signAccessToken, verifyAccessToken };
