import Transaction from '../models/Transaction.js';
import Product from '../models/Product.js';  // <-- added missing import

// GET /api/transactions?barId=&from=&to=
export const getTransactions = async (req, res, next) => {
  try {
    const { barId, from, to } = req.query;
    if (!barId || !from || !to) {
      return res.status(400).json({ error: 'barId, from, and to are required' });
    }

    // Build date range
    const start = new Date(from);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    // Let Mongoose cast barId string to ObjectId
    const filter = {
      bar: barId,
      date: { $gte: start, $lte: end },
    };

    const txns = await Transaction.find(filter)
      .populate('product', 'name sellingPrice')
      .sort('date');

    return res.json(txns);
  } catch (err) {
    return next(err);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const { barId, productId, quantity, date } = req.body;
    if (!barId || !productId || !quantity || !date) {
      return res.status(400).json({ error: 'barId, productId, quantity and date are required' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const revenue = quantity * product.sellingPrice;
    const cost    = quantity * product.costPrice;

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
