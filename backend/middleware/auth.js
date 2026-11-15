const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');

const SESSION_COOKIE = 'kistet_session';
const CSRF_COOKIE = 'kistet_csrf';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters before the API can start.');
  }
  return secret;
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { return [key, decodeURIComponent(value)]; }
    catch { return [key, '']; }
  }).filter(([key]) => key));
}

function allowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return configured.length ? configured : (
    process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']
  );
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.sessionCookieName = SESSION_COOKIE;
exports.csrfCookieName = CSRF_COOKIE;
exports.createCsrfToken = () => crypto.randomBytes(32).toString('base64url');

exports.protect = async (req, res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = String(req.headers.origin || '').replace(/\/$/, '');
      const csrfHeader = req.headers['x-csrf-token'];
      if (!origin || !allowedOrigins().includes(origin) ||
          !safeEqual(cookies[CSRF_COOKIE], csrfHeader)) {
        return res.status(403).json({ error: 'Request security check failed. Refresh the page and try again.' });
      }
    }

    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'kistet-ar-menu',
      audience: process.env.JWT_AUDIENCE || 'kistet-ar-menu-web'
    });
    if (!decoded.sub) return res.status(401).json({ error: 'Invalid authentication session' });

    const user = await User.findById(decoded.sub).select('-password');
    if (!user) return res.status(401).json({ error: 'Account is no longer available' });
    if (user.role === 'restaurant_admin') {
      if (!user.restaurant) return res.status(403).json({ error: 'Restaurant account is not correctly configured' });
      const activeRestaurant = await Restaurant.exists({ _id: user.restaurant, active: true });
      if (!activeRestaurant) return res.status(403).json({ error: 'This restaurant account is currently unavailable' });
    }

    req.user = user;
    return next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError') {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    return next(err);
  }
};

exports.requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  return next();
};

exports.canAccessRestaurant = (user, restaurantId) => (
  user?.role === 'super_admin' || (
    user?.role === 'restaurant_admin' &&
    Boolean(user.restaurant) &&
    String(user.restaurant._id || user.restaurant) === String(restaurantId)
  )
);

exports.scopeToOwnRestaurant = (req, res, next) => {
  const requestedRestaurantId = req.params.restaurantId || req.params.id || req.body.restaurant;
  if (!requestedRestaurantId) return res.status(400).json({ error: 'Restaurant ID required' });
  if (!exports.canAccessRestaurant(req.user, requestedRestaurantId)) {
    return res.status(403).json({ error: 'You do not have access to this restaurant' });
  }
  return next();
};

exports.signToken = (id) => jwt.sign(
  { sub: String(id) },
  getJwtSecret(),
  {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES || '12h',
    issuer: process.env.JWT_ISSUER || 'kistet-ar-menu',
    audience: process.env.JWT_AUDIENCE || 'kistet-ar-menu-web'
  }
);
