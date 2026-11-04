// =====================================================================
// Populates MongoDB with the existing Velora perfume catalogue (backend/data/catalogue.json).
// The catalogue was extracted from the original React file (src/data/products.js), so every
// product keeps its original id (stored as "slug"), name, notes, price and image name.
//
//   npm run seed          -> adds the products that are missing (safe to run many times,
//                            never overwrites edits you made in the admin dashboard)
//   npm run seed:reset    -> DELETES all products first, then re-imports the original catalogue
//
// =====================================================
// USER ACTION REQUIRED
// TODO: MAKE SURE backend/.env CONTAINS YOUR MONGODB_URI BEFORE RUNNING THIS SCRIPT.
// TODO: NO DATASET TO DOWNLOAD - THE CATALOGUE IS ALREADY IN backend/data/catalogue.json.
// =====================================================
const mongoose = require('mongoose');
const catalogue = require('../data/catalogue.json');
const { config } = require('../config');
const { connectDB } = require('../config/db');
const Product = require('../models/Product');

// "Stock" did not exist in the original shop, so every perfume starts with the same quantity.
// Change it in the admin dashboard afterwards (or run: DEFAULT_STOCK=40 npm run seed).
const DEFAULT_STOCK = parseInt(process.env.DEFAULT_STOCK, 10) || 25;

async function main() {
  if (!config.mongoUri) throw new Error('MONGODB_URI is missing. Copy .env.example to .env and fill it in.');
  await connectDB();

  if (process.argv.includes('--reset')) {
    const { deletedCount } = await Product.deleteMany({});
    console.log(`Removed ${deletedCount} existing product(s).`);
  }

  const ops = catalogue.map((p, index) => ({
    updateOne: {
      filter: { slug: p.id },
      update: {
        $setOnInsert: {
          slug: p.id,
          name: p.name,
          brand: p.brand,
          description: p.description,
          price: p.price,
          category: p.type,
          imageUrl: `/assets/perfumes/${p.id}.jpg`,
          stock: DEFAULT_STOCK,
          gender: p.gender,
          family: p.family,
          familyLabel: p.familyLabel,
          size: p.size,
          bestseller: Boolean(p.bestseller),
          featured: Boolean(p.featured),
          smellsLike: p.smellsLike,
          notes: p.notes,
          sortOrder: index + 1,
        },
      },
      upsert: true,
    },
  }));

  const result = await Product.bulkWrite(ops);
  const total = await Product.countDocuments();
  console.log(`Catalogue processed: ${result.upsertedCount} added, ${catalogue.length - result.upsertedCount} already present.`);
  console.log(`Products in database: ${total}`);
}

main()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
