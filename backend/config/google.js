// =====================================================================
// GOOGLE OAUTH 2.0 / OPENID CONNECT SETUP
//
// =====================================================
// USER ACTION REQUIRED
// TODO: GO TO https://console.cloud.google.com/ AND CREATE (OR SELECT) A PROJECT.
// TODO: OPEN "APIs & Services" > "OAuth consent screen" AND CONFIGURE IT
//       (User type: External, add your own Google account as a TEST USER).
// TODO: OPEN "APIs & Services" > "Credentials" > "Create credentials" > "OAuth client ID"
//       Application type: "Web application".
// TODO: UNDER "Authorized redirect URIs" ADD EXACTLY:
//         http://localhost:5000/api/auth/google/callback
// TODO: COPY THE "Client ID"     INTO  backend/.env  ->  GOOGLE_CLIENT_ID
// TODO: COPY THE "Client secret" INTO  backend/.env  ->  GOOGLE_CLIENT_SECRET
//       (the secret stays on the server ONLY - it must never appear in the React code).
// =====================================================
const { OAuth2Client } = require('google-auth-library');
const { config } = require('./index');

/** Returns a new OAuth client, or null when Google sign-in has not been configured yet. */
function createGoogleClient() {
  if (!config.googleEnabled) return null;
  return new OAuth2Client({
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    redirectUri: config.google.redirectUri,
  });
}

module.exports = { createGoogleClient };
