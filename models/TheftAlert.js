// models/TheftAlert.js
import mongoose from 'mongoose';

const TheftAlertSchema = new mongoose.Schema({
  inventoryRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryRecord', required: true },
  product: {
    _id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name:  { type: String, required: true }
  },
  bar:             { type: mongoose.Schema.Types.ObjectId, ref: 'Bar', required: true },
  date:            { type: Date, required: true },
  expectedClosing: { type: Number, required: true },
  manualClosing:   { type: Number, required: true },
  variance:        { type: Number, required: true },
  flaggedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:       { type: Date, default: Date.now }
});

export default mongoose.model('TheftAlert', TheftAlertSchema);
