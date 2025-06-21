import mongoose, { Types } from 'mongoose';
import asyncHandler from 'express-async-handler';
import InventoryRecord from '../models/Inventory.js';
import Product from '../models/Product.js';
import TheftAlert from '../models/TheftAlert.js'; // optional

/**
 * Ripple‑forward helper:
 * Starting from `fromDate`, re‑compute every subsequent day's opening/expected/closing.
 */
async function rippleForward(barId, productId, fromDate, session = null) {
  const base = await InventoryRecord.findOne({ bar: barId, product: productId, date: fromDate })
    .session(session);
  if (!base) return;
  let prevClosing = base.closing;

  const future = await InventoryRecord.find({
    bar: barId,
    product: productId,
    date: { $gt: fromDate }
  })
    .sort({ date: 1 })
    .session(session);

  for (const rec of future) {
    rec.opening = prevClosing;

    rec.expectedClosing =
      rec.opening
      + (rec.receivedQty   || 0)
      + (rec.transferInQty  || 0)
      - (rec.transferOutQty || 0);

    rec.closing =
      rec.manualClosing != null
        ? rec.manualClosing
        : rec.expectedClosing;

    rec.variance =
      rec.manualClosing != null
        ? rec.manualClosing - rec.expectedClosing
        : null;

    await rec.save({ session });
    prevClosing = rec.closing;
  }
}

/**
 * GET /api/inventory?barId=xxx&date=YYYY-MM-DD
 */
export const getInventoryByBarAndDate = asyncHandler(async (req, res) => {
  const { barId, date } = req.query;
  if (!barId || !date) {
    return res.status(400).json({ error: 'barId and date are required' });
  }

  const [Y, M, D] = date.split('-').map(Number);
  const startOfDay     = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0));
  const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const agg = await Product.aggregate([
    { $sort: { name: 1 } },

    // Lookup today's inventory record (if any)
    {
      $lookup: {
        from: InventoryRecord.collection.name,
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: {
              $and: [
                ...(barId !== 'all'
                  ? [{ $eq: ['$bar', new Types.ObjectId(barId)] }]
                  : [{ $gt: ['$bar', null] }]),
                { $eq: ['$product', '$$pid'] },
                { $gte: ['$date', startOfDay] },
                { $lt: ['$date', startOfNextDay] }
              ]
            } } },
          { $limit: 1 }
        ],
        as: 'todayRec'
      }
    },
    { $unwind: { path: '$todayRec', preserveNullAndEmptyArrays: true } },

    // Lookup yesterday's record for opening fallback
    {
      $lookup: {
        from: InventoryRecord.collection.name,
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: {
              $and: [
                ...(barId !== 'all'
                  ? [{ $eq: ['$bar', new Types.ObjectId(barId)] }]
                  : [{ $gt: ['$bar', null] }]),
                { $eq: ['$product', '$$pid'] },
                { $lt: ['$date', startOfDay] }
              ]
            } } },
          { $sort: { date: -1 } },
          { $limit: 1 }
        ],
        as: 'prevRec'
      }
    },
    { $unwind: { path: '$prevRec', preserveNullAndEmptyArrays: true } },

    // Build all fields
    {
      $addFields: {
        opening: {
          $cond: [
            { $ifNull: ['$todayRec', false] },
            { $ifNull: ['$todayRec.opening', 0] },
            { $ifNull: ['$prevRec.closing', 0] }
          ]
        },
        receivedQty:    { $ifNull: ['$todayRec.receivedQty',    0] },
        transferInQty:  { $ifNull: ['$todayRec.transferInQty',  0] },
        transferOutQty: { $ifNull: ['$todayRec.transferOutQty', 0] },
        manualClosing:  { $ifNull: ['$todayRec.manualClosing', null] },
        // price: override if record has it, else use product default
        sellingPrice: {
          $ifNull: [
            '$todayRec.sellingPrice',
            '$sellingPrice'
          ]
        }
      }
    },

    // Finally compute salesQty, salesAmt, expectedClosing, variance:
    {
      $project: {
        _id:             { $ifNull: ['$todayRec._id', null] },
        product:         { _id: '$_id', name: '$name' },
        opening:         1,
        receivedQty:     1,
        transferInQty:   1,
        transferOutQty:  1,
        manualClosing:   1,
        sellingPrice:    1,

        // salesQty = opening + received + in - out - (manualClosing || 0)
        salesQty: {
          $subtract: [
            {
              $add: [
                '$opening',
                '$receivedQty',
                '$transferInQty',
                { $multiply: [-1, '$transferOutQty'] }
              ]
            },
            { $ifNull: ['$manualClosing', 0] }
          ]
        },

        // salesAmt = salesQty * sellingPrice
        salesAmt: {
          $multiply: [
            {
              $subtract: [
                {
                  $add: [
                    '$opening',
                    '$receivedQty',
                    '$transferInQty',
                    { $multiply: [-1, '$transferOutQty'] }
                  ]
                },
                { $ifNull: ['$manualClosing', 0] }
              ]
            },
            '$sellingPrice'
          ]
        },

        // expectedClosing & variance for completeness
        expectedClosing: {
          $subtract: [
            { $add: [
                '$opening',
                '$receivedQty',
                '$transferInQty'
              ] },
            '$transferOutQty'
          ]
        },
        variance: {
          $cond: [
            { $ne: ['$manualClosing', null] },
            { $subtract: ['$manualClosing', '$expectedClosing'] },
            null
          ]
        }
      }
    }
  ]).exec();

  res.json({ data: agg });
});

/**
 * POST /api/inventory
 * Single‐row upsert (preserves transfer, salesQty, computes salesAmt & sellingPrice).
 */
export const upsertInventory = asyncHandler(async (req, res) => {
  const { barId, productId, date, opening = 0, inQty = 0 } = req.body;
  const currentUser = req.user;
  if (!currentUser) return res.status(401).json({ error: 'Not authenticated' });
  if (!barId || !productId || !date)
    return res.status(400).json({ error: 'barId, productId, and date are required' });
  if (barId === 'all') return res.status(400).json({ error: 'Cannot upsert for all bars' });

  const product = await Product.findById(productId).lean();
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const normDate = new Date(date);
  normDate.setUTCHours(0, 0, 0, 0);

  const existing = await InventoryRecord.findOne({
    bar:     new Types.ObjectId(barId),
    product: new Types.ObjectId(productId),
    date:    { $gte: normDate, $lt: new Date(normDate.getTime() + 86400000) }
  }).lean();

  const salesQtyExisting = existing?.salesQty ?? 0;
  const priceExisting    = existing?.sellingPrice ?? product.sellingPrice;

  const rec = await InventoryRecord.findOneAndUpdate(
    {
      bar:     new Types.ObjectId(barId),
      product: new Types.ObjectId(productId),
      date:    { $gte: normDate, $lt: new Date(normDate.getTime() + 86400000) }
    },
    {
      $set: {
        opening,
        receivedQty:   inQty,
        manualClosing: req.body.manualClosing ?? existing?.manualClosing ?? null,
        transferInQty:  existing?.transferInQty  ?? 0,
        transferOutQty: existing?.transferOutQty ?? 0,
        salesQty:       salesQtyExisting,
        sellingPrice:   priceExisting,
        salesAmt:       salesQtyExisting * priceExisting,
        costPrice:      product.costPrice || 0
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  await rippleForward(barId, productId, normDate);
  res.json(rec);
});

/**
 * POST /api/inventory/bulk-upsert
 * Bulk update (preserves transfer, salesQty, computes salesAmt & sellingPrice).
 */
export const bulkUpsertInventory = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { barId, date, items } = req.body;
  if (!currentUser) return res.status(401).json({ error: 'Not authenticated' });
  if (!barId || !date || !Array.isArray(items))
    return res.status(400).json({ error: 'barId, date, and items[] are required' });
  if (barId === 'all')
    return res.status(400).json({ error: 'Cannot bulk-upsert for all bars' });

  const normDate = new Date(date);
  normDate.setUTCHours(0, 0, 0, 0);

  const bulkOps = [];
  for (const it of items) {
    if (!it.productId || !Types.ObjectId.isValid(it.productId)) continue;

    const existing = await InventoryRecord.findOne({
      bar:     new Types.ObjectId(barId),
      product: new Types.ObjectId(it.productId),
      date:    normDate
    }).lean();
    const prod     = await Product.findById(it.productId).lean();

    const salesQtyExisting = existing?.salesQty ?? 0;
    const priceExisting    = existing?.sellingPrice ?? prod.sellingPrice ?? 0;

    bulkOps.push({
      updateOne: {
        filter: {
          bar:     new Types.ObjectId(barId),
          product: new Types.ObjectId(it.productId),
          date:    normDate
        },
        update: {
          $set: {
            opening:       it.opening      || 0,
            receivedQty:   it.receivedQty  || 0,
            manualClosing: it.manualClosing ?? existing?.manualClosing ?? null,
            transferInQty:  existing?.transferInQty  ?? 0,
            transferOutQty: existing?.transferOutQty ?? 0,
            salesQty:       salesQtyExisting,
            sellingPrice:   priceExisting,
            salesAmt:       salesQtyExisting * priceExisting
          }
        },
        upsert: true
      }
    });
  }

  if (!bulkOps.length) {
    return res.status(400).json({ error: 'No valid items to upsert' });
  }

  await InventoryRecord.bulkWrite(bulkOps);

  // Recompute expected/closing/variance and ripple‑forward
  const recs = await InventoryRecord.find({ bar: barId, date: normDate }).lean();
  const secondOps = recs.map(rec => {
    const o = rec.opening       || 0;
    const r = rec.receivedQty   || 0;
    const i = rec.transferInQty || 0;
    const t = rec.transferOutQty|| 0;
    const m = rec.manualClosing != null ? rec.manualClosing : null;

    const expected = o + r + i - t;
    const closing  = m != null ? m : expected;
    const variance = m != null ? m - expected : rec.variance;

    return {
      updateOne: {
        filter: { _id: rec._id },
        update: { $set: { expectedClosing: expected, closing, variance } }
      }
    };
  });
  if (secondOps.length) await InventoryRecord.bulkWrite(secondOps);

  // Ripple‑forward each affected product
  const pids = new Set(recs.map(r => r.product.toString()));
  for (const pid of pids) {
    await rippleForward(barId, pid, normDate);
  }

  const finalDocs = await InventoryRecord.find({ bar: barId, date: normDate })
    .populate('product')
    .lean();
  res.json({ updated: finalDocs });
});
