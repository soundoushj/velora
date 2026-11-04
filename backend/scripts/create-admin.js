// =====================================================================
// Creates the FIRST administrator account. This is the only way to get an admin:
//   - the public /register endpoint always creates a "customer",
//   - there are no hard-coded credentials anywhere in the project.
//
// =====================================================
// USER ACTION REQUIRED
// TODO: OPEN backend/.env AND FILL IN THESE THREE LINES WITH YOUR OWN VALUES:
//         ADMIN_NAME=Your Name
//         ADMIN_EMAIL=you@example.com
//         ADMIN_PASSWORD=a-long-password-with-letters-and-numbers   (12+ characters)
// TODO: RUN:  npm run create-admin
// TODO: AFTERWARDS, DELETE THE ADMIN_PASSWORD LINE FROM backend/.env.
// =====================================================
//
// Safety rules built into this script:
//   * refuses to run if an administrator already exists (pass --allow-additional to add another)
//   * refuses to touch an existing account unless you pass --promote (then it only changes the role)
//   * enforces a strong password (12+ characters, letters and numbers)
const mongoose = require('mongoose');
const { config } = require('../config');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const { passwordProblem } = require('../utils/password');

async function main() {
  const name = (process.env.ADMIN_NAME || 'Velora Admin').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const promote = process.argv.includes('--promote');
  const allowAdditional = process.argv.includes('--allow-additional');

  if (!config.mongoUri) throw new Error('MONGODB_URI is missing in backend/.env');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set a valid ADMIN_EMAIL in backend/.env');
  if (!promote) {
    const problem = passwordProblem(password, { minLength: 12 });
    if (problem) throw new Error(`ADMIN_PASSWORD: ${problem}`);
  }

  await connectDB();

  if (!allowAdditional && (await User.exists({ role: 'admin' }))) {
    throw new Error('An administrator already exists. Nothing was changed. (Use --allow-additional to create another one.)');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (!promote) throw new Error(`A user with the email ${email} already exists. Re-run with --promote to make that account an administrator.`);
    existing.role = 'admin';
    await existing.save();
    console.log(`"${email}" is now an administrator.`);
    return;
  }
  if (promote) throw new Error(`No user with the email ${email} exists, so there is nothing to promote.`);

  await User.create({ name, email, passwordHash: await User.hashPassword(password), role: 'admin', authProvider: 'local' });
  console.log(`Administrator created: ${email}`);
  console.log('Next: delete the ADMIN_PASSWORD line from backend/.env, then open http://localhost:' + config.port + '/admin/');
}

main()
  .catch((err) => {
    console.error('\nCould not create the administrator:', err.message, '\n');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
