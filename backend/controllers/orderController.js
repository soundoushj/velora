const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Order = require('../models/Order');
const orderService = require('../services/orderService');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What the customer gets back: enough for a confirmation screen, nothing more.
const publicView = (o) => ({
  orderNumber: o.orderNumber,
  status: o.status,
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  customer: { fullName: o.customer.fullName, city: o.customer.city },
  items: o.items.map((i) => ({ slug: i.slug, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
  subtotal: o.subtotal,
  deliveryFee: o.deliveryFee,
  total: o.total,
  createdAt: o.createdAt,
});

// POST /api/orders   (public)
// Only whitelisted fields are read from the body: a "total", "unitPrice" or "status" sent by the
// browser is simply ignored. Prices are always recalculated from the database.
exports.create = asyncHandler(async (req, res) => {
  const { customer, items, idempotencyKey } = req.body;
  const { order, duplicate } = await orderService.createOrder({
    customer: { fullName: customer.fullName, phone: customer.phone, city: customer.city, address: customer.address },
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    idempotencyKey,
  });
  res.status(duplicate ? 200 : 201).json({
    success: true,
    message: duplicate ? 'This order was already received.' : 'Order placed.',
    duplicate,
    data: publicView(order),
  });
});

// GET /api/orders   (admin)
exports.list = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = {};
  if (q.status) filter.status = q.status;
  const term = (q.search || '').trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const or = [{ orderNumber: rx }, { 'customer.fullName': rx }, { 'customer.city': rx }, { 'customer.phone': rx }];
    const compact = term.replace(/[\s().-]/g, ''); // "0550 12 34 56" also finds "0550123456"
    if (compact && compact !== term) or.push({ 'customer.phone': new RegExp(escapeRegex(compact), 'i') });
    filter.$or = or;
  }
  const page = parseInt(q.page, 10) || 1;
  const limit = parseInt(q.limit, 10) || 20;
  const [data, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, pages: Math.max(1, Math.ceil(total / limit)), count: data.length, data });
});

// GET /api/orders/:id   (admin)
exports.getOne = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  res.json({ success: true, data: order });
});

// PATCH /api/orders/:id/status   (admin)
exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await orderService.changeStatus(req.params.id, req.body.status);
  res.json({ success: true, message: `Order is now ${order.status}.`, data: order });
});
