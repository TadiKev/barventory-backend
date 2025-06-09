import mongoose from 'mongoose';

const transferRequestSchema = new mongoose.Schema(
  {
    product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty:        { type: Number, required: true, min: 1 },
    fromBar:    { type: mongoose.Schema.Types.ObjectId, ref: 'Bar', required: true },
    toBar:      { type: mongoose.Schema.Types.ObjectId, ref: 'Bar', required: true },
    status:     { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
    requestedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

export default mongoose.model('TransferRequest', transferRequestSchema);
