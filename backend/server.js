require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
// crossOriginResourcePolicy: false allows the frontend (running on a
// different port, e.g. 5174) to actually load images served from
// /uploads — without this, the browser blocks them even though the
// request itself succeeds (shows as ERR_BLOCKED_BY_RESPONSE.NotSameOrigin).
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded dish photos & 3D models as plain files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/categories',  require('./routes/categories'));
app.use('/api/items',       require('./routes/items'));
app.use('/api/qr',          require('./routes/qr'));
app.get('/api/test-cloudinary', async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    const result = await cloudinary.api.ping()
    res.json({ success: true, result })
  } catch (err) {
    res.json({ success: false, error: err.message })
  }
})
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Keep-alive: ping ourselves every 14 minutes so Render's free tier
// doesn't spin down the server (it sleeps after 15 min of inactivity).
// This means the first load is always fast, not 30-60 seconds.
if (process.env.NODE_ENV !== 'development') {
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL?.replace(/\/menu.*/, '');
  if (SELF_URL) {
    setInterval(async () => {
      try {
        await fetch(`${SELF_URL}/api/health`);
        console.log('Keep-alive ping sent');
      } catch (e) {
        console.log('Keep-alive ping failed:', e.message);
      }
    }, 14 * 60 * 1000); // every 14 minutes
  }
}

// ── Database connection ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kistet-ar-menu';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected:', MONGO_URI.includes('localhost') ? 'local' : 'Atlas cloud'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running -> http://localhost:${PORT}`);
  console.log(`Health check     -> http://localhost:${PORT}/api/health`);
});

module.exports = app;
