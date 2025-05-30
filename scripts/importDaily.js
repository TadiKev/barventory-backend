// importDaily.js
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import DailySummary from '../models/DailySummary.js';

dotenv.config();

async function main() {
  // 1) Connect
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log('📦 MongoDB connected');

  const filePath = path.resolve('today.csv');
  const records = [];

  // 2) Parse CSV
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      records.push({
        date:     new Date(),                        // or parse a date column
        barId:    mongoose.Types.ObjectId('REPLACE_BAR_ID_HERE'),
        product:  row.product,
        price:    parseFloat(row.price) || 0,
        opening:  parseInt(row.opening)  || 0,
        inQty:    parseInt(row.in)       || 0,
        outQty:   parseInt(row.out)      || 0,
        closing:  parseInt(row.closing)  || 0,
        salesQty: parseInt(row.salesQty) || 0,
        salesAmt: parseFloat(row.salesAmt)|| 0,
      });
    })
    .on('end', async () => {
      console.log(`Parsed ${records.length} rows`);
      try {
        const inserted = await DailySummary.insertMany(records);
        console.log(`✅ Inserted ${inserted.length} daily-summary docs`);
      } catch (err) {
        console.error('❌ Import error:', err);
      } finally {
        mongoose.disconnect();
      }
    });
}

main().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
