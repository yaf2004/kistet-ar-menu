const router = require('express').Router();
const User = require('../models/User');
const { loginAttemptLimiter } = require('../middleware/loginAttemptLimiter');
const { signToken, protect } = require('../middleware/auth');

router.post('/login', loginAttemptLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password || email.length > 254 || password.length > 1024) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email })
      .select('+password')
      .populate('restaurant', 'name slug active');
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
