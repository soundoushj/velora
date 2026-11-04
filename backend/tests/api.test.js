// Automated API tests (Node's built-in test runner + supertest).
//
// =====================================================
// USER ACTION REQUIRED (only if you want to run "npm test")
// TODO: SET TEST_MONGODB_URI IN backend/.env TO A *SEPARATE* DATABASE WHOSE NAME CONTAINS "test",
//       e.g. mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/velora_test
//       WARNING: the tests ERASE that database. They refuse to run against any other name.
// =====================================================
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');

const { config } = require('../config');
const TEST_URI = process.env.TEST_MONGODB_URI;
const dbNameOk = TEST_URI && /test/i.test(new URL(TEST_URI.replace('mongodb+srv://', 'mongodb://')).pathname);

if (!TEST_URI || !dbNameOk) {
  console.log('Skipping API tests: set TEST_MONGODB_URI to a database whose name contains "test".');
  process.exit(0);
}
config.jwt.secret = config.jwt.secret || 'test-secret-test-secret-test-secret-123456';

const { connectDB } = require('../config/db');
const { createApp } = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const catalogue = require('../data/catalogue.json');

const roomy = { windowMs: 15 * 60 * 1000, apiMax: 10000, loginMax: 10000, authMax: 10000 };
let app;
const ADMIN = { name: 'Test Admin', email: 'admin@velora.test', password: 'AdminPass12345' };
const CUSTOMER = { name: 'Sara Customer', email: 'sara@example.com', password: 'Perfume2024' };
let adminToken, customerToken, productId;

const newProduct = (over = {}) => ({
  name: 'Test Noir', brand: 'Velora', description: 'A dark, smoky test fragrance for the unit tests.',
  price: 12000, category: 'Eau de parfum', stock: 10, gender: 'Unisex', family: 'Woody', ...over,
});

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Product.init()]);
  app = createApp({ rateLimit: roomy });
  await User.create({ ...ADMIN, passwordHash: await User.hashPassword(ADMIN.password), role: 'admin' });
  await Product.insertMany(catalogue.slice(0, 3).map((p, i) => ({
    slug: p.id, name: p.name, brand: p.brand, description: p.description, price: p.price, category: p.type,
    imageUrl: `/assets/perfumes/${p.id}.jpg`, stock: 25, gender: p.gender, family: p.family, familyLabel: p.familyLabel,
    size: p.size, bestseller: !!p.bestseller, featured: !!p.featured, smellsLike: p.smellsLike, notes: p.notes, sortOrder: i + 1,
  })));
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

describe('Authentication', () => {
  test('register a new user -> 201, JWT returned, no password hash, role is customer', async () => {
    const res = await request(app).post('/api/auth/register').send(CUSTOMER);
    assert.equal(res.status, 201);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.role, 'customer');
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.ok(!JSON.stringify(res.body).includes('passwordHash'));
    customerToken = res.body.data.token;
  });
  test('password is stored hashed (bcrypt), never in plain text', async () => {
    const u = await User.findOne({ email: CUSTOMER.email }).select('+passwordHash');
    assert.match(u.passwordHash, /^\$2[aby]\$/);
    assert.notEqual(u.passwordHash, CUSTOMER.password);
  });
  test('register with an existing email -> 409', async () => {
    const res = await request(app).post('/api/auth/register').send(CUSTOMER);
    assert.equal(res.status, 409);
  });
  test('duplicate email differing only by case -> 409', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...CUSTOMER, email: 'SARA@Example.com' });
    assert.equal(res.status, 409);
  });
  test('register cannot grant the admin role (mass assignment)', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Evil User', email: 'evil@example.com', password: 'Perfume2024', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'customer');
  });
  test('register validation: missing/invalid fields -> 400', async () => {
    assert.equal((await request(app).post('/api/auth/register').send({})).status, 400);
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: '123' })).status, 400);
    assert.equal((await request(app).post('/api/auth/register').send({ ...CUSTOMER, email: 'x@y.com', password: 'onlyletters' })).status, 400);
  });
  test('login with valid credentials -> 200 + JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: CUSTOMER.email, password: CUSTOMER.password });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.tokenType, 'Bearer');
    assert.equal(res.body.data.token.split('.').length, 3);
  });
  test('login with wrong password and unknown email -> same 401 message', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: CUSTOMER.email, password: 'WrongPass123' });
    const b = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'WrongPass123' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });
  test('NoSQL injection in login body is rejected (400, not a login)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });
  test('admin login works', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'admin');
    adminToken = res.body.data.token;
  });
  test('GET /api/auth/me returns the current user', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, CUSTOMER.email);
  });
});

describe('Products (public)', () => {
  test('GET /api/products -> 200 list', async () => {
    const res = await request(app).get('/api/products');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.data[0].slug, catalogue[0].id); // original order preserved
  });
  test('filters: gender, search, price range', async () => {
    const her = await request(app).get('/api/products?gender=Her');
    assert.ok(her.body.data.every((p) => p.gender === 'Her'));
    const s = await request(app).get('/api/products?search=lancôme');
    assert.ok(s.body.total >= 1);
    const none = await request(app).get('/api/products?maxPrice=1');
    assert.equal(none.body.total, 0);
  });
  test('regex characters in search are treated literally (no ReDoS / injection)', async () => {
    const res = await request(app).get('/api/products?search=' + encodeURIComponent('(.*)+'));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
  });
  test('invalid query values -> 400', async () => {
    assert.equal((await request(app).get('/api/products?gender=Alien')).status, 400);
    assert.equal((await request(app).get('/api/products?limit=9999')).status, 400);
    assert.equal((await request(app).get('/api/products?search[$ne]=x')).status, 400);
  });
  test('GET one by original slug and by MongoDB id', async () => {
    const bySlug = await request(app).get(`/api/products/${catalogue[0].id}`);
    assert.equal(bySlug.status, 200);
    const byId = await request(app).get(`/api/products/${bySlug.body.data._id}`);
    assert.equal(byId.status, 200);
    assert.equal(byId.body.data.slug, catalogue[0].id);
  });
  test('GET unknown id -> 404; malformed id -> 400', async () => {
    assert.equal((await request(app).get('/api/products/64b7f0c2a1b2c3d4e5f60718')).status, 404);
    assert.equal((await request(app).get('/api/products/does-not-exist')).status, 404);
    assert.equal((await request(app).get('/api/products/bad_id!!')).status, 400);
  });
});

describe('Security: protected endpoints', () => {
  test('no token -> 401', async () => {
    assert.equal((await request(app).post('/api/products').send(newProduct())).status, 401);
    assert.equal((await request(app).get('/api/admin/stats')).status, 401);
  });
  test('invalid / tampered / wrong-scheme token -> 401', async () => {
    assert.equal((await request(app).post('/api/products').set('Authorization', 'Bearer not.a.jwt').send(newProduct())).status, 401);
    const tampered = adminToken.slice(0, -3) + (adminToken.endsWith('aaa') ? 'bbb' : 'aaa');
    assert.equal((await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${tampered}`)).status, 401);
    assert.equal((await request(app).get('/api/admin/stats').set('Authorization', `Basic ${adminToken}`)).status, 401);
  });
  test('"alg: none" forged token is rejected', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: (await User.findOne({ role: 'admin' }))._id, role: 'admin' })}.`;
    assert.equal((await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${forged}`)).status, 401);
  });
  test('customer token on admin/product-write endpoints -> 403', async () => {
    const auth = { Authorization: `Bearer ${customerToken}` };
    assert.equal((await request(app).post('/api/products').set(auth).send(newProduct())).status, 403);
    assert.equal((await request(app).put('/api/products/64b7f0c2a1b2c3d4e5f60718').set(auth).send({ price: 1 })).status, 403);
    assert.equal((await request(app).delete('/api/products/64b7f0c2a1b2c3d4e5f60718').set(auth)).status, 403);
    assert.equal((await request(app).get('/api/admin/stats').set(auth)).status, 403);
    assert.equal((await request(app).get('/api/admin/users').set(auth)).status, 403);
  });
  test('role is read from the database: a customer promoted/demoted is honoured immediately', async () => {
    const u = await User.findOne({ email: 'evil@example.com' });
    const login = await request(app).post('/api/auth/login').send({ email: 'evil@example.com', password: 'Perfume2024' });
    const t = login.body.data.token;
    assert.equal((await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${t}`)).status, 403);
    await User.deleteOne({ _id: u._id });
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`)).status, 401); // deleted user
  });
});

describe('Products CRUD (admin)', () => {
  const auth = () => ({ Authorization: `Bearer ${adminToken}` });
  test('create -> 201', async () => {
    const res = await request(app).post('/api/products').set(auth()).send(newProduct());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.slug, 'velora-test-noir');
    productId = res.body.data._id;
  });
  test('create duplicate -> 409', async () => {
    assert.equal((await request(app).post('/api/products').set(auth()).send(newProduct())).status, 409);
  });
  test('create with missing / invalid information -> 400', async () => {
    assert.equal((await request(app).post('/api/products').set(auth()).send({})).status, 400);
    const bad = await request(app).post('/api/products').set(auth()).send(newProduct({ name: 'Bad', price: -5, gender: 'Robot', stock: 1.5 }));
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors.length >= 3);
    assert.equal((await request(app).post('/api/products').set(auth()).send(newProduct({ name: '<script>alert(1)</script>' }))).status, 400);
    assert.equal((await request(app).post('/api/products').set(auth()).send(newProduct({ name: 'X Img', imageUrl: 'javascript:alert(1)' }))).status, 400);
  });
  test('update -> 200 (only whitelisted fields; slug cannot change)', async () => {
    const res = await request(app).put(`/api/products/${productId}`).set(auth()).send({ price: 13500, stock: 7, slug: 'hacked', _id: '000000000000000000000000' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.price, 13500);
    assert.equal(res.body.data.slug, 'velora-test-noir');
    assert.equal(res.body.data._id, productId);
  });
  test('update stock via PATCH', async () => {
    const res = await request(app).patch(`/api/products/${productId}/stock`).set(auth()).send({ stock: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.stock, 0);
    assert.equal((await request(app).patch(`/api/products/${productId}/stock`).set(auth()).send({ stock: -1 })).status, 400);
  });
  test('invalid ids: malformed -> 400, unknown -> 404', async () => {
    assert.equal((await request(app).put('/api/products/123').set(auth()).send({ price: 1 })).status, 400);
    assert.equal((await request(app).delete('/api/products/not-an-id').set(auth())).status, 400);
    assert.equal((await request(app).put('/api/products/64b7f0c2a1b2c3d4e5f60718').set(auth()).send({ price: 1 })).status, 404);
    assert.equal((await request(app).delete('/api/products/64b7f0c2a1b2c3d4e5f60718').set(auth())).status, 404);
  });
  test('delete -> 200, then GET -> 404', async () => {
    assert.equal((await request(app).delete(`/api/products/${productId}`).set(auth())).status, 200);
    assert.equal((await request(app).get(`/api/products/${productId}`)).status, 404);
  });
});

describe('Admin dashboard API', () => {
  const auth = () => ({ Authorization: `Bearer ${adminToken}` });
  test('stats', async () => {
    const res = await request(app).get('/api/admin/stats').set(auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.totalProducts, 3);
    assert.ok(res.body.data.totalUsers >= 2);
    assert.equal(res.body.data.inventory.totalUnits, 75);
  });
  test('users list never exposes password hashes', async () => {
    const res = await request(app).get('/api/admin/users').set(auth());
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 2);
    assert.ok(!JSON.stringify(res.body).match(/passwordHash|\$2[aby]\$/));
  });
  test('admin static page is served with security headers', async () => {
    const res = await request(app).get('/admin/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });
});

describe('Platform security', () => {
  test('unknown route -> 404 JSON; malformed JSON -> 400; oversized body -> 413', async () => {
    assert.equal((await request(app).get('/api/nope')).status, 404);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    assert.equal(bad.status, 400);
    const big = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(20000) });
    assert.equal(big.status, 413);
  });
  test('CORS: allowed origin gets headers, foreign origin is refused', async () => {
    const ok = await request(app).get('/api/products').set('Origin', config.frontendUrl);
    assert.equal(ok.headers['access-control-allow-origin'], config.frontendUrl);
    const bad = await request(app).get('/api/products').set('Origin', 'https://evil.example');
    assert.equal(bad.status, 403);
  });
  test('CORS: same-origin POST (what the admin dashboard does) is allowed', async () => {
    const res = await request(app).post('/api/auth/login').set('Host', 'localhost:5000').set('Origin', 'http://localhost:5000').send({ email: ADMIN.email, password: ADMIN.password });
    assert.equal(res.status, 200);
  });
  test('Helmet headers present, no X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.ok(res.headers['x-frame-options'] || res.headers['content-security-policy']);
  });
  test('Google OAuth: not configured -> 501 (never a crash)', async () => {
    if (config.googleEnabled) return;
    assert.equal((await request(app).get('/api/auth/google')).status, 501);
  });
  test('OAuth code exchange rejects unknown codes', async () => {
    assert.equal((await request(app).post('/api/auth/oauth/exchange').send({ code: 'x'.repeat(64) })).status, 400);
  });
});

describe('Google OAuth 2.0 (Google itself is mocked; everything else is real)', () => {
  const crypto = require('crypto');
  const { OAuth2Client } = require('google-auth-library');
  const originals = { getToken: OAuth2Client.prototype.getToken, verifyIdToken: OAuth2Client.prototype.verifyIdToken };
  let google = { sub: 'g-123', email: 'gina@example.com', email_verified: true, name: 'Gina Google' };
  let seenVerifier;
  const wasEnabled = { ...config.google, enabled: config.googleEnabled };

  before(() => {
    config.google.clientId = 'test-client-id.apps.googleusercontent.com';
    config.google.clientSecret = 'test-secret';
    config.googleEnabled = true;
    OAuth2Client.prototype.getToken = async function getToken({ codeVerifier }) { seenVerifier = codeVerifier; return { tokens: { id_token: 'fake' } }; };
    OAuth2Client.prototype.verifyIdToken = async function verifyIdToken() { return { getPayload: () => ({ ...google, nonce: lastNonce }) }; };
  });
  after(() => {
    OAuth2Client.prototype.getToken = originals.getToken;
    OAuth2Client.prototype.verifyIdToken = originals.verifyIdToken;
    Object.assign(config.google, { clientId: wasEnabled.clientId, clientSecret: wasEnabled.clientSecret });
    config.googleEnabled = wasEnabled.enabled;
  });

  let lastNonce;
  async function start(agent) {
    const res = await agent.get('/api/auth/google');
    assert.equal(res.status, 302);
    const url = new URL(res.headers.location);
    lastNonce = url.searchParams.get('nonce');
    return { url, state: url.searchParams.get('state'), res };
  }

  test('start: redirects to Google with PKCE (S256), state and nonce; sets an httpOnly cookie', async () => {
    const agent = request.agent(app);
    const { url, res } = await start(agent);
    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(url.searchParams.get('code_challenge'));
    assert.match(url.searchParams.get('scope'), /openid/);
    assert.equal(url.searchParams.get('redirect_uri'), config.google.redirectUri);
    assert.ok(!res.headers.location.includes('test-secret'), 'client secret must never be in the URL');
    assert.match(res.headers['set-cookie'][0], /HttpOnly/i);
  });

  test('callback: valid flow creates a customer, PKCE verifier matches the challenge, code is single-use', async () => {
    const agent = request.agent(app);
    const { url, state } = await start(agent);
    const cb = await agent.get(`/api/auth/google/callback?code=abc&state=${state}`);
    assert.equal(cb.status, 302);
    const loc = new URL(cb.headers.location);
    assert.equal(loc.origin + loc.pathname, `${config.frontendUrl}/auth/callback`);
    const challenge = crypto.createHash('sha256').update(seenVerifier).digest('base64url');
    assert.equal(challenge, url.searchParams.get('code_challenge'));
    assert.ok(!cb.headers.location.includes('eyJ'), 'a JWT must never appear in the redirect URL');

    const code = loc.searchParams.get('code');
    const ex = await request(app).post('/api/auth/oauth/exchange').send({ code });
    assert.equal(ex.status, 200);
    assert.equal(ex.body.data.user.email, 'gina@example.com');
    assert.equal(ex.body.data.user.role, 'customer');
    assert.equal(ex.body.data.user.authProvider, 'google');
    assert.equal((await request(app).post('/api/auth/oauth/exchange').send({ code })).status, 400);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ex.body.data.token}`)).status, 200);
  });

  test('callback: signing in again with the same Google account re-uses the user (no duplicate)', async () => {
    const agent = request.agent(app);
    const { state } = await start(agent);
    assert.equal((await agent.get(`/api/auth/google/callback?code=abc&state=${state}`)).status, 302);
    assert.equal(await User.countDocuments({ email: 'gina@example.com' }), 1);
  });

  test('callback: email belonging to a password account is NOT silently linked', async () => {
    google = { sub: 'g-evil', email: CUSTOMER.email, email_verified: true, name: 'Someone' };
    const agent = request.agent(app);
    const { state } = await start(agent);
    const cb = await agent.get(`/api/auth/google/callback?code=abc&state=${state}`);
    assert.match(cb.headers.location, /\/account\?error=account_exists_use_password/);
    const u = await User.findOne({ email: CUSTOMER.email }).select('+googleId');
    assert.ok(!u.googleId);
    google = { sub: 'g-123', email: 'gina@example.com', email_verified: true, name: 'Gina Google' };
  });

  test('callback: wrong state, missing cookie, unverified email, wrong nonce and Google error are all refused', async () => {
    let agent = request.agent(app);
    await start(agent);
    assert.match((await agent.get('/api/auth/google/callback?code=abc&state=forged')).headers.location, /oauth_state_mismatch/);

    assert.match((await request(app).get('/api/auth/google/callback?code=abc&state=x')).headers.location, /oauth_session_expired/);

    agent = request.agent(app);
    let { state } = await start(agent);
    google = { ...google, email_verified: false };
    assert.match((await agent.get(`/api/auth/google/callback?code=abc&state=${state}`)).headers.location, /oauth_verification_failed/);
    google = { ...google, email_verified: true };

    agent = request.agent(app);
    ({ state } = await start(agent));
    lastNonce = 'attacker-nonce';
    assert.match((await agent.get(`/api/auth/google/callback?code=abc&state=${state}`)).headers.location, /oauth_verification_failed/);

    agent = request.agent(app);
    ({ state } = await start(agent));
    assert.match((await agent.get(`/api/auth/google/callback?error=access_denied&state=${state}`)).headers.location, /oauth_denied/);
  });

  test('"?response=json" dev helper returns the JWT directly (non-production only)', async () => {
    const agent = request.agent(app);
    const res0 = await agent.get('/api/auth/google?response=json');
    const url = new URL(res0.headers.location); lastNonce = url.searchParams.get('nonce');
    const cb = await agent.get(`/api/auth/google/callback?code=abc&state=${url.searchParams.get('state')}`);
    assert.equal(cb.status, 200);
    assert.ok(cb.body.data.token);
  });
});

describe('Rate limiting', () => {
  test('login: 6th request from the same IP within the window -> 429', async () => {
    const limited = createApp({ rateLimit: { windowMs: 15 * 60 * 1000, apiMax: 100, loginMax: 5, authMax: 20 } });
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await request(limited).post('/api/auth/login').send({ email: 'x@y.com', password: 'WrongPass123' })).status);
    }
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
    const res = await request(limited).post('/api/auth/login').send({ email: 'x@y.com', password: 'WrongPass123' });
    assert.equal(res.status, 429);
    assert.ok(res.headers['retry-after']);
  });
  test('general API: 101st request within the window -> 429', async () => {
    const limited = createApp({ rateLimit: { windowMs: 15 * 60 * 1000, apiMax: 100, loginMax: 5, authMax: 20 } });
    let last;
    for (let i = 0; i < 101; i++) last = await request(limited).get('/api/health');
    assert.equal(last.status, 429);
  });
});
