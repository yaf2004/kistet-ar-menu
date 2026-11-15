const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]+$/ },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500 },
  limits: {
    menuItems: { type: Number, required: true, min: 1 },
    categories: { type: Number, required: true, min: 1 },
    monthlyOrders: { type: Number, required: true, min: 1 },
    arItems: { type: Number, required: true, min: 0 },
    assetBytes: { type: Number, required: true, min: 1048576 }
  },
  features: [{ type: String, trim: true, maxlength: 60 }],
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0, min: 0 }
}, { timestamps: true, optimisticConcurrency: true });

module.exports = mongoose.model('Plan', planSchema);
