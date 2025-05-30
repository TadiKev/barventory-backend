// scripts/backfillCostPrice.js
import 'dotenv/config';  // Auto‐loads .env into process.env
import mongoose         from 'mongoose';
import path             from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Adjust paths to your models
import InventoryRecord from '../models/Inventory.js';
import Product         from '../models/Product.js';

async function main() {
  // 1️⃣ Connect
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/your_db_name';
  console.log('🔌 Connecting to', uri);
  await mongoose.connect(uri, {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
  });

  // 2️⃣ Backfill loop
  console.log('🔄 Backfilling costPrice on inventory records...');
  let count = 0;
  for await (const rec of InventoryRecord.find().cursor()) {
    const prod = await Product.findById(rec.product);
    if (prod && typeof prod.costPrice === 'number') {
      rec.costPrice = prod.costPrice;
      await rec.save();
      count++;
    }
  }

  console.log(`✅ Backfilled costPrice on ${count} records`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected and exiting');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
