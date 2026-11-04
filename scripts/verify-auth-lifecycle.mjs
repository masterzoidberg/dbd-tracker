import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostedSaveV3Fixture } from '../tests/fixtures/hosted-save.js';

const projectPrefix = 'dbd-tracker-';
const authPath = '/api/auth';
const mailtrapBase = 'https://mailtrap.io';
const bypassHeader = 'x-vercel-protection-bypass';
const mailtrapMinimumSendIntervalMs = 11_000;

function getPreviewOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Provide a deployment URL with --url.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !new RegExp(`^${projectPrefix}[a-z0-9]+-nick-queens-projects\\.vercel\\.app$`, 'i').test(url.hostname)) {
    throw new Error('The verifier accepts only a dbd-tracker Vercel Preview deployment URL.');
  }
  return url.origin;
}

function requiredEnv(env, name) {
  const value = env?.[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required for this local verifier.`);
  return value;
}

function parseArgs(args) {
  if (!Array.isArray(args) || args.length !== 2 || args[0] !== '--url' || !args[1]) {
    throw new Error('Usage: node scripts/verify-auth-lifecycle.mjs --url PREVIEW_DEPLOYMENT_URL');
  }
  return args[1];
}

function newActor(runId, label) {
  return {
    email: `codex-pr20-${runId}-${label}@example.invalid`,
    password: `Synthetic-${randomUUID()}-Aa1!`,
    cookies: new Map(),
    verified: false,
  };
}

function cookieHeader(actor) {
  return [...actor.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function requestJson(fetchImpl, url, {
  method = 'GET', body, actor, bypassSecret, origin,
  redirect = 'manual', mailtrapToken,
} = {}) {
  const headers = { accept: 'application/json' };
  if (bypassSecret) headers[bypassHeader] = bypassSecret;
  if (origin) headers.origin = origin;
  if (mailtrapToken) headers['Api-Token'] = mailtrapToken;
  if (actor && actor.cookies.size) headers.cookie = cookieHeader(actor);
  const options = { method, headers, redirect };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try { response = await fetchImpl(url, options); } catch { throw new Error('A Preview or sandbox API request failed.'); }
  if (actor) {
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const pair = cookie.split(';', 1)[0];
      const separator = pair.indexOf('=');
      if (separator > 0) actor.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
  const text = await response.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data, location: response.headers.get('location') };
}

function requireStatus(response, status, action) {
  assert.equal(response.status, status, `${action} returned an unexpected HTTP status.`);
  return response.data;
}

function mailtrapIds(env) {
  const accountId = requiredEnv(env, 'MAILTRAP_ACCOUNT_ID');
  const inboxId = requiredEnv(env, 'MAILTRAP_INBOX_ID');
  if (!/^\d+$/.test(accountId) || !/^\d+$/.test(inboxId)) throw new Error('Mailtrap account and inbox IDs must be numeric.');
  return { accountId, inboxId };
}

export function createMailtrapSendPacer({
  wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  now = Date.now,
} = {}) {
  let lastSendAt;
  return async function paceMailtrapSend() {
    const currentTime = now();
    if (lastSendAt !== undefined) {
      const remaining = mailtrapMinimumSendIntervalMs - (currentTime - lastSendAt);
      if (remaining > 0) await wait(remaining);
    }
    lastSendAt = now();
  };
}

async function listMessages(fetchImpl, ids, token) {
  const url = `${mailtrapBase}/api/accounts/${encodeURIComponent(ids.accountId)}/inboxes/${encodeURIComponent(ids.inboxId)}/messages`;
  const response = await requestJson(fetchImpl, url, { mailtrapToken: token });
  requireStatus(response, 200, 'Mailtrap inbox query');
  const messages = Array.isArray(response.data)
    ? response.data
    : response.data?.messages ?? response.data?.data ?? response.data?.items;
  if (!Array.isArray(messages)) throw new Error('Mailtrap returned an unexpected inbox response.');
  return messages;
}

export function messageMatches(message, email, subject, excludedIds = new Set()) {
  if (excludedIds.has(String(message.id))) return false;
  const recipients = [message.to_email, message.to, message.recipient].flatMap(value =>
    Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item?.email) : [value]);
  return message.subject === subject && recipients.some(value =>
    (typeof value === 'string' ? value : value?.email)?.toLowerCase() === email.toLowerCase());
}

async function waitForMessage(fetchImpl, ids, token, email, subject, excludedIds = new Set()) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const messages = await listMessages(fetchImpl, ids, token);
    const message = messages.find(item => messageMatches(item, email, subject, excludedIds));
    if (message) {
      const bodyUrl = `${mailtrapBase}/api/accounts/${encodeURIComponent(ids.accountId)}/inboxes/${encodeURIComponent(ids.inboxId)}/messages/${encodeURIComponent(message.id)}/body.txt`;
      const body = await requestJson(fetchImpl, bodyUrl, { mailtrapToken: token });
      requireStatus(body, 200, 'Mailtrap message content query');
      if (typeof body.data !== 'string' || body.data.length === 0) throw new Error('Mailtrap returned an empty message body.');
      return body.data;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('A synthetic auth message did not reach the Mailtrap inbox in time.');
}

export function extractLink(body, type, previewOrigin) {
  const candidate = body.match(/https:\/\/[^\s<>"']+/g)?.map(value => value.replace(/[),.;]+$/, ''))
    .find(value => {
      try { return new URL(value).origin === previewOrigin; } catch { return false; }
    });
  if (!candidate) throw new Error('The captured synthetic email did not contain a same-Preview link.');
  const link = new URL(candidate);
  if (type === 'verification' && (link.pathname !== `${authPath}/verify-email` || !link.searchParams.has('token'))) {
    throw new Error('The captured verification email contained an unexpected link.');
  }
  if (type === 'password-reset' && (!new RegExp(`^${authPath}/reset-password/[^/]+$`).test(link.pathname) || !link.searchParams.has('callbackURL'))) {
    throw new Error('The captured password-reset email contained an unexpected link.');
  }
  return link;
}

async function sendPreview(fetchImpl, previewOrigin, path, options = {}) {
  return requestJson(fetchImpl, new URL(path, previewOrigin), {
    ...options,
    bypassSecret: options.bypassSecret,
    origin: options.origin ?? previewOrigin,
  });
}

async function verifyActorSignup(fetchImpl, previewOrigin, bypassSecret, mailtrap, actor, {
  waitForSigninWindow = false,
  excludedMessageIds = new Set(),
  checkResendLimit = false,
  paceEmail = async () => {},
} = {}) {
  await paceEmail();
  const signup = await sendPreview(fetchImpl, previewOrigin, `${authPath}/sign-up/email`, {
    method: 'POST', body: { name: 'Synthetic Ledger User', email: actor.email, password: actor.password },
    actor, bypassSecret,
  });
  const created = requireStatus(signup, 200, 'Synthetic signup');
  assert.equal(created?.user?.emailVerified, false, 'Signup must leave the synthetic account unverified.');
  assert.equal(created?.token, null, 'Signup must not create a session before verification.');

  let body = await waitForMessage(
    fetchImpl,
    mailtrap.ids,
    mailtrap.token,
    actor.email,
    'Verify your Ledger Tracker email',
    excludedMessageIds,
  );

  await paceEmail();
  const unverifiedSignIn = await sendPreview(fetchImpl, previewOrigin, `${authPath}/sign-in/email`, {
    method: 'POST', body: { email: actor.email, password: actor.password }, actor, bypassSecret,
  });
  requireStatus(unverifiedSignIn, 403, 'Unverified sign-in');
  assert.equal(actor.cookies.size, 0, 'An unverified sign-in must not set a session cookie.');

  let resendLimiter;
  if (checkResendLimit) {
    const result = await verifyResendLimiter(fetchImpl, previewOrigin, bypassSecret, mailtrap, actor, { paceEmail });
    body = result.verificationBody;
    resendLimiter = result.report;
  }
  const link = extractLink(body, 'verification', previewOrigin);
  const verification = await requestJson(fetchImpl, link, { bypassSecret, origin: previewOrigin });
  requireStatus(verification, 302, 'Email verification');
  const replay = await requestJson(fetchImpl, link, { bypassSecret, origin: previewOrigin });
  requireStatus(replay, 401, 'Verification-token replay');
  actor.verified = true;

  if (waitForSigninWindow) await new Promise(resolve => setTimeout(resolve, 65_000));

  const signIn = await sendPreview(fetchImpl, previewOrigin, `${authPath}/sign-in/email`, {
    method: 'POST', body: { email: actor.email, password: actor.password }, actor, bypassSecret,
  });
  requireStatus(signIn, 200, 'Verified sign-in');
  assert.ok(actor.cookies.size > 0, 'Verified sign-in must create a session cookie.');
  const activeSession = await sendPreview(fetchImpl, previewOrigin, `${authPath}/get-session`, { actor, bypassSecret });
  assert.equal(requireStatus(activeSession, 200, 'Verified session check')?.user?.email, actor.email);
  return {
    signup: true,
    unverifiedSignInRejected: true,
    verificationCaptured: true,
    verificationSucceeded: true,
    verificationReplayRejected: true,
    ...(resendLimiter ? { resendLimiter } : {}),
  };
}

async function verifyPasswordRecovery(fetchImpl, previewOrigin, bypassSecret, mailtrap, actor, {
  paceEmail = async () => {},
} = {}) {
  const preResetCookies = new Map(actor.cookies);
  const priorPassword = actor.password;
  const activeSession = await sendPreview(fetchImpl, previewOrigin, `${authPath}/get-session`, {
    actor: { cookies: preResetCookies }, bypassSecret,
  });
  assert.equal(requireStatus(activeSession, 200, 'Pre-reset active session check')?.user?.email, actor.email);
  const unknown = await sendPreview(fetchImpl, previewOrigin, `${authPath}/request-password-reset`, {
    method: 'POST', body: { email: `unknown-${randomUUID()}@example.invalid`, redirectTo: `${previewOrigin}/` }, bypassSecret,
  });
  await paceEmail();
  const known = await sendPreview(fetchImpl, previewOrigin, `${authPath}/request-password-reset`, {
    method: 'POST', body: { email: actor.email, redirectTo: `${previewOrigin}/` }, bypassSecret,
  });
  const unknownBody = requireStatus(unknown, 200, 'Unknown-address reset request');
  const knownBody = requireStatus(known, 200, 'Synthetic reset request');
  assert.deepEqual(unknownBody, knownBody, 'Password-reset requests must not reveal whether an address exists.');

  const body = await waitForMessage(fetchImpl, mailtrap.ids, mailtrap.token, actor.email, 'Reset your Ledger Tracker password');
  const link = extractLink(body, 'password-reset', previewOrigin);
  const token = decodeURIComponent(link.pathname.split('/').at(-1));
  const newPassword = `Synthetic-${randomUUID()}-Bb2!`;
  const reset = await sendPreview(fetchImpl, previewOrigin, `${authPath}/reset-password`, {
    method: 'POST', body: { token, newPassword }, bypassSecret,
  });
  requireStatus(reset, 200, 'Synthetic password reset');
  actor.password = newPassword;

  const replay = await sendPreview(fetchImpl, previewOrigin, `${authPath}/reset-password`, {
    method: 'POST', body: { token, newPassword: actor.password }, bypassSecret,
  });
  requireStatus(replay, 400, 'Password-reset-token replay');

  const oldPassword = await sendPreview(fetchImpl, previewOrigin, `${authPath}/sign-in/email`, {
    method: 'POST', body: { email: actor.email, password: priorPassword }, bypassSecret,
  });
  requireStatus(oldPassword, 401, 'Prior password rejection after recovery');

  const revokedSession = await sendPreview(fetchImpl, previewOrigin, `${authPath}/get-session`, {
    actor: { cookies: preResetCookies }, bypassSecret,
  });
  requireStatus(revokedSession, 200, 'Pre-reset session check');
  assert.equal(revokedSession.data, null, 'Password reset must revoke existing sessions.');

  const signIn = await sendPreview(fetchImpl, previewOrigin, `${authPath}/sign-in/email`, {
    method: 'POST', body: { email: actor.email, password: newPassword }, actor, bypassSecret,
  });
  requireStatus(signIn, 200, 'Sign-in with recovered password');

  return { resetCaptured: true, resetSucceeded: true, resetReplayRejected: true, oldPasswordRejected: true, newPasswordAccepted: true, priorSessionRevoked: true };
}

export async function verifyResendLimiter(fetchImpl, previewOrigin, bypassSecret, mailtrap, actor, {
  paceEmail = () => new Promise(resolve => setTimeout(resolve, mailtrapMinimumSendIntervalMs)),
} = {}) {
  if (actor?.verified !== false || !(actor.cookies instanceof Map) || actor.cookies.size !== 0) {
    throw new Error('Verification resend checks require an unverified account without a session.');
  }
  const priorMessages = await listMessages(fetchImpl, mailtrap.ids, mailtrap.token);
  const excludedMessageIds = new Set(priorMessages.map(message => String(message.id)));
  const responses = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    // Mailtrap Sandbox's lowest published plan allows one message per 10 seconds.
    if (attempt < 3) await paceEmail();
    responses.push(await sendPreview(fetchImpl, previewOrigin, `${authPath}/send-verification-email`, {
      method: 'POST', body: { email: actor.email, callbackURL: `${previewOrigin}/` }, actor, bypassSecret,
    }));
  }
  for (const response of responses.slice(0, 3)) requireStatus(response, 200, 'Verification resend');
  requireStatus(responses[3], 429, 'Verification resend limit');
  const verificationBody = await waitForMessage(
    fetchImpl,
    mailtrap.ids,
    mailtrap.token,
    actor.email,
    'Verify your Ledger Tracker email',
    excludedMessageIds,
  );
  return {
    report: { resendAccepted: 3, fourthResendRateLimited: true, resendEmailCaptured: true, neonLimiterObserved: true },
    verificationBody,
  };
}

async function saveStateAndBackup(fetchImpl, previewOrigin, bypassSecret, actor, note) {
  const data = hostedSaveV3Fixture();
  data.characters['meg-thomas'].notes = note;
  const saved = await sendPreview(fetchImpl, previewOrigin, '/api/ledger/state', {
    method: 'PUT', body: { expectedRevision: 0, data }, actor, bypassSecret,
  });
  const state = requireStatus(saved, 200, 'Synthetic Ledger state write');
  const created = await sendPreview(fetchImpl, previewOrigin, '/api/ledger/backups', {
    method: 'POST', actor, bypassSecret,
  });
  const backup = requireStatus(created, 201, 'Synthetic Ledger backup creation');
  const read = await sendPreview(fetchImpl, previewOrigin, '/api/ledger/state', { actor, bypassSecret });
  assert.equal(requireStatus(read, 200, 'Synthetic Ledger state read').revision, state.revision);
  return { data, backup };
}

async function readBackup(fetchImpl, previewOrigin, bypassSecret, actor, id, expectedStatus, expectedData) {
  const result = await sendPreview(fetchImpl, previewOrigin, `/api/ledger/backups/${encodeURIComponent(id)}`, { actor, bypassSecret });
  const data = requireStatus(result, expectedStatus, 'Synthetic Ledger backup access');
  if (expectedData) assert.deepEqual(data.data, expectedData);
  return data;
}

async function deleteSyntheticAccount(fetchImpl, previewOrigin, bypassSecret, actor, password, origin = previewOrigin) {
  return sendPreview(fetchImpl, previewOrigin, '/api/account/delete', {
    method: 'POST', body: { password }, actor, bypassSecret, origin,
  });
}

export async function verifyAuthLifecycle(previewUrl, {
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const previewOrigin = getPreviewOrigin(previewUrl);
  const bypassSecret = requiredEnv(env, 'VERCEL_AUTOMATION_BYPASS_SECRET');
  const mailtrapToken = requiredEnv(env, 'MAILTRAP_API_TOKEN');
  const ids = mailtrapIds(env);
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');

  const runId = randomUUID();
  const primary = newActor(runId, 'a');
  const secondary = newActor(runId, 'b');
  const mailtrap = { ids, token: mailtrapToken };
  const paceEmail = createMailtrapSendPacer();

  const previewCheck = await sendPreview(fetchImpl, previewOrigin, `${authPath}/get-session`, { bypassSecret });
  requireStatus(previewCheck, 200, 'Preview auth preflight');
  assert.equal(previewCheck.data, null, 'The verifier requires an unauthenticated Preview endpoint before creating synthetic users.');

  const { resendLimiter: resend, ...signup } = await verifyActorSignup(
    fetchImpl, previewOrigin, bypassSecret, mailtrap, primary, { checkResendLimit: true, paceEmail },
  );
  const recovery = await verifyPasswordRecovery(fetchImpl, previewOrigin, bypassSecret, mailtrap, primary, { paceEmail });
  const secondarySignup = await verifyActorSignup(fetchImpl, previewOrigin, bypassSecret, mailtrap, secondary, {
    waitForSigninWindow: true,
    paceEmail,
  });

  const first = await saveStateAndBackup(fetchImpl, previewOrigin, bypassSecret, primary, `synthetic ${runId} account A`);
  const second = await saveStateAndBackup(fetchImpl, previewOrigin, bypassSecret, secondary, `synthetic ${runId} account B`);
  const primaryState = await sendPreview(fetchImpl, previewOrigin, '/api/ledger/state', { actor: primary, bypassSecret });
  const secondaryState = await sendPreview(fetchImpl, previewOrigin, '/api/ledger/state', { actor: secondary, bypassSecret });
  assert.equal(requireStatus(primaryState, 200, 'Primary Ledger state read').data.characters['meg-thomas'].notes, `synthetic ${runId} account A`);
  assert.equal(requireStatus(secondaryState, 200, 'Secondary Ledger state read').data.characters['meg-thomas'].notes, `synthetic ${runId} account B`);
  await readBackup(fetchImpl, previewOrigin, bypassSecret, secondary, first.backup.id, 404);
  await readBackup(fetchImpl, previewOrigin, bypassSecret, primary, first.backup.id, 200, first.data);

  const foreignOrigin = await deleteSyntheticAccount(fetchImpl, previewOrigin, bypassSecret, primary, primary.password, 'https://attacker.invalid');
  requireStatus(foreignOrigin, 403, 'Cross-origin account deletion');
  const incorrectPassword = await deleteSyntheticAccount(fetchImpl, previewOrigin, bypassSecret, primary, 'Incorrect-Synthetic-Password');
  requireStatus(incorrectPassword, 401, 'Incorrect current password on account deletion');

  const erased = await deleteSyntheticAccount(fetchImpl, previewOrigin, bypassSecret, primary, primary.password);
  requireStatus(erased, 204, 'Synthetic account erasure');
  const revoked = await sendPreview(fetchImpl, previewOrigin, `${authPath}/get-session`, { actor: primary, bypassSecret });
  requireStatus(revoked, 200, 'Deleted account session check');
  assert.equal(revoked.data, null, 'Account erasure must delete the active session.');
  const removedState = await sendPreview(fetchImpl, previewOrigin, '/api/ledger/state', { actor: primary, bypassSecret });
  requireStatus(removedState, 401, 'Deleted account Ledger access');
  await readBackup(fetchImpl, previewOrigin, bypassSecret, secondary, second.backup.id, 200, second.data);
  const secondaryStateAfter = await sendPreview(fetchImpl, previewOrigin, '/api/ledger/state', { actor: secondary, bypassSecret });
  assert.equal(requireStatus(secondaryStateAfter, 200, 'Other account after erasure').data.revision, 1);

  const repeatedDelete = await deleteSyntheticAccount(fetchImpl, previewOrigin, bypassSecret, primary, primary.password);
  requireStatus(repeatedDelete, 401, 'Repeated account erasure');

  const priorMessages = await listMessages(fetchImpl, mailtrap.ids, mailtrap.token);
  const excludedMessageIds = new Set(priorMessages.map(message => String(message.id)));
  const recreated = { ...newActor(runId, 'a-recreated'), email: primary.email };
  await verifyActorSignup(fetchImpl, previewOrigin, bypassSecret, mailtrap, recreated, { excludedMessageIds, paceEmail });
  const recreatedState = await sendPreview(fetchImpl, previewOrigin, '/api/ledger/state', { actor: recreated, bypassSecret });
  requireStatus(recreatedState, 404, 'State after account erasure and re-registration');
  await readBackup(fetchImpl, previewOrigin, bypassSecret, recreated, first.backup.id, 404);

  const recreatedDeletion = await deleteSyntheticAccount(fetchImpl, previewOrigin, bypassSecret, recreated, recreated.password);
  requireStatus(recreatedDeletion, 204, 'Recreated synthetic account cleanup erasure');
  const secondaryErasure = await deleteSyntheticAccount(fetchImpl, previewOrigin, bypassSecret, secondary, secondary.password);
  requireStatus(secondaryErasure, 204, 'Synthetic cleanup erasure');

  return {
    runId,
    previewOrigin,
    syntheticIdentitiesOnly: true,
    signupAndVerification: signup,
    resendLimiter: resend,
    passwordRecovery: recovery,
    secondSyntheticIdentity: secondarySignup,
    ledgerIsolation: true,
    deletionRequirements: {
      sameOrigin: true,
      currentPassword: true,
      sessionAndLedgerRevoked: true,
      stateAndBackupsAbsentAfterEmailReRegistration: true,
      otherSyntheticAccountUnaffected: true,
      repeatRejected: true,
    },
    syntheticAccountsErased: 3,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const url = parseArgs(process.argv.slice(2));
    const result = await verifyAuthLifecycle(url);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Preview auth lifecycle verification failed.');
    process.exitCode = 1;
  }
}
