import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { signJWT } from 'better-auth/crypto';
import { createEmailVerificationTokenGuard } from '../src/auth/verification-token-guard.js';

const secret = 'synthetic-verification-secret-with-enough-length';

async function tokenFor(email, options = {}) {
  return signJWT({ email, ...options.payload }, secret, options.expired ? -1 : 3600);
}

function createPoolHarness(rows = [{ token_hash: 'claimed' }]) {
  const calls = [];
  return {
    calls,
    async query(text, values) {
      calls.push({ text, values });
      return { rows: rows.shift() ?? [] };
    },
  };
}

test('a valid email verification token is atomically claimed by digest, never stored raw', async () => {
  const token = await tokenFor('verify-1@example.invalid');
  const pool = createPoolHarness([[{ token_hash: 'claimed' }]]);
  const guard = createEmailVerificationTokenGuard({ pool, secret });

  await guard({ path: '/verify-email', query: { token } });

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /INSERT\s+INTO\s+auth_email_verification_tokens[\s\S]+ON\s+CONFLICT\s+DO\s+NOTHING\s+RETURNING\s+1\s+AS\s+claimed/i);
  assert.match(pool.calls[0].text, /SELECT\s+claimed\s+FROM\s+claimed/i);
  assert.equal(pool.calls[0].values[0].toString('hex'), createHash('sha256').update(token).digest('hex'));
  assert.equal(JSON.stringify(pool.calls).includes(token), false);
  assert.equal(pool.calls[0].values[2], 'verify-1@example.invalid');
});

test('a verification token cannot be consumed twice', async () => {
  const token = await tokenFor('verify-2@example.invalid');
  const pool = createPoolHarness([[{ token_hash: 'first-claim' }], []]);
  const guard = createEmailVerificationTokenGuard({ pool, secret });

  await guard({ path: '/verify-email', query: { token } });
  await assert.rejects(guard({ path: '/verify-email', query: { token } }), /invalid or already used/i);
  assert.equal(pool.calls.length, 2);
});

test('invalid, expired, or unrelated-path tokens are not claimed', async () => {
  const pool = createPoolHarness([[{ token_hash: 'claimed' }]]);
  const guard = createEmailVerificationTokenGuard({ pool, secret });
  const valid = await tokenFor('verify-3@example.invalid');
  const expired = await tokenFor('verify-4@example.invalid', { expired: true });

  await guard({ path: '/sign-in/email', query: { token: valid } });
  await assert.rejects(guard({ path: '/verify-email', query: { token: 'not-a-jwt' } }), /invalid or already used/i);
  await assert.rejects(guard({ path: '/verify-email', query: { token: expired } }), /invalid or already used/i);
  assert.equal(pool.calls.length, 0);
});

test('verification tokens cannot be used for an email-change flow', async () => {
  const token = await tokenFor('verify-5@example.invalid', { payload: { updateTo: 'other@example.invalid' } });
  const pool = createPoolHarness([[]]);
  const guard = createEmailVerificationTokenGuard({ pool, secret });

  await assert.rejects(guard({ path: '/verify-email', query: { token } }), /invalid or already used/i);
  assert.equal(pool.calls.length, 0);
});
