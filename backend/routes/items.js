const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const MenuItem = require('../models/MenuItem');
const { protect } = require('../middleware/auth');

// ── File upload setup ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'model3d' ? 'uploads/models' : 'uploads/dishes';
    cb(null, path.join(__dirname, '..', folder));
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (/jpeg|jpg|png|webp/.test(ext) || /glb|gltf/.test(ext)) cb(null, true);
  else cb(new Error('Invalid file type'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// Helper: confirm this user is allowed to touch this restaurant's data
function canAccessRestaurant(user, restaurantId) {
  return user.role === 'super_admin' || String(user.restaurant) === String(restaurantId);
}

// ── ADMIN: standalone file upload (used for restaurant logo/cover images,
// or any case where we just need a URL back without creating a menu item) ──
router.post('/upload-only', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res) => {
    try {
      const base = `${req.protocol}://${req.get('host')}`;
      if (req.files?.image) {
        return res.json({ url: `${base}/uploads/dishes/${req.files.image[0].filename}` });
      }
      if (req.files?.model3d) {
        return res.json({ url: `${base}/uploads/models/${req.files.model3d[0].filename}` });
      }
      return res.status(400).json({ error: 'No file uploaded' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── PUBLIC: items for the customer-facing menu ────────────────────────────────
router.get('/public/:restaurantId', async (req, res) => {
  try {
    const items = await MenuItem.find({ restaurant: req.params.restaurantId, is_available: true }).sort('sort_order');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: list items for a restaurant ────────────────────────────────────────
router.get('/:restaurantId', protect, async (req, res) => {
  try {
    if (!canAccessRestaurant(req.user, req.params.restaurantId)) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const items = await MenuItem.find({ restaurant: req.params.restaurantId }).sort('-createdAt');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: create item (with optional photo + 3D model upload) ───────────────
router.post('/', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res) => {
    try {
      const base = `${req.protocol}://${req.get('host')}`;
      const data = { ...req.body };
      if (!canAccessRestaurant(req.user, data.restaurant)) {
        return res.status(403).json({ error: 'Not your restaurant' });
      }
      if (req.files?.image)   data.image_url    = `${base}/uploads/dishes/${req.files.image[0].filename}`;
      if (req.files?.model3d) data.model_3d_url = `${base}/uploads/models/${req.files.model3d[0].filename}`;
      if (typeof data.tags === 'string') data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (typeof data.allergens === 'string') data.allergens = data.allergens.split(',').map(a => a.trim()).filter(Boolean);

      const item = await MenuItem.create(data);
      res.status(201).json(item);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── ADMIN: update item ────────────────────────────────────────────────────────
router.put('/:id', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res) => {
    try {
      const existing = await MenuItem.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (!canAccessRestaurant(req.user, existing.restaurant)) {
        return res.status(403).json({ error: 'Not your item' });
      }
      const base = `${req.protocol}://${req.get('host')}`;
      const data = { ...req.body };
      if (req.files?.image)   data.image_url    = `${base}/uploads/dishes/${req.files.image[0].filename}`;
      if (req.files?.model3d) data.model_3d_url = `${base}/uploads/models/${req.files.model3d[0].filename}`;
      if (typeof data.tags === 'string') data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (typeof data.allergens === 'string') data.allergens = data.allergens.split(',').map(a => a.trim()).filter(Boolean);

      Object.assign(existing, data);
      await existing.save();
      res.json(existing);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── ADMIN: delete item ────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!canAccessRestaurant(req.user, item.restaurant)) {
      return res.status(403).json({ error: 'Not your item' });
    }
    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
