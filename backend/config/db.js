const mongoose = require('mongoose');
const { config } = require('./index');

// =====================================================
// USER ACTION REQUIRED
// TODO: CREATE A FREE MONGODB ATLAS ACCOUNT:  https://www.mongodb.com/cloud/atlas/register
// TODO: CREATE A FREE (M0) CLUSTER, THEN:
//         - "Database Access"  -> add a database user (username + password)
//         - "Network Access"   -> add your current IP address (or 0.0.0.0/0 for testing only)
//         - "Database" > "Connect" > "Drivers" -> COPY THE CONNECTION STRING
// TODO: PASTE THE CONNECTION STRING INTO backend/.env  ->  MONGODB_URI
//       Replace <password> with your database user's password and add the database name "velora":
//       mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/velora?retryWrites=true&w=majority
// =====================================================

async function connectDB(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  // Make sure the unique indexes (email, slug) exist before we accept requests.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  return mongoose.connection;
}

module.exports = { connectDB };
