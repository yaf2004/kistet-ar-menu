const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    maxlength: 80
  },
  description: { type: String, trim: true, maxlength: 2000 },
  logo_url: { type: String, trim: true, maxlength: 2048 },
  cover_image_url: { type: String, trim: true, maxlength: 2048 },
  address: { type: String, trim: true, maxlength: 500 },
  phone: { type: String, trim: true, maxlength: 40 },
  currency: { type: String, trim: true, default: '$', maxlength: 8 },

  theme_primary_color: { type: String, default: '#d97706', match: /^#[0-9a-fA-F]{6}$/ },
  theme_bg_color: { type: String, default: '#fafaf9', match: /^#[0-9a-fA-F]{6}$/ },
  theme_card_color: { type: String, default: '#ffffff', match: /^#[0-9a-fA-F]{6}$/ },
  theme_text_color: { type: String, default: '#1c1917', match: /^#[0-9a-fA-F]{6}$/ },
  theme_font: { type: String, default: 'modern', trim: true, maxlength: 40 },
  theme_dark_mode: { type: Boolean, default: false },

  tables: [{
    tableNumber: { type: String, required: true, maxlength: 12 },
    qrUrl: { type: String, required: true, maxlength: 2048 },
    qrDataUrl: { type: String, required: true, maxlength: 200000 }
  }],
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true, optimisticConcurrency: true });

restaurantSchema.index({ active: 1, slug: 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);
