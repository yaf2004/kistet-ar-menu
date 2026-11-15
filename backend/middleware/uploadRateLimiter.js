const crypto = require('crypto');
const RateLimitBucket = require('../models/RateLimitBucket');

const WINDOW_MS = 60 * 60 * 1000;
const MAX_UPLOAD_REQUESTS = 30;

module.exports = async function uploadRateLimiter(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  try {
    const now = Date.now();
    const bucket = Math.floor(now / WINDOW_MS);
    const expiresAt = new Date((bucket + 2) * WINDOW_MS);
    const actor = String(req.user?._id || req.ip || req.socket.remoteAddress || 'unknown');
    const digest = crypto.createHash('sha256').update(actor).digest('hex');
    const key = `asset-upload:${digest}:${bucket}`;
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
    res.set('RateLimit-Policy', `${MAX_UPLOAD_REQUESTS};w=3600`);
    if (record.count > MAX_UPLOAD_REQUESTS) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000))));
      return res.status(429).json({ error: 'Upload limit reached. Try again later.' });
    }
    return next();
  } catch (err) { return next(err); }
};
