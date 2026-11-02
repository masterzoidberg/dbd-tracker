import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { hostedSaveV3Fixture } from '../tests/fixtures/hosted-save.js';

const authBasePath = '/api/auth';
const statePath = '/api/ledger/state';
const backupsPath = '/api/ledger/backups';

function explicitPreviewBaseUrl(value) {
  if (typeof value !== 'string' || value.length === 0) throw new Error('An explicit Preview URL is required.');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('An explicit Preview URL is required.');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.vercel.app') ||
      parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('An explicit Preview URL is required.');
  }
  return parsed.origin;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieHeaders(response) {
  const lines = typeof response.headers?.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers?.get?.('set-cookie')].filter(Boolean);
  const cookies = lines
    .map(line => line.split(';', 1)[0].trim())
    .filter(cookie => /^__Secure-better-auth\.session_token=/.test(cookie));
  if (cookies.length === 0) throw new Error('Preview sign-in did not establish an authenticated session.');
  return cookies.join('; ');
}

function makeSyntheticAccount() {
  return {
    name: 'Ledger synthetic proof',
    email: `ledger-proof-${randomUUID()}@example.invalid`,
    password: randomBytes(32).toString('base64url'),
  };
}

async function fetchJson(fetchImpl, baseUrl, path, {
  method = 'GET',
  body,
  cookie,
  expectedStatus = 200,
} = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (method === 'PUT' || method === 'POST') headers.origin = baseUrl;
  if (cookie) headers.cookie = cookie;

  let response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    throw new Error('Preview verification request failed.');
  }
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expectedStatuses.includes(response.status) || response.redirected || (response.status >= 300 && response.status < 400)) {
    throw new Error(`Preview verification endpoint returned HTTP ${response.status}.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Preview verification endpoint returned an invalid response.');
  }
  return { response, payload };
}

async function createSignedInSyntheticAccount(fetchImpl, baseUrl) {
  const account = makeSyntheticAccount();
  const origin = baseUrl;
  const signup = await fetchJson(fetchImpl, baseUrl, `${authBasePath}/sign-up/email`, {
    method: 'POST',
    body: account,
    expectedStatus: [200, 201],
  });
  if (signup.payload?.user?.email !== account.email || typeof signup.payload?.user?.id !== 'string') {
    throw new Error('Synthetic account creation failed.');
  }

  const signInResponse = await fetchImpl(`${baseUrl}${authBasePath}/sign-in/email`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', origin },
    body: JSON.stringify({ email: account.email, password: account.password }),
    redirect: 'manual',
    cache: 'no-store',
  }).catch(() => { throw new Error('Preview sign-in request failed.'); });
  if (signInResponse.status !== 200 || signInResponse.redirected) {
    throw new Error(`Preview sign-in returned HTTP ${signInResponse.status}.`);
  }
  const cookie = cookieHeaders(signInResponse);
  const session = await fetchJson(fetchImpl, baseUrl, `${authBasePath}/get-session`, { cookie });
  if (session.payload?.user?.email !== account.email || session.payload?.user?.id !== signup.payload.user.id) {
    throw new Error('Preview sign-in did not establish the requested synthetic session.');
  }
  return { cookie, userId: signup.payload.user.id };
}

function syntheticSave(note) {
  const save = hostedSaveV3Fixture();
  save.updatedAt = '2026-11-02T12:00:00.000Z';
  save.characters['meg-thomas'].notes = note;
  return save;
}

function sameDocument(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function verifyAuthenticatedPersistence(value, { fetchImpl = globalThis.fetch } = {}) {
  const baseUrl = explicitPreviewBaseUrl(value);
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');

  let probe;
  try {
    probe = await fetchImpl(`${baseUrl}${authBasePath}/get-session`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    throw new Error('Preview deployment could not be reached.');
  }
  if (probe.status !== 200 || probe.redirected) {
    throw new Error('The supplied URL is not an accessible Preview deployment.');
  }
  let emptySession;
  try {
    emptySession = await probe.json();
  } catch {
    throw new Error('The supplied URL is not an accessible Preview deployment.');
  }
  if (emptySession !== null) throw new Error('Preview session probe did not return an empty session.');

  const anonymousState = await fetchJson(fetchImpl, baseUrl, statePath, { expectedStatus: 401 });
  const anonymousBackup = await fetchJson(fetchImpl, baseUrl, backupsPath, { method: 'POST', expectedStatus: 401 });
  requireCondition(anonymousState.payload?.error === 'Authentication required.' &&
    anonymousBackup.payload?.error === 'Authentication required.', 'Unauthenticated persistence requests were not rejected.');

  const accountA = await createSignedInSyntheticAccount(fetchImpl, baseUrl);
  const accountB = await createSignedInSyntheticAccount(fetchImpl, baseUrl);
  const { cookie: cookieA, userId: userIdA } = accountA;
  const { cookie: cookieB, userId: userIdB } = accountB;

  const originalA = syntheticSave('Synthetic authenticated proof account A');
  const originalB = syntheticSave('Synthetic authenticated proof account B');
  const writeA = (await fetchJson(fetchImpl, baseUrl, statePath, {
    method: 'PUT', cookie: cookieA, body: { expectedRevision: 0, data: originalA },
  })).payload;
  const writeB = (await fetchJson(fetchImpl, baseUrl, statePath, {
    method: 'PUT', cookie: cookieB, body: { expectedRevision: 0, data: originalB },
  })).payload;
  requireCondition(writeA.revision === 1 && writeB.revision === 1, 'Synthetic users did not receive independent initial revisions.');

  const stateA = (await fetchJson(fetchImpl, baseUrl, statePath, { cookie: cookieA })).payload;
  const stateB = (await fetchJson(fetchImpl, baseUrl, statePath, { cookie: cookieB })).payload;
  requireCondition(stateA.data.characters['meg-thomas'].notes === 'Synthetic authenticated proof account A', 'First synthetic account readback failed.');
  requireCondition(stateB.data.characters['meg-thomas'].notes === 'Synthetic authenticated proof account B', 'Second synthetic account readback failed.');

  const stateARequestingB = (await fetchJson(fetchImpl, baseUrl, `${statePath}?userId=${encodeURIComponent(userIdB)}`, { cookie: cookieA })).payload;
  const stateBRequestingA = (await fetchJson(fetchImpl, baseUrl, `${statePath}?userId=${encodeURIComponent(userIdA)}`, { cookie: cookieB })).payload;
  requireCondition(stateARequestingB.data.characters['meg-thomas'].notes === originalA.characters['meg-thomas'].notes &&
    stateBRequestingA.data.characters['meg-thomas'].notes === originalB.characters['meg-thomas'].notes,
  'A request for another user\u2019s state did not return foreign data.');

  const foreignWriteA = await fetchJson(fetchImpl, baseUrl, statePath, {
    method: 'PUT', cookie: cookieA,
    body: { expectedRevision: 1, userId: userIdB, data: syntheticSave('Rejected cross-owner write from A') },
    expectedStatus: 400,
  });
  const foreignWriteB = await fetchJson(fetchImpl, baseUrl, statePath, {
    method: 'PUT', cookie: cookieB,
    body: { expectedRevision: 1, userId: userIdA, data: syntheticSave('Rejected cross-owner write from B') },
    expectedStatus: 400,
  });
  requireCondition(foreignWriteA.payload?.error === 'Invalid request.' &&
    foreignWriteB.payload?.error === 'Invalid request.', 'A cross-owner state write was not rejected.');
  const stateAfterForeignWritesA = (await fetchJson(fetchImpl, baseUrl, statePath, { cookie: cookieA })).payload;
  const stateAfterForeignWritesB = (await fetchJson(fetchImpl, baseUrl, statePath, { cookie: cookieB })).payload;
  requireCondition(stateAfterForeignWritesA.revision === 1 &&
    stateAfterForeignWritesA.data.characters['meg-thomas'].notes === originalA.characters['meg-thomas'].notes &&
    stateAfterForeignWritesB.revision === 1 &&
    stateAfterForeignWritesB.data.characters['meg-thomas'].notes === originalB.characters['meg-thomas'].notes,
  'A rejected cross-owner write changed a user state.');

  const backup = (await fetchJson(fetchImpl, baseUrl, backupsPath, {
    method: 'POST', cookie: cookieA, expectedStatus: 201,
  })).payload;
  const backupSnapshot = cloneBackup(backup);
  requireCondition(backup.sourceRevision === 1 && backup.data.characters['meg-thomas'].notes === originalA.characters['meg-thomas'].notes,
    'Synthetic backup did not snapshot the authenticated account state.');
  const backupB = (await fetchJson(fetchImpl, baseUrl, backupsPath, {
    method: 'POST', cookie: cookieB, expectedStatus: 201,
  })).payload;
  const backupSnapshotB = cloneBackup(backupB);
  requireCondition(backupB.sourceRevision === 1 && backupB.data.characters['meg-thomas'].notes === originalB.characters['meg-thomas'].notes,
    'Second synthetic backup did not snapshot its authenticated account state.');

  const foreignBackup = await fetchJson(fetchImpl, baseUrl, `${backupsPath}/${encodeURIComponent(backup.id)}`, {
    cookie: cookieB, expectedStatus: 404,
  });
  const foreignBackupB = await fetchJson(fetchImpl, baseUrl, `${backupsPath}/${encodeURIComponent(backupB.id)}`, {
    cookie: cookieA, expectedStatus: 404,
  });
  const unknownBackup = await fetchJson(fetchImpl, baseUrl, `${backupsPath}/00000000-0000-4000-8000-999999999999`, {
    cookie: cookieB, expectedStatus: 404,
  });
  requireCondition(foreignBackup.payload?.error === unknownBackup.payload?.error, 'Foreign backup response differs from an unknown backup.');
  const unknownBackupA = await fetchJson(fetchImpl, baseUrl, `${backupsPath}/00000000-0000-4000-8000-999999999998`, {
    cookie: cookieA, expectedStatus: 404,
  });
  requireCondition(foreignBackupB.payload?.error === unknownBackupA.payload?.error,
    'Second foreign backup response differs from an unknown backup.');
  const ownBackup = (await fetchJson(fetchImpl, baseUrl, `${backupsPath}/${encodeURIComponent(backup.id)}`, { cookie: cookieA })).payload;
  requireCondition(sameDocument(ownBackup, backupSnapshot), 'Backup owner could not read the original snapshot.');
  const ownBackupB = (await fetchJson(fetchImpl, baseUrl, `${backupsPath}/${encodeURIComponent(backupB.id)}`, { cookie: cookieB })).payload;
  requireCondition(sameDocument(ownBackupB, backupSnapshotB), 'Second backup owner could not read the original snapshot.');

  const backupMutation = await fetchJson(fetchImpl, baseUrl, `${backupsPath}/${encodeURIComponent(backup.id)}`, {
    method: 'DELETE', cookie: cookieA, expectedStatus: 405,
  });
  requireCondition(backupMutation.payload?.error === 'Method not allowed.', 'The Preview API exposed a backup mutation method.');

  const revisionTwo = syntheticSave('Synthetic authenticated proof account A revision two');
  const updatedA = (await fetchJson(fetchImpl, baseUrl, statePath, {
    method: 'PUT', cookie: cookieA, body: { expectedRevision: 1, data: revisionTwo },
  })).payload;
  const staleSave = syntheticSave('Synthetic stale request must not be stored');
  const staleWrite = await fetchJson(fetchImpl, baseUrl, statePath, {
    method: 'PUT', cookie: cookieA, body: { expectedRevision: 1, data: staleSave }, expectedStatus: 409,
  });
  requireCondition(staleWrite.payload?.error === 'Revision conflict.', 'Stale write did not return the revision conflict response.');
  const afterStale = (await fetchJson(fetchImpl, baseUrl, statePath, { cookie: cookieA })).payload;
  requireCondition(sameDocument(afterStale, updatedA), 'Stale write changed the stored document.');

  const writerA = syntheticSave('Synthetic concurrent writer A');
  const writerB = syntheticSave('Synthetic concurrent writer B');
  const concurrent = await Promise.all([
    fetchJson(fetchImpl, baseUrl, statePath, { method: 'PUT', cookie: cookieA, body: { expectedRevision: 2, data: writerA }, expectedStatus: [200, 409] }),
    fetchJson(fetchImpl, baseUrl, statePath, { method: 'PUT', cookie: cookieA, body: { expectedRevision: 2, data: writerB }, expectedStatus: [200, 409] }),
  ]);
  const concurrentWinners = concurrent.filter(result => result.response.status === 200).length;
  requireCondition(concurrentWinners === 1, 'Concurrent same-revision requests did not produce exactly one winner.');

  const finalA = (await fetchJson(fetchImpl, baseUrl, statePath, { cookie: cookieA })).payload;
  const finalB = (await fetchJson(fetchImpl, baseUrl, statePath, { cookie: cookieB })).payload;
  requireCondition(finalA.revision === 3 && finalB.revision === 1, 'Concurrent writes changed another user revision.');
  requireCondition(
    ['Synthetic concurrent writer A', 'Synthetic concurrent writer B'].includes(finalA.data.characters['meg-thomas'].notes),
    'Concurrent winner document was not stored.',
  );
  const backupAfterUpdates = (await fetchJson(fetchImpl, baseUrl, `${backupsPath}/${encodeURIComponent(backup.id)}`, { cookie: cookieA })).payload;
  const backupUnchanged = sameDocument(backupAfterUpdates, backupSnapshot);
  requireCondition(backupUnchanged, 'Immutable backup changed after later state revisions.');
  const backupBAfterUpdates = (await fetchJson(fetchImpl, baseUrl, `${backupsPath}/${encodeURIComponent(backupB.id)}`, { cookie: cookieB })).payload;
  requireCondition(sameDocument(backupBAfterUpdates, backupSnapshotB), 'Second immutable backup changed after later state revisions.');

  return {
    independentUsers: true,
    unauthenticatedAccessRejected: true,
    foreignStateReadsContained: true,
    foreignStateWritesRejected: true,
    foreignBackupHidden: true,
    backupMutationRejected: true,
    staleWriteConflict: true,
    concurrentWinners,
    backupId: backup.id,
    backupSourceRevision: backup.sourceRevision,
    backupUnchanged,
    finalRevision: finalA.revision,
  };
}

function cloneBackup(value) {
  return JSON.parse(JSON.stringify(value));
}

export function parseVerifierArgs(args) {
  if (!Array.isArray(args) || args.length !== 2 || args[0] !== '--url' || !args[1]) {
    throw new Error('Usage: node scripts/verify-authenticated-persistence.mjs --url <preview-url>');
  }
  return args[1];
}

export async function runVerifierCli(args, options = {}) {
  return verifyAuthenticatedPersistence(parseVerifierArgs(args), options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVerifierCli(process.argv.slice(2))
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(error => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
