const router = require('express').Router();
const MenuCategory = require('../models/MenuCategory');
const { protect, scopeToOwnRestaurant } = require('../middleware/auth');

// PUBLIC: categories for the customer-facing menu
router.get('/public/:restaurantId', async (req, res) => {
  try {
    const cats = await MenuCategory.find({ restaurant: req.params.restaurantId, is_active: true }).sort('sort_order');
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: list categories for a given restaurant (own restaurant only, unless super_admin)
router.get('/:restaurantId', protect, scopeToOwnRestaurant, async (req, res) => {
  try {
    const cats = await MenuCategory.find({ restaurant: req.params.restaurantId }).sort('sort_order');
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', protect, scopeToOwnRestaurant, async (req, res) => {
  try {
    const cat = await MenuCategory.create(req.body);
    res.status(201).json(cat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const cat = await MenuCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'super_admin' && String(req.user.restaurant) !== String(cat.restaurant)) {
      return res.status(403).json({ error: 'Not your category' });
    }
    Object.assign(cat, req.body);
    await cat.save();
    res.json(cat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const cat = await MenuCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'super_admin' && String(req.user.restaurant) !== String(cat.restaurant)) {
      return res.status(403).json({ error: 'Not your category' });
    }
    await cat.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
