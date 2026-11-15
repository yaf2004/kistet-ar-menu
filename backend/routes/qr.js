const router = require('express').Router();
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const { protect, canAccessRestaurant } = require('../middleware/auth');

function getFrontendBaseUrl() {
  const value = process.env.BASE_URL;
  if (!value) throw new Error('BASE_URL must be configured to the public frontend origin');
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('BASE_URL must use HTTP or HTTPS');
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('BASE_URL must use HTTPS in production');
  }
  return parsed.origin;
}

router.post('/generate/:restaurantId', protect, async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    if (!mongoose.isValidObjectId(restaurantId)) return res.status(400).json({ error: 'Invalid restaurant ID' });
    if (!canAccessRestaurant(req.user, restaurantId)) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const rawCount = req.body.tableCount === undefined ? 10 : Number(req.body.tableCount);
    if (!Number.isInteger(rawCount) || rawCount < 1 || rawCount > 100) {
      return res.status(400).json({ error: 'Table count must be a whole number between 1 and 100' });
    }

    const baseUrl = getFrontendBaseUrl();
    const tables = await Promise.all(Array.from({ length: rawCount }, async (_, index) => {
      const tableNumber = String(index + 1);
      const url = new URL(`/menu/${encodeURIComponent(restaurant.slug)}`, baseUrl);
      url.searchParams.set('table', tableNumber);
      const qrDataUrl = await QRCode.toDataURL(url.toString(), {
        errorCorrectionLevel: 'H',
        width: 400,
        margin: 2
      });
      return { tableNumber, qrUrl: url.toString(), qrDataUrl };
    }));

    restaurant.tables = tables;
    await restaurant.save();
    res.json({ tables });
  } catch (err) { next(err); }
});

module.exports = router;
