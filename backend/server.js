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

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

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
