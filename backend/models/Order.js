const mongoose = require('mongoose');

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_METHODS = ['cash_on_delivery'];
const PAYMENT_STATUSES = ['unpaid', 'paid'];

// One ordered perfume. name / slug / unitPrice are SNAPSHOTS taken at purchase time,
// so later edits (or deletion) of the product never change an existing order.
const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    slug: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' } },
    unitPrice: { type: Number, required: true, min: 0 }, // DZD, price at the time of purchase
    lineTotal: { type: Number, required: true, min: 0 }, // unitPrice * quantity
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    city: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    address: { type: String, required: true, trim: true, minlength: 5, maxlength: 250 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, immutable: true }, // e.g. VEL-261105-K7P2QX
    // Random key created by the shop for each checkout attempt. The unique index makes a double
    // submit (double click, retry after a timeout) impossible to turn into two orders.
    idempotencyKey: { type: String, required: true, unique: true, immutable: true, },
    customer: { type: customerSchema, required: true },
    items: {
      type: [itemSchema],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: 'An order needs at least one item' },
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash_on_delivery' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.idempotencyKey;
        return ret;
      },
    },
  }
);

orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
