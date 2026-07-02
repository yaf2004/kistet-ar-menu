const router = require('express').Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const MenuItem = require('../models/MenuItem');
const { protect } = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/cloudinary');

// Use memory storage — files go to Cloudinary, not local disk
// (local disk doesn't persist on Render's free tier)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (/jpeg|jpg|png|webp|glb|gltf/.test(ext)) cb(null, true);
    else cb(new Error('Invalid file type. Use jpg/png/webp for photos, glb/gltf for 3D models.'));
  }
});

function canAccessRestaurant(user, restaurantId) {
  return user.role === 'super_admin' || String(user.restaurant) === String(restaurantId);
}

// Upload a file from the request to Cloudinary, returns the secure URL
async function handleFileUpload(file) {
  if (!file) return null;
  const ext = file.originalname.split('.').pop().toLowerCase();
  const isModel = /glb|gltf/.test(ext);
  const result = await uploadToCloudinary(file.buffer, {
    folder: isModel ? 'ar-menu/models' : 'ar-menu/dishes',
    resourceType: isModel ? 'raw' : 'image',
    publicId: uuidv4()
  });
  return result.secure_url;
}

// ── ADMIN: standalone file upload (for restaurant logo/cover or 3D models) ──
router.post('/upload-only', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res) => {
    try {
      if (req.files?.image) {
        const url = await handleFileUpload(req.files.image[0]);
        return res.json({ url });
      }
      if (req.files?.model3d) {
        const url = await handleFileUpload(req.files.model3d[0]);
        return res.json({ url });
      }
      return res.status(400).json({ error: 'No file uploaded' });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUBLIC: items for the customer-facing menu ──
router.get('/public/:restaurantId', async (req, res) => {
  try {
    const items = await MenuItem.find({ restaurant: req.params.restaurantId, is_available: true }).sort('sort_order');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: list items for a restaurant ──
router.get('/:restaurantId', protect, async (req, res) => {
  try {
    if (!canAccessRestaurant(req.user, req.params.restaurantId)) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const items = await MenuItem.find({ restaurant: req.params.restaurantId }).sort('-createdAt');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: create item ──
router.post('/', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res) => {
    try {
      const data = { ...req.body };
      if (!canAccessRestaurant(req.user, data.restaurant)) {
        return res.status(403).json({ error: 'Not your restaurant' });
      }
      if (req.files?.image)   data.image_url    = await handleFileUpload(req.files.image[0]);
      if (req.files?.model3d) data.model_3d_url = await handleFileUpload(req.files.model3d[0]);
      if (typeof data.tags === 'string') data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (typeof data.allergens === 'string') data.allergens = data.allergens.split(',').map(a => a.trim()).filter(Boolean);
      const item = await MenuItem.create(data);
      res.status(201).json(item);
    } catch (err) {
      console.error('Create item error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── ADMIN: update item ──
router.put('/:id', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res) => {
    try {
      const existing = await MenuItem.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (!canAccessRestaurant(req.user, existing.restaurant)) {
        return res.status(403).json({ error: 'Not your item' });
      }
      const data = { ...req.body };
      if (req.files?.image)   data.image_url    = await handleFileUpload(req.files.image[0]);
      if (req.files?.model3d) data.model_3d_url = await handleFileUpload(req.files.model3d[0]);
      if (typeof data.tags === 'string') data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (typeof data.allergens === 'string') data.allergens = data.allergens.split(',').map(a => a.trim()).filter(Boolean);
      Object.assign(existing, data);
      await existing.save();
      res.json(existing);
    } catch (err) {
      console.error('Update item error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── ADMIN: delete item ──
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
