// models/Inventory.js
import mongoose from 'mongoose';
const { Schema, Types } = mongoose;

const InventorySchema = new Schema({
  bar:       { type: Types.ObjectId, ref: 'Bar', required: true },
  product:   { type: Types.ObjectId, ref: 'Product', required: true },
  date:      { type: Date, required: true, default: () => new Date() },
  opening:   { type: Number, default: 0 },
  inQty:     { type: Number, default: 0 },
  outQty:    { type: Number, default: 0 },
  closing:   { type: Number, default: 0 },
  salesQty:  { type: Number, default: 0 },
  salesAmt:  { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 }
}, {
  timestamps: true  // ← adds createdAt & updatedAt
});

export default mongoose.model('Inventory', InventorySchema);
