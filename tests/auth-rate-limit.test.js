import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createAuthRateLimitStorage } from '../src/auth/rate-limit-storage.js';

function createPoolHarness(responses) {
  const client = {
    calls: [],
    released: false,
    async query(text, values = []) {
      this.calls.push({ text, values });
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return result ?? { rows: [] };
    },
    release() { this.released = true; },
  };
  return { clients: [client], async connect() { return client; } };
}

test('rate limits increment atomically, hash IP/path keys, and prune expired records', async () => {
  const now = 1_800_000_000_000;
  const pool = createPoolHarness([
    { rows: [] },
    { rows: [] },
    { rows: [] },
    { rows: [{ count: 1, last_request: String(now) }] },
  ]);
  const storage = createAuthRateLimitStorage(pool, { secret: 'test-only-secret-with-at-least-32-bytes', now: () => now });

  const result = await storage.consume('198.51.100.17|/sign-in/email', { window: 60, max: 5 });

  assert.deepEqual(result, { allowed: true, retryAfter: null });
  const calls = pool.clients[0].calls;
  assert.equal(calls[0].text, 'BEGIN');
  assert.match(calls[1].text, /DELETE\s+FROM\s+auth_rate_limits[\s\S]+last_request\s*<\s*\$1/i);
  assert.match(calls[2].text, /DELETE\s+FROM\s+auth_email_verification_tokens[\s\S]+expires_at\s*<=\s*NOW\(\)/i);
  assert.equal(calls[3].values[0], createHmac('sha256', 'test-only-secret-with-at-least-32-bytes')
    .update('198.51.100.17|/sign-in/email').digest('hex'));
  assert.doesNotMatch(JSON.stringify(calls), /198\.51\.100\.17/);
  assert.match(calls[3].text, /INSERT\s+INTO\s+auth_rate_limits[\s\S]+ON\s+CONFLICT\s*\(\s*key_hash\s*\)\s+DO\s+UPDATE/i);
  assert.match(calls[3].text, /existing\.count\s*<\s*\$4/i);
  assert.equal(calls.at(-1).text, 'COMMIT');
  assert.equal(pool.clients[0].released, true);
});

test('rate limit denial reports a positive retry interval without incrementing past the limit', async () => {
  const now = 1_800_000_000_000;
  const pool = createPoolHarness([
    { rows: [] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
    { rows: [{ count: 3, last_request: String(now - 11_000) }] },
  ]);
  const storage = createAuthRateLimitStorage(pool, { secret: 'test-only-secret-with-at-least-32-bytes', now: () => now });

  assert.deepEqual(await storage.consume('192.0.2.8|/request-password-reset', { window: 60, max: 3 }), {
    allowed: false,
    retryAfter: 49,
  });
  assert.match(pool.clients[0].calls[3].text, /WHERE[\s\S]+existing\.count\s*<\s*\$4/i);
  assert.equal(pool.clients[0].calls.at(-1).text, 'COMMIT');
});

test('rate limiter storage errors fail closed and release the transaction', async () => {
  const pool = createPoolHarness([
    { rows: [] },
    new Error('database unavailable'),
    { rows: [] },
  ]);
  const storage = createAuthRateLimitStorage(pool, { secret: 'test-only-secret-with-at-least-32-bytes', now: () => 1_800_000_000_000 });

  await assert.rejects(storage.consume('203.0.113.5|/sign-up/email', { window: 60, max: 5 }), /database unavailable/);
  assert.equal(pool.clients[0].calls.at(-1).text, 'ROLLBACK');
  assert.equal(pool.clients[0].released, true);
});
