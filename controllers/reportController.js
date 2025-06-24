// src/controllers/reportController.js

import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import InventoryRecord from '../models/Inventory.js';
import Expense         from '../models/Expense.js';
import Transaction     from '../models/Transaction.js';  // ensure this is imported
import Bar             from '../models/Bar.js';

/**
 * GET /api/reports/income-statement?barId=&from=&to=
 */
export const getIncomeStatement = asyncHandler(async (req, res) => {
  const { barId = 'all', from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  let barObjId = null;
  if (barId !== 'all') {
    if (!mongoose.Types.ObjectId.isValid(barId)) {
      return res
        .status(400)
        .json({ error: 'barId must be "all" or a valid 24-character hex string' });
    }
    barObjId = new mongoose.Types.ObjectId(barId);
  }

  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const barFilter = barObjId ? { bar: barObjId } : {};

  // Opening stock: last record before start
  const [lastBefore] = await InventoryRecord.find({
    ...barFilter,
    date: { $lt: start }
  })
    .populate('product')
    .sort('-date')
    .limit(1)
    .lean();

  const openingStock = lastBefore && lastBefore.product
    ? lastBefore.closing * (lastBefore.product.costPrice || 0)
    : 0;

  // Period inventory records
  let periodRecs = await InventoryRecord.find({
    ...barFilter,
    date: { $gte: start, $lte: end }
  })
    .populate('product')
    .lean();

  // Filter out any with missing product
  periodRecs = periodRecs.filter(r => r.product);

  // Inject derived sales if original are zero
  periodRecs = periodRecs.map(r => {
    const opening       = r.opening        || 0;
    const received      = r.receivedQty    || 0;
    const transferIn    = r.transferInQty  || 0;
    const transferOut   = r.transferOutQty || 0;
    const actualClosing = (r.manualClosing != null)
      ? r.manualClosing
      : r.closing || 0;

    const derivedSalesQty = opening + received + transferIn - transferOut - actualClosing;
    const derivedSalesAmt = derivedSalesQty * (r.product.sellingPrice || 0);

    return {
      ...r,
      salesQty: r.salesQty > 0 ? r.salesQty : derivedSalesQty,
      salesAmt: r.salesAmt > 0 ? r.salesAmt : derivedSalesAmt
    };
  });

  const purchases = periodRecs.reduce(
    (sum, r) => sum + (r.receivedQty || 0) * (r.product.costPrice || 0),
    0
  );

  // Closing stock: last record on or before end
  const [lastOnOrBefore] = await InventoryRecord.find({
    ...barFilter,
    date: { $lte: end }
  })
    .populate('product')
    .sort('-date')
    .limit(1)
    .lean();

  const closingStock = lastOnOrBefore && lastOnOrBefore.product
    ? lastOnOrBefore.closing * (lastOnOrBefore.product.costPrice || 0)
    : 0;

  const revenue = periodRecs.reduce((sum, r) => sum + (r.salesAmt || 0), 0);
  const cogs    = periodRecs.reduce(
    (sum, r) => sum + (r.salesQty || 0) * (r.product.costPrice || 0),
    0
  );

  const exps = await Expense.find({
    ...barFilter,
    date: { $gte: start, $lte: end }
  }).lean();
  const expenses = exps.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Breakdown by product
  const byProductMap = new Map();
  periodRecs.forEach(r => {
    const pid = r.product._id.toString();
    if (!byProductMap.has(pid)) {
      byProductMap.set(pid, {
        productId:   pid,
        productName: r.product.name,
        salesQty:    0,
        salesAmt:    0,
        profit:      0
      });
    }
    const agg = byProductMap.get(pid);
    agg.salesQty += r.salesQty;
    agg.salesAmt += r.salesAmt;
    agg.profit   += r.salesAmt - (r.salesQty * (r.product.costPrice || 0));
  });
  const byProduct = Array.from(byProductMap.values());

  // Daily trend
  const pad = n => String(n).padStart(2, '0');
  const salesByDay = {};
  periodRecs.forEach(r => {
    const d   = new Date(r.date);
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    if (!salesByDay[key]) salesByDay[key] = { revenue: 0, cogs: 0 };
    salesByDay[key].revenue += r.salesAmt;
    salesByDay[key].cogs    += (r.salesQty || 0) * (r.product.costPrice || 0);
  });

  const dailyTrend = [];
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate()+1)) {
    const key = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
    dailyTrend.push({
      date:    key,
      revenue: salesByDay[key]?.revenue || 0,
      cogs:    salesByDay[key]?.cogs    || 0
    });
  }

  const grossProfit = revenue - cogs;
  const netProfit   = grossProfit - expenses;

  res.json({
    openingStock,
    purchases,
    closingStock,
    revenue,
    cogs,
    grossProfit,
    expenses,
    netProfit,
    byProduct,
    dailyTrend
  });
});

/**
 * GET /api/reports/bar-performance?from=&to=
 */
export const getBarPerformance = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }
  const start = new Date(from);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  // Debug: count matching
  const matchFilter = { date: { $gte: start, $lte: end } };
  const count = await Transaction.countDocuments(matchFilter);
  console.log('BarPerformance: date range', start, end, 'matching transactions:', count);

  const agg = await Transaction.aggregate([
    { $match: matchFilter },
    { 
      $group: {
        _id: '$bar',
        totalRevenue: { $sum: '$revenue' },
        totalCost:    { $sum: '$cost' }
      }
    },
    {
      $lookup: {
        from: 'bars',
        localField: '_id',
        foreignField: '_id',
        as: 'barInfo'
      }
    },
    { $unwind: '$barInfo' },
    {
      $project: {
        barId: '$_id',
        barName: '$barInfo.name',
        totalRevenue: 1,
        totalCost:    1,
        netProfit: { $subtract: ['$totalRevenue', '$totalCost'] }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  console.log('BarPerformance aggregation result:', agg);
  res.json(agg);
});
