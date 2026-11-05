const asyncHandler = require('../utils/asyncHandler');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { config } = require('../config');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/stats
exports.stats = asyncHandler(async (_req, res) => {
  const low = config.lowStockThreshold;
  const [totalProducts, customerPhones, byGender, byFamily, inv, outOfStock, lowStock, lowStockItems] = await Promise.all([
    Product.countDocuments(),
    Order.distinct('customer.phone'), // a customer is identified by phone number
    Product.aggregate([{ $group: { _id: '$gender', count: { $sum: 1 } } }]),
    Product.aggregate([{ $group: { _id: '$family', count: { $sum: 1 } } }]),
    Product.find().select('stock price'), // small catalogue: summing in JS keeps this simple and portable
    Product.countDocuments({ stock: 0 }),
    Product.countDocuments({ stock: { $gt: 0, $lte: low } }),
    Product.find({ stock: { $lte: low } }).sort({ stock: 1, name: 1 }).limit(8).select('name brand slug stock imageUrl'),
  ]);
  const totalUnits = inv.reduce((sum, p) => sum + p.stock, 0);
  const inventoryValue = inv.reduce((sum, p) => sum + p.stock * p.price, 0);
  const toMap = (rows) => rows.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});

  res.json({
    success: true,
    data: {
      totalProducts,
      totalCustomers: customerPhones.length,
      inventory: { totalUnits, inventoryValue, outOfStock, lowStock, lowStockThreshold: low, lowStockItems },
      byGender: toMap(byGender),
      byFamily: toMap(byFamily),
    },
  });
});

// GET /api/admin/customers
// Velora has no customer accounts: customers are guests, so this list is built from the orders.
// Orders are grouped by phone number (already normalised when the order is saved). The name, city and
// address shown are the ones from the customer's most recent order.
exports.listCustomers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const after = {};
  const term = (req.query.search || '').trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const or = [{ fullName: rx }, { city: rx }, { _id: rx }];
    const compact = term.replace(/[\s().-]/g, ''); // "0550 12 34 56" also finds "0550123456"
    if (compact && compact !== term) or.push({ _id: new RegExp(escapeRegex(compact), 'i') });
    after.$or = or;
  }

  const [out] = await Order.aggregate([
    { $sort: { createdAt: -1, _id: -1 } }, // newest first, so $first below means "most recent order"
    {
      $group: {
        _id: '$customer.phone',
        fullName: { $first: '$customer.fullName' },
        city: { $first: '$customer.city' },
        address: { $first: '$customer.address' },
        ordersCount: { $sum: 1 },
        totalSpent: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, '$total'] } },
        lastOrderAt: { $first: '$createdAt' },
      },
    },
    { $match: after },
    { $sort: { lastOrderAt: -1, _id: 1 } },
    { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'n' }] } },
  ]);

  const total = out.count.length ? out.count[0].n : 0;
  const data = out.rows.map(({ _id, ...rest }) => ({ phone: _id, ...rest }));
  res.json({ success: true, total, page, pages: Math.max(1, Math.ceil(total / limit)), count: data.length, data });
});