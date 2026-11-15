const mongoose = require('mongoose');

const orderLineSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true, maxlength: 120 },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 50 },
  lineTotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  orderNumber: { type: String, required: true },
  idempotencyKey: { type: String, required: true },
  trackingTokenHash: { type: String, required: true, unique: true, select: false },
  items: { type: [orderLineSchema], required: true, validate: v => v.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, maxlength: 8 },
  tableNumber: { type: String, trim: true, maxlength: 12, default: null },
  customerName: { type: String, trim: true, maxlength: 120, default: null },
  customerPhone: { type: String, trim: true, maxlength: 40, default: null },
  notes: { type: String, trim: true, maxlength: 500, default: null },
  status: {
    type: String,
    enum: ['new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'new',
    index: true
  },
  paymentMethod: { type: String, enum: ['pay_at_restaurant'], default: 'pay_at_restaurant' },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid', index: true }
}, { timestamps: true, optimisticConcurrency: true });

orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, status: 1, createdAt: 1 });
orderSchema.index({ restaurant: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ restaurant: 1, orderNumber: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);
