const crypto = require('crypto');
const LoginAttempt = require('../models/LoginAttempt');

const WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 30;
const IP_IDENTITY_LIMIT = 8;

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getAttemptWindow(req) {
  const now = Date.now();
  const bucket = Math.floor(now / WINDOW_MS);
  const expiresAt = new Date((bucket + 2) * WINDOW_MS);
  const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const keys = [`ip:${hashKey(ip)}:${bucket}`];
  if (email) keys.push(`identity:${hashKey(ip + ':' + email)}:${bucket}`);
  return { keys, expiresAt, now };
}

async function increment(key, expiresAt) {
  try {
    return await LoginAttempt.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    return LoginAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
  }
}

exports.loginAttemptLimiter = async (req, res, next) => {
  try {
    const window = getAttemptWindow(req);
    const records = await LoginAttempt.find({ key: { $in: window.keys } }).select('key count').lean();
    const counts = new Map(records.map((record) => [record.key, record.count]));
    const ipCount = counts.get(window.keys[0]) || 0;
    const identityCount = window.keys[1] ? counts.get(window.keys[1]) || 0 : 0;
    res.set('RateLimit-Policy', `${IP_IDENTITY_LIMIT};w=900, ${IP_LIMIT};w=900`);
    if (ipCount >= IP_LIMIT || identityCount >= IP_IDENTITY_LIMIT) {
      const retryAfter = Math.max(1, Math.ceil((window.expiresAt.getTime() - window.now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many failed login attempts. Please wait before trying again.' });
    }
    req.loginAttemptWindow = window;
    return next();
  } catch (err) { return next(err); }
};

exports.recordFailedLoginAttempt = async (req) => {
  const window = req.loginAttemptWindow || getAttemptWindow(req);
  await Promise.all(window.keys.map((key) => increment(key, window.expiresAt)));
};

exports.clearLoginAttempts = async (req) => {
  const window = req.loginAttemptWindow || getAttemptWindow(req);
  await LoginAttempt.deleteMany({ key: { $in: window.keys } });
};
