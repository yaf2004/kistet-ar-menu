const router = require('express').Router();
const User = require('../models/User');
const { signToken, protect } = require('../middleware/auth');

// POST /api/auth/login — used by both super_admin and restaurant_admin
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('restaurant', 'name slug');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant: user.restaurant // null for super_admin, populated object for restaurant_admin
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — confirms who's currently logged in (used on every page load)
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password').populate('restaurant', 'name slug');
  res.json(user);
});

module.exports = router;
