const crypto = require('crypto');
const LoginAttempt = require('../models/LoginAttempt');

const WINDOW_MS = 15 * 60 * 1000;

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function increment(key, expiresAt) {
  try {
    return await LoginAttempt.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // A simultaneous first request may win the unique-key upsert race.
    if (err.code !== 11000) throw err;
    return LoginAttempt.findOneAndUpdate(
      { key },
      { $inc: { count: 1 } },
      { new: true }
    );
  }
}

exports.loginAttemptLimiter = async (req, res, next) => {
  try {
    const now = Date.now();
    const bucket = Math.floor(now / WINDOW_MS);
    const expiresAt = new Date((bucket + 2) * WINDOW_MS);
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const keys = [`ip:${hashKey(ip)}:${bucket}`];
    if (email) keys.push(`identity:${hashKey(email)}:${bucket}`);
    const attempts = await Promise.all(keys.map((key) => increment(key, expiresAt)));
    res.set('RateLimit-Policy', '8;w=900');
    if (attempts[0].count > 30 || (attempts[1] && attempts[1].count > 8)) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000))));
      return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }
    next();
  } catch (err) { next(err); }
};
