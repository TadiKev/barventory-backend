// controllers/inventoryController.js

import InventoryRecord from '../models/Inventory.js';
import Product         from '../models/Product.js';

export const getInventoryByBarAndDate = async (req, res, next) => {
  try {
    const { barId, date } = req.query;
    if (!barId || !date) {
      return res.status(400).json({ error: 'barId and date are required' });
    }

    // normalize to start/end of that day
    const d          = new Date(date);
    const startOfDay = new Date(d.setHours(0, 0, 0, 0));
    const endOfDay   = new Date(d.setHours(23, 59, 59, 999));

    // fetch existing records
    const existing = await InventoryRecord.find({
      bar:  barId === 'all' ? { $exists: true } : barId,
      date: { $gte: startOfDay, $lte: endOfDay }
    })
      .populate('product')
      .exec();

    // drop any where product was deleted
    const validRecords = existing.filter(r => r.product);

    // fetch all products
    const allProducts = await Product.find().sort('name').exec();

    // map productId → record
    const recordMap = new Map(
      validRecords.map(r => [r.product._id.toString(), r])
    );

    // build full result array
    const fullResult = allProducts.map(p => {
      const rec = recordMap.get(p._id.toString());
      if (rec) {
        // recompute derived fields on read
        rec.closing   = rec.opening + rec.inQty - rec.outQty;
        rec.salesQty  = rec.outQty;
        rec.salesAmt  = rec.salesQty * p.sellingPrice;
        return rec.toObject();
      }
      return {
        _id:        null,
        product:    p,
        date:       startOfDay,
        opening:    0,
        inQty:      0,
        outQty:     0,
        closing:    0,
        salesQty:   0,
        salesAmt:   0,
        costPrice:  p.costPrice || 0,
        updatedAt:  null,
      };
    });

    // sort and return
    fullResult.sort((a, b) => {
      const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tB - tA;
    });

    res.json({ data: fullResult });
  } catch (err) {
    next(err);
  }
};

export const upsertInventory = async (req, res, next) => {
  try {
    const { barId, productId, date, opening, inQty, outQty } = req.body;
    if (!barId || !productId || !date) {
      return res.status(400).json({
        error: 'barId, productId, and date are required'
      });
    }
    if (barId === 'all') {
      return res.status(400).json({
        error: 'Cannot upsert inventory for all bars'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // normalize date to midnight
    const normDate = new Date(date);
    normDate.setHours(0,0,0,0);

    // recompute derived
    const salesQty  = outQty;
    const salesAmt  = salesQty * product.sellingPrice;
    const closing   = opening + inQty - outQty;
    const costPrice = product.costPrice || 0;

    const record = await InventoryRecord.findOneAndUpdate(
      {
        bar:     barId,
        product: productId,
        date:    { $gte: normDate, $lte: new Date(normDate.getTime() + 86399999) }
      },
      {
        bar,
        product:   productId,
        date:      normDate,
        opening,
        inQty,
        outQty,
        closing,
        salesQty,
        salesAmt,
        costPrice
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    ).populate('product');

    res.json(record);
  } catch (err) {
    next(err);
  }
};

export const bulkUpsertInventory = async (req, res, next) => {
  try {
    const { barId, date, items } = req.body;
    if (!barId || !date || !Array.isArray(items)) {
      return res.status(400).json({
        error: 'barId, date, and items[] are required'
      });
    }
    if (barId === 'all') {
      return res.status(400).json({
        error: 'Cannot bulk-upsert inventory for all bars'
      });
    }

    const normDate = new Date(date);
    normDate.setHours(0,0,0,0);
    const endDate = new Date(normDate.getTime() + 86399999);

    const ops = items.map(async item => {
      const { productId, opening, inQty, outQty } = item;
      const product = await Product.findById(productId);
      if (!product) {
        console.warn(`Skipping missing product ${productId}`);
        return null;
      }

      // recompute derived
      const salesQty  = outQty;
      const salesAmt  = salesQty * product.sellingPrice;
      const closing   = opening + inQty - outQty;
      const costPrice = product.costPrice || 0;

      return InventoryRecord.findOneAndUpdate(
        {
          bar:     barId,
          product: productId,
          date:    { $gte: normDate, $lte: endDate }
        },
        {
          bar:       barId,
          product:   productId,
          date:      normDate,
          opening,
          inQty,
          outQty,
          closing,
          salesQty,
          salesAmt,
          costPrice
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      ).populate('product');
    });

    const results = (await Promise.all(ops)).filter(r => r !== null);
    res.json({ updated: results });
  } catch (err) {
    next(err);
  }
};
