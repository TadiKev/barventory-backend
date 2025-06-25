// controllers/dashboardController.js

import mongoose, { Types } from 'mongoose';
import asyncHandler from 'express-async-handler';

import Bar             from '../models/Bar.js';
import InventoryRecord from '../models/Inventory.js';
import Transaction     from '../models/Transaction.js';
import Product         from '../models/Product.js';

const { ObjectId } = Types;

// GET /api/dashboard?barId=&from=&to=
export const getDashboard = asyncHandler(async (req, res) => {
  const { barId, from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  // ── parse dates ─────────────────────────────────────────────────────
  const start = new Date(from);
  start.setHours(0,0,0,0);
  const end = new Date(to);
  end.setHours(23,59,59,999);

  // ── 1) KPIs ──────────────────────────────────────────────────────────

  // a) totalSKUs
  const invMatch = { date: { $gte: start, $lte: end } };
  if (barId && barId !== 'all') invMatch.bar = new ObjectId(barId);
  const totalSKUs = await InventoryRecord.distinct('product', invMatch).then(arr => arr.length);

  // b) lowStockCount + lowStockList
  const lowStockAgg = await InventoryRecord.aggregate([
    { $match: invMatch },
    { $lookup: {
        from:        Product.collection.name,
        localField:  'product',
        foreignField:'_id',
        as:          'prod'
    }},
    { $unwind: '$prod' },
    { $addFields: {
        onHand: { $ifNull: ['$manualClosing', '$expectedClosing'] }
    }},
    { $match: { $expr: { $lte: ['$onHand', '$prod.lowStockThreshold'] } } },
    { $group: {
        _id:       '$product',
        name:      { $first: '$prod.name' },
        onHand:    { $first: '$onHand' },
        threshold: { $first: '$prod.lowStockThreshold' }
    }}
  ]);

  const lowStockCount = lowStockAgg.length;
  const lowStockList  = lowStockAgg
    .map(r => ({
      productId: r._id,
      name:      r.name,
      onHand:    r.onHand || 0,
      threshold: r.threshold
    }))
    .sort((a,b) => a.onHand - b.onHand);

  // c) avgDailySalesPerItem
  const txFilter = { date: { $gte: start, $lte: end } };
  if (barId && barId !== 'all') txFilter.bar = new ObjectId(barId);
  const txAgg = await Transaction.aggregate([
    { $match: txFilter },
    { $group: { _id: null, totalQty: { $sum: '$quantity' } } }
  ]);
  const totalQty = txAgg[0]?.totalQty || 0;
  const days     = Math.ceil((end - start)/(1000*60*60*24)) + 1;
  const avgDailySalesPerItem = days > 0 ? totalQty / days : 0;

  // d) avgInvValue
  const dayValues = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
    const dayEnd   = new Date(d); dayEnd.setHours(23,59,59,999);

    const recs = await InventoryRecord.find({
      date: { $gte: dayStart, $lte: dayEnd },
      ...(barId && barId !== 'all' && { bar: new ObjectId(barId) })
    }).populate('product','costPrice').lean();

    const dayTotal = recs.reduce((sum,r) => {
      const costPerUnit = r.product?.costPrice || 0;
      const onHand = r.manualClosing != null
        ? r.manualClosing
        : (r.expectedClosing || 0);
      return sum + onHand * costPerUnit;
    }, 0);

    dayValues.push(dayTotal);
  }
  const avgInvValue = dayValues.length
    ? dayValues.reduce((s,v)=>s+v,0) / dayValues.length
    : 0;

  // ── 2) barPerformance (all-bars only) ───────────────────────────────
  let barPerformance = [];
  if (!barId || barId === 'all') {
    const allBars = await Bar.find().lean();
    barPerformance = await Promise.all(
      allBars.map(async b => {
        // now we simply sum the transaction.revenue and transaction.cost fields
        const agg = await Transaction.aggregate([
          { $match: {
              bar:  new ObjectId(b._id),
              date: { $gte: start, $lte: end }
          }},
          { $group: {
              _id:          null,
              totalRevenue: { $sum: '$revenue' },
              totalCost:    { $sum: '$cost' }
          }}
        ]);

        const vals = agg[0] || { totalRevenue: 0, totalCost: 0 };
        return {
          barName:      b.name,
          totalRevenue: vals.totalRevenue,
          totalCost:    vals.totalCost
        };
      })
    );
  }

  // ── 3) topMovers (single-bar only, with fallback) ──────────────────
  let topMovers = [];
  if (barId && barId !== 'all') {
    topMovers = await Transaction.aggregate([
      { $match: txFilter },
      { $group: { _id: '$product', totalQty: { $sum: '$quantity' } } },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
      { $lookup: {
          from:        Product.collection.name,
          localField:  '_id',
          foreignField:'_id',
          as:          'prod'
      }},
      { $unwind: '$prod' },
      { $project: {
          name:     '$prod.name',
          velocity: { $divide: ['$totalQty', days] }
      }}
    ]);

    if (!topMovers.length) {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
      const invRecs = await InventoryRecord.find({
        bar: new ObjectId(barId),
        date: { $gte: todayStart, $lte: todayEnd }
      }).populate('product','name').lean();

      topMovers = invRecs
        .sort((a,b) => (b.salesQty || 0) - (a.salesQty || 0))
        .slice(0,5)
        .map(r => ({
          name:     r.product.name,
          velocity: (r.salesQty || 0) / days
        }));
    }
  }

  // ── 4) inventoryTrend ───────────────────────────────────────────────
  const inventoryTrend = dayValues.map((value,i) => ({
    date:  new Date(start.getTime() + i*24*60*60*1000).toISOString().slice(0,10),
    value
  }));

  // ── final payload ───────────────────────────────────────────────────
  res.json({
    kpis: {
      totalSKUs,
      lowStockCount,
      avgDailySalesPerItem,
      avgInvValue
    },
    barPerformance,
    topMovers,
    inventoryTrend,
    lowStockList
  });
});
