const test = require('node:test');
const assert = require('node:assert/strict');
const { ORDER_TRANSITIONS, canTransitionOrder } = require('../lib/orderState');

test('orders follow the defined kitchen workflow', () => {
  assert.equal(canTransitionOrder('new', 'accepted'), true);
  assert.equal(canTransitionOrder('accepted', 'preparing'), true);
  assert.equal(canTransitionOrder('preparing', 'ready'), true);
  assert.equal(canTransitionOrder('ready', 'completed'), true);
});

test('orders cannot skip stages or reopen terminal states', () => {
  assert.equal(canTransitionOrder('new', 'ready'), false);
  assert.equal(canTransitionOrder('completed', 'preparing'), false);
  assert.equal(canTransitionOrder('cancelled', 'accepted'), false);
  assert.equal(canTransitionOrder('unknown', 'accepted'), false);
});

test('cancellation is permitted only before an order is ready', () => {
  assert.equal(canTransitionOrder('new', 'cancelled'), true);
  assert.equal(canTransitionOrder('accepted', 'cancelled'), true);
  assert.equal(canTransitionOrder('preparing', 'cancelled'), true);
  assert.equal(canTransitionOrder('ready', 'cancelled'), false);
});

test('every known state has an explicit transition policy', () => {
  assert.deepEqual(Object.keys(ORDER_TRANSITIONS), [
    'new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'
  ]);
});
