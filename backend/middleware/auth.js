const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters before the API can start.');
  }
  return secret;
}

exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (!decoded.sub) return res.status(401).json({ error: 'Invalid authentication token' });

    const user = await User.findById(decoded.sub).select('-password');
    if (!user) return res.status(401).json({ error: 'Account is no longer available' });
    if (user.role === 'restaurant_admin' && !user.restaurant) {
      return res.status(403).json({ error: 'Restaurant account is not correctly configured' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
};

exports.requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

exports.canAccessRestaurant = (user, restaurantId) =>
  user?.role === 'super_admin' || (
    user?.role === 'restaurant_admin' &&
    Boolean(user.restaurant) &&
    String(user.restaurant) === String(restaurantId)
  );

exports.scopeToOwnRestaurant = (req, res, next) => {
  const requestedRestaurantId = req.params.restaurantId || req.params.id || req.body.restaurant;
  if (!requestedRestaurantId) {
    return res.status(400).json({ error: 'Restaurant ID required' });
  }
  if (!exports.canAccessRestaurant(req.user, requestedRestaurantId)) {
    return res.status(403).json({ error: 'You do not have access to this restaurant' });
  }
  next();
};

exports.signToken = (id) => jwt.sign(
  { sub: String(id) },
  getJwtSecret(),
  {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES || '15m',
    issuer: process.env.JWT_ISSUER || 'kistet-ar-menu',
    audience: process.env.JWT_AUDIENCE || 'kistet-ar-menu-web'
  }
);
