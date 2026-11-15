// One-time setup script: creates YOUR super_admin account.
// Run with: npm run seed
// (You'll be prompted in the terminal for your name, email, and password.)

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to database.\n');

  const existing = await User.findOne({ role: 'super_admin' });
  if (existing) {
    console.log(`A super admin already exists: ${existing.email}`);
    console.log('If you forgot the password, delete this user from the database and run this script again.');
    process.exit(0);
  }

  console.log('No super admin found yet. Let\'s create your account.\n');
  const name = await ask('Your name: ');
  const email = await ask('Your email (this will be your login): ');
  const password = await ask('Your password (min 12 characters): ');

  if (!name || !email || !password || password.length < 12) {
    console.log('\nAll fields are required and password must be at least 12 characters. Try again.');
    process.exit(1);
  }

  const user = await User.create({ name, email, password, role: 'super_admin', restaurant: null });
  console.log(`\nSuper admin account created: ${user.email}`);
  console.log('You can now log in with these credentials at the admin login page.');
  await mongoose.disconnect();
  rl.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
