import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { createAuthConfig } from '../src/auth/config.js';

test('personal authentication blocks registration and email flows but permits the provisioned owner', async () => {
  const database = new DatabaseSync(':memory:');
  const origin = 'https://personal.example.test';
  const config = createAuthConfig({
    env: { VERCEL_URL: 'personal.example.test', BETTER_AUTH_SECRET: 'synthetic-only-secret-at-least-thirty-two-characters' }, database,
    emailDelivery: async () => { throw Error('Email must not be used'); },
    verificationTokenGuard: async () => {},
  });
  await (await getMigrations(config)).runMigrations();
  config.rateLimit = { enabled: false };
  config.advanced.useSecureCookies = false;
  const auth = betterAuth(config);
  const request = (path, body, cookie = '') => auth.handler(new Request(origin + '/api/auth' + path, {
    method: body ? 'POST' : 'GET', headers: { origin, 'content-type': 'application/json', cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  try {
    const signup = await request('/sign-up/email', { name: 'Stranger', email: 'stranger@example.invalid', password: 'Synthetic-Passphrase-1' });
    assert.notEqual(signup.status, 200);
    assert.equal(database.prepare('SELECT count(*) AS count FROM user').get().count, 0);
    for (const path of ['/send-verification-email', '/request-password-reset', '/reset-password']) {
      assert.equal((await request(path, { email: 'owner@example.invalid', token: 'old-token', newPassword: 'Synthetic-Passphrase-2' })).status, 404, path);
    }
    assert.equal((await request('/verify-email?token=old-token')).status, 404);
    const context = await auth.$context;
    const user = await context.internalAdapter.createUser({ name: 'Owner', email: 'owner@example.invalid', emailVerified: false });
    await context.internalAdapter.createAccount({ userId: user.id, accountId: user.id, providerId: 'credential', password: await context.password.hash('Synthetic-Passphrase-1') });
    const login = await request('/sign-in/email', { email: user.email, password: 'Synthetic-Passphrase-1' });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert.match(cookie, /session_token=/);
    assert.equal((await (await request('/get-session', null, cookie)).json()).user.id, user.id);
    assert.equal((await request('/sign-out', {}, cookie)).status, 200);
    assert.equal(await (await request('/get-session', null, cookie)).json(), null);
  } finally { database.close(); }
});
