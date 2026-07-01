const mongoose = require('mongoose');

// Matches the fields the existing React frontend (AdminItems, CustomerMenu, MenuItemForm) already expects
const menuItemSchema = new mongoose.Schema({
  restaurant:   { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  category_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'MenuCategory', required: true },
  name:         { type: String, required: true },
  description:  { type: String },
  price:        { type: Number, required: true },
  image_url:    { type: String },
  is_available: { type: Boolean, default: true },
  is_featured:  { type: Boolean, default: false },

  // Real AR fields (replacing Base44's fake 2D-sticker AR)
  ar_enabled:   { type: Boolean, default: false },
  model_3d_url: { type: String }, // .glb file — used for actual AR placement

  tags:       [{ type: String }],
  allergens:  [{ type: String }],
  ingredients:{ type: String },
  sort_order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
