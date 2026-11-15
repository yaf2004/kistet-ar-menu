const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { signToken, protect } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password || email.length > 254 || password.length > 1024) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password').populate('restaurant', 'name slug active');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.role === 'restaurant_admin' && (!user.restaurant || !user.restaurant.active)) {
      return res.status(403).json({ error: 'This restaurant account is currently unavailable' });
    }

    const token = signToken(user._id);
    res.set('Cache-Control', 'no-store');
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant: user.restaurant
      }
    });
  } catch (err) { next(err); }
});

router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('restaurant', 'name slug active')
      .lean();
    if (!user) return res.status(401).json({ error: 'Account is no longer available' });
    res.set('Cache-Control', 'no-store');
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
