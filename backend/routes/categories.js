const router = require('express').Router();
const mongoose = require('mongoose');
const MenuCategory = require('../models/MenuCategory');
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const { protect, canAccessRestaurant } = require('../middleware/auth');

const editableFields = ['name', 'description', 'sort_order', 'is_active'];

function pickEditableFields(source) {
  return Object.fromEntries(editableFields
    .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
    .map((key) => [key, source[key]]));
}

router.get('/public/:restaurantId', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }
    if (!await Restaurant.exists({ _id: req.params.restaurantId, active: true })) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const cats = await MenuCategory.find({
      restaurant: req.params.restaurantId,
      is_active: true
    }).select('name description sort_order').sort({ sort_order: 1, name: 1 }).lean();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(cats);
  } catch (err) { next(err); }
});

router.get('/:restaurantId', protect, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }
    if (!canAccessRestaurant(req.user, req.params.restaurantId)) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const cats = await MenuCategory.find({ restaurant: req.params.restaurantId })
      .sort({ sort_order: 1, name: 1 }).lean();
    res.json(cats);
  } catch (err) { next(err); }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const { restaurant } = req.body;
    if (!mongoose.isValidObjectId(restaurant)) {
      return res.status(400).json({ error: 'A valid restaurant is required' });
    }
    if (!canAccessRestaurant(req.user, restaurant)) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const data = pickEditableFields(req.body);
    if (typeof data.name !== 'string' || !data.name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const cat = await MenuCategory.create({ ...data, name: data.name.trim(), restaurant });
    res.status(201).json(cat);
  } catch (err) { next(err); }
});

router.put('/:id', protect, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    const cat = await MenuCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (!canAccessRestaurant(req.user, cat.restaurant)) {
      return res.status(403).json({ error: 'Not your category' });
    }

    const data = pickEditableFields(req.body);
    if (Object.prototype.hasOwnProperty.call(data, 'name')) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      data.name = data.name.trim();
    }
    Object.assign(cat, data);
    await cat.save();
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    const cat = await MenuCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (!canAccessRestaurant(req.user, cat.restaurant)) {
      return res.status(403).json({ error: 'Not your category' });
    }
    const inUse = await MenuItem.exists({ category_id: cat._id });
    if (inUse) {
      return res.status(409).json({ error: 'Move or remove the menu items in this category before deleting it' });
    }
    await cat.deleteOne();
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
