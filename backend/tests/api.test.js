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
const Order = require('../models/Order');
const { signAccessToken } = require('../services/tokenService');
const catalogue = require('../data/catalogue.json');

const roomy = { windowMs: 15 * 60 * 1000, apiMax: 10000, loginMax: 10000 };
let app;
const ADMIN = { name: 'Test Admin', email: 'admin@velora.test', password: 'AdminPass12345' };
// Velora has no customer accounts any more. This is a LEFTOVER account (as could exist in an old database):
// it must not be able to log in, and its token must never reach admin endpoints.
const LEGACY_CUSTOMER = { name: 'Sara Customer', email: 'sara@example.com', password: 'Perfume2024' };
let adminToken, customerToken, productId;

const newProduct = (over = {}) => ({
  name: 'Test Noir', brand: 'Velora', description: 'A dark, smoky test fragrance for the unit tests.',
  price: 12000, category: 'Eau de parfum', stock: 10, gender: 'Unisex', family: 'Woody', ...over,
});

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Product.init(), Order.init()]);
  app = createApp({ rateLimit: roomy });
  await User.create({ ...ADMIN, passwordHash: await User.hashPassword(ADMIN.password), role: 'admin' });
  const legacy = await User.create({ ...LEGACY_CUSTOMER, passwordHash: await User.hashPassword(LEGACY_CUSTOMER.password), role: 'customer' });
  customerToken = signAccessToken(legacy);
  await Product.insertMany(catalogue.slice(0, 3).map((p, i) => ({
    slug: p.id, name: p.name, brand: p.brand, description: p.description, price: p.price, category: p.type,
    imageUrl: `/assets/perfumes/${p.id}.jpg`, stock: 25, gender: p.gender, family: p.family, familyLabel: p.familyLabel,
    size: p.size, bestseller: !!p.bestseller, featured: !!p.featured, smellsLike: p.smellsLike, notes: p.notes, sortOrder: i + 1,
  })));
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

describe('Authentication (administrators only)', () => {
  test('there is no customer registration: POST /api/auth/register -> 404', async () => {
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'New Person', email: 'new@example.com', password: 'Perfume2024' })).status, 404);
    assert.equal(await User.countDocuments({ email: 'new@example.com' }), 0);
  });
  test('there is no Google sign-in or OAuth code exchange -> 404', async () => {
    assert.equal((await request(app).get('/api/auth/google')).status, 404);
    assert.equal((await request(app).get('/api/auth/google/callback')).status, 404);
    assert.equal((await request(app).post('/api/auth/oauth/exchange').send({ code: 'x'.repeat(64) })).status, 404);
  });
  test('admin login works -> 200 + JWT, no password hash in the response', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'admin');
    assert.equal(res.body.data.tokenType, 'Bearer');
    assert.equal(res.body.data.token.split('.').length, 3);
    assert.ok(!JSON.stringify(res.body).includes('passwordHash'));
    adminToken = res.body.data.token;
  });
  test('admin password is stored hashed (bcrypt), never in plain text', async () => {
    const u = await User.findOne({ email: ADMIN.email }).select('+passwordHash');
    assert.match(u.passwordHash, /^\$2[aby]\$/);
    assert.notEqual(u.passwordHash, ADMIN.password);
  });
  test('a leftover customer account cannot log in, even with the correct password -> 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: LEGACY_CUSTOMER.email, password: LEGACY_CUSTOMER.password });
    assert.equal(res.status, 401);
    assert.equal(res.body.data, undefined);
  });
  test('wrong password, unknown email and customer account -> the same 401 message', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: 'WrongPass123' });
    const b = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'WrongPass123' });
    const c = await request(app).post('/api/auth/login').send({ email: LEGACY_CUSTOMER.email, password: LEGACY_CUSTOMER.password });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(c.status, 401);
    assert.equal(a.body.message, b.body.message);
    assert.equal(a.body.message, c.body.message);
  });
  test('NoSQL injection in login body is rejected (400, not a login)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });
  test('GET /api/auth/me returns the current administrator', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, ADMIN.email);
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
    assert.equal((await request(app).get('/api/admin/customers').set(auth)).status, 403);
  });
  test('role is read from the database: a deleted user\'s token stops working immediately', async () => {
    const u = await User.create({ name: 'Temp User', email: 'temp@example.com', passwordHash: await User.hashPassword('Perfume2024'), role: 'customer' });
    const t = signAccessToken(u);
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
    assert.equal(typeof res.body.data.totalCustomers, 'number');
    assert.equal(res.body.data.inventory.totalUnits, 75);
  });
  test('customers list is built from guest orders: grouped by phone, cancelled orders not counted as spent', async () => {
    const empty = await request(app).get('/api/admin/customers').set(auth());
    assert.equal(empty.status, 200);
    assert.equal(empty.body.total, 0);

    const base = { items: [{ product: new mongoose.Types.ObjectId(), slug: 'x', name: 'X', quantity: 1, unitPrice: 1000, lineTotal: 1000 }], subtotal: 1000, deliveryFee: 0 };
    const who = { fullName: 'Amina Benali', phone: '0550123456', city: 'Alger', address: '12 rue Didouche Mourad' };
    await Order.create({ ...base, orderNumber: 'VEL-T-000001', idempotencyKey: 'k'.repeat(16) + '1', customer: who, total: 1000, status: 'delivered', createdAt: new Date('2026-01-01') });
    await Order.create({ ...base, orderNumber: 'VEL-T-000002', idempotencyKey: 'k'.repeat(16) + '2', customer: { ...who, city: 'Oran' }, total: 5000, status: 'cancelled', createdAt: new Date('2026-02-01') });
    await Order.create({ ...base, orderNumber: 'VEL-T-000003', idempotencyKey: 'k'.repeat(16) + '3', customer: { ...who, fullName: 'Karim Haddad', phone: '0661000000' }, total: 2000, status: 'pending' });

    const res = await request(app).get('/api/admin/customers').set(auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
    const amina = res.body.data.find((c) => c.phone === '0550123456');
    assert.equal(amina.ordersCount, 2);
    assert.equal(amina.totalSpent, 1000); // the cancelled 5000 is not counted
    assert.equal(amina.city, 'Oran'); // details come from the latest order
    assert.ok(!JSON.stringify(res.body).match(/passwordHash|\$2[aby]\$/));

    const found = await request(app).get('/api/admin/customers?search=' + encodeURIComponent('0550 12 34 56')).set(auth());
    assert.equal(found.body.total, 1);
    assert.equal(found.body.data[0].phone, '0550123456');
    assert.equal((await request(app).get('/api/admin/customers?search[$ne]=x').set(auth())).status, 400);
  });
  test('the old /api/admin/users endpoint no longer exists -> 404', async () => {
    assert.equal((await request(app).get('/api/admin/users').set(auth())).status, 404);
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
});

describe('Rate limiting', () => {
  test('login: 6th request from the same IP within the window -> 429', async () => {
    const limited = createApp({ rateLimit: { windowMs: 15 * 60 * 1000, apiMax: 100, loginMax: 5 } });
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
    const limited = createApp({ rateLimit: { windowMs: 15 * 60 * 1000, apiMax: 100, loginMax: 5 } });
    let last;
    for (let i = 0; i < 101; i++) last = await request(limited).get('/api/health');
    assert.equal(last.status, 429);
  });
});