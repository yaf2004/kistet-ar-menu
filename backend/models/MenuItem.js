const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuCategory', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000 },
  price: { type: Number, required: true, min: 0, max: 1000000000 },
  image_url: { type: String, trim: true, maxlength: 2048 },
  is_available: { type: Boolean, default: true },
  is_featured: { type: Boolean, default: false },
  ar_enabled: { type: Boolean, default: false },
  model_3d_url: { type: String, trim: true, maxlength: 2048 },
  model_3d_metadata: {
    format: { type: String, enum: ['glb'] },
    gltfVersion: { type: String, maxlength: 8 },
    fileSizeBytes: { type: Number, min: 0 },
    vertexCount: { type: Number, min: 0 },
    triangleCount: { type: Number, min: 0 },
    meshCount: { type: Number, min: 0 },
    materialCount: { type: Number, min: 0 },
    textureCount: { type: Number, min: 0 },
    imageCount: { type: Number, min: 0 },
    nodeCount: { type: Number, min: 0 },
    validatedAt: { type: Date }
  },
  tags: [{ type: String, trim: true, maxlength: 40 }],
  allergens: [{ type: String, trim: true, maxlength: 60 }],
  ingredients: { type: String, trim: true, maxlength: 2000 },
  sort_order: { type: Number, default: 0, min: 0, max: 100000 }
}, { timestamps: true, optimisticConcurrency: true });

menuItemSchema.pre('validate', function () {
  if (this.ar_enabled && !this.model_3d_url) {
    this.invalidate('ar_enabled', 'An AR-enabled item must have a 3D model');
  }
});

menuItemSchema.index({ restaurant: 1, category_id: 1, sort_order: 1 });
menuItemSchema.index({ restaurant: 1, is_available: 1, sort_order: 1 });
menuItemSchema.index({ restaurant: 1, is_featured: 1, is_available: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
