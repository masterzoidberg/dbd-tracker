import nodemailer from 'nodemailer';

const featureBranch = 'codex/ledger-production-auth-readiness';
const sandboxHost = 'sandbox.smtp.mailtrap.io';
const unavailable = () => new Error('Email delivery is unavailable.');
const vercelHost = /^[a-z0-9.-]+(?::\d+)?$/i;
const smtpCommands = new Set([
  'AUTH LOGIN', 'AUTH PLAIN', 'CONN', 'DATA', 'EHLO', 'HELO', 'MAIL FROM',
  'NOOP', 'QUIT', 'RCPT TO', 'STARTTLS',
]);

function safeSmtpErrorMetadata(error) {
  const metadata = {};
  if (typeof error?.code === 'string' && /^[A-Z0-9_-]{1,32}$/i.test(error.code)) {
    metadata.code = error.code;
  }
  if (Number.isInteger(error?.responseCode) && error.responseCode >= 400 && error.responseCode <= 599) {
    metadata.responseCode = error.responseCode;
  }
  if (typeof error?.command === 'string') {
    const command = error.command.toUpperCase();
    if (smtpCommands.has(command)) metadata.command = command;
  }
  return metadata;
}

function validMessage({ env, kind, to, url }) {
  if (env?.VERCEL_ENV !== 'preview' || env?.VERCEL_GIT_COMMIT_REF !== featureBranch ||
      !['verification', 'password-reset'].includes(kind) ||
      typeof to !== 'string' || !/^[^\s@]+@example\.invalid$/i.test(to) ||
      typeof url !== 'string' || url.length > 8192) return false;

  const hosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
    .filter(host => typeof host === 'string' && vercelHost.test(host));
  let link;
  try { link = new URL(url); } catch { return false; }
  if (link.protocol !== 'https:' || link.username || link.password ||
      !hosts.includes(link.host) || link.hash) return false;

  if (kind === 'verification') {
    return link.pathname === '/api/auth/verify-email' && link.searchParams.has('token');
  }
  return /^\/reset-password\/[^/]+$/.test(link.pathname) && link.searchParams.has('callbackURL');
}

export function createMailtrapPreviewDelivery({ env = process.env, createTransport = nodemailer.createTransport } = {}) {
  let transporter;

  return async function deliverPreviewAuthEmail(message) {
    if (!validMessage({ env, ...message }) ||
        typeof env.MAILTRAP_SMTP_USER !== 'string' || !env.MAILTRAP_SMTP_USER.trim() ||
        typeof env.MAILTRAP_SMTP_PASS !== 'string' || !env.MAILTRAP_SMTP_PASS.trim()) {
      throw unavailable();
    }

    const subjects = {
      verification: 'Verify your Ledger Tracker email',
      'password-reset': 'Reset your Ledger Tracker password',
    };
    const actions = {
      verification: 'verify your email',
      'password-reset': 'reset your password',
    };

    try {
      transporter ??= createTransport({
        host: sandboxHost,
        port: 2525,
        secure: false,
        requireTLS: true,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        auth: {
          user: env.MAILTRAP_SMTP_USER,
          pass: env.MAILTRAP_SMTP_PASS,
        },
        logger: false,
        debug: false,
      });
      await transporter.sendMail({
        from: 'Ledger Tracker <no-reply@example.invalid>',
        to: message.to,
        subject: subjects[message.kind],
        text: `Use this one-time link to ${actions[message.kind]}: ${message.url}`,
      });
    } catch (error) {
      console.error('[mailtrap] SMTP delivery failed', safeSmtpErrorMetadata(error));
      transporter = undefined;
      throw unavailable();
    }
  };
}
