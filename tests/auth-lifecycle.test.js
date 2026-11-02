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

test('unverified email/password accounts cannot receive a session before verifying', () => {
  const { config } = createConfig();

  assert.equal(config.emailAndPassword.enabled, true);
  assert.equal(config.emailAndPassword.requireEmailVerification, true);
  assert.equal(config.emailAndPassword.autoSignIn, false);
  assert.equal(config.emailVerification.autoSignInAfterVerification, false);
});

test('verification and password-reset callbacks have explicit one-hour expiry and safe session behavior', () => {
  const { config } = createConfig();

  assert.equal(config.emailVerification.expiresIn, 3600);
  assert.equal(config.emailVerification.sendOnSignUp, true);
  assert.equal(config.emailVerification.sendOnSignIn, true);
  assert.equal(config.emailAndPassword.resetPasswordTokenExpiresIn, 3600);
  assert.equal(config.emailAndPassword.revokeSessionsOnPasswordReset, true);
  assert.equal(config.emailAndPassword.sendResetPassword instanceof Function, true);
});

test('auth emails use the injected delivery boundary without returning token material', async () => {
  const { config, calls } = createConfig();
  const verification = {
    user: { email: 'verify-1@example.invalid' },
    url: 'https://preview.example.test/api/auth/verify-email?token=synthetic-verification-token',
    token: 'synthetic-verification-token',
  };
  const reset = {
    user: { email: 'reset-1@example.invalid' },
    url: 'https://preview.example.test/api/auth/reset-password/synthetic-reset-token',
    token: 'synthetic-reset-token',
  };

  await config.emailVerification.sendVerificationEmail(verification);
  await config.emailAndPassword.sendResetPassword(reset);

  assert.deepEqual(calls.map(({ kind, to }) => [kind, to]), [
    ['verification', 'verify-1@example.invalid'],
    ['password-reset', 'reset-1@example.invalid'],
  ]);
  assert.equal(calls[0].url, verification.url);
  assert.equal(calls[1].url, reset.url);
  assert.equal(JSON.stringify(calls).includes('synthetic-verification-token'), true);
  assert.equal(Object.hasOwn(config.emailVerification.sendVerificationEmail, 'token'), false);
});

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

test('verification guard is installed as Better Auth server middleware', () => {
  const { config } = createConfig();

  assert.equal(typeof config.hooks.before, 'function');
});

test('Better Auth direct account deletion and email change remain disabled', () => {
  const { config } = createConfig();

  assert.notEqual(config.user?.deleteUser?.enabled, true);
  assert.notEqual(config.user?.changeEmail?.enabled, true);
});
