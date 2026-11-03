import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { getMigrations } from 'better-auth/db/migration';
import { createAuthConfig } from '../src/auth/config.js';

const host = 'dbd-tracker-preview.example.test';
const origin = `https://${host}`;

function createRateLimitStorage() {
  const counts = new Map();
  return {
    async consume(key, { window, max }) {
      const current = counts.get(key);
      const now = Date.now();
      if (!current || current.resetAt <= now) {
        counts.set(key, { count: 1, resetAt: now + window * 1000 });
        return { allowed: true, retryAfter: null };
      }
      if (current.count >= max) return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
      current.count++;
      return { allowed: true, retryAfter: null };
    },
  };
}

async function createHarness() {
  const emails = [];
  const usedVerificationTokens = new Set();
  const database = new DatabaseSync(':memory:');
  const config = createAuthConfig({
    env: { VERCEL_URL: host, BETTER_AUTH_SECRET: randomBytes(48).toString('base64url') },
    database,
    emailDelivery: async message => { emails.push(message); },
    rateLimitStorage: createRateLimitStorage(),
    verificationTokenGuard: async context => {
      if (context.path !== '/verify-email') return;
      const token = context.query?.token;
      if (usedVerificationTokens.has(token)) {
        throw APIError.from('UNAUTHORIZED', { code: 'INVALID_TOKEN', message: 'Invalid or already used verification token.' });
      }
      usedVerificationTokens.add(token);
    },
  });
  const migrations = await getMigrations(config);
  await migrations.runMigrations();
  config.advanced.useSecureCookies = false;
  const auth = betterAuth(config);

  async function request(path, { method = 'GET', body, cookie = '' } = {}) {
    const headers = new Headers({
      host,
      origin,
      'x-forwarded-for': '198.51.100.31',
    });
    if (body !== undefined) headers.set('content-type', 'application/json');
    if (cookie) headers.set('cookie', cookie);
    const response = await auth.handler(new Request(`${origin}/api/auth${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    return {
      status: response.status,
      body: await response.json().catch(() => null),
      cookie: response.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; '),
      location: response.headers.get('location'),
    };
  }
  return { auth, emails, request, close: () => database.close() };
}

test('Better Auth gates signup and sign-in on verified email, and verification does not create a session', async () => {
  const { emails, request, close } = await createHarness();
  const email = 'lifecycle-1@example.invalid';
  const password = 'Synthetic-Passphrase-1';

  const signup = await request('/sign-up/email', {
    method: 'POST', body: { name: 'Synthetic User', email, password },
  });
  assert.equal(signup.status, 200);
  assert.equal(signup.body.user.emailVerified, false);
  assert.equal(signup.body.token, null);
  assert.equal(signup.cookie, '');
  assert.equal(emails[0].kind, 'verification');

  const beforeVerification = await request('/sign-in/email', {
    method: 'POST', body: { email, password },
  });
  assert.equal(beforeVerification.status, 403);
  assert.equal(beforeVerification.cookie, '');
  assert.equal(emails[1].kind, 'verification');

  const resend = await request('/send-verification-email', {
    method: 'POST', body: { email, callbackURL: `${origin}/` },
  });
  assert.equal(resend.status, 200);
  assert.equal(emails[2].kind, 'verification');

  const verificationUrl = new URL(emails[2].url);
  const verified = await request(`${verificationUrl.pathname.replace('/api/auth', '')}${verificationUrl.search}`);
  assert.equal(verified.status, 302);
  assert.equal(verified.cookie, '');
  const replayedVerification = await request(`${verificationUrl.pathname.replace('/api/auth', '')}${verificationUrl.search}`);
  assert.equal(replayedVerification.status, 401);
  assert.equal(replayedVerification.cookie, '');

  const afterVerification = await request('/sign-in/email', {
    method: 'POST', body: { email, password },
  });
  assert.equal(afterVerification.status, 200);
  assert.match(afterVerification.cookie, /better-auth\.session_token=/);
  const verifiedResend = await request('/send-verification-email', {
    method: 'POST', body: { email, callbackURL: `${origin}/` }, cookie: afterVerification.cookie,
  });
  assert.equal(verifiedResend.status, 400);
  close();
});

test('Better Auth recovery rejects invalid, expired, and reused reset tokens and revokes prior sessions', async () => {
  const { auth, emails, request, close } = await createHarness();
  const email = 'lifecycle-reset@example.invalid';
  const oldPassword = 'Synthetic-Old-Passphrase-1';
  const newPassword = 'Synthetic-New-Passphrase-1';

  await request('/sign-up/email', { method: 'POST', body: { name: 'Synthetic User', email, password: oldPassword } });
  const verificationUrl = new URL(emails[0].url);
  await request(`${verificationUrl.pathname.replace('/api/auth', '')}${verificationUrl.search}`);
  const signedIn = await request('/sign-in/email', { method: 'POST', body: { email, password: oldPassword } });
  assert.equal(signedIn.status, 200);
  assert.notEqual(signedIn.cookie, '');

  const unknownReset = await request('/request-password-reset', {
    method: 'POST', body: { email: 'unknown@example.invalid', redirectTo: `${origin}/reset` },
  });
  assert.equal(unknownReset.status, 200);
  const validResetRequest = await request('/request-password-reset', {
    method: 'POST', body: { email, redirectTo: `${origin}/reset` },
  });
  assert.equal(validResetRequest.status, 200);
  assert.equal(unknownReset.body.message, validResetRequest.body.message);
  const resetEmail = emails.findLast(message => message.kind === 'password-reset');
  const validToken = new URL(resetEmail.url).pathname.split('/').at(-1);

  const invalid = await request('/reset-password', { method: 'POST', body: { token: 'not-a-real-token', newPassword } });
  assert.equal(invalid.status, 400);
  const reset = await request('/reset-password', { method: 'POST', body: { token: validToken, newPassword } });
  assert.equal(reset.status, 200);
  assert.equal(reset.cookie, '');
  const reused = await request('/reset-password', { method: 'POST', body: { token: validToken, newPassword: oldPassword } });
  assert.equal(reused.status, 400);

  const previousSession = await request('/get-session', { cookie: signedIn.cookie });
  assert.equal(previousSession.body, null);
  const oldLogin = await request('/sign-in/email', { method: 'POST', body: { email, password: oldPassword } });
  assert.notEqual(oldLogin.status, 200);
  const newLogin = await request('/sign-in/email', { method: 'POST', body: { email, password: newPassword } });
  assert.equal(newLogin.status, 200);
  const currentPassword = await request('/verify-password', {
    method: 'POST', body: { password: newPassword }, cookie: newLogin.cookie,
  });
  assert.equal(currentPassword.status, 200);
  assert.equal(currentPassword.body.status, true);
  const incorrectPassword = await request('/verify-password', {
    method: 'POST', body: { password: oldPassword }, cookie: newLogin.cookie,
  });
  assert.equal(incorrectPassword.status, 400);

  await request('/request-password-reset', { method: 'POST', body: { email, redirectTo: `${origin}/reset` } });
  const expiredEmail = emails.findLast(message => message.kind === 'password-reset');
  const expiredToken = new URL(expiredEmail.url).pathname.split('/').at(-1);
  const context = await auth.$context;
  await context.adapter.update({
    model: 'verification',
    where: [{ field: 'identifier', value: `reset-password:${expiredToken}` }],
    update: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await request('/reset-password', { method: 'POST', body: { token: expiredToken, newPassword } });
  assert.equal(expired.status, 400);
  close();
});

test('repeated password failures are rate limited by Better Auth before a sixth check', async () => {
  const { emails, request, close } = await createHarness();
  const email = 'lifecycle-throttle@example.invalid';
  const password = 'Synthetic-Passphrase-1';

  await request('/sign-up/email', { method: 'POST', body: { name: 'Synthetic User', email, password } });
  const verificationUrl = new URL(emails[0].url);
  await request(`${verificationUrl.pathname.replace('/api/auth', '')}${verificationUrl.search}`);

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await request('/sign-in/email', {
      method: 'POST', body: { email, password: 'Incorrect-Synthetic-Passphrase' },
    });
    assert.notEqual(response.status, 429);
  }
  const limited = await request('/sign-in/email', {
    method: 'POST', body: { email, password: 'Incorrect-Synthetic-Passphrase' },
  });
  assert.equal(limited.status, 429);
  close();
});
