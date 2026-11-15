const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const mongoose = require('mongoose');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);
const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.set('X-Request-Id', req.requestId);
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.info(JSON.stringify({
      type: 'http_request', requestId: req.requestId, method: req.method,
      path: req.path, status: res.statusCode, durationMs: Math.round(durationMs * 100) / 100
    }));
  });
  next();
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"]
    }
  }
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = configuredOrigins.length ? configuredOrigins : (
      process.env.NODE_ENV === 'production' ? [] : developmentOrigins
    );
    if (allowed.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key', 'X-CSRF-Token'],
  credentials: true,
  maxAge: 600
}));

app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((req, res, next) => {
  if (!req.body || typeof req.body !== 'object') req.body = {};
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/items', require('./routes/items'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/qr', require('./routes/qr'));

app.get('/api/health/live', (req, res) => {
  res.json({ status: 'ok', requestId: req.requestId });
});

app.get('/api/health/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.set('Cache-Control', 'no-store');
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'disconnected', requestId: req.requestId });
});

app.get('/api/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    database: ready ? 'connected' : 'disconnected',
    requestId: req.requestId
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', requestId: req.requestId });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) ? err.status :
    (err.code === 'LIMIT_FILE_SIZE' ? 413 :
      (err.name === 'ValidationError' || err.name === 'CastError' || err.name === 'SyntaxError' ? 400 :
        (err.code === 11000 ? 409 : (err.message === 'Origin is not allowed by CORS' ? 403 : 500))));
  if (status >= 500) {
    console.error('Request failed', { requestId: req.requestId, message: err.message, stack: err.stack });
  }
  const message = status >= 500 ? 'An unexpected server error occurred' : err.message;
  res.status(status).json({ error: message, requestId: req.requestId });
});

module.exports = app;
