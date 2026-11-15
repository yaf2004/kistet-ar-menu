const crypto = require('crypto');
const LoginAttempt = require('../models/LoginAttempt');

const WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 30;
const IP_IDENTITY_LIMIT = 8;

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getAttemptWindow(req, now = Date.now()) {
  const bucket = Math.floor(now / WINDOW_MS);
  const expiresAt = new Date((bucket + 2) * WINDOW_MS);
  const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const keys = [`ip:${hashKey(ip)}:${bucket}`];
  if (email) keys.push(`identity:${hashKey(email)}:${bucket}`);
  return { keys, expiresAt, now };
}

// Reserve each attempt atomically before password verification. This avoids
// a read-then-increment race where concurrent requests could all pass.
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

exports.getAttemptWindow = getAttemptWindow;

exports.loginAttemptLimiter = async (req, res, next) => {
  try {
    const window = getAttemptWindow(req);
    const records = await Promise.all(window.keys.map((key) => increment(key, window.expiresAt)));
    const ipCount = records[0]?.count || 0;
    const identityCount = records[1]?.count || 0;
    res.set('RateLimit-Policy', `${IP_IDENTITY_LIMIT};w=900, ${IP_LIMIT};w=900`);
    if (ipCount > IP_LIMIT || identityCount > IP_IDENTITY_LIMIT) {
      const retryAfter = Math.max(1, Math.ceil((window.expiresAt.getTime() - window.now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many login attempts. Please wait before trying again.' });
    }
    req.loginAttemptWindow = window;
    return next();
  } catch (err) { return next(err); }
};

exports.clearLoginAttempts = async (req) => {
  const window = req.loginAttemptWindow || getAttemptWindow(req);
  // Clear only this caller's IP bucket. Keep the account-wide bucket until
  // expiry so a successful login from another IP cannot reset distributed guesses.
  await LoginAttempt.deleteMany({ key: window.keys.slice(0, 1)[0] });
};
