// models/Inventory.js
import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    bar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bar',
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    date: {
      type: Date,
      required: true
    },

    // Opening stock at start of day
    opening: {
      type: Number,
      default: 0
    },

    // Received from supplier that day
    receivedQty: {
      type: Number,
      default: 0
    },

    // Sum of approved transfer‐in
    transferInQty: {
      type: Number,
      default: 0
    },

    // Sales (to customers) → we expect sales recorded separately
    salesQty: {
      type: Number,
      default: 0
    },

    // Sum of approved transfer‐out
    transferOutQty: {
      type: Number,
      default: 0
    },

    // The “actual” closing count entered manually (optional)
    manualClosing: {
      type: Number,
      default: null
    },

    // Computed “actual” closing. If manualClosing != null, use manualClosing; else use expectedClosing
    closing: {
      type: Number,
      default: 0
    },

    // Computed “expected closing” = opening + received + transferIn – (sales + transferOut)
    expectedClosing: {
      type: Number,
      default: 0
    },

    // Computed “variance” = manualClosing – expectedClosing (only if manualClosing not null)
    variance: {
      type: Number,
      default: null
    },

    // Price fields
    costPrice: {
      type: Number,
      default: 0
    },

    // Revenue from sales that day = salesQty * product.sellingPrice
    salesAmt: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// We’ll always recalc expectedClosing/closing/variance in code—no pre‐save hook here.

export default mongoose.model('InventoryRecord', inventorySchema);
