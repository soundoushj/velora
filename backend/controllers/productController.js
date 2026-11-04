const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');
const { config } = require('../config');

const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;
const EDITABLE = ['name', 'brand', 'description', 'price', 'category', 'imageUrl', 'stock', 'gender', 'family', 'familyLabel', 'size', 'bestseller', 'featured', 'smellsLike', 'notes'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bool = (v) => v === true || v === 'true';

// Only whitelisted fields are copied from the request ("mass assignment" protection).
const pick = (source) => EDITABLE.reduce((acc, key) => (source[key] !== undefined ? { ...acc, [key]: source[key] } : acc), {});

const slugify = (text) =>
  text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const SORTS = {
  featured: { sortOrder: 1, _id: 1 }, // original Velora catalogue order
  'price-asc': { price: 1, sortOrder: 1 },
  'price-desc': { price: -1, sortOrder: 1 },
  name: { name: 1 },
  newest: { createdAt: -1 },
  'stock-asc': { stock: 1, name: 1 },
  'stock-desc': { stock: -1, name: 1 },
};

// GET /api/products   (public)
exports.list = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = {};
  if (q.search && q.search.trim()) {
    const rx = new RegExp(escapeRegex(q.search.trim()), 'i'); // escaped => user input can't inject a pattern
    filter.$or = [{ name: rx }, { brand: rx }, { description: rx }, { familyLabel: rx }, { smellsLike: rx }];
  }
  if (q.gender) filter.gender = q.gender;
  if (q.family) filter.family = q.family;
  if (q.category) filter.category = q.category;
  if (q.bestseller !== undefined) filter.bestseller = bool(q.bestseller);
  if (q.featured !== undefined) filter.featured = bool(q.featured);
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = Number(q.minPrice);
    if (q.maxPrice !== undefined) filter.price.$lte = Number(q.maxPrice);
  }
  if (bool(q.inStock)) filter.stock = { $gt: 0 };
  if (q.stockLevel === 'out') filter.stock = 0;
  if (q.stockLevel === 'low') filter.stock = { $gt: 0, $lte: config.lowStockThreshold };
  if (q.stockLevel === 'in') filter.stock = { $gt: config.lowStockThreshold };

  const page = parseInt(q.page, 10) || 1;
  const limit = parseInt(q.limit, 10) || 20;
  const [data, total] = await Promise.all([
    Product.find(filter).sort(SORTS[q.sort] || SORTS.featured).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, pages: Math.max(1, Math.ceil(total / limit)), count: data.length, data });
});

// GET /api/products/:id   (public)  -- :id is a MongoDB id OR the original Velora slug
exports.getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = MONGO_ID_REGEX.test(id) ? await Product.findById(id) : await Product.findOne({ slug: id });
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ success: true, data: product });
});

// POST /api/products   (admin)
exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body);
  const slug = req.body.slug || slugify(`${data.brand || 'velora'} ${data.name}`);
  if (!slug) throw new ApiError(400, 'Could not create a product slug from the name.');
  if (await Product.exists({ slug })) throw new ApiError(409, 'A product with this name/slug already exists.');

  const last = await Product.findOne().sort({ sortOrder: -1 }).select('sortOrder');
  const product = await Product.create({
    ...data,
    slug,
    imageUrl: data.imageUrl !== undefined ? data.imageUrl : `/assets/perfumes/${slug}.jpg`,
    sortOrder: (last ? last.sortOrder : 0) + 1,
  });
  res.status(201).json({ success: true, message: 'Product created.', data: product });
});

// PUT /api/products/:id   (admin)  -- send the fields you want to change
exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found.');
  product.set(pick(req.body));
  await product.save(); // runs the schema validators again
  res.json({ success: true, message: 'Product updated.', data: product });
});

// PATCH /api/products/:id/stock   (admin)
exports.updateStock = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { stock: req.body.stock }, { new: true, runValidators: true });
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ success: true, message: 'Stock updated.', data: product });
});

// DELETE /api/products/:id   (admin)
exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ success: true, message: 'Product deleted.', data: { _id: product._id, slug: product.slug } });
});
