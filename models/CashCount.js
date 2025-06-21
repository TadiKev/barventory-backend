// models/CashCount.js
import mongoose from 'mongoose';
export default mongoose.model('CashCount', new mongoose.Schema({
  bar:       { type: mongoose.Schema.Types.ObjectId, ref: 'Bar', required: true },
  date:      { type: Date, required: true },
  amount:    { type: Number, required: true },
  recordedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, unique: ['bar','date'] }));
