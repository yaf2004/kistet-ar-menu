const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canAccessRestaurant,
  requireSuperAdmin,
  scopeToOwnRestaurant,
  signToken
} = require('../middleware/auth');

test('super administrators can access any restaurant', () => {
  assert.equal(canAccessRestaurant({ role: 'super_admin', restaurant: null }, 'restaurant-b'), true);
});

test('restaurant administrators can access only their assigned restaurant', () => {
  const user = { role: 'restaurant_admin', restaurant: 'restaurant-a' };
  assert.equal(canAccessRestaurant(user, 'restaurant-a'), true);
  assert.equal(canAccessRestaurant(user, 'restaurant-b'), false);
});

test('unassigned restaurant administrators cannot access tenant data', () => {
  assert.equal(canAccessRestaurant({ role: 'restaurant_admin', restaurant: null }, 'restaurant-a'), false);
});

test('tenant scope middleware rejects cross-restaurant requests', () => {
  const req = {
    user: { role: 'restaurant_admin', restaurant: 'restaurant-a' },
    params: { restaurantId: 'restaurant-b' },
    body: {}
  };
  let nextCalled = false;
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  scopeToOwnRestaurant(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.code, 403);
});

test('tenant scope middleware allows the assigned restaurant', () => {
  const req = {
    user: { role: 'restaurant_admin', restaurant: 'restaurant-a' },
    params: { restaurantId: 'restaurant-a' },
    body: {}
  };
  let nextCalled = false;
  scopeToOwnRestaurant(req, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('super-admin middleware rejects non-platform administrators', () => {
  let nextCalled = false;
  const req = { user: { role: 'restaurant_admin' } };
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  requireSuperAdmin(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.code, 403);
});

test('signed access tokens carry issuer and audience claims', () => {
  process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
  const token = signToken('user-123');
  const jwt = require('jsonwebtoken');
  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'kistet-ar-menu',
    audience: 'kistet-ar-menu-web',
    algorithms: ['HS256']
  });
  assert.equal(decoded.sub, 'user-123');
});
