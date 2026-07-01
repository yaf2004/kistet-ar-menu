const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// A User is either:
//   - a "super_admin" (you, Kistet Creatives) — can see/manage ALL restaurants
//   - a "restaurant_admin" — can only see/manage the ONE restaurant they're linked to
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['super_admin', 'restaurant_admin'], default: 'restaurant_admin' },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null } // null for super_admin
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
