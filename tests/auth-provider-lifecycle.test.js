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

test('repeated password failures are rate limited by Better Auth before a sixth check', async () => {
  const { auth, request, close } = await createHarness();
  const email = 'lifecycle-throttle@example.invalid';
  const password = 'Synthetic-Passphrase-1';

  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({ name: 'Owner', email, emailVerified: false });
  await context.internalAdapter.createAccount({ userId: user.id, accountId: user.id, providerId: 'credential', password: await context.password.hash(password) });

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
