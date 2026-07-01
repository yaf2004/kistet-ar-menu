const router = require('express').Router();
const QRCode = require('qrcode');
const Restaurant = require('../models/Restaurant');
const { protect } = require('../middleware/auth');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'; // points at the frontend

function canAccessRestaurant(user, restaurantId) {
  return user.role === 'super_admin' || String(user.restaurant) === String(restaurantId);
}

router.post('/generate/:restaurantId', protect, async (req, res) => {
  try {
    if (!canAccessRestaurant(req.user, req.params.restaurantId)) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Not found' });

    const { tableCount = 10 } = req.body;
    const tables = [];
    for (let i = 1; i <= tableCount; i++) {
      const url = `${BASE_URL}/menu/${restaurant.slug}?table=${i}`;
      const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'H', width: 400, margin: 2 });
      tables.push({ tableNumber: String(i), qrUrl: url, qrDataUrl });
    }
    restaurant.tables = tables;
    await restaurant.save();
    res.json({ tables });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
