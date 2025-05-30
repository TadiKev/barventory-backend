import mongoose from 'mongoose';
const TransactionSchema = new mongoose.Schema({
  barId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bar', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  type: { type: String, enum: ['opening','receive','sale','adjustment'], required: true },
  quantity: { type: Number, required: true },
  cost: Number,
  revenue: Number,
  date: { type: Date, default: Date.now }
});
export default mongoose.model('Transaction', TransactionSchema);
