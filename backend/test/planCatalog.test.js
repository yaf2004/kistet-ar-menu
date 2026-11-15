const test = require('node:test');
const assert = require('node:assert/strict');
const { PLAN_DEFINITIONS, subscriptionIsUsable, checkLimit, createTrialDates } = require('../lib/planCatalog');

test('the SaaS catalog defines unique plans with ordered, positive limits', () => {
  assert.deepEqual(PLAN_DEFINITIONS.map((plan) => plan.code), ['starter', 'growth', 'scale']);
  for (const plan of PLAN_DEFINITIONS) {
    for (const limit of Object.values(plan.limits)) assert.ok(Number.isFinite(limit) && limit > 0);
  }
  assert.ok(PLAN_DEFINITIONS[1].limits.menuItems > PLAN_DEFINITIONS[0].limits.menuItems);
  assert.ok(PLAN_DEFINITIONS[2].limits.monthlyOrders > PLAN_DEFINITIONS[1].limits.monthlyOrders);
});

test('active subscriptions are usable and expired trials are not', () => {
  const now = new Date('2026-11-15T00:00:00.000Z');
  assert.equal(subscriptionIsUsable({ status: 'active' }, now), true);
  assert.equal(subscriptionIsUsable({ status: 'trialing', trialEndsAt: new Date('2026-11-16T00:00:00.000Z') }, now), true);
  assert.equal(subscriptionIsUsable({ status: 'trialing', trialEndsAt: new Date('2026-11-14T00:00:00.000Z') }, now), false);
  assert.equal(subscriptionIsUsable({ status: 'suspended' }, now), false);
  assert.equal(subscriptionIsUsable(null, now), false);
});

test('plan limit checks report remaining capacity and reject overages', () => {
  const plan = { limits: { menuItems: 30 } };
  assert.deepEqual(checkLimit(plan, 'menuItems', 28, 2), {
    allowed: true, limit: 30, current: 28, remaining: 2
  });
  assert.equal(checkLimit(plan, 'menuItems', 30).allowed, false);
  assert.equal(checkLimit(plan, 'missing', 0).allowed, false);
});

test('trial provisioning creates a fourteen-day trial window', () => {
  const start = new Date('2026-11-15T00:00:00.000Z');
  const dates = createTrialDates(start);
  assert.equal(dates.trialEndsAt.toISOString(), '2026-11-29T00:00:00.000Z');
  assert.equal(dates.currentPeriodStart, start);
});
