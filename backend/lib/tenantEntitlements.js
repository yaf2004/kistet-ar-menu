const Subscription = require('../models/Subscription');
const { subscriptionIsUsable, checkLimit } = require('./planCatalog');

async function getTenantSubscription(restaurantId) {
  return Subscription.findOne({ restaurant: restaurantId }).populate('plan').lean();
}

async function requireUsableSubscription(restaurantId) {
  const subscription = await getTenantSubscription(restaurantId);
  if (!subscriptionIsUsable(subscription)) {
    const error = new Error('This restaurant subscription is not active. Contact the platform administrator to restore access.');
    error.status = 402;
    error.code = 'SUBSCRIPTION_INACTIVE';
    throw error;
  }
  return subscription;
}

async function enforceLimit(restaurantId, key, currentCount, increment = 1) {
  const subscription = await requireUsableSubscription(restaurantId);
  const result = checkLimit(subscription.plan, key, currentCount, increment);
  if (!result.allowed) {
    const error = new Error(`Your ${subscription.plan.name} plan allows up to ${result.limit} ${key}. Upgrade the plan or remove existing usage to continue.`);
    error.status = 409;
    error.code = 'PLAN_LIMIT_REACHED';
    error.limit = result.limit;
    error.current = result.current;
    throw error;
  }
  return subscription;
}

module.exports = { getTenantSubscription, requireUsableSubscription, enforceLimit };
