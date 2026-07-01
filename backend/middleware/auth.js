const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Step 1: confirm the person is logged in at all (any role)
exports.protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Step 2: only allow super_admins through (e.g. for "create restaurant")
exports.requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Step 3: scope a restaurant_admin to ONLY their own restaurant.
// super_admins are allowed through to anything (no restriction).
// This is the core rule that keeps Restaurant A's owner from seeing Restaurant B's data.
exports.scopeToOwnRestaurant = (req, res, next) => {
  if (req.user.role === 'super_admin') return next(); // sees everything

  const requestedRestaurantId = req.params.restaurantId || req.body.restaurant;
  if (!requestedRestaurantId) {
    return res.status(400).json({ error: 'Restaurant ID required' });
  }
  if (String(req.user.restaurant) !== String(requestedRestaurantId)) {
    return res.status(403).json({ error: 'You do not have access to this restaurant' });
  }
  next();
};

exports.signToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '30d' });
