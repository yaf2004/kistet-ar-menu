const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('kistet-dummy-login-password', 12);
const { loginAttemptLimiter, clearLoginAttempts } = require('../middleware/loginAttemptLimiter');
const {
  signToken,
  protect,
  sessionCookieName,
  csrfCookieName,
  createCsrfToken
} = require('../middleware/auth');

function setSessionCookies(res, token, csrfToken) {
  const sessionAge = 12 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'None' : 'Lax';
  res.append('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; Max-Age=${sessionAge}; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}`);
  res.append('Set-Cookie', `${csrfCookieName}=${encodeURIComponent(csrfToken)}; Path=/; Max-Age=${sessionAge}; SameSite=${sameSite}${secure ? '; Secure' : ''}`);
}

function clearSessionCookies(res) {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'None' : 'Lax';
  res.append('Set-Cookie', `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}`);
  res.append('Set-Cookie', `${csrfCookieName}=; Path=/; Max-Age=0; SameSite=${sameSite}${secure ? '; Secure' : ''}`);
}

function readCookie(req, name) {
  const prefix = `${name}=`;
  const entry = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return '';
  try { return decodeURIComponent(entry.slice(prefix.length)); }
  catch { return ''; }
}

router.get('/csrf', (req, res) => {
  const existing = readCookie(req, csrfCookieName);
  const csrfToken = existing || createCsrfToken();
  if (!existing) {
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = secure ? 'None' : 'Lax';
    res.append('Set-Cookie', `${csrfCookieName}=${encodeURIComponent(csrfToken)}; Path=/; Max-Age=43200; SameSite=${sameSite}${secure ? '; Secure' : ''}`);
  }
  res.set('Cache-Control', 'no-store');
  return res.json({ csrfToken });
});

function requireTrustedOrigin(req, res, next) {
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const allowed = configured.length ? configured : (
    process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']
  );
  if ((origin && !allowed.includes(origin)) || (!origin && process.env.NODE_ENV === 'production')) {
    return res.status(403).json({ error: 'Untrusted request origin' });
  }
  return next();
}

router.post('/login', requireTrustedOrigin, loginAttemptLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password || email.length > 254 || password.length > 1024) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email })
      .select('+password')
      .populate('restaurant', 'name slug active');
    const passwordMatches = user
      ? await user.comparePassword(password)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    await clearLoginAttempts(req);
    if (user.role === 'restaurant_admin' && (!user.restaurant || !user.restaurant.active)) {
      return res.status(403).json({ error: 'This restaurant account is currently unavailable' });
    }

    const csrfToken = createCsrfToken();
    setSessionCookies(res, signToken(user._id, user.tokenVersion || 0), csrfToken);
    res.set('Cache-Control', 'no-store');
    return res.json({
      csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant: user.restaurant
      }
    });
  } catch (err) { return next(err); }
});

router.post('/logout', protect, async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    clearSessionCookies(res);
  res.set('Cache-Control', 'no-store');
    return res.status(204).end();
  } catch (err) { return next(err); }
});

router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('restaurant', 'name slug active')
      .lean();
    if (!user) return res.status(401).json({ error: 'Account is no longer available' });
    res.set('Cache-Control', 'no-store');
    return res.json(user);
  } catch (err) { return next(err); }
});

module.exports = router;
