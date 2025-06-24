import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';

import Bar               from '../models/Bar.js';
import InventoryRecord   from '../models/Inventory.js';
import Transaction       from '../models/Transaction.js';
import Product           from '../models/Product.js';
import Expense           from '../models/Expense.js';

const { Types } = mongoose;

// GET /api/dashboard?barId=&from=&to=
export const getDashboard = asyncHandler(async (req, res) => {
  const { barId, from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  // parse dates
  const start = new Date(from);
  start.setHours(0,0,0,0);
  const end = new Date(to);
  end.setHours(23,59,59,999);

  // Transaction filter
  const txFilter = { date: { $gte: start, $lte: end } };
  if (barId && barId !== 'all') {
    if (!Types.ObjectId.isValid(barId)) {
      return res.status(400).json({ error: 'barId must be ObjectId or "all"' });
    }
    txFilter.bar = new Types.ObjectId(barId);
  }

  // 1) KPIs
  // a) totalSKUs
  const invMatch = { date: { $gte: start, $lte: end } };
  if (barId && barId !== 'all') invMatch.bar = new Types.ObjectId(barId);
  const totalSKUs = await InventoryRecord.distinct('product', invMatch).then(a => a.length);

  // b) lowStockCount
  const lowStockCount = await InventoryRecord.aggregate([
    { $match: invMatch },
    { $lookup: {
        from: Product.collection.name,
        localField: 'product',
        foreignField: '_id',
        as: 'prod'
    }},
    { $unwind: '$prod' },
    { $match: { $expr: { $lte: ['$closing', '$prod.lowStockThreshold'] } }},
    { $group: { _id: '$product' } },
    { $count: 'cnt' }
  ]).then(a => a[0]?.cnt || 0);

  // c) avgDailySalesPerItem
  const txAgg = await Transaction.aggregate([
    { $match: txFilter },
    { $group: { _id: null, totalQty: { $sum: '$quantity' } } }
  ]);
  const totalQty = txAgg[0]?.totalQty || 0;
  const days = Math.ceil((end - start)/(1000*60*60*24)) + 1;
  const avgDailySalesPerItem = days > 0 ? totalQty/days : 0;

  // d) avgInvValue
  const dayValues = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
    const dayEnd   = new Date(d); dayEnd.setHours(23,59,59,999);
    const recs = await InventoryRecord.find({
      date: { $gte: dayStart, $lte: dayEnd },
      ...(barId && barId !== 'all' && { bar: new Types.ObjectId(barId) })
    }).populate('product','costPrice').lean();

    const dayTotal = recs.reduce((sum,r) => {
      const cost = r.product?.costPrice || 0;
      return sum + (r.closing||0)*cost;
    }, 0);
    dayValues.push(dayTotal);
  }
  const avgInvValue = dayValues.length
    ? dayValues.reduce((s,v)=>s+v,0)/dayValues.length
    : 0;

  // 2) barPerformance (all-bars only)
  let barPerformance = [];
  if (!barId || barId === 'all') {
    const allBars = await Bar.find().lean();
    barPerformance = await Promise.all(allBars.map(async b => {
      const a = await Transaction.aggregate([
        { $match: {
            date: { $gte: start, $lte: end },
            bar: new Types.ObjectId(b._id)
        }},
        { $group: {
            _id: null,
            totalRevenue: { $sum: '$revenue' },
            totalCost:    { $sum: '$cost' }
        }}
      ]);
      const vals = a[0] || { totalRevenue: 0, totalCost: 0 };
      return {
        barName:      b.name,
        totalRevenue: vals.totalRevenue,
        totalCost:    vals.totalCost
      };
    }));
  }

  // 3) topMovers (single-bar only)
  let topMovers = [];
  if (barId && barId !== 'all') {
    topMovers = await Transaction.aggregate([
      { $match: txFilter },
      { $group: { _id: '$product', totalQty: { $sum: '$quantity' } } },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
      { $lookup: {
          from: Product.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'prod'
      }},
      { $unwind: '$prod' },
      { $project: {
          name:     '$prod.name',
          velocity: { $divide: ['$totalQty', days] }
      }}
    ]);
  }

  // 4) inventoryTrend
  const inventoryTrend = dayValues.map((value,i) => ({
    date: new Date(start).toISOString().slice(0,10),
    value
  }));

  res.json({
    kpis: { totalSKUs, lowStockCount, avgDailySalesPerItem, avgInvValue },
    barPerformance,
    topMovers,
    inventoryTrend
  });
});
