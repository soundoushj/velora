// Order management tests (Node's built-in test runner + supertest), same setup as api.test.js.
// Needs TEST_MONGODB_URI (a SEPARATE database whose name contains "test"). It erases that database.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');

const { config } = require('../config');
const TEST_URI = process.env.TEST_MONGODB_URI;
const dbNameOk = TEST_URI && /test/i.test(new URL(TEST_URI.replace('mongodb+srv://', 'mongodb://')).pathname);
if (!TEST_URI || !dbNameOk) {
  console.log('Skipping order tests: set TEST_MONGODB_URI to a database whose name contains "test".');
  process.exit(0);
}
config.jwt.secret = config.jwt.secret || 'test-secret-test-secret-test-secret-123456';

const { connectDB } = require('../config/db');
const { createApp } = require('../app');
const User = require('../models/User');
const { signAccessToken } = require('../services/tokenService');
const Product = require('../models/Product');
const Order = require('../models/Order');

const roomy = { windowMs: 15 * 60 * 1000, apiMax: 10000, loginMax: 10000, orderMax: 10000 };
const ADMIN = { name: 'Test Admin', email: 'admin@velora.test', password: 'AdminPass12345' };
// A LEFTOVER customer account (Velora has no customer accounts any more): it cannot log in,
// but if an old token existed it must still never reach the admin order endpoints.
const CUSTOMER = { name: 'Sara Customer', email: 'sara@example.com', password: 'Perfume2024' };
const key = () => crypto.randomUUID();
const CUST = { fullName: 'Amina Benali', phone: '0550 12 34 56', city: 'Alger', address: '12 rue Didouche Mourad, Alger-Centre' };

let app, adminToken, customerToken, a, b, c; // a, b, c = test products
const make = (slug, price, stock) => Product.create({
  slug, name: `Test ${slug}`, brand: 'Velora', description: 'A fragrance used by the order tests.',
  price, category: 'Eau de parfum', stock, gender: 'Unisex', family: 'Woody',
});
const place = (items, over = {}, agent = app) => request(agent).post('/api/orders').send({ customer: CUST, items, idempotencyKey: key(), ...over });
const stockOf = async (p) => (await Product.findById(p._id)).stock;
const admin = () => ({ Authorization: `Bearer ${adminToken}` });

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Product.init(), Order.init()]);
  app = createApp({ rateLimit: roomy });
  await User.create({ ...ADMIN, passwordHash: await User.hashPassword(ADMIN.password), role: 'admin' });
  const legacyCustomer = await User.create({ ...CUSTOMER, passwordHash: await User.hashPassword(CUSTOMER.password) });
  adminToken = (await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password })).body.data.token;
  customerToken = signAccessToken(legacyCustomer);
  a = await make('order-a', 10000, 100); // 10 000 DZD
  b = await make('order-b', 4000, 100);
  c = await make('order-c', 8000, 1);
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

describe('Creating orders (public)', () => {
  test('valid order -> 201, saved in MongoDB, status pending, COD unpaid, stock reduced', async () => {
    const res = await place([{ productId: 'order-a', quantity: 2 }]);
    assert.equal(res.status, 201);
    assert.match(res.body.data.orderNumber, /^VEL-\d{6}-[A-Z2-9]{6}$/);
    assert.equal(res.body.data.status, 'pending');
    assert.equal(res.body.data.paymentMethod, 'cash_on_delivery');
    assert.equal(res.body.data.paymentStatus, 'unpaid');
    const saved = await Order.findOne({ orderNumber: res.body.data.orderNumber });
    assert.ok(saved);
    assert.equal(saved.customer.phone, '0550123456'); // normalised
    assert.equal(saved.items[0].slug, 'order-a');
    assert.equal(saved.items[0].name, 'Test order-a'); // snapshot
    assert.equal(await stockOf(a), 98);
  });

  test('prices are calculated on the server: 2 x 10 000 = 20 000 -> free delivery', async () => {
    const o = await Order.findOne().sort({ createdAt: -1 });
    assert.equal(o.subtotal, 20000);
    assert.equal(o.deliveryFee, 0);
    assert.equal(o.total, 20000);
  });

  test('delivery fee is added under the free-delivery threshold (1 x 4 000 + 600)', async () => {
    const res = await place([{ productId: 'order-b', quantity: 1 }]);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.subtotal, 4000);
    assert.equal(res.body.data.deliveryFee, 600);
    assert.equal(res.body.data.total, 4600);
  });

  test('manipulated prices/totals/status sent by the browser are ignored', async () => {
    const res = await place([{ productId: 'order-b', quantity: 1, unitPrice: 1, price: 1, lineTotal: 1 }], { total: 1, subtotal: 1, deliveryFee: 0, status: 'delivered', paymentStatus: 'paid' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.total, 4600);
    assert.equal(res.body.data.status, 'pending');
    assert.equal(res.body.data.paymentStatus, 'unpaid');
  });

  test('a product can be referenced by MongoDB id; duplicate lines are merged', async () => {
    const before = await stockOf(b);
    const res = await place([{ productId: String(b._id), quantity: 1 }, { productId: 'order-b', quantity: 1 }]);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.items[0].quantity, 2);
    assert.equal(await stockOf(b), before - 2);
  });

  test('order numbers are unique', async () => {
    const numbers = (await Order.find().select('orderNumber')).map((o) => o.orderNumber);
    assert.equal(new Set(numbers).size, numbers.length);
  });

  test('the same idempotencyKey never creates a second order or takes stock twice', async () => {
    const k = key();
    const before = await stockOf(a);
    const first = await place([{ productId: 'order-a', quantity: 1 }], { idempotencyKey: k });
    const second = await place([{ productId: 'order-a', quantity: 1 }], { idempotencyKey: k });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(second.body.data.orderNumber, first.body.data.orderNumber);
    assert.equal(await Order.countDocuments({ idempotencyKey: k }), 1);
    assert.equal(await stockOf(a), before - 1);
  });

  test('simultaneous identical requests -> one order only', async () => {
    const k = key();
    const before = await stockOf(a);
    const results = await Promise.all([1, 2, 3].map(() => place([{ productId: 'order-a', quantity: 1 }], { idempotencyKey: k })));
    assert.ok(results.every((r) => [200, 201].includes(r.status)));
    assert.equal(new Set(results.map((r) => r.body.data.orderNumber)).size, 1);
    assert.equal(await Order.countDocuments({ idempotencyKey: k }), 1);
    assert.equal(await stockOf(a), before - 1);
  });

  test('the response never exposes phone, address or the idempotency key', async () => {
    const res = await place([{ productId: 'order-b', quantity: 1 }]);
    const text = JSON.stringify(res.body);
    assert.ok(!text.includes('0550123456') && !text.includes('Didouche') && !text.includes('idempotencyKey'));
  });
});

describe('Validation and stock', () => {
  test('invalid customer data -> 400 with field errors', async () => {
    const items = [{ productId: 'order-b', quantity: 1 }];
    assert.equal((await place(items, { customer: { ...CUST, fullName: '' } })).status, 400);
    assert.equal((await place(items, { customer: { ...CUST, phone: 'abc' } })).status, 400);
    assert.equal((await place(items, { customer: { ...CUST, phone: '0112' } })).status, 400);
    assert.equal((await place(items, { customer: { ...CUST, city: 'A' } })).status, 400);
    assert.equal((await place(items, { customer: { ...CUST, address: 'x' } })).status, 400);
    assert.equal((await place(items, { customer: { ...CUST, fullName: '<script>alert(1)</script>' } })).status, 400);
    assert.equal((await place(items, { customer: undefined })).status, 400);
    const bad = await place(items, { customer: { fullName: '', phone: '', city: '', address: '' } });
    assert.ok(bad.body.errors.length >= 4);
  });
  test('accepted phone formats: +213, 00213 and landline', async () => {
    for (const phone of ['+213 550 12 34 56', '00213550123456', '021 12 34 56']) {
      assert.equal((await place([{ productId: 'order-b', quantity: 1 }], { customer: { ...CUST, phone } })).status, 201, phone);
    }
  });
  test('invalid items, quantities and keys -> 400', async () => {
    assert.equal((await place([])).status, 400);
    assert.equal((await place('order-b')).status, 400);
    assert.equal((await place([{ productId: 'order-b', quantity: 0 }])).status, 400);
    assert.equal((await place([{ productId: 'order-b', quantity: -3 }])).status, 400);
    assert.equal((await place([{ productId: 'order-b', quantity: 1.5 }])).status, 400);
    assert.equal((await place([{ productId: 'order-b', quantity: '2' }])).status, 400);
    assert.equal((await place([{ productId: 'order-b', quantity: 11 }])).status, 400);
    assert.equal((await place([{ productId: 'order-b', quantity: 6 }, { productId: 'order-b', quantity: 5 }])).status, 400); // merged > 10
    assert.equal((await place([{ productId: { $ne: null }, quantity: 1 }])).status, 400);
    assert.equal((await place([{ productId: 'Bad Slug!', quantity: 1 }])).status, 400);
    assert.equal((await place([{ productId: 'order-b', quantity: 1 }], { idempotencyKey: 'short' })).status, 400);
    assert.equal((await place([{ productId: 'order-b', quantity: 1 }], { idempotencyKey: undefined })).status, 400);
  });
  test('unknown product -> 400 and nothing is saved', async () => {
    const count = await Order.countDocuments();
    assert.equal((await place([{ productId: 'does-not-exist', quantity: 1 }])).status, 400);
    assert.equal((await place([{ productId: '64b7f0c2a1b2c3d4e5f60718', quantity: 1 }])).status, 400);
    assert.equal(await Order.countDocuments(), count);
  });
  test('insufficient stock -> 409, stock and orders unchanged', async () => {
    const count = await Order.countDocuments();
    const stock = await stockOf(c);
    const res = await place([{ productId: 'order-c', quantity: 2 }]);
    assert.equal(res.status, 409);
    assert.equal(await stockOf(c), stock);
    assert.equal(await Order.countDocuments(), count);
  });
  test('a failed multi-product order leaves NO partial stock change', async () => {
    const before = await stockOf(b);
    const res = await place([{ productId: 'order-b', quantity: 1 }, { productId: 'order-c', quantity: 5 }]);
    assert.equal(res.status, 409);
    assert.equal(await stockOf(b), before);
  });
  test('failure while saving the order gives the reserved stock back', async () => {
    const before = await stockOf(b);
    const original = Order.create;
    Order.create = async () => { throw new Error('simulated database failure'); };
    try {
      const res = await place([{ productId: 'order-b', quantity: 2 }]);
      assert.equal(res.status, 500);
      assert.ok(!res.text.includes('simulated'), 'internal error details must not leak');
    } finally { Order.create = original; }
    assert.equal(await stockOf(b), before);
  });
  test('two customers buying the last bottle at the same time: exactly one wins', async () => {
    await Product.updateOne({ _id: c._id }, { stock: 1 });
    const results = await Promise.all([1, 2, 3, 4].map(() => place([{ productId: 'order-c', quantity: 1 }])));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 3);
    assert.equal(await stockOf(c), 0);
  });
  test('out of stock product -> 409', async () => {
    assert.equal((await place([{ productId: 'order-c', quantity: 1 }])).status, 409);
  });
  test('a price that changed meanwhile is never charged silently (uses the current DB price)', async () => {
    await Product.updateOne({ _id: b._id }, { price: 5000 });
    const res = await place([{ productId: 'order-b', quantity: 1 }]);
    assert.equal(res.body.data.items[0].unitPrice, 5000);
    await Product.updateOne({ _id: b._id }, { price: 4000 });
  });
});

describe('Admin order endpoints', () => {
  let orderId;
  test('no token -> 401; customer token -> 403', async () => {
    const some = await Order.findOne();
    assert.equal((await request(app).get('/api/orders')).status, 401);
    assert.equal((await request(app).get(`/api/orders/${some._id}`)).status, 401);
    assert.equal((await request(app).patch(`/api/orders/${some._id}/status`).send({ status: 'confirmed' })).status, 401);
    const auth = { Authorization: `Bearer ${customerToken}` };
    assert.equal((await request(app).get('/api/orders').set(auth)).status, 403);
    assert.equal((await request(app).get(`/api/orders/${some._id}`).set(auth)).status, 403);
    assert.equal((await request(app).patch(`/api/orders/${some._id}/status`).set(auth).send({ status: 'confirmed' })).status, 403);
  });
  test('admin lists orders (newest first, paginated) without exposing the idempotency key', async () => {
    const res = await request(app).get('/api/orders?limit=5').set(admin());
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 5);
    assert.ok(res.body.total > 5);
    assert.ok(!JSON.stringify(res.body).includes('idempotencyKey'));
    orderId = res.body.data[0]._id;
    const dates = res.body.data.map((o) => new Date(o.createdAt).getTime());
    assert.deepEqual([...dates].sort((x, y) => y - x), dates);
  });
  test('search by order number, name, phone (any spacing) and city; filter by status', async () => {
    const o = await Order.findOne().sort({ createdAt: 1 });
    const by = async (qs) => (await request(app).get(`/api/orders?${qs}`).set(admin())).body;
    assert.ok((await by(`search=${o.orderNumber}`)).total >= 1);
    assert.ok((await by('search=amina')).total >= 1);
    assert.ok((await by(`search=${encodeURIComponent('0550 12 34')}`)).total >= 1);
    assert.ok((await by('search=alger')).total >= 1);
    assert.equal((await by('search=nobody-here')).total, 0);
    assert.equal((await by('status=delivered')).total, 0);
    assert.ok((await by('status=pending')).total > 0);
    assert.equal((await request(app).get('/api/orders?status=bogus').set(admin())).status, 400);
    assert.equal((await request(app).get('/api/orders?search[$ne]=x').set(admin())).status, 400);
  });
  test('admin gets one order with full details; bad/unknown id -> 400/404', async () => {
    const res = await request(app).get(`/api/orders/${orderId}`).set(admin());
    assert.equal(res.status, 200);
    assert.ok(res.body.data.customer.phone && res.body.data.customer.address && res.body.data.items.length);
    assert.equal((await request(app).get('/api/orders/123').set(admin())).status, 400);
    assert.equal((await request(app).get('/api/orders/64b7f0c2a1b2c3d4e5f60718').set(admin())).status, 404);
  });
  test('valid status flow: pending -> confirmed -> shipped -> delivered', async () => {
    for (const status of ['confirmed', 'shipped', 'delivered']) {
      const res = await request(app).patch(`/api/orders/${orderId}/status`).set(admin()).send({ status });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, status);
    }
  });
  test('invalid transitions are refused (409) and bad values (400)', async () => {
    const send = (status) => request(app).patch(`/api/orders/${orderId}/status`).set(admin()).send({ status });
    assert.equal((await send('pending')).status, 409); // delivered is final
    assert.equal((await send('cancelled')).status, 409);
    assert.equal((await send('delivered')).status, 409);
    assert.equal((await send('teleported')).status, 400);
    assert.equal((await request(app).patch(`/api/orders/${orderId}/status`).set(admin()).send({})).status, 400);
    assert.equal((await request(app).patch('/api/orders/64b7f0c2a1b2c3d4e5f60718/status').set(admin()).send({ status: 'confirmed' })).status, 404);
    const fresh = await place([{ productId: 'order-b', quantity: 1 }]);
    const o = await Order.findOne({ orderNumber: fresh.body.data.orderNumber });
    assert.equal((await request(app).patch(`/api/orders/${o._id}/status`).set(admin()).send({ status: 'delivered' })).status, 409); // cannot skip steps
  });
  test('cancelling gives the stock back exactly once', async () => {
    const before = await stockOf(a);
    const res = await place([{ productId: 'order-a', quantity: 3 }]);
    assert.equal(await stockOf(a), before - 3);
    const o = await Order.findOne({ orderNumber: res.body.data.orderNumber });
    const cancel = await request(app).patch(`/api/orders/${o._id}/status`).set(admin()).send({ status: 'cancelled' });
    assert.equal(cancel.status, 200);
    assert.equal(await stockOf(a), before);
    assert.equal((await request(app).patch(`/api/orders/${o._id}/status`).set(admin()).send({ status: 'cancelled' })).status, 409);
    assert.equal(await stockOf(a), before); // not restored twice
    assert.equal((await request(app).patch(`/api/orders/${o._id}/status`).set(admin()).send({ status: 'confirmed' })).status, 409); // final
  });
});

describe('Order rate limiting and existing features', () => {
  test('public order creation is rate limited (11th request in the window -> 429)', async () => {
    const limited = createApp({ rateLimit: { windowMs: 15 * 60 * 1000, apiMax: 1000, loginMax: 5, orderMax: 10 } });
    const statuses = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await place([], {}, limited)).status); // invalid body: still counts
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(400));
    assert.equal(statuses[10], 429);
  });
  test('existing endpoints still work (products, stats, health)', async () => {
    assert.equal((await request(app).get('/api/products')).status, 200);
    assert.equal((await request(app).get('/api/admin/stats').set(admin())).status, 200);
    assert.equal((await request(app).get('/api/health')).status, 200);
    assert.equal((await request(app).get('/api/orders-nope')).status, 404);
  });
});