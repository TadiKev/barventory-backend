import mongoose from 'mongoose';

const BarSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  location: { type: String, default: '', trim: true }
}, {
  timestamps: true
});

export default mongoose.model('Bar', BarSchema);
