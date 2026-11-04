const mongoose = require('mongoose');
const { config, validateConfig } = require('./config');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
require('./models/User');
require('./models/Product');

async function start() {
  try {
    validateConfig();
  } catch (err) {
    console.error('\n' + err.message + '\n');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('MongoDB connected.');
  } catch (err) {
    console.error('\nCould not connect to MongoDB:', err.message);
    console.error('Check MONGODB_URI in backend/.env and that your IP is allowed in MongoDB Atlas > Network Access.\n');
    process.exit(1);
  }

  if (!config.googleEnabled) console.warn('Note: Google sign-in is disabled (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set).');

  const server = createApp().listen(config.port, () => {
    console.log(`Velora API  ->  http://localhost:${config.port}/api/health`);
    console.log(`Admin panel ->  http://localhost:${config.port}/admin/`);
  });

  const shutdown = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
