import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountErasureHandler } from '../src/auth/account-erasure.js';
import { createErasureRuntime } from '../src/auth/erasure-runtime.js';

const env = {
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'dbd-tracker-unique-deployment.vercel.app',
  VERCEL_BRANCH_URL: 'dbd-tracker-git-codex-ledger-production-auth-readiness.vercel.app',
};

function response() {
  return {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { this.ended = true; },
  };
}

function request(body = { password: 'correct horse battery staple' }, overrides = {}) {
  return {
    method: 'POST',
    headers: { origin: `https://${env.VERCEL_BRANCH_URL}` },
    body,
    ...overrides,
  };
}

const allowPasswordVerification = async () => ({ allowed: true, retryAfter: null });

test('account erasure rejects non-Preview, non-POST, cross-origin, and extra client identity fields', async () => {
  let calls = 0;
  const handler = createAccountErasureHandler({
    env,
    resolveSession: async () => { calls++; return { userId: 'user-a', sessionId: 'session-a' }; },
    limitPasswordVerification: allowPasswordVerification,
    verifyPassword: async () => { calls++; return { status: true }; },
    eraseAccount: async () => { calls++; return true; },
  });

  for (const [req, status] of [
    [request({}, { method: 'GET' }), 405],
    [request({}, { headers: { origin: 'https://attacker.invalid' } }), 403],
    [request({ password: 'correct horse battery staple', userId: 'user-b' }), 400],
  ]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, status);
  }
  const production = response();
  await createAccountErasureHandler({ env: { VERCEL_ENV: 'production' } })(request(), production);
  assert.equal(production.statusCode, 404);
  assert.equal(calls, 0);
});

test('unauthenticated deletion and incorrect current password never reach the erasure function', async () => {
  let erased = false;
  const handler = createAccountErasureHandler({
    env,
    resolveSession: async () => null,
    limitPasswordVerification: allowPasswordVerification,
    verifyPassword: async () => { throw new Error('invalid password'); },
    eraseAccount: async () => { erased = true; return true; },
  });

  const unauthenticated = response();
  await handler(request(), unauthenticated);
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(erased, false);

  const wrongPassword = createAccountErasureHandler({
    env,
    resolveSession: async () => ({ userId: 'user-a', sessionId: 'session-a' }),
    limitPasswordVerification: allowPasswordVerification,
    verifyPassword: async () => { throw new Error('invalid password'); },
    eraseAccount: async () => { erased = true; return true; },
  });
  const rejected = response();
  await wrongPassword(request(), rejected);
  assert.equal(rejected.statusCode, 401);
  assert.equal(erased, false);
});

test('account deletion rate limits password checks by the server-resolved user before checking the password', async () => {
  const attempts = [];
  let passwordChecks = 0;
  let erasures = 0;
  const handler = createAccountErasureHandler({
    env,
    resolveSession: async () => ({ userId: 'user-a', sessionId: 'session-a' }),
    limitPasswordVerification: async userId => {
      attempts.push(userId);
      return { allowed: false, retryAfter: 300 };
    },
    verifyPassword: async () => { passwordChecks++; return { status: true }; },
    eraseAccount: async () => { erasures++; return true; },
  });
  const res = response();

  await handler(request(), res);

  assert.equal(res.statusCode, 429);
  assert.deepEqual(attempts, ['user-a']);
  assert.equal(passwordChecks, 0);
  assert.equal(erasures, 0);
});

test('account deletion fails closed when durable password-attempt storage is unavailable', async () => {
  let passwordChecks = 0;
  const handler = createAccountErasureHandler({
    env,
    resolveSession: async () => ({ userId: 'user-a', sessionId: 'session-a' }),
    limitPasswordVerification: async () => { throw new Error('storage failure'); },
    verifyPassword: async () => { passwordChecks++; return { status: true }; },
    eraseAccount: async () => true,
  });
  const res = response();

  await handler(request(), res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Internal server error.' });
  assert.equal(passwordChecks, 0);
});

test('deletion derives the session server-side, verifies the current password, then erases atomically by session ID', async () => {
  const calls = [];
  const handler = createAccountErasureHandler({
    env,
    resolveSession: async () => ({ userId: 'user-a', sessionId: 'session-a' }),
    limitPasswordVerification: allowPasswordVerification,
    verifyPassword: async (_req, password) => { calls.push(['password', password]); return { status: true }; },
    eraseAccount: async sessionId => { calls.push(['session', sessionId]); return true; },
  });
  const res = response();

  await handler(request({ password: 'correct horse battery staple' }), res);

  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.deepEqual(calls, [
    ['password', 'correct horse battery staple'],
    ['session', 'session-a'],
  ]);
});

test('account deletion accepts only Vercel Preview deployment and branch origins', async () => {
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
    const handler = createAccountErasureHandler({
      env,
      resolveSession: async () => ({ userId: 'user-a', sessionId: 'session-a' }),
      limitPasswordVerification: allowPasswordVerification,
      verifyPassword: async () => ({ status: true }),
      eraseAccount: async () => true,
    });
    const res = response();

    await handler(request(undefined, { headers: { origin: `https://${host}` } }), res);

    assert.equal(res.statusCode, 204);
  }
});

test('failed database erasure returns a generic error without claiming success', async () => {
  const handler = createAccountErasureHandler({
    env,
    resolveSession: async () => ({ userId: 'user-a', sessionId: 'session-a' }),
    limitPasswordVerification: allowPasswordVerification,
    verifyPassword: async () => ({ status: true }),
    eraseAccount: async () => { throw new Error('database details must not escape'); },
  });
  const res = response();

  await handler(request(), res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Internal server error.' });
  assert.doesNotMatch(JSON.stringify(res.body), /database details/);
});

test('erasure runtime accepts only the dedicated Preview Neon login and passes a verified session ID', async () => {
  let connection;
  const calls = [];
  const runtime = createErasureRuntime({
    env: {
      ...env,
      ERASURE_DATABASE_URL: 'postgresql://ledger_erasure_login:synthetic-password@ep-test.us-east-2.aws.neon.tech/ledger',
    },
    createPool: value => { connection = value; return { async query(sql, values) { calls.push([sql, values]); return { rows: [{ erased: true }] }; } }; },
    attachPool() {},
  });

  assert.equal(await runtime.eraseAccount('verified-session-a'), true);
  assert.match(connection, /^postgresql:\/\/ledger_erasure_login:/);
  assert.deepEqual(calls, [[
    'SELECT public.erase_ledger_account_for_session($1) AS erased',
    ['verified-session-a'],
  ]]);
  await assert.rejects(() => runtime.eraseAccount(''), /verified session/i);
});

test('erasure runtime rejects Production and non-erasure database credentials before pool creation', () => {
  let created = false;
  for (const settings of [
    { VERCEL_ENV: 'production', ERASURE_DATABASE_URL: 'postgresql://ledger_erasure_login:pass@ep-test.neon.tech/ledger' },
    { ...env, ERASURE_DATABASE_URL: 'postgresql://ledger_runtime:pass@ep-test.neon.tech/ledger' },
    { ...env, ERASURE_DATABASE_URL: 'postgresql://ledger_erasure_login:pass@localhost/ledger' },
  ]) {
    assert.throws(() => createErasureRuntime({
      env: settings,
      createPool: () => { created = true; },
      attachPool() {},
    }), /Account deletion is unavailable/);
  }
  assert.equal(created, false);
});
