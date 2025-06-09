// controllers/reportController.js

import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import InventoryRecord from '../models/Inventory.js';
import Expense         from '../models/Expense.js';

/**
 * GET /api/reports/income-statement?barId=&from=&to=
 */
export const getIncomeStatement = asyncHandler(async (req, res) => {
  const { barId, from, to } = req.query;
  if (!barId || !from || !to) {
    return res
      .status(400)
      .json({ error: 'barId, from, and to are required' });
  }

  // 1) Validate barId
  if (!mongoose.Types.ObjectId.isValid(barId)) {
    return res
      .status(400)
      .json({ error: 'barId must be a valid 24‑character hex string' });
  }
  const barObjId = new mongoose.Types.ObjectId(barId);

  // 2) Build date range
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  // 3) Opening stock: latest record *before* the period
  const [lastBefore] = await InventoryRecord.find({
    bar:  barObjId,
    date: { $lt: start }
  })
    .sort('-date')
    .limit(1)
    .lean();

  const openingStock = lastBefore
    ? lastBefore.closing * lastBefore.costPrice
    : 0;

  // 4) Period records
  let periodRecs = await InventoryRecord.find({
    bar:  barObjId,
    date: { $gte: start, $lte: end }
  })
    .populate('product')
    .lean();

  periodRecs = periodRecs.filter(r => r.product);

  // 5) Purchases = sum(receivedQty * costPrice)
  const purchases = periodRecs.reduce(
    (sum, r) => sum + (r.receivedQty || 0) * r.costPrice,
    0
  );

  // 6) Closing stock: latest record on or before `to`
  const [lastOnOrBefore] = await InventoryRecord.find({
    bar:  barObjId,
    date: { $lte: end }
  })
    .sort('-date')
    .limit(1)
    .lean();

  const closingStock = lastOnOrBefore
    ? lastOnOrBefore.closing * lastOnOrBefore.costPrice
    : 0;

  // 7) Revenue & COGS
  const revenue = periodRecs.reduce((sum, r) => sum + (r.salesAmt || 0), 0);
  const cogs    = periodRecs.reduce(
    (sum, r) => sum + (r.salesQty || 0) * r.costPrice,
    0
  );

  // 8) Expenses
  const exps = await Expense.find({
    bar:  barObjId,
    date: { $gte: start, $lte: end }
  })
  .lean();
  const expenses = exps.reduce((sum, e) => sum + e.amount, 0);

  // 9) By-product breakdown
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
    agg.profit   += r.salesAmt - (r.salesQty * r.costPrice);
  });
  const byProduct = Array.from(byProductMap.values());

  // 10) Daily trend
  const pad = n => String(n).padStart(2, '0');
  const salesByDay = {};
  periodRecs.forEach(r => {
    const d   = r.date;
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    if (!salesByDay[key]) salesByDay[key] = { revenue: 0, cogs: 0 };
    salesByDay[key].revenue += r.salesAmt;
    salesByDay[key].cogs    += (r.salesQty || 0) * r.costPrice;
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

  // 11) Final metrics
  const grossProfit = revenue - cogs;
  const netProfit   = grossProfit - expenses;

  return res.json({
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
