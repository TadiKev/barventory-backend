// scripts/seedProducts.js
import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/Product.js'; // ← adjust path if needed

// 1. Your full product list:
const products = [
  { name: 'grants without glass', sellingPrice: 10.00, costPrice: 2.00, profitPerUnit: 8.00 },
{ name: 'vat 69', sellingPrice: 10.00, costPrice: 2.50, profitPerUnit: 7.50 },
{ name: 'strawberry lips', sellingPrice: 12.00, costPrice: 1.08, profitPerUnit: 10.92 },
{ name: 'magic moments', sellingPrice: 8.00, costPrice: 0.00, profitPerUnit: 8.00 },
{ name: 'jameson', sellingPrice: 20.00, costPrice: 0.00, profitPerUnit: 20.00 },
{ name: 'hasenranche 750mls', sellingPrice: 15.00, costPrice: 4.58, profitPerUnit: 10.42 },
{ name: 'jager 1 litre', sellingPrice: 25.00, costPrice: 3.33, profitPerUnit: 21.67 },
{ name: 'jager 750mls', sellingPrice: 20.00, costPrice: 3.33, profitPerUnit: 16.67 },
{ name: 'JAGER 20ML', sellingPrice: 2.00, costPrice: 0.58, profitPerUnit: 1.42 },
{ name: 'strettons pink', sellingPrice: 10.00, costPrice: 2.50, profitPerUnit: 7.50 },
{ name: 'strettons blue', sellingPrice: 10.00, costPrice: 2.50, profitPerUnit: 7.50 },
{ name: 'amarula og', sellingPrice: 20.00, costPrice: 3.75, profitPerUnit: 16.25 },
{ name: 'southern comfort', sellingPrice: 13.00, costPrice: 3.41, profitPerUnit: 9.59 },
{ name: 'jack daniels', sellingPrice: 20.00, costPrice: 0.00, profitPerUnit: 20.00 },
{ name: 'belgravia gin', sellingPrice: 10.00, costPrice: 0.00, profitPerUnit: 10.00 },
{ name: 'pushkin', sellingPrice: 7.00, costPrice: 2.20, profitPerUnit: 4.80 },
{ name: 'sky vodka', sellingPrice: 20.00, costPrice: 0.00, profitPerUnit: 20.00 },
{ name: 'datex', sellingPrice: 1.00, costPrice: 0.50, profitPerUnit: 0.50 },
{ name: 'imperial', sellingPrice: 7.00, costPrice: 1.58, profitPerUnit: 5.42 },
{ name: 'no.9', sellingPrice: 4.00, costPrice: 0.84, profitPerUnit: 3.16 },
{ name: 'Famous Grouse', sellingPrice: 12.00, costPrice: 2.41, profitPerUnit: 9.59 },
{ name: 'mr dowells', sellingPrice: 10.00, costPrice: 0.00, profitPerUnit: 10.00 },
{ name: '1st Watch', sellingPrice: 13.00, costPrice: 0.00, profitPerUnit: 13.00 }


];

// 2. Main
async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🌱 Connected to MongoDB');

    for (const p of products) {
      const filter = { name: p.name };
      const update = {
        $set: {
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          profitPerUnit: p.profitPerUnit
        }
      };
      await Product.updateOne(filter, update, { upsert: true });
      console.log('✓ Upserted:', p.name);
    }

    console.log('🎉 All products seeded!');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    mongoose.disconnect();
  }
}

seed();
