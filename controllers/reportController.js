// controllers/reportController.js

import mongoose from 'mongoose';
import InventoryRecord from '../models/Inventory.js';
import Expense         from '../models/Expense.js';

/**
 * GET /api/reports/income-statement?barId=&from=&to=
 */
export const getIncomeStatement = async (req, res, next) => {
  try {
    const { barId, from, to } = req.query;
    if (!barId || !from || !to) {
      return res
        .status(400)
        .json({ error: 'barId, from, and to are required' });
    }

    // 1️⃣ Build date range
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const barObjId = new mongoose.Types.ObjectId(barId);

    // 2️⃣ Opening stock: latest record *before* the period, use its CLOSING
    const [lastBefore] = await InventoryRecord.find({
      bar:  barObjId,
      date: { $lt: start }                   // <-- strictly before `from`
    })
      .sort('-date')
      .limit(1)
      .exec();

    const openingStock = lastBefore
      ? lastBefore.closing * lastBefore.costPrice   // <-- use closing
      : 0;

    // 3️⃣ All inventory records *during* the period
    let periodRecs = await InventoryRecord.find({
      bar:  barObjId,
      date: { $gte: start, $lte: end }
    })
      .populate('product')
      .exec();

    // drop any that lost their product reference
    periodRecs = periodRecs.filter(r => r.product);

    // 4️⃣ Purchases = sum of ALL inflows × costPrice
    const purchases = periodRecs.reduce(
      (sum, r) => sum + r.inQty * r.costPrice,
      0
    );

    // 5️⃣ Closing stock: latest record *on or before* `to`, use its CLOSING
    const [lastOnOrBefore] = await InventoryRecord.find({
      bar:  barObjId,
      date: { $lte: end }
    })
      .sort('-date')
      .limit(1)
      .exec();

    const closingStock = lastOnOrBefore
      ? lastOnOrBefore.closing * lastOnOrBefore.costPrice  // <-- use closing
      : 0;

    // 6️⃣ Revenue & COGS
    const revenue = periodRecs.reduce((sum, r) => sum + (r.salesAmt || 0), 0);
    const cogs    = periodRecs.reduce(
      (sum, r) => sum + (r.salesQty || 0) * r.costPrice,
      0
    );

    // 7️⃣ Expenses total
    const exps = await Expense.find({
      bar:  barObjId,
      date: { $gte: start, $lte: end }
    }).exec();
    const expenses = exps.reduce((sum, e) => sum + e.amount, 0);

    // 8️⃣ By‐product breakdown
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
      agg.profit   += r.salesAmt - r.salesQty * r.costPrice;
    });
    const byProduct = Array.from(byProductMap.values());

    // 9️⃣ Daily trend
    const pad = n => String(n).padStart(2, '0');
    const salesByDay = {};
    periodRecs.forEach(r => {
      const d      = r.date;
      const key    = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      salesByDay[key] = salesByDay[key] || { revenue: 0, cogs: 0 };
      salesByDay[key].revenue += r.salesAmt;
      salesByDay[key].cogs    += r.salesQty * r.costPrice;
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

    // Finals
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
  } catch (err) {
    next(err);
  }
};
