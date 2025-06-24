import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Product from '../models/Product.js';

/**
 * GET /api/transactions?barId=&from=&to=
 */
export const getTransactions = async (req, res, next) => {
  try {
    const { barId, from, to } = req.query;

    if (!barId || !from || !to) {
      return res.status(400).json({ error: 'barId, from, and to are required' });
    }

    // Validate ObjectId
    if (barId !== 'all' && !mongoose.Types.ObjectId.isValid(barId)) {
      return res.status(400).json({ error: 'Invalid barId' });
    }

    // Parse dates
    const start = new Date(from);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const filter = { date: { $gte: start, $lte: end } };
    if (barId !== 'all') {
      filter.bar = new mongoose.Types.ObjectId(barId);
    }

    const txns = await Transaction.find(filter)
      .populate('product', 'name costPrice sellingPrice')
      .populate('bar', 'name') // Include bar info for dashboard comparison
      .sort('date')
      .lean();

    return res.json(txns);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/transactions
 */
export const createTransaction = async (req, res, next) => {
  try {
    const { barId, productId, quantity, date } = req.body;

    if (!barId || !productId || !quantity || !date) {
      return res.status(400).json({ error: 'barId, productId, quantity and date are required' });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(barId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid barId or productId' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const revenue = quantity * (product.sellingPrice || 0);
    const cost    = quantity * (product.costPrice || 0);

    const txn = new Transaction({
      bar:      barId,
      product:  productId,
      quantity,
      date:     new Date(date),
      revenue,
      cost
    });

    await txn.save();

    res.status(201).json(txn);
  } catch (err) {
    next(err);
  }
};
