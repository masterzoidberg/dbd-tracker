import test from 'node:test';
import assert from 'node:assert/strict';
import state from '../api/ledger/state.js';
import { resolveUserSession } from '../src/user-persistence/runtime.js';

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('a Vercel SSO cookie without a Better Auth session is rejected before auth runtime creation', async () => {
  const previous = Object.fromEntries(['VERCEL_ENV', 'DATABASE_URL', 'BETTER_AUTH_SECRET']
    .map(name => [name, process.env[name]]));
  process.env.VERCEL_ENV = 'preview';
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;

  try {
    const res = response();
    await state({
      method: 'GET',
      headers: { cookie: '_vercel_jwt=synthetic-sso; _vercel_sso_nonce=synthetic-nonce' },
    }, res);

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Authentication required.' });
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('only Better Auth session-token cookies reach verified session lookup', async () => {
  let runtimeCalls = 0;
  const getRuntime = () => {
    runtimeCalls += 1;
    return { async resolveSession() { return { userId: 'synthetic-user', sessionId: 'synthetic-session' }; } };
  };

  assert.equal(await resolveUserSession({
    headers: { cookie: '_vercel_jwt=synthetic-sso; _vercel_sso_nonce=synthetic-nonce' },
  }, getRuntime), null);
  assert.equal(runtimeCalls, 0);

  assert.deepEqual(await resolveUserSession({
    headers: { cookie: '__Secure-better-auth.session_token=synthetic-token' },
  }, getRuntime), { userId: 'synthetic-user', sessionId: 'synthetic-session' });
  assert.equal(runtimeCalls, 1);
});
