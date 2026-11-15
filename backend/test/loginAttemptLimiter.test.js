const test = require('node:test');
const assert = require('node:assert/strict');
const { getAttemptWindow } = require('../middleware/loginAttemptLimiter');

test('account login throttle key is shared across source IPs', () => {
  const now = 1_800_000_000_000;
  const first = getAttemptWindow({ ip: '203.0.113.10', body: { email: 'Owner@Example.com' } }, now);
  const second = getAttemptWindow({ ip: '198.51.100.22', body: { email: ' owner@example.com ' } }, now);

  assert.notEqual(first.keys[0], second.keys[0], 'IP buckets should remain independent');
  assert.equal(first.keys[1], second.keys[1], 'the account bucket must not include the source IP');
  assert.match(first.keys[1], /^identity:[a-f0-9]{64}:\d+$/);
  assert.equal(first.keys.some((key) => key.includes('owner@example.com')), false, 'email must not be stored in plaintext in the rate-limit key');
});

test('different accounts receive independent account throttle keys', () => {
  const now = 1_800_000_000_000;
  const first = getAttemptWindow({ ip: '203.0.113.10', body: { email: 'one@example.com' } }, now);
  const second = getAttemptWindow({ ip: '203.0.113.10', body: { email: 'two@example.com' } }, now);

  assert.notEqual(first.keys[1], second.keys[1]);
});
