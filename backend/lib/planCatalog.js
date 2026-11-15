const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_DEFINITIONS = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'A practical starting plan for a single restaurant.',
    limits: { menuItems: 30, categories: 6, monthlyOrders: 100, arItems: 3, assetBytes: 15 * 1024 * 1024 },
    features: ['digital_menu', 'qr_codes', 'ordering', 'ar_viewer'],
    sortOrder: 1
  },
  {
    code: 'growth',
    name: 'Growth',
    description: 'More menu capacity and richer AR for growing restaurants.',
    limits: { menuItems: 150, categories: 25, monthlyOrders: 1500, arItems: 30, assetBytes: 15 * 1024 * 1024 },
    features: ['digital_menu', 'qr_codes', 'ordering', 'ar_viewer', 'advanced_ar', 'menu_analytics'],
    sortOrder: 2
  },
  {
    code: 'scale',
    name: 'Scale',
    description: 'High-volume capacity for established restaurant operators.',
    limits: { menuItems: 1000, categories: 100, monthlyOrders: 15000, arItems: 300, assetBytes: 15 * 1024 * 1024 },
    features: ['digital_menu', 'qr_codes', 'ordering', 'ar_viewer', 'advanced_ar', 'menu_analytics', 'priority_support'],
    sortOrder: 3
  }
];

function subscriptionIsUsable(subscription, now = new Date()) {
  if (!subscription) return false;
  if (subscription.status === 'active') return true;
  return subscription.status === 'trialing' &&
    subscription.trialEndsAt instanceof Date &&
    subscription.trialEndsAt.getTime() > now.getTime();
}

function checkLimit(plan, key, current, increment = 1) {
  const limit = plan?.limits?.[key];
  if (!Number.isFinite(limit)) return { allowed: false, limit: 0, current, remaining: 0 };
  return {
    allowed: current + increment <= limit,
    limit,
    current,
    remaining: Math.max(0, limit - current)
  };
}

function createTrialDates(now = new Date()) {
  return {
    startsAt: now,
    currentPeriodStart: now,
    trialEndsAt: new Date(now.getTime() + 14 * DAY_MS)
  };
}

module.exports = { PLAN_DEFINITIONS, subscriptionIsUsable, checkLimit, createTrialDates };
