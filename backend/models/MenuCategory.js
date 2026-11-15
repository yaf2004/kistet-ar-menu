const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1000 },
  sort_order: { type: Number, default: 0, min: 0, max: 100000 },
  is_active: { type: Boolean, default: true }
}, { timestamps: true, optimisticConcurrency: true });

categorySchema.index({ restaurant: 1, is_active: 1, sort_order: 1 });
categorySchema.index({ restaurant: 1, name: 1 });

module.exports = mongoose.model('MenuCategory', categorySchema);
