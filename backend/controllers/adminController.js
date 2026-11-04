const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Product = require('../models/Product');
const { config } = require('../config');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/stats
exports.stats = asyncHandler(async (_req, res) => {
  const low = config.lowStockThreshold;
  const [totalProducts, totalUsers, admins, byGender, byFamily, inv, outOfStock, lowStock, lowStockItems] = await Promise.all([
    Product.countDocuments(),
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
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
      totalUsers,
      customers: totalUsers - admins,
      admins,
      inventory: { totalUnits, inventoryValue, outOfStock, lowStock, lowStockThreshold: low, lowStockItems },
      byGender: toMap(byGender),
      byFamily: toMap(byFamily),
    },
  });
});

// GET /api/admin/users   (password hashes are never selected, and are stripped from JSON anyway)
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, pages: Math.max(1, Math.ceil(total / limit)), count: data.length, data });
});
