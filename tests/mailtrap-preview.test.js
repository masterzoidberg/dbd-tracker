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

test('account acceptance SMTP permits only its exact Preview branch and sandbox recipients and links', async () => {
  for (const [environment, branch, to, host, allowed] of [
    ['preview', 'codex/ledger-preview-account-ui', 'synthetic@example.invalid', 'dbd-tracker-deployment.vercel.app', true],
    ['production', 'codex/ledger-preview-account-ui', 'synthetic@example.invalid', 'dbd-tracker-deployment.vercel.app', false],
    ['development', 'codex/ledger-preview-account-ui', 'synthetic@example.invalid', 'dbd-tracker-deployment.vercel.app', false],
    ['preview', 'codex/ledger-preview-account-ui-other', 'synthetic@example.invalid', 'dbd-tracker-deployment.vercel.app', false],
    ['preview', 'codex/ledger-preview-account-ui', 'real@example.com', 'dbd-tracker-deployment.vercel.app', false],
    ['preview', 'codex/ledger-preview-account-ui', 'synthetic@example.invalid', 'attacker.invalid', false],
  ]) {
    const delivery = createMailtrapPreviewDelivery({ env: { ...env(), VERCEL_ENV: environment, VERCEL_GIT_COMMIT_REF: branch },
      createTransport: () => ({ async sendMail() {} }) });
    const result = delivery({ kind: 'verification', to, url: `https://${host}/api/auth/verify-email?token=synthetic` });
    if (allowed) await result; else await assert.rejects(result, /Email delivery is unavailable/);
  }
});

test('Mailtrap transport does not construct or connect to SMTP during auth initialization', () => {
  let transportsCreated = 0;
  createMailtrapPreviewDelivery({
    env: env(),
    createTransport() {
      transportsCreated++;
      return { async sendMail() {} };
    },
  });

  assert.equal(transportsCreated, 0);
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
    url: 'https://dbd-tracker-deployment.vercel.app/api/auth/reset-password/synthetic-token?callbackURL=https%3A%2F%2Fdbd-tracker-deployment.vercel.app%2F',
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
    'Use this one-time link to reset your password: https://dbd-tracker-deployment.vercel.app/api/auth/reset-password/synthetic-token?callbackURL=https%3A%2F%2Fdbd-tracker-deployment.vercel.app%2F',
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
    ['reset URL outside the Better Auth path', { kind: 'password-reset', to: 'synthetic@example.invalid', url: 'https://dbd-tracker-deployment.vercel.app/reset-password/token?callbackURL=https%3A%2F%2Fdbd-tracker-deployment.vercel.app%2F' }],
    ['wrong verification link path', { kind: 'verification', to: 'synthetic@example.invalid', url: 'https://dbd-tracker-deployment.vercel.app/api/auth/reset-password/token?callbackURL=https%3A%2F%2Fdbd-tracker-deployment.vercel.app%2F' }],
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

test('SMTP errors are replaced with a generic error and log only allowlisted metadata', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  const delivery = createMailtrapPreviewDelivery({
    env: env(),
    createTransport: () => ({
      async sendMail() {
        const error = new Error('SMTP credential detail: password=do-not-log');
        error.code = 'EAUTH';
        error.responseCode = 535;
        error.command = 'AUTH PLAIN';
        error.response = '535 invalid password=do-not-log';
        throw error;
      },
    }),
  });

  try {
    await assert.rejects(delivery({
      kind: 'verification',
      to: 'synthetic@example.invalid',
      url: 'https://dbd-tracker-deployment.vercel.app/api/auth/verify-email?token=synthetic',
    }), error => {
      assert.equal(error.message, 'Email delivery is unavailable.');
      assert.doesNotMatch(error.message, /SMTP credential detail|do-not-log/);
      return true;
    });
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(logs, [['[mailtrap] SMTP delivery failed', {
    code: 'EAUTH',
    responseCode: 535,
    command: 'AUTH PLAIN',
  }]]);
  assert.doesNotMatch(JSON.stringify(logs), /credential detail|do-not-log|invalid password/);
});
