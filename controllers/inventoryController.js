// controllers/inventoryController.js

import { Types } from 'mongoose';
import asyncHandler from 'express-async-handler';
import InventoryRecord from '../models/Inventory.js';
import Product from '../models/Product.js';
import TheftAlert from '../models/TheftAlert.js'; // ← optional: only if you want to log theft alerts

/**
 * GET /api/inventory?barId=xxx&date=YYYY-MM-DD
 *
 * Returns a “full” inventory list for that bar/date, including:
 *   • existing record for that exact date (if any)
 *   • if no record exists today, then:
 *       – opening   = closing of the most recent record before “date”
 *       – received  = 0
 *       – transferIn  = 0
 *       – transferOut = 0
 *       – salesQty  = 0
 *       – manualClosing = null
 *       – closing   = opening
 *       – variance  = null
 *   • computed fields: salesAmt, expectedClosing, variance, etc.
 */
export const getInventoryByBarAndDate = asyncHandler(async (req, res) => {
  const { barId, date } = req.query;
  if (!barId || !date) {
    return res.status(400).json({ error: 'barId and date are required' });
  }

  // Parse YYYY-MM-DD into UTC midnight [startOfDay, startOfNextDay)
  const [Y, M, D] = date.split('-').map(Number);
  const startOfDay     = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0, 0));
  const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const agg = await Product.aggregate([
    { $sort: { name: 1 } },  // 1) sort products

    // 2) todayRec lookup
    {
      $lookup: {
        from: InventoryRecord.collection.name,
        let: { prodId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  ...(barId !== 'all'
                    ? [{ $eq: ['$bar', new Types.ObjectId(barId)] }]
                    : [{ $gt: ['$bar', null] }]),
                  { $eq: ['$product', '$$prodId'] },
                  { $gte: ['$date', startOfDay] },
                  { $lt:  ['$date', startOfNextDay] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: 'todayRec'
      }
    },
    { $unwind: { path: '$todayRec', preserveNullAndEmptyArrays: true } },

    // 3) prevRec lookup (before today)
    {
      $lookup: {
        from: InventoryRecord.collection.name,
        let: { prodId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  ...(barId !== 'all'
                    ? [{ $eq: ['$bar', new Types.ObjectId(barId)] }]
                    : [{ $gt: ['$bar', null] }]),
                  { $eq: ['$product', '$$prodId'] },
                  { $lt: ['$date', startOfDay] }
                ]
              }
            }
          },
          { $sort: { date: -1 } },
          { $limit: 1 }
        ],
        as: 'prevRec'
      }
    },
    { $unwind: { path: '$prevRec', preserveNullAndEmptyArrays: true } },

    // 4) compute fields
    {
      $addFields: {
        productId:    '$_id',
        productName:  '$name',
        sellingPrice: '$sellingPrice',

        // opening = todayRec.opening || prevRec.closing || 0
        opening: {
          $cond: [
            { $ifNull: ['$todayRec', false] },
            { $ifNull: ['$todayRec.opening', 0] },
            { $ifNull: ['$prevRec.closing', 0] }
          ]
        },

        // raw fields
        receivedQty:    { $ifNull: ['$todayRec.receivedQty',    0] },
        transferInQty:  { $ifNull: ['$todayRec.transferInQty',  0] },
        transferOutQty: { $ifNull: ['$todayRec.transferOutQty', 0] },
        salesQty:       { $ifNull: ['$todayRec.salesQty',       0] },
        manualClosing:  { $ifNull: ['$todayRec.manualClosing', null] },

        // closing = todayRec.closing || (opening + received + in − out)
        closing: {
          $cond: [
            { $ifNull: ['$todayRec', false] },
            '$todayRec.closing',
            {
              $subtract: [
                {
                  $add: [
                    { $ifNull: ['$prevRec.closing',    0] },
                    { $ifNull: ['$todayRec.receivedQty',    0] },
                    { $ifNull: ['$todayRec.transferInQty',  0] }
                  ]
                },
                { $ifNull: ['$todayRec.transferOutQty', 0] }
              ]
            }
          ]
        },

        // salesAmt & variance (only if manualClosing provided)
        salesAmt: {
          $multiply: [
            { $ifNull: ['$salesQty', 0] },
            '$sellingPrice'
          ]
        },
        variance: {
          $cond: [
            { $ne: ['$manualClosing', null] },
            { $subtract: ['$manualClosing', '$closing'] },
            null
          ]
        }
      }
    },

    // 5) shape projection
    {
      $project: {
        _id:            { $ifNull: ['$todayRec._id', null] },
        date:           startOfDay,
        product: {
          _id:          '$productId',
          name:         '$productName',
          costPrice:    { $ifNull: ['$todayRec.costPrice', '$costPrice'] },
          sellingPrice: '$sellingPrice'
        },
        opening:        1,
        receivedQty:    1,
        transferInQty:  1,
        salesQty:       1,
        transferOutQty: 1,
        manualClosing:  1,
        closing:        1,
        expectedClosing:'$closing',
        salesAmt:       1,
        variance:       1,
        updatedAt:      { $ifNull: ['$todayRec.updatedAt', '$prevRec.updatedAt'] }
      }
    },

    // 6) sort
    { $sort: { 'product.name': 1 } }
  ]).exec();

  res.json({ data: agg });
});


/**
 * POST /api/inventory
 *   body: { barId, productId, date, opening, inQty, outQty }
 *
 * Single‐row upsert: salesQty = outQty, closing = opening + inQty − outQty,
 * salesAmt = salesQty * sellingPrice.
 */
export const upsertInventory = asyncHandler(async (req, res) => {
  const { barId, productId, date, opening = 0, inQty = 0, outQty = 0 } = req.body;
  const currentUser = req.user || null;
  if (!currentUser) return res.status(401).json({ error: 'Not authenticated' });
  if (!barId || !productId || !date)
    return res.status(400).json({ error: 'barId, productId, and date are required' });
  if (barId === 'all') return res.status(400).json({ error: 'Cannot upsert for all bars' });

  const product = await Product.findById(productId).lean();
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const normDate = new Date(date);
  normDate.setUTCHours(0, 0, 0, 0);

  const salesQty = outQty;
  const salesAmt = salesQty * product.sellingPrice;
  const closing  = opening + inQty - outQty;
  const costPrice = product.costPrice || 0;

  const rec = await InventoryRecord.findOneAndUpdate(
    {
      bar:     new Types.ObjectId(barId),
      product: new Types.ObjectId(productId),
      date:    { $gte: normDate, $lt: new Date(normDate.getTime() + 24*60*60*1000) }
    },
    {
      bar,
      product:       new Types.ObjectId(productId),
      date:          normDate,
      opening,
      receivedQty:   inQty,
      transferInQty: 0,
      transferOutQty:0,
      salesQty,
      salesAmt,
      closing,
      manualClosing: null,
      costPrice
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  .populate('product')
  .lean();

  return res.json(rec);
});


/**
 * POST /api/inventory/bulk-upsert
 *   body: { barId, date, items: [{ productId, opening?, receivedQty?, transferInQty?, transferOutQty?, salesQty?, manualClosing? }] }
 *
 * 1) Bulk‐write raw fields (including salesQty).
 * 2) Fetch & recompute derived fields:
 *      expectedClosing = opening + received + transferIn – transferOut
 *      closing         = manualClosing !== null ? manualClosing : expectedClosing
 *      variance        = manualClosing !== null ? manualClosing – expectedClosing : null
 *      salesAmt        = salesQty * sellingPrice
 * 3) Log TheftAlert where variance < 0.
 */
export const bulkUpsertInventory = asyncHandler(async (req, res) => {
  try {
    const currentUser = req.user || null;
    const { barId, date, items } = req.body;
    if (!barId || !date || !Array.isArray(items))
      return res.status(400).json({ error: 'barId, date, and items[] are required' });
    if (barId === 'all')
      return res.status(400).json({ error: 'Cannot bulk-upsert for all bars' });

    const normDate = new Date(date);
    normDate.setUTCHours(0,0,0,0);

    // 1) First pass: persist raw fields + salesQty
    const bulkOps = items
      .filter(item => item.productId && Types.ObjectId.isValid(item.productId))
      .map(item => {
        const {
          productId,
          opening       = 0,
          receivedQty   = 0,
          transferInQty = 0,
          transferOutQty= 0,
          salesQty      = 0,
          manualClosing = null
        } = item;

        return {
          updateOne: {
            filter: {
              bar:     new Types.ObjectId(barId),
              product: new Types.ObjectId(productId),
              date:    normDate
            },
            update: {
              $set: {
                opening,
                receivedQty,
                transferInQty,
                transferOutQty,
                salesQty,        // ← now persisted
                manualClosing
              }
            },
            upsert: true
          }
        };
      });

    if (bulkOps.length === 0)
      return res.status(400).json({ error: 'No valid items to upsert' });

    await InventoryRecord.bulkWrite(bulkOps);

    // 2) Re-fetch & recompute derived fields
    const updatedRecords = await InventoryRecord.find({
      bar:  new Types.ObjectId(barId),
      date: normDate
    })
    .populate('product')
    .lean();

    const secondaryBulk = [];
    const theftAlerts   = [];

    for (const rec of updatedRecords) {
      if (!rec.product) continue;

      const o = rec.opening       || 0;
      const r = rec.receivedQty   || 0;
      const i = rec.transferInQty || 0;
      const t = rec.transferOutQty|| 0;
      const s = rec.salesQty      || 0;      // ← use stored salesQty
      const m = (typeof rec.manualClosing === 'number') ? rec.manualClosing : null;

      // expectedClosing = opening + received + transferIn - transferOut
      const expectedClosing = o + r + i - t;

      // closing = manualClosing !== null ? manualClosing : expectedClosing
      const actualClosing = m !== null ? m : expectedClosing;

      // variance = manualClosing !== null ? manualClosing - expectedClosing : null
      const variance = m !== null ? m - expectedClosing : null;

      secondaryBulk.push({
        updateOne: {
          filter: { _id: rec._id },
          update: {
            $set: {
              costPrice:      rec.product.costPrice || 0,
              salesQty:       s,
              salesAmt:       s * rec.product.sellingPrice,
              expectedClosing,
              closing:        actualClosing,
              variance
            }
          }
        }
      });

      // log theft if negative variance
      if (variance !== null && variance < 0 && currentUser) {
        theftAlerts.push({
          inventoryRecord: rec._id,
          product: {
            _id:  rec.product._id,
            name: rec.product.name
          },
          bar:           new Types.ObjectId(barId),
          date:          normDate,
          expectedClosing,
          manualClosing: m,
          variance,
          flaggedBy:     currentUser._id
        });
      }
    }

    // 3) Apply recompute and alerts
    if (secondaryBulk.length) await InventoryRecord.bulkWrite(secondaryBulk);
    if (theftAlerts.length)   await TheftAlert.insertMany(theftAlerts);

    // 4) Return final docs
    const finalDocs = await InventoryRecord.find({
      _id: { $in: updatedRecords.map(r => r._id) }
    })
    .populate('product')
    .lean();

    return res.json({ updated: finalDocs });
  } catch (err) {
    console.error('💥 bulkUpsertInventory error:', err);
    return res.status(500).json({ error: err.message });
  }
});
