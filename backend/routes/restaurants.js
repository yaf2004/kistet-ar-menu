const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { protect, requireSuperAdmin, canAccessRestaurant } = require('../middleware/auth');

const restaurantAdminFields = [
  'name', 'description', 'logo_url', 'cover_image_url', 'address', 'phone',
  'currency', 'theme_primary_color', 'theme_bg_color', 'theme_card_color',
  'theme_text_color', 'theme_font', 'theme_dark_mode'
];
const superAdminFields = [...restaurantAdminFields, 'slug', 'active'];

function pickFields(source, allowed) {
  return Object.fromEntries(allowed
    .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
    .map((key) => [key, source[key]]));
}

function slugify(value) {
  return String(value || '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateTheme(data) {
  const colors = ['theme_primary_color', 'theme_bg_color', 'theme_card_color', 'theme_text_color'];
  return colors.every((key) => data[key] === undefined || /^#[0-9a-fA-F]{6}$/.test(data[key]));
}

router.get('/public/:slug', async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: req.params.slug, active: true })
      .select('name slug description logo_url cover_image_url address phone currency theme_primary_color theme_bg_color theme_card_color theme_text_color theme_font theme_dark_mode')
      .lean();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(restaurant);
  } catch (err) { next(err); }
});

router.get('/', protect, requireSuperAdmin, async (req, res, next) => {
  try {
    const restaurants = await Restaurant.find().sort({ createdAt: -1 }).lean();
    res.json(restaurants);
  } catch (err) { next(err); }
});

router.post('/', protect, requireSuperAdmin, async (req, res, next) => {
  let restaurant;
  try {
    const { name, address, phone, currency, ownerEmail, ownerPassword, ownerName, slug: requestedSlug } = req.body;
    if (typeof name !== 'string' || !name.trim() ||
        typeof ownerEmail !== 'string' || !ownerEmail.trim() ||
        typeof ownerPassword !== 'string' || ownerPassword.length < 12) {
      return res.status(400).json({ error: 'Restaurant name, owner email, and an owner password of at least 12 characters are required' });
    }

    const email = ownerEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid owner email is required' });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ error: 'That owner email is already registered' });
    }

    const slugBase = slugify(requestedSlug || name) || `restaurant-${crypto.randomBytes(4).toString('hex')}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugBase) || slugBase.length > 80) {
      return res.status(400).json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' });
    }
    const slug = await Restaurant.exists({ slug: slugBase })
      ? `${slugBase}-${crypto.randomBytes(3).toString('hex')}`
      : slugBase;

    restaurant = await Restaurant.create({
      name: name.trim(), slug, address, phone, currency
    });
    const ownerUser = await User.create({
      name: (typeof ownerName === 'string' && ownerName.trim()) ? ownerName.trim() : `${name.trim()} Admin`,
      email,
      password: ownerPassword,
      role: 'restaurant_admin',
      restaurant: restaurant._id
    });

    res.status(201).json({
      restaurant,
      owner: { id: ownerUser._id, email: ownerUser.email, name: ownerUser.name }
    });
  } catch (err) {
    if (restaurant?._id) {
      await Restaurant.findByIdAndDelete(restaurant._id).catch(() => {});
    }
    if (err.code === 11000) return res.status(409).json({ error: 'Restaurant slug or owner email already exists' });
    next(err);
  }
});

router.put('/:id/toggle-active', protect, requireSuperAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    restaurant.active = !restaurant.active;
    await restaurant.save();
    res.json(restaurant);
  } catch (err) { next(err); }
});

router.delete('/:id', protect, requireSuperAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    // Retain orders and menu history for audit, reconciliation, and future reactivation.
    // Deactivation immediately blocks logins and public menu access.
    restaurant.active = false;
    await restaurant.save();
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
    if (!canAccessRestaurant(req.user, req.params.id)) return res.status(403).json({ error: 'Not your restaurant' });
    const restaurant = await Restaurant.findById(req.params.id).lean();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) { next(err); }
});

router.put('/:id', protect, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
    if (!canAccessRestaurant(req.user, req.params.id)) return res.status(403).json({ error: 'Not your restaurant' });

    const allowed = req.user.role === 'super_admin' ? superAdminFields : restaurantAdminFields;
    const data = pickFields(req.body, allowed);
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No editable fields supplied' });
    if (!validateTheme(data)) return res.status(400).json({ error: 'Theme colors must be six-digit hexadecimal colors' });
    if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim())) {
      return res.status(400).json({ error: 'Restaurant name cannot be empty' });
    }
    if (data.slug !== undefined) {
      data.slug = slugify(data.slug);
      if (!data.slug || data.slug.length > 80) return res.status(400).json({ error: 'A valid restaurant slug is required' });
      const collision = await Restaurant.exists({ slug: data.slug, _id: { $ne: req.params.id } });
      if (collision) return res.status(409).json({ error: 'That restaurant slug is already in use' });
    }
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) { next(err); }
});

module.exports = router;
