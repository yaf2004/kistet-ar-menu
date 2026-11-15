const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    select: false,
    minlength: 12
  },
  role: {
    type: String,
    enum: ['super_admin', 'restaurant_admin'],
    default: 'restaurant_admin',
    required: true
  },
  tokenVersion: { type: Number, default: 0, min: 0 },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    default: null,
    index: true
  }
}, { timestamps: true });

userSchema.pre('validate', function () {
  if (this.role === 'restaurant_admin' && !this.restaurant) {
    this.invalidate('restaurant', 'Restaurant administrators must belong to a restaurant');
  }
  if (this.role === 'super_admin' && this.restaurant) {
    this.invalidate('restaurant', 'Platform administrators cannot be assigned to a restaurant');
  }
});

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
    this.tokenVersion = (this.tokenVersion || 0) + 1;
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
