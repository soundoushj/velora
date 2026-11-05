const { body, param, query } = require('express-validator');
const { ORDER_STATUSES } = require('../models/Order');

const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_REGEX = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_QTY = 10;
const noHtml = (v) => !/[<>]/.test(v);
const noControl = (v) => !/[\u0000-\u001f\u007f]/.test(v);
const hasLetter = (v) => /\p{L}/u.test(v);

/** "+213 550 12 34 56", "00213550123456" and "0550 12 34 56" all become "0550123456". */
function normalizePhone(raw) {
  let p = String(raw).replace(/[\s().-]/g, '');
  if (p.startsWith('00213')) p = `+213${p.slice(5)}`;
  if (p.startsWith('+213')) p = `0${p.slice(4)}`;
  return p;
}
// Algerian mobile (05/06/07 + 8 digits) or landline (02/03/04 + 7 digits), or any international +number.
const phoneOk = (p) => /^0(?:[567]\d{8}|[234]\d{7})$/.test(p) || /^\+[1-9]\d{7,14}$/.test(p);

// isString() blocks arrays/objects (operator-injection payloads), same approach as validators.js
const text = (field, { min, max, label, letters = false }) => {
  let chain = body(field)
    .isString().withMessage(`${label} must be text.`).bail()
    .trim()
    .isLength({ min, max }).withMessage(`${label} must be between ${min} and ${max} characters.`).bail()
    .custom(noHtml).withMessage(`${label} must not contain < or >.`)
    .custom(noControl).withMessage(`${label} contains invalid characters.`);
  if (letters) chain = chain.custom(hasLetter).withMessage(`${label} must contain letters.`);
  return chain;
};

const createOrderRules = [
  body('customer').isObject().withMessage('Customer details are required.'),
  text('customer.fullName', { min: 2, max: 80, label: 'Full name', letters: true }),
  body('customer.phone')
    .isString().withMessage('Phone number must be text.').bail()
    .customSanitizer(normalizePhone)
    .custom(phoneOk).withMessage('Enter a valid phone number, for example 0550 12 34 56.'),
  text('customer.city', { min: 2, max: 60, label: 'City', letters: true }),
  text('customer.address', { min: 5, max: 250, label: 'Delivery address' }),
  body('items').isArray({ min: 1, max: 20 }).withMessage('Your bag must contain between 1 and 20 different perfumes.'),
  body('items.*.productId')
    .isString().withMessage('Product id must be text.').bail()
    .trim().toLowerCase()
    .custom((v) => MONGO_ID_REGEX.test(v) || (v.length <= 120 && SLUG_REGEX.test(v))).withMessage('Invalid product id.'),
  body('items.*.quantity')
    .custom((v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_QTY)
    .withMessage(`Quantity must be a whole number between 1 and ${MAX_QTY}.`),
  body('idempotencyKey').isString().withMessage('idempotencyKey is required.').bail().trim().matches(KEY_REGEX).withMessage('idempotencyKey is invalid.'),
];

const orderIdParam = [param('id').custom((v) => MONGO_ID_REGEX.test(v)).withMessage('Invalid order id.')];

const orderStatusRules = [
  body('status').isString().withMessage('Status is required.').bail().isIn(ORDER_STATUSES).withMessage(`Status must be one of: ${ORDER_STATUSES.join(', ')}.`),
];

const orderListRules = [
  query('search').optional().isString().withMessage('search must be text.').bail().isLength({ max: 100 }),
  query('status').optional().isIn(ORDER_STATUSES).withMessage('Invalid status.'),
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100.'),
];

module.exports = { createOrderRules, orderIdParam, orderStatusRules, orderListRules, normalizePhone };
