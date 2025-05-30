import mongoose from 'mongoose';

const DailySummarySchema = new mongoose.Schema({
  date:        { type: Date, required: true },        // e.g. 2025-05-12
  barId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Bar', required: true },
  product:     { type: String,  required: true },
  price:       { type: Number,  required: true },
  opening:     { type: Number,  default: 0 },
  inQty:       { type: Number,  default: 0 },
  outQty:      { type: Number,  default: 0 },
  closing:     { type: Number,  default: 0 },
  salesQty:    { type: Number,  default: 0 },
  salesAmt:    { type: Number,  default: 0 }
});

export default mongoose.model('DailySummary', DailySummarySchema);
