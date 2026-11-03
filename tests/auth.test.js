import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAuthRuntime } from '../src/auth/runtime.js';
import { createAuthRoute } from '../api/auth/[...].js';

const previewEnv = () => ({
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'dbd-tracker-preview.vercel.app',
  VERCEL_BRANCH_URL: 'dbd-tracker-git-codex-ledger-production-auth-readiness.vercel.app',
  DATABASE_URL: 'postgresql://test.invalid/ledger',
  BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
});

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('auth route returns 404 outside Preview before loading auth runtime', async () => {
  let loaded = false;
  const route = createAuthRoute({
    env: { VERCEL_ENV: 'production' },
    getRuntime: async () => { loaded = true; throw Error('must not load'); },
  });
  const res = response();

  await route({ method: 'GET' }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Not found.' });
  assert.equal(loaded, false);
});

test('auth splat route restores nested Better Auth paths after Vercel routing', async () => {
  let routedUrl;
  const route = createAuthRoute({
    env: { VERCEL_ENV: 'preview' },
    getRuntime: async () => ({
      async handle(req, res) {
        routedUrl = req.url;
        return res.status(200).json(null);
      },
    }),
  });
  const res = response();

  await route({
    method: 'POST',
    url: '/api/auth/[...]?path=sign-up%2Femail&callbackURL=%2Fdashboard',
    query: { path: 'sign-up/email', callbackURL: '/dashboard' },
  }, res);

  assert.equal(routedUrl, '/api/auth/sign-up/email?callbackURL=%2Fdashboard');
});

test('auth runtime refuses missing Preview credentials before creating a pool', () => {
  let created = false;

  assert.throws(
    () => createAuthRuntime({ env: { VERCEL_ENV: 'preview' }, createPool: () => { created = true; } }),
    error => error.message === 'Authentication is unavailable.',
  );

  assert.equal(created, false);
});

test('auth runtime configures an exact Preview host and secure cookie protections', () => {
  const env = previewEnv();
  let options;
  const runtime = createAuthRuntime({
    env,
    createPool: connectionString => ({ connectionString }),
    attachPool() {},
    createRateLimitStorage: () => ({ async consume() { return { allowed: true, retryAfter: null }; } }),
    createVerificationTokenGuard: () => async () => {},
    createAuth: config => {
      options = config;
      return { handler() {}, api: { async getSession() { return null; } } };
    },
    createNodeHandler: handler => handler,
  });

  assert.deepEqual(options.baseURL, {
    allowedHosts: [env.VERCEL_URL, env.VERCEL_BRANCH_URL],
    protocol: 'https',
  });
  assert.equal(options.advanced.useSecureCookies, true);
  assert.deepEqual(options.advanced.defaultCookieAttributes, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
  assert.notEqual(options.advanced.disableCSRFCheck, true);
  assert.notEqual(options.advanced.disableOriginCheck, true);
  assert.equal(options.emailAndPassword.enabled, true);
  assert.equal(options.emailAndPassword.requireEmailVerification, true);
  assert.equal(options.emailAndPassword.revokeSessionsOnPasswordReset, true);
  assert.equal(options.emailAndPassword.resetPasswordTokenExpiresIn, 3600);
  assert.equal(options.emailVerification.expiresIn, 3600);
  assert.equal(options.emailVerification.sendOnSignUp, true);
  assert.equal(options.emailVerification.sendOnSignIn, true);
  assert.equal(options.emailVerification.autoSignInAfterVerification, false);
  assert.notEqual(options.user?.deleteUser?.enabled, true);
  assert.equal(runtime.pool.connectionString, env.DATABASE_URL);
});

test('auth runtime defaults email callbacks to the Preview Mailtrap transport and fails closed without credentials', async () => {
  const env = previewEnv();
  let options;
  createAuthRuntime({
    env,
    createPool: connectionString => ({ connectionString }),
    attachPool() {},
    createRateLimitStorage: () => ({ async consume() { return { allowed: true, retryAfter: null }; } }),
    createVerificationTokenGuard: () => async () => {},
    createAuth: config => { options = config; return { handler() {}, api: { async getSession() { return null; } } }; },
    createNodeHandler: handler => handler,
  });

  await assert.rejects(options.emailVerification.sendVerificationEmail({
    user: { email: 'synthetic@example.invalid' },
    url: `https://${env.VERCEL_URL}/api/auth/verify-email?token=synthetic`,
  }), error => error.message === 'Email delivery is unavailable.');
});

test('session resolution uses the verified Better Auth session, not request-body identity', async () => {
  const runtime = createAuthRuntime({
    env: previewEnv(),
    createPool: () => ({}),
    attachPool() {},
    createRateLimitStorage: () => ({ async consume() { return { allowed: true, retryAfter: null }; } }),
    createVerificationTokenGuard: () => async () => {},
    createAuth: () => ({
      handler() {},
      api: {
        async getSession({ headers }) {
          if (headers.get('cookie') === 'session=valid') {
            return { user: { id: 'synthetic-user-a' }, session: { id: 'session-a' } };
          }
          return null;
        },
      },
    }),
    createNodeHandler: handler => handler,
  });

  assert.deepEqual(await runtime.resolveSession({
    headers: { cookie: 'session=valid' },
    body: { userId: 'synthetic-user-b' },
  }), { userId: 'synthetic-user-a', sessionId: 'session-a' });
  assert.equal(await runtime.resolveSession({ headers: { cookie: 'session=expired' } }), null);
});

test('account deletion password checks use the durable user-scoped limiter', async () => {
  const consumed = [];
  const runtime = createAuthRuntime({
    env: previewEnv(),
    createPool: () => ({}),
    attachPool() {},
    createRateLimitStorage: () => ({
      async consume(key, rule) {
        consumed.push({ key, rule });
        return { allowed: false, retryAfter: 300 };
      },
    }),
    createVerificationTokenGuard: () => async () => {},
    createAuth: () => ({ handler() {}, api: { async getSession() { return null; } } }),
    createNodeHandler: handler => handler,
  });

  assert.deepEqual(await runtime.limitPasswordVerification('synthetic-user-a'), {
    allowed: false,
    retryAfter: 300,
  });
  assert.deepEqual(consumed, [{
    key: 'account-deletion:synthetic-user-a',
    rule: { window: 300, max: 5 },
  }]);
});

test('Preview auth handler errors do not expose database or auth configuration details', async () => {
  const route = createAuthRoute({
    env: { VERCEL_ENV: 'preview' },
    getRuntime: async () => { throw Error('postgresql://secret@database.invalid'); },
  });
  const res = response();

  await route({ method: 'GET' }, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'Authentication is unavailable.' });
  assert.doesNotMatch(JSON.stringify(res.body), /secret|database\.invalid/);
});
