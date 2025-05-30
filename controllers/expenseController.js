// controllers/expenseController.js
import Expense from '../models/Expense.js';

// GET /api/expenses?barId=&from=&to=
export const getExpenses = async (req, res, next) => {
  try {
    const { barId, from, to } = req.query;
    if (!barId || !from || !to) {
      return res
        .status(400)
        .json({ error: 'barId, from, and to are required' });
    }

    // Build date range
    const start = new Date(from);
    const end   = new Date(to);
    end.setHours(23, 59, 59, 999);

    // Let Mongoose cast barId string → ObjectId automatically
    const filter = {
      bar:  barId,
      date: { $gte: start, $lte: end }
    };

    const expenses = await Expense.find(filter).sort('date');
    return res.json(expenses);
  } catch (err) {
    return next(err);
  }
};

// POST /api/expenses
export const createExpense = async (req, res, next) => {
  try {
    const { barId, category, amount, date, notes } = req.body;
    if (!barId || !category || amount == null || !date) {
      return res
        .status(400)
        .json({ error: 'barId, category, amount, and date are required' });
    }

    const expense = new Expense({
      bar:      barId,
      category,
      amount,
      date,
      notes
    });
    await expense.save();

    return res.status(201).json(expense);
  } catch (err) {
    return next(err);
  }
};


export const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, amount, date, notes } = req.body;
    const expense = await Expense.findByIdAndUpdate(
      id,
      { category, amount, date, notes },
      { new: true, runValidators: true }
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/expenses/:id
export const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
