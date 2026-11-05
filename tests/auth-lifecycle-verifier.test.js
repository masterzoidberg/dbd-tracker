import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailtrapSendPacer, extractLink, messageMatches, verifyAuthLifecycle, verifyResendLimiter } from '../scripts/verify-auth-lifecycle.mjs';

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

test('lifecycle verifier accepts Better Auth reset URLs under the configured base path', () => {
  const previewOrigin = 'https://dbd-tracker-3bph976ln-nick-queens-projects.vercel.app';
  const url = `${previewOrigin}/api/auth/reset-password/synthetic-token?callbackURL=${encodeURIComponent(`${previewOrigin}/`)}`;

  assert.equal(extractLink(url, 'password-reset', previewOrigin).pathname, '/api/auth/reset-password/synthetic-token');
  assert.throws(
    () => extractLink(`${previewOrigin}/reset-password/synthetic-token?callbackURL=${encodeURIComponent(`${previewOrigin}/`)}`, 'password-reset', previewOrigin),
    /unexpected link/i,
  );
});

test('lifecycle verifier spaces email sends to honor the Mailtrap sandbox interval', async () => {
  let now = 1_000;
  const waits = [];
  const paceEmail = createMailtrapSendPacer({
    now: () => now,
    wait: async milliseconds => {
      waits.push(milliseconds);
      now += milliseconds;
    },
  });

  await paceEmail();
  now += 3_000;
  await paceEmail();
  now += 12_000;
  await paceEmail();

  assert.deepEqual(waits, [8_000]);
});

test('lifecycle verifier refuses to test resend behavior with a verified or session-bearing actor', async () => {
  let requests = 0;
  const mailtrap = {
    ids: { accountId: '12345', inboxId: '67890' },
    token: 'unit-test-mailtrap-secret',
  };
  const fetchImpl = async () => { requests++; };
  const previewOrigin = 'https://dbd-tracker-3bph976ln-nick-queens-projects.vercel.app';
  const bypassSecret = 'unit-test-bypass-secret';

  for (const actor of [
    { email: 'codex-pr20-run-a@example.invalid', verified: true, cookies: new Map() },
    { email: 'codex-pr20-run-a@example.invalid', verified: false, cookies: new Map([['session', 'test']]) },
  ]) {
    await assert.rejects(
      verifyResendLimiter(fetchImpl, previewOrigin, bypassSecret, mailtrap, actor),
      /require an unverified account without a session/i,
    );
  }
  assert.equal(requests, 0);
});

test('lifecycle verifier spaces accepted resends for Mailtrap and probes the fourth request without email', async () => {
  const previewOrigin = 'https://dbd-tracker-3bph976ln-nick-queens-projects.vercel.app';
  const actor = {
    email: 'codex-pr20-run-a@example.invalid',
    verified: false,
    cookies: new Map(),
  };
  const mailtrap = {
    ids: { accountId: '12345', inboxId: '67890' },
    token: 'unit-test-mailtrap-secret',
  };
  const waitIntervals = [];
  const resendStatuses = [];
  let messageQueries = 0;

  const fetchImpl = async (input, options) => {
    const url = String(input);
    if (url.startsWith('https://mailtrap.io/')) {
      if (url.endsWith('/messages')) {
        messageQueries++;
        const messages = messageQueries === 1 ? [] : [{
          id: 'fresh-resend',
          to_email: actor.email,
          subject: 'Verify your Ledger Tracker email',
        }];
        return new Response(JSON.stringify(messages), { status: 200 });
      }
      if (url.endsWith('/body.txt')) return new Response('Synthetic verification email body', { status: 200 });
      throw new Error('Unexpected Mailtrap request.');
    }

    assert.match(url, /\/api\/auth\/send-verification-email$/);
    assert.equal(options.method, 'POST');
    assert.match(options.headers.cookie ?? '', /^$/);
    const status = resendStatuses.length < 3 ? 200 : 429;
    resendStatuses.push(status);
    return new Response(JSON.stringify({ status: status === 200 }), { status });
  };

  const result = await verifyResendLimiter(fetchImpl, previewOrigin, 'unit-test-bypass-secret', mailtrap, actor, {
    paceEmail: async () => waitIntervals.push(11_000),
  });

  assert.deepEqual(waitIntervals, [11_000, 11_000, 11_000]);
  assert.deepEqual(resendStatuses, [200, 200, 200, 429]);
  assert.deepEqual(result.report, {
    resendAccepted: 3,
    fourthResendRateLimited: true,
    resendEmailCaptured: true,
    neonLimiterObserved: true,
  });
  assert.equal(result.verificationBody, 'Synthetic verification email body');
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
