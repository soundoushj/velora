// Password rules shared by registration and the admin-creation script.
// bcrypt only uses the first 72 BYTES, so longer passwords are rejected instead of silently truncated.
function passwordProblem(password, { minLength = 8 } = {}) {
  if (typeof password !== 'string') return 'Password must be a string.';
  if (password.length < minLength) return `Password must be at least ${minLength} characters long.`;
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be at most 72 bytes long.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.';
  return null;
}
module.exports = { passwordProblem };
