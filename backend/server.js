require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const models = [
  require('./models/User'),
  require('./models/Restaurant'),
  require('./models/MenuItem'),
  require('./models/MenuCategory'),
  require('./models/LoginAttempt'),
  require('./models/Order'),
  require('./models/RateLimitBucket')
];

async function start() {
  const isProduction = process.env.NODE_ENV === 'production';
  const mongoUri = process.env.MONGO_URI;
  const jwtSecret = process.env.JWT_SECRET;

  if (!mongoUri) {
    if (isProduction) throw new Error('MONGO_URI must be configured in production');
    throw new Error('MONGO_URI is required. Copy backend/.env.example to backend/.env and configure it.');
  }
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 random characters');
  }
  if (!process.env.BASE_URL) throw new Error('BASE_URL must be configured to the public frontend origin');
  if (isProduction && (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)) {
    throw new Error('Cloudinary credentials must be configured in production');
  }
  if (isProduction && !process.env.ALLOWED_ORIGINS) {
    throw new Error('ALLOWED_ORIGINS must contain the exact production frontend origin(s)');
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: isProduction ? false : true
  });
  await Promise.all(models.map((model) => model.createIndexes()));
  console.log('MongoDB connected and indexes verified');

  const port = Number(process.env.PORT || 4000);
  const server = app.listen(port, () => {
    console.log(`Kistet AR Menu API listening on port ${port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received; shutting down gracefully`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('API startup failed:', err.message);
    process.exit(1);
  });
}

module.exports = { start };
