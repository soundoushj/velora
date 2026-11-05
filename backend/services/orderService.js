// Business rules for orders. Everything that touches money or stock lives here,
// so the controller stays thin and the rules are easy to test.
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { config } = require('../config');

const MAX_QTY_PER_PRODUCT = 10;
const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;
const NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I: easy to read over the phone

// Which status may follow which. Delivered and cancelled are final.
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function generateOrderNumber(now = new Date()) {
  const day = now.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
  let tail = '';
  for (let i = 0; i < 6; i += 1) tail += NUMBER_ALPHABET[crypto.randomInt(NUMBER_ALPHABET.length)];
  return `VEL-${day}-${tail}`;
}

const deliveryFeeFor = (subtotal) => (subtotal >= config.delivery.freeThreshold ? 0 : config.delivery.fee);

/** Which unique field caused a duplicate-key error ('orderNumber', 'idempotencyKey' or null). */
function duplicateField(err) {
  if (!err || err.code !== 11000) return null;
  if (err.keyPattern) return Object.keys(err.keyPattern)[0] || null;
  const msg = String(err.message || '');
  if (msg.includes('idempotencyKey')) return 'idempotencyKey';
  if (msg.includes('orderNumber')) return 'orderNumber';
  return null;
}

const conflict = (message) => new ApiError(409, message, [{ field: 'items', message }]);

/**
 * Loads the REAL products from MongoDB and builds the order lines.
 * The shop only sends { productId, quantity }: names and prices always come from the database.
 */
async function buildLines(items) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const objectIds = ids.filter((id) => MONGO_ID_REGEX.test(id));
  const products = await Product.find({ $or: [{ _id: { $in: objectIds } }, { slug: { $in: ids } }] });
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const merged = new Map(); // the same perfume sent twice is merged into one line
  for (const { productId, quantity } of items) {
    const product = byId.get(productId) || bySlug.get(productId);
    if (!product) {
      const message = 'One of the perfumes in your bag is no longer available.';
      throw new ApiError(400, message, [{ field: 'items', message }]);
    }
    const key = String(product._id);
    const qty = (merged.has(key) ? merged.get(key).quantity : 0) + quantity;
    if (qty > MAX_QTY_PER_PRODUCT) {
      const message = `You can order at most ${MAX_QTY_PER_PRODUCT} units of “${product.name}”.`;
      throw new ApiError(400, message, [{ field: 'items', message }]);
    }
    merged.set(key, { product, quantity: qty });
  }

  return [...merged.values()].map(({ product, quantity }) => {
    if (product.stock <= 0) throw conflict(`“${product.name}” is out of stock.`);
    if (product.stock < quantity) throw conflict(`Only ${product.stock} unit${product.stock === 1 ? '' : 's'} of “${product.name}” left. Please lower the quantity.`);
    return {
      product: product._id,
      slug: product.slug,
      name: product.name,
      quantity,
      unitPrice: product.price,
      lineTotal: round2(product.price * quantity),
    };
  });
}

async function giveStockBack(lines) {
  if (!lines.length) return;
  await Product.bulkWrite(lines.map((l) => ({ updateOne: { filter: { _id: l.product }, update: { $inc: { stock: l.quantity } } } })));
}

/**
 * Takes the stock with ATOMIC conditional updates: "subtract N only if stock >= N and the price is
 * still the one we used". Two customers buying the last bottle at the same moment cannot both win.
 * If any line fails, the lines already taken are given back, so no partial reduction is left behind.
 */
async function reserveStock(lines) {
  const taken = [];
  for (const line of lines) {
    const result = await Product.updateOne(
      { _id: line.product, stock: { $gte: line.quantity }, price: line.unitPrice },
      { $inc: { stock: -line.quantity } }
    );
    if (result.modifiedCount !== 1) {
      try { await giveStockBack(taken); } catch (err) { console.error('[orders] could not release stock after a failed reservation', err); }
      const now = await Product.findById(line.product).select('stock price name');
      if (!now) throw new ApiError(400, 'One of the perfumes in your bag is no longer available.');
      if (now.price !== line.unitPrice) throw conflict(`The price of “${now.name}” has just changed. Please review your bag and try again.`);
      throw conflict(now.stock <= 0 ? `“${now.name}” has just sold out.` : `Only ${now.stock} unit${now.stock === 1 ? '' : 's'} of “${now.name}” left. Please lower the quantity.`);
    }
    taken.push(line);
  }
  return taken;
}

async function insertWithUniqueNumber(doc) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Order.create({ ...doc, orderNumber: generateOrderNumber() });
    } catch (err) {
      const field = duplicateField(err);
      if (field && field !== 'orderNumber') throw err; // a known non-number duplicate (idempotencyKey) is not retried
      if (!field && err.code !== 11000) throw err; // only duplicate-key errors are retried (new number each time)
      lastError = err;
    }
  }
  throw lastError; // still a duplicate-key error: createOrder() checks whether it is a repeated submission
}

/**
 * Creates an order. Returns { order, duplicate }.
 *  - duplicate = true  -> this idempotencyKey was already used; the ORIGINAL order is returned, nothing new is created.
 */
async function createOrderOnce({ customer, items, idempotencyKey }) {
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return { order: existing, duplicate: true };

  const lines = await buildLines(items);
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const deliveryFee = deliveryFeeFor(subtotal);
  const total = round2(subtotal + deliveryFee);

  await reserveStock(lines); // throws (and cleans up after itself) if anything is not available

  try {
    const order = await insertWithUniqueNumber({
      idempotencyKey, customer, items: lines, subtotal, deliveryFee, total,
      paymentMethod: 'cash_on_delivery', paymentStatus: 'unpaid', status: 'pending',
    });
    return { order, duplicate: false };
  } catch (err) {
    // The order was NOT saved: give every reserved unit back.
    try { await giveStockBack(lines); } catch (e) { console.error('[orders] could not release stock after a failed order', e); }
    if (err.code === 11000) { // duplicate key: most likely the same checkout submitted twice at once
      const original = await Order.findOne({ idempotencyKey });
      if (original) return { order: original, duplicate: true }; // two identical requests raced each other
    }
    throw err;
  }
}

// Requests with the same idempotencyKey that arrive while the first one is still running simply wait for it
// (this process only; the unique index in MongoDB remains the real safety net, also across restarts/servers).
const inFlight = new Map();
function createOrder(args) {
  const { idempotencyKey } = args;
  const running = inFlight.get(idempotencyKey);
  if (running) return running.then((r) => ({ order: r.order, duplicate: true }));
  const promise = createOrderOnce(args).finally(() => inFlight.delete(idempotencyKey));
  inFlight.set(idempotencyKey, promise);
  return promise;
}

/** Changes the status if the transition is allowed. Cancelling puts the stock back. */
async function changeStatus(id, next) {
  const allowedFrom = Object.keys(TRANSITIONS).filter((s) => TRANSITIONS[s].includes(next));
  // Atomic: the update only happens if the order is STILL in an allowed status (no race between two admins).
  const before = await Order.findOneAndUpdate({ _id: id, status: { $in: allowedFrom } }, { $set: { status: next } }, { new: false });
  if (!before) {
    const current = await Order.findById(id).select('status');
    if (!current) throw new ApiError(404, 'Order not found.');
    throw new ApiError(409, `An order that is “${current.status}” cannot be changed to “${next}”.`);
  }
  if (next === 'cancelled') {
    try {
      await giveStockBack(before.items.map((i) => ({ product: i.product, quantity: i.quantity })));
    } catch (err) {
      await Order.updateOne({ _id: id, status: 'cancelled' }, { $set: { status: before.status } }); // undo, so the admin can retry
      throw err;
    }
  }
  return Order.findById(id);
}

module.exports = { createOrder, changeStatus, generateOrderNumber, TRANSITIONS, MAX_QTY_PER_PRODUCT };
