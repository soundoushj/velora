const { body, param, query } = require('express-validator');
const { GENDERS, FAMILIES } = require('../models/Product');

// ---------- helpers ----------
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;
const noHtml = (v) => !/[<>]/.test(v);

// express-validator's isString() guarantees a value is really a string (not an object/array),
// which is what stops operator-injection payloads such as {"$ne": null}.
const text = (field, { min = 1, max = 200, label = field } = {}) =>
  body(field)
    .isString().withMessage(`${label} must be text.`).bail()
    .trim()
    .isLength({ min, max }).withMessage(`${label} must be between ${min} and ${max} characters.`)
    .custom(noHtml).withMessage(`${label} must not contain < or >.`);

const optionalIf = (chain, optional) => (optional ? chain.optional({ values: 'undefined' }) : chain);

const loginRules = [
  body('email').isString().withMessage('Email is required.').bail().trim().toLowerCase().isEmail().withMessage('Email is not valid.'),
  body('password').isString().withMessage('Password is required.').bail().isLength({ min: 1, max: 128 }).withMessage('Password is required.'),
];


// ---------- products ----------
const imageUrlCheck = (v) => {
  if (v === '') return true;
  // relative path on the shop ("/assets/perfumes/x.jpg") or an https/http URL. Blocks javascript:, data: etc.
  if (/^\/(?!\/)[\w\-./%]+$/.test(v)) return true;
  if (/^https?:\/\/[^\s<>"']+$/i.test(v)) return true;
  throw new Error('Image URL must be a path starting with "/" or an http(s) URL.');
};

const notesCheck = (v) => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('Notes must be an object with top, heart and base lists.');
  for (const key of Object.keys(v)) {
    if (!['top', 'heart', 'base'].includes(key)) throw new Error(`Unknown notes field "${key}".`);
    const list = v[key];
    if (!Array.isArray(list) || list.length > 20 || list.some((n) => typeof n !== 'string' || n.length > 60 || !noHtml(n))) {
      throw new Error(`Notes "${key}" must be a list of up to 20 short texts.`);
    }
  }
  return true;
};

/** @param {boolean} partial  true for updates (every field optional) */
const productRules = (partial) => [
  optionalIf(text('name', { min: 2, max: 120, label: 'Name' }), partial),
  optionalIf(text('description', { min: 10, max: 2000, label: 'Description' }), partial),
  optionalIf(text('category', { min: 2, max: 60, label: 'Category' }), partial),
  body('brand').optional().isString().bail().trim().isLength({ min: 1, max: 80 }).custom(noHtml).withMessage('Brand is not valid.'),
  optionalIf(body('price').isFloat({ min: 0, max: 10000000 }).withMessage('Price must be a number between 0 and 10,000,000.').toFloat(), partial),
  body('stock').optional().isInt({ min: 0, max: 100000 }).withMessage('Stock must be a whole number between 0 and 100,000.').toInt(),
  optionalIf(body('gender').isIn(GENDERS).withMessage(`Gender must be one of: ${GENDERS.join(', ')}.`), partial),
  optionalIf(body('family').isIn(FAMILIES).withMessage(`Fragrance family must be one of: ${FAMILIES.join(', ')}.`), partial),
  body('familyLabel').optional().isString().bail().trim().isLength({ max: 80 }).custom(noHtml),
  body('size').optional().isString().bail().trim().isLength({ min: 1, max: 20 }).custom(noHtml),
  body('smellsLike').optional().isString().bail().trim().isLength({ max: 300 }).custom(noHtml),
  body('imageUrl').optional().isString().withMessage('Image URL must be text.').bail().trim().custom(imageUrlCheck),
  body('bestseller').optional().isBoolean().withMessage('bestseller must be true or false.').toBoolean(),
  body('featured').optional().isBoolean().withMessage('featured must be true or false.').toBoolean(),
  body('notes').optional().custom(notesCheck),
  // slug can only be chosen when CREATING a product (changing it later would break links and favourites)
  ...(partial ? [] : [body('slug').optional().isString().bail().trim().toLowerCase().matches(SLUG_REGEX).withMessage('Slug may only contain lowercase letters, numbers and hyphens.')]),
];

const stockRules = [body('stock').exists().withMessage('Stock is required.').bail().isInt({ min: 0, max: 100000 }).withMessage('Stock must be a whole number between 0 and 100,000.').toInt()];

const mongoIdParam = [param('id').custom((v) => MONGO_ID_REGEX.test(v)).withMessage('Invalid product id.')];
// Public GET accepts either a MongoDB id or the original Velora slug ("dior-sauvage").
const idOrSlugParam = [param('id').custom((v) => MONGO_ID_REGEX.test(v) || SLUG_REGEX.test(v)).withMessage('Invalid product id.')];

const productListRules = [
  query('search').optional().isString().withMessage('search must be text.').bail().isLength({ max: 100 }),
  query('gender').optional().isIn(GENDERS).withMessage('Invalid gender.'),
  query('family').optional().isIn(FAMILIES).withMessage('Invalid family.'),
  query('category').optional().isString().bail().isLength({ max: 60 }),
  query('bestseller').optional().isBoolean().withMessage('bestseller must be true or false.'),
  query('featured').optional().isBoolean().withMessage('featured must be true or false.'),
  query('inStock').optional().isBoolean().withMessage('inStock must be true or false.'),
  query('stockLevel').optional().isIn(['out', 'low', 'in']).withMessage('Invalid stockLevel.'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a number.'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a number.'),
  query('sort').optional().isIn(['featured', 'price-asc', 'price-desc', 'name', 'newest', 'stock-asc', 'stock-desc']).withMessage('Invalid sort.'),
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100.'),
];

const customerListRules = [
  query('search').optional().isString().withMessage('search must be text.').bail().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

module.exports = {
  loginRules,
  createProductRules: productRules(false), updateProductRules: productRules(true),
  stockRules, mongoIdParam, idOrSlugParam, productListRules, customerListRules,
};
