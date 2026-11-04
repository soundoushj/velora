const crypto = require('crypto');

// One-time login codes. After Google sign-in succeeds, the backend redirects the browser to the
// React app with a short-lived, single-use code (NOT the JWT), so the token never appears in a URL.
// The React app swaps the code for a JWT with POST /api/auth/oauth/exchange.
// Stored in memory: fine for a single server instance (use Redis if you ever scale to several).
const TTL_MS = 60 * 1000;
const codes = new Map();

function issueCode(userId) {
  const code = crypto.randomBytes(32).toString('hex');
  codes.set(code, { userId: String(userId), expires: Date.now() + TTL_MS });
  return code;
}

/** Returns the userId once, then forgets the code. */
function consumeCode(code) {
  const entry = codes.get(code);
  codes.delete(code);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.userId;
}

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of codes) if (entry.expires < now) codes.delete(code);
}, 60 * 1000);
sweep.unref();

module.exports = { issueCode, consumeCode };
