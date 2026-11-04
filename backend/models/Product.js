const mongoose = require('mongoose');

const GENDERS = ['Her', 'Him', 'Unisex'];
const FAMILIES = ['Floral', 'Woody', 'Oriental', 'Fresh', 'Citrus', 'Gourmand', 'Musky'];

const notesSchema = new mongoose.Schema(
  { top: [String], heart: [String], base: [String] },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // `slug` is the ORIGINAL Velora product id (e.g. "dior-sauvage"). It keeps old links,
    // favourites and image file names working. MongoDB's own _id is used by the admin API.
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 120 },
    brand: { type: String, trim: true, maxlength: 80, default: 'Velora' },
    description: { type: String, required: [true, 'Description is required'], trim: true, minlength: 10, maxlength: 2000 },
    price: { type: Number, required: [true, 'Price is required'], min: 0, max: 10000000 }, // DZD
    category: { type: String, required: [true, 'Category is required'], trim: true, maxlength: 60 }, // e.g. "Eau de parfum"
    imageUrl: { type: String, trim: true, maxlength: 500, default: '' },
    stock: { type: Number, required: true, min: 0, max: 100000, default: 0, validate: { validator: Number.isInteger, message: 'Stock must be a whole number' } },
    gender: { type: String, required: true, enum: GENDERS },
    family: { type: String, required: true, enum: FAMILIES }, // fragrance family
    familyLabel: { type: String, trim: true, maxlength: 80 },
    size: { type: String, trim: true, maxlength: 20, default: '100 ml' },
    bestseller: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    smellsLike: { type: String, trim: true, maxlength: 300, default: '' },
    notes: { type: notesSchema, default: () => ({ top: [], heart: [], base: [] }) },
    sortOrder: { type: Number, default: 0, index: true }, // keeps the original catalogue order
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

productSchema.index({ gender: 1, family: 1 });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
module.exports.GENDERS = GENDERS;
module.exports.FAMILIES = FAMILIES;
