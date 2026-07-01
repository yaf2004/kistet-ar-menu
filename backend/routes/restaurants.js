const router = require('express').Router();
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { protect, requireSuperAdmin } = require('../middleware/auth');

// ── PUBLIC: used by the customer-facing menu page (no login needed) ──────────
router.get('/public/:slug', async (req, res) => {
  try {
    const r = await Restaurant.findOne({ slug: req.params.slug, active: true });
    if (!r) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SUPER ADMIN ONLY: list every restaurant on the platform ──────────────────
router.get('/', protect, requireSuperAdmin, async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort('-createdAt');
    res.json(restaurants);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SUPER ADMIN ONLY: create a new restaurant AND its admin login in one step
// This is the "onboard a new client" action — you fill in the restaurant's
// name + an email/password for them, and both get created together.
router.post('/', protect, requireSuperAdmin, async (req, res) => {
  try {
    const { name, address, phone, currency, ownerEmail, ownerPassword, ownerName } = req.body;

    if (!name || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ error: 'Restaurant name, owner email and password are required' });
    }

    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const exists = await Restaurant.findOne({ slug: slugBase });
    const slug = exists ? `${slugBase}-${Date.now()}` : slugBase;

    const restaurant = await Restaurant.create({ name, address, phone, currency, slug });

    const emailTaken = await User.findOne({ email: ownerEmail });
    if (emailTaken) {
      await Restaurant.findByIdAndDelete(restaurant._id); // roll back
      return res.status(409).json({ error: 'That owner email is already registered' });
    }

    const ownerUser = await User.create({
      name: ownerName || name + ' Admin',
      email: ownerEmail,
      password: ownerPassword,
      role: 'restaurant_admin',
      restaurant: restaurant._id
    });

    res.status(201).json({
      restaurant,
      owner: { id: ownerUser._id, email: ownerUser.email, name: ownerUser.name }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SUPER ADMIN ONLY: suspend / delete a restaurant ───────────────────────────
router.put('/:id/toggle-active', protect, requireSuperAdmin, async (req, res) => {
  try {
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    r.active = !r.active;
    await r.save();
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', protect, requireSuperAdmin, async (req, res) => {
  try {
    await Restaurant.findByIdAndDelete(req.params.id);
    await User.deleteMany({ restaurant: req.params.id }); // also remove their admin logins
    res.json({ message: 'Restaurant and its logins deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── RESTAURANT ADMIN (or super admin): get / update YOUR OWN restaurant's settings ──
router.get('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin' && String(req.user.restaurant) !== req.params.id) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin' && String(req.user.restaurant) !== req.params.id) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const r = await Restaurant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
