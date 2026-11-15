const crypto = require('crypto');
const RateLimitBucket = require('../models/RateLimitBucket');

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ORDERS_PER_WINDOW = 10;

module.exports = async function orderCreationLimiter(req, res, next) {
  try {
    const now = Date.now();
    const bucket = Math.floor(now / WINDOW_MS);
    const expiresAt = new Date((bucket + 2) * WINDOW_MS);
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const key = `public-order:${crypto.createHash('sha256').update(ip).digest('hex')}:${bucket}`;
    let record;
    try {
      record = await RateLimitBucket.findOneAndUpdate(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
      record = await RateLimitBucket.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    }
    res.set('RateLimit-Policy', `${MAX_ORDERS_PER_WINDOW};w=600`);
    if (record.count > MAX_ORDERS_PER_WINDOW) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000))));
      return res.status(429).json({ error: 'Too many order attempts. Please wait and try again.' });
    }
    return next();
  } catch (err) { return next(err); }
};
