// scripts/seedProducts.js
import 'dotenv/config';                   // Load MONGO_URI from .env
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname workaround in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import your Product model
import Product from '../models/Product.js';

async function main() {
  // Connect to MongoDB
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI not defined in .env');
    process.exit(1);
  }
  console.log('🔌 Connecting to', uri);
  await mongoose.connect(uri);

  // Define products to seed (continued group)
  const products = [
    

    // New group to add:
    { name: '2 keys 750',         category: 'spirits', costPrice: 6.00, sellingPrice: 7.50, lowStockThreshold: 5 },
    { name: '2 KEYS HONEY',       category: 'spirits', costPrice: 6.00, sellingPrice: 7.50, lowStockThreshold: 5 },
    { name: '2 keys 200mls',      category: 'spirits', costPrice: 1.50, sellingPrice: 2.00, lowStockThreshold: 10 },
    { name: 'best cream',         category: 'spirits', costPrice: 11.00, sellingPrice: 12.00, lowStockThreshold: 5 },
    { name: 'wild africa',        category: 'spirits', costPrice: 10.00, sellingPrice: 11.00, lowStockThreshold: 5 },
    { name: 'grants with glasses',category: 'spirits', costPrice: 12.00, sellingPrice: 13.00, lowStockThreshold: 5 },
    { name: 'grants without glass',category: 'spirits', costPrice: 10.00, sellingPrice: 11.00, lowStockThreshold: 5 },
    { name: 'vat 69',             category: 'spirits', costPrice: 10.00, sellingPrice: 11.00, lowStockThreshold: 5 },
    { name: 'strawberry lips',    category: 'spirits', costPrice: 12.00, sellingPrice: 13.00, lowStockThreshold: 5 },
    { name: 'magic moments',      category: 'spirits', costPrice: 8.00, sellingPrice: 9.00, lowStockThreshold: 5 },
    { name: 'jameson',            category: 'spirits', costPrice: 20.00, sellingPrice: 22.00, lowStockThreshold: 3 },
    { name: 'hasenranche 750mls', category: 'spirits', costPrice: 15.00, sellingPrice: 16.50, lowStockThreshold: 5 },
    { name: 'jager 1 litre',      category: 'spirits', costPrice: 25.00, sellingPrice: 27.50, lowStockThreshold: 3 },
    { name: 'jager 750mls',       category: 'spirits', costPrice: 20.00, sellingPrice: 22.00, lowStockThreshold: 3 },
    { name: 'JAGER 20ML',         category: 'spirits', costPrice: 2.00, sellingPrice: 2.50, lowStockThreshold: 10 },
    { name: 'strettons pink',     category: 'spirits', costPrice: 10.00, sellingPrice: 11.00, lowStockThreshold: 5 },
    { name: 'strettons blue',     category: 'spirits', costPrice: 10.00, sellingPrice: 11.00, lowStockThreshold: 5 },
    { name: 'amarula og',         category: 'spirits', costPrice: 15.00, sellingPrice: 16.50, lowStockThreshold: 5 },
    { name: 'southern comfort',   category: 'spirits', costPrice: 13.00, sellingPrice: 14.50, lowStockThreshold: 5 },
    { name: 'jack daniels',       category: 'spirits', costPrice: 20.00, sellingPrice: 22.00, lowStockThreshold: 3 },
    { name: 'belgravia gin',      category: 'spirits', costPrice: 10.00, sellingPrice: 11.00, lowStockThreshold: 5 },
    { name: 'pushkin',            category: 'spirits', costPrice: 7.00, sellingPrice: 8.00, lowStockThreshold: 5 },
    { name: 'sky vodka',          category: 'spirits', costPrice: 20.00, sellingPrice: 22.00, lowStockThreshold: 3 },
    { name: 'datex',              category: 'spirits', costPrice: 1.00, sellingPrice: 1.50, lowStockThreshold: 10 },
    { name: 'imperial',           category: 'spirits', costPrice: 7.00, sellingPrice: 8.00, lowStockThreshold: 5 },
    { name: 'no.9',               category: 'spirits', costPrice: 4.00, sellingPrice: 5.00, lowStockThreshold: 5 },
    { name: 'Famous Grouse',      category: 'spirits', costPrice: 12.00, sellingPrice: 13.00, lowStockThreshold: 5 },
    { name: 'mr dowells',         category: 'spirits', costPrice: 10.00, sellingPrice: 11.00, lowStockThreshold: 5 },
    { name: '1st Watch',          category: 'spirits', costPrice: 13.00, sellingPrice: 14.00, lowStockThreshold: 5 },
  ];

  console.log(`🛠️  Inserting ${products.length} products…`);
  await Product.insertMany(products);
  console.log('✅ Products seeded successfully');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from DB');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
