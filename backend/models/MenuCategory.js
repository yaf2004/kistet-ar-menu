const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name:       { type: String, required: true },
  description:{ type: String },
  sort_order: { type: Number, default: 0 },
  is_active:  { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('MenuCategory', categorySchema);
