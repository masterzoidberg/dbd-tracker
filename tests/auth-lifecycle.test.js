import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthConfig } from '../src/auth/config.js';

function createConfig(overrides = {}) {
  const calls = [];
  const config = createAuthConfig({
    env: {
      VERCEL_URL: 'dbd-tracker-git-codex-ledger-production-auth-readiness.vercel.app',
      BETTER_AUTH_SECRET: 'test-only-secret-value-not-for-a-real-account',
    },
    database: { testDatabase: true },
    emailDelivery: async message => { calls.push(message); },
    rateLimitStorage: { async consume() { return { allowed: true, retryAfter: null }; } },
    verificationTokenGuard: async () => {},
    ...overrides,
  });
  return { config, calls };
}

test('auth endpoint rate limits persist through the injected atomic store and use Vercel client IP only', () => {
  const store = { async consume() { return { allowed: true, retryAfter: null }; } };
  const { config } = createConfig({ rateLimitStorage: store });

  assert.equal(config.rateLimit.enabled, true);
  assert.equal(config.rateLimit.customStorage, store);
  assert.deepEqual(config.advanced.ipAddress.ipAddressHeaders, ['x-forwarded-for']);
  assert.deepEqual(config.rateLimit.customRules, {
    '/sign-up/email': { window: 60, max: 5 },
    '/sign-in/email': { window: 60, max: 5 },
    '/send-verification-email': { window: 300, max: 3 },
    '/request-password-reset': { window: 300, max: 3 },
    '/verify-email': { window: 60, max: 5 },
    '/reset-password': { window: 60, max: 5 },
    '/reset-password/*': { window: 60, max: 5 },
  });
});

test('Better Auth direct account deletion and email change remain disabled', () => {
  const { config } = createConfig();

  assert.notEqual(config.user?.deleteUser?.enabled, true);
  assert.notEqual(config.user?.changeEmail?.enabled, true);
});
