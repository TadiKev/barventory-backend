import mongoose from 'mongoose';

const ExpenseSchema = new mongoose.Schema({
  bar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bar',
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Expense', ExpenseSchema);
