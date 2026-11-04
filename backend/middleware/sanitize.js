// Defence against NoSQL operator injection such as {"email": {"$ne": null}}.
// Any key that starts with "$" or contains "." is removed from the request body (recursively).
function clean(value, depth = 0) {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__') continue;
      out[key] = clean(val, depth + 1);
    }
    return out;
  }
  return value;
}

module.exports = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
};
