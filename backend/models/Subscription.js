const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, unique: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  planCode: { type: String, required: true, trim: true, lowercase: true },
  status: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'canceled', 'suspended'],
    default: 'trialing',
    index: true
  },
  startsAt: { type: Date, default: Date.now },
  trialEndsAt: { type: Date, default: null },
  currentPeriodStart: { type: Date, default: Date.now },
  currentPeriodEnd: { type: Date, default: null },
  canceledAt: { type: Date, default: null },
  adminNotes: { type: String, trim: true, maxlength: 1000, default: '' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, optimisticConcurrency: true });

subscriptionSchema.index({ status: 1, trialEndsAt: 1 });
subscriptionSchema.index({ planCode: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
