const mongoose = require('mongoose');

// One document per restaurant client. This matches the fields the
// React frontend's theme system already expects (theme_primary_color, etc.)
const restaurantSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true }, // used in the menu URL
  description: { type: String },
  logo_url:    { type: String },
  cover_image_url: { type: String },
  address:     { type: String },
  phone:       { type: String },
  currency:    { type: String, default: '$' },

  // Theme fields — drive the look of the customer menu per restaurant
  theme_primary_color: { type: String, default: '#d97706' },
  theme_bg_color:      { type: String, default: '#fafaf9' },
  theme_card_color:    { type: String, default: '#ffffff' },
  theme_text_color:    { type: String, default: '#1c1917' },
  theme_font:          { type: String, default: 'modern' },
  theme_dark_mode:     { type: Boolean, default: false },

  tables:  [{ tableNumber: String, qrUrl: String, qrDataUrl: String }],
  active:  { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
