import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailtrapPreviewDelivery } from '../src/auth/mailtrap-preview.js';

const env = () => ({
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'codex/ledger-production-auth-readiness',
  VERCEL_URL: 'dbd-tracker-deployment.vercel.app',
  VERCEL_BRANCH_URL: 'dbd-tracker-git-codex-ledger-production-auth-readiness.vercel.app',
  MAILTRAP_SMTP_USER: 'synthetic-user',
  MAILTRAP_SMTP_PASS: 'synthetic-password',
});

test('Mailtrap SMTP is fixed to the capture sandbox and requires STARTTLS', async () => {
  const settings = [];
  const messages = [];
  const delivery = createMailtrapPreviewDelivery({
    env: env(),
    createTransport(options) {
      settings.push(options);
      return { async sendMail(message) { messages.push(message); } };
    },
  });

  await delivery({
    kind: 'verification',
    to: 'synthetic@example.invalid',
    url: 'https://dbd-tracker-git-codex-ledger-production-auth-readiness.vercel.app/api/auth/verify-email?token=synthetic-token',
  });
  await delivery({
    kind: 'password-reset',
    to: 'synthetic@example.invalid',
    url: 'https://dbd-tracker-deployment.vercel.app/reset-password/synthetic-token?callbackURL=https%3A%2F%2Fdbd-tracker-deployment.vercel.app%2F',
  });

  assert.equal(settings.length, 1);
  assert.deepEqual(settings[0], {
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    secure: false,
    requireTLS: true,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: { user: 'synthetic-user', pass: 'synthetic-password' },
    logger: false,
    debug: false,
  });
  assert.deepEqual(messages.map(message => message.subject), [
    'Verify your Ledger Tracker email',
    'Reset your Ledger Tracker password',
  ]);
  assert.deepEqual(messages.map(message => message.text), [
    'Use this one-time link to verify your email: https://dbd-tracker-git-codex-ledger-production-auth-readiness.vercel.app/api/auth/verify-email?token=synthetic-token',
    'Use this one-time link to reset your password: https://dbd-tracker-deployment.vercel.app/reset-password/synthetic-token?callbackURL=https%3A%2F%2Fdbd-tracker-deployment.vercel.app%2F',
  ]);
  assert.ok(messages.every(message => message.from === 'Ledger Tracker <no-reply@example.invalid>'));
});

test('Mailtrap delivery is unavailable outside the feature Preview or without both credentials', async t => {
  const cases = [
    ['Production', { ...env(), VERCEL_ENV: 'production' }],
    ['other Preview branch', { ...env(), VERCEL_GIT_COMMIT_REF: 'main' }],
    ['missing username', { ...env(), MAILTRAP_SMTP_USER: '' }],
    ['missing password', { ...env(), MAILTRAP_SMTP_PASS: undefined }],
  ];

  for (const [name, deliveryEnv] of cases) {
    await t.test(name, async () => {
      let constructed = false;
      const delivery = createMailtrapPreviewDelivery({
        env: deliveryEnv,
        createTransport() { constructed = true; throw new Error('must not construct'); },
      });

      await assert.rejects(delivery({
        kind: 'verification',
        to: 'synthetic@example.invalid',
        url: 'https://dbd-tracker-deployment.vercel.app/api/auth/verify-email?token=synthetic',
      }), /Email delivery is unavailable\./);
      assert.equal(constructed, false);
    });
  }
});

test('Mailtrap delivery rejects real recipients, unsupported message kinds, and untrusted links', async t => {
  const cases = [
    ['real recipient', { kind: 'verification', to: 'real@example.com', url: 'https://dbd-tracker-deployment.vercel.app/api/auth/verify-email?token=x' }],
    ['unsupported message kind', { kind: 'notice', to: 'synthetic@example.invalid', url: 'https://dbd-tracker-deployment.vercel.app/api/auth/verify-email?token=x' }],
    ['untrusted origin', { kind: 'verification', to: 'synthetic@example.invalid', url: 'https://attacker.invalid/api/auth/verify-email?token=x' }],
    ['wrong link path', { kind: 'password-reset', to: 'synthetic@example.invalid', url: 'https://dbd-tracker-deployment.vercel.app/api/auth/verify-email?token=x' }],
  ];

  for (const [name, message] of cases) {
    await t.test(name, async () => {
      let constructed = false;
      const delivery = createMailtrapPreviewDelivery({
        env: env(),
        createTransport() { constructed = true; return { async sendMail() {} }; },
      });

      await assert.rejects(delivery(message), /Email delivery is unavailable\./);
      assert.equal(constructed, false);
    });
  }
});

test('SMTP errors are replaced with a generic error and never returned verbatim', async () => {
  const delivery = createMailtrapPreviewDelivery({
    env: env(),
    createTransport: () => ({ async sendMail() { throw new Error('smtp credential detail'); } }),
  });

  await assert.rejects(delivery({
    kind: 'verification',
    to: 'synthetic@example.invalid',
    url: 'https://dbd-tracker-deployment.vercel.app/api/auth/verify-email?token=synthetic',
  }), error => {
    assert.equal(error.message, 'Email delivery is unavailable.');
    assert.doesNotMatch(error.message, /smtp credential detail/);
    return true;
  });
});
