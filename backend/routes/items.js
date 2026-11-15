const router = require('express').Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const MenuCategory = require('../models/MenuCategory');
const Restaurant = require('../models/Restaurant');
const { protect, canAccessRestaurant } = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/cloudinary');

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_MODEL_BYTES = 4 * 1024 * 1024;
const editableFields = [
  'category_id', 'name', 'description', 'price', 'is_available',
  'is_featured', 'ar_enabled', 'image_url', 'model_3d_url', 'tags', 'allergens', 'ingredients', 'sort_order'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MODEL_BYTES, files: 2, fields: 30, parts: 34, fieldNestingDepth: 2, fieldArrayIndexLimit: 100 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const imageOk = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) &&
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    const modelOk = ext === 'glb' && ['model/gltf-binary', 'application/octet-stream'].includes(file.mimetype);
    if (imageOk || modelOk) return cb(null, true);
    cb(new Error('Unsupported upload. Use JPEG, PNG, WebP, or binary GLB files only.'));
  }
});

function parseList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return value;
}

function pickEditableFields(source) {
  const data = {};
  for (const key of editableFields) {
    if (Object.prototype.hasOwnProperty.call(source, key)) data[key] = source[key];
  }
  if (typeof data.tags === 'string') data.tags = parseList(data.tags);
  if (typeof data.allergens === 'string') data.allergens = parseList(data.allergens);
  return data;
}

function validateFileSignature(file) {
  if (!file) return true;
  const b = file.buffer;
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === 'png') return b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === 'webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  if (ext === 'glb') {
    if (b.length < 20 || b.toString('ascii', 0, 4) !== 'glTF' ||
        b.readUInt32LE(4) !== 2 || b.readUInt32LE(8) !== b.length) return false;
    const jsonLength = b.readUInt32LE(12);
    const jsonType = b.readUInt32LE(16);
    if (jsonType !== 0x4e4f534a || jsonLength < 2 || 20 + jsonLength > b.length) return false;
    try {
      const document = JSON.parse(b.toString('utf8', 20, 20 + jsonLength).trim());
      if (document.asset?.version !== '2.0') return false;
      if ((document.buffers || []).some((entry) => entry.uri)) return false;
      if ((document.images || []).some((entry) => entry.uri && !entry.uri.startsWith('data:'))) return false;
      return true;
    } catch { return false; }
  }
  return false;
}

async function handleFileUpload(file, kind, restaurantId) {
  if (!file) return null;
  if (!validateFileSignature(file)) {
    const error = new Error('The uploaded file content does not match its file type');
    error.status = 400;
    throw error;
  }
  const isModel = kind === 'model';
  if (!isModel && file.size > MAX_IMAGE_BYTES) {
    const error = new Error('Images must be 4 MB or smaller');
    error.status = 413;
    throw error;
  }
  const result = await uploadToCloudinary(file.buffer, {
    folder: `ar-menu/${restaurantId}/${isModel ? 'models' : 'dishes'}`,
    resourceType: isModel ? 'raw' : 'image',
    publicId: uuidv4()
  });
  return result.secure_url;
}

function isTenantAssetUrl(value, restaurantId, kind, existingValue) {
  if (value === undefined || value === null || value === '') return true;
  if (existingValue && value === existingValue) return true;
  try {
    const url = new URL(value);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const folder = kind === 'model' ? 'models' : 'dishes';
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
      Boolean(cloudName) && url.pathname.includes(`/${cloudName}/`) &&
      url.pathname.includes(`/ar-menu/${restaurantId}/${folder}/`);
  } catch { return false; }
}

async function validateCategory(categoryId, restaurantId) {
  if (!mongoose.isValidObjectId(categoryId)) return false;
  return Boolean(await MenuCategory.exists({ _id: categoryId, restaurant: restaurantId }));
}

router.post('/upload-only', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const restaurantId = req.body.restaurant || req.query.restaurant;
      if (!mongoose.isValidObjectId(restaurantId)) {
        return res.status(400).json({ error: 'A valid restaurant ID is required for uploads' });
      }
      if (!canAccessRestaurant(req.user, restaurantId)) {
        return res.status(403).json({ error: 'Not your restaurant' });
      }
      if (!await Restaurant.exists({ _id: restaurantId })) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      const imageFile = req.files?.image?.[0];
      const modelFile = req.files?.model3d?.[0];
      if (!imageFile && !modelFile) return res.status(400).json({ error: 'No file uploaded' });
      if (imageFile && modelFile) return res.status(400).json({ error: 'Upload one asset at a time' });
      const url = imageFile
        ? await handleFileUpload(imageFile, 'image', restaurantId)
        : await handleFileUpload(modelFile, 'model', restaurantId);
      res.status(201).json({ url });
    } catch (err) { next(err); }
  }
);

router.get('/public/:restaurantId', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }
    if (!await Restaurant.exists({ _id: req.params.restaurantId, active: true })) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const items = await MenuItem.find({
      restaurant: req.params.restaurantId,
      is_available: true
    }).select('category_id name description price image_url is_featured ar_enabled model_3d_url tags allergens ingredients sort_order')
      .sort({ sort_order: 1, name: 1 }).lean();
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json(items);
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
    const items = await MenuItem.find({ restaurant: req.params.restaurantId })
      .sort({ sort_order: 1, createdAt: -1 }).lean();
    res.json(items);
  } catch (err) { next(err); }
});

router.post('/', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const restaurantId = req.body.restaurant;
      if (!mongoose.isValidObjectId(restaurantId)) {
        return res.status(400).json({ error: 'A valid restaurant is required' });
      }
      if (!canAccessRestaurant(req.user, restaurantId)) {
        return res.status(403).json({ error: 'Not your restaurant' });
      }
      if (!await Restaurant.exists({ _id: restaurantId })) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      const data = pickEditableFields(req.body);
      if (typeof data.name !== 'string' || !data.name.trim()) {
        return res.status(400).json({ error: 'Item name is required' });
      }
      if (!Number.isFinite(Number(data.price)) || Number(data.price) < 0) {
        return res.status(400).json({ error: 'A valid non-negative price is required' });
      }
      data.price = Number(data.price);
      if (!await validateCategory(data.category_id, restaurantId)) {
        return res.status(400).json({ error: 'The selected category does not belong to this restaurant' });
      }
      if (req.body.image_url && !isTenantAssetUrl(req.body.image_url, restaurantId, 'image')) {
        return res.status(400).json({ error: 'Image must be uploaded to this restaurant\'s asset library' });
      }
      if (req.body.model_3d_url && !isTenantAssetUrl(req.body.model_3d_url, restaurantId, 'model')) {
        return res.status(400).json({ error: '3D model must be uploaded to this restaurant\'s asset library' });
      }
      if (req.files?.image?.[0]) data.image_url = await handleFileUpload(req.files.image[0], 'image', restaurantId);
      if (req.files?.model3d?.[0]) data.model_3d_url = await handleFileUpload(req.files.model3d[0], 'model', restaurantId);
      data.ar_enabled = Boolean(data.model_3d_url) && data.ar_enabled !== false && data.ar_enabled !== 'false';
      const item = await MenuItem.create({ ...data, restaurant: restaurantId, name: data.name.trim() });
      res.status(201).json(item);
    } catch (err) { next(err); }
  }
);

router.put('/:id', protect,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model3d', maxCount: 1 }]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }
      const existing = await MenuItem.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Menu item not found' });
      if (!canAccessRestaurant(req.user, existing.restaurant)) {
        return res.status(403).json({ error: 'Not your item' });
      }

      const data = pickEditableFields(req.body);
      if (req.body.image_url === '') data.image_url = undefined;
      if (req.body.model_3d_url === '') data.model_3d_url = undefined;
      if (Object.prototype.hasOwnProperty.call(data, 'name')) {
        if (typeof data.name !== 'string' || !data.name.trim()) {
          return res.status(400).json({ error: 'Item name cannot be empty' });
        }
        data.name = data.name.trim();
      }
      if (Object.prototype.hasOwnProperty.call(data, 'price')) {
        if (!Number.isFinite(Number(data.price)) || Number(data.price) < 0) {
          return res.status(400).json({ error: 'A valid non-negative price is required' });
        }
        data.price = Number(data.price);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'category_id') &&
          !await validateCategory(data.category_id, existing.restaurant)) {
        return res.status(400).json({ error: 'The selected category does not belong to this restaurant' });
      }
      if (!isTenantAssetUrl(data.image_url, existing.restaurant, 'image', existing.image_url)) {
        return res.status(400).json({ error: 'Image must belong to this restaurant\'s asset library' });
      }
      if (!isTenantAssetUrl(data.model_3d_url, existing.restaurant, 'model', existing.model_3d_url)) {
        return res.status(400).json({ error: '3D model must belong to this restaurant\'s asset library' });
      }
      if (req.files?.image?.[0]) data.image_url = await handleFileUpload(req.files.image[0], 'image', existing.restaurant);
      if (req.files?.model3d?.[0]) data.model_3d_url = await handleFileUpload(req.files.model3d[0], 'model', existing.restaurant);
      Object.assign(existing, data);
      if (!existing.model_3d_url) existing.ar_enabled = false;
      await existing.save();
      res.json(existing);
    } catch (err) { next(err); }
  }
);

router.delete('/:id', protect, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    if (!canAccessRestaurant(req.user, item.restaurant)) {
      return res.status(403).json({ error: 'Not your item' });
    }
    await item.deleteOne();
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
