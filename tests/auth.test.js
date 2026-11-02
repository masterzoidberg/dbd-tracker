import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAuthRuntime } from '../src/auth/runtime.js';
import { createAuthRoute } from '../api/auth/[...all].js';

const previewEnv = () => ({
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'dbd-tracker-preview.vercel.app',
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
    createAuth: config => {
      options = config;
      return { handler() {}, api: { async getSession() { return null; } } };
    },
    createNodeHandler: handler => handler,
  });

  assert.deepEqual(options.baseURL, {
    allowedHosts: [env.VERCEL_URL],
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
  assert.equal(options.emailAndPassword.requireEmailVerification, false);
  assert.notEqual(options.user?.deleteUser?.enabled, true);
  assert.equal(runtime.pool.connectionString, env.DATABASE_URL);
});

test('session resolution uses the verified Better Auth session, not request-body identity', async () => {
  const runtime = createAuthRuntime({
    env: previewEnv(),
    createPool: () => ({}),
    attachPool() {},
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
