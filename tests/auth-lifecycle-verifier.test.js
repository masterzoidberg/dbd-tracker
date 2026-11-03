import test from 'node:test';
import assert from 'node:assert/strict';
import { messageMatches, verifyAuthLifecycle } from '../scripts/verify-auth-lifecycle.mjs';

const env = {
  VERCEL_AUTOMATION_BYPASS_SECRET: 'unit-test-bypass-secret',
  MAILTRAP_API_TOKEN: 'unit-test-mailtrap-secret',
  MAILTRAP_ACCOUNT_ID: '12345',
  MAILTRAP_INBOX_ID: '67890',
};

test('lifecycle verifier ignores stale inbox messages for a re-registered synthetic identity', () => {
  const stale = {
    id: 123,
    to_email: 'codex-pr20-run-a@example.invalid',
    subject: 'Verify your Ledger Tracker email',
  };
  const fresh = { ...stale, id: 456 };
  const excluded = new Set(['123']);

  assert.equal(messageMatches(stale, stale.to_email, stale.subject, excluded), false);
  assert.equal(messageMatches(fresh, fresh.to_email, fresh.subject, excluded), true);
});

test('lifecycle verifier matches only the exact synthetic recipient and verification subject', () => {
  const message = {
    id: 'new-message',
    to_email: 'codex-pr20-run-a@example.invalid',
    subject: 'Verify your Ledger Tracker email',
  };

  assert.equal(messageMatches(message, message.to_email, message.subject), true);
  assert.equal(messageMatches(message, 'codex-pr20-other@example.invalid', message.subject), false);
  assert.equal(messageMatches(message, message.to_email, 'Reset your Ledger Tracker password'), false);
});

test('lifecycle verifier rejects the Production project alias before making a request', async () => {
  let requests = 0;

  await assert.rejects(
    verifyAuthLifecycle('https://dbd-tracker-nick-queens-projects.vercel.app', {
      env,
      fetchImpl: async () => { requests++; throw new Error('must not request'); },
    }),
    /dbd-tracker Vercel Preview deployment URL/i,
  );
  assert.equal(requests, 0);
});

test('lifecycle verifier makes no account requests unless its Preview-only auth preflight passes', async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url: String(url), headers: options.headers });
    return new Response(JSON.stringify({ error: 'Not found.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };

  await assert.rejects(
    verifyAuthLifecycle('https://dbd-tracker-3bph976ln-nick-queens-projects.vercel.app', { env, fetchImpl }),
    /Preview auth preflight returned an unexpected HTTP status/i,
  );
  assert.equal(seen.length, 1);
  assert.match(seen[0].url, /\/api\/auth\/get-session$/);
  assert.equal(seen[0].headers['x-vercel-protection-bypass'], env.VERCEL_AUTOMATION_BYPASS_SECRET);
});
