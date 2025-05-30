import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name:               { type: String, required: true, trim: true },
  category:           { type: String, default: '', trim: true },
  costPrice:          { type: Number, required: true, min: 0 },
  sellingPrice:       { type: Number, required: true, min: 0 },
  lowStockThreshold:  { type: Number, default: 10, min: 0 },
}, {
  timestamps: true
});

export default mongoose.model('Product', ProductSchema);
