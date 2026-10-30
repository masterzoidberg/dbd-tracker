import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostedSaveV3Fixture } from '../tests/fixtures/hosted-save.js';

const bypassHeader = 'x-vercel-protection-bypass';

function previewOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Provide an HTTPS Preview URL with --url.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Provide an HTTPS Preview URL without credentials or query parameters.');
  }
  return url.origin;
}

function parseCliArgs(args) {
  const usage = 'Usage: node scripts/verify-hosted-proof.mjs --url PREVIEW_URL [--verify-backup ID --fingerprint SHA256]';
  if (!Array.isArray(args) || args.length < 2 || args[0] !== '--url' || !args[1]) {
    throw new Error(usage);
  }
  if (args.length === 2) return { previewUrl: args[1] };
  if (
    args.length === 6
    && args[2] === '--verify-backup'
    && args[3]
    && args[4] === '--fingerprint'
    && /^[a-f0-9]{64}$/i.test(args[5])
  ) {
    return {
      previewUrl: args[1],
      backupId: args[3],
      fingerprint: args[5],
    };
  }
  if (args.length !== 2) {
    throw new Error('Usage: node scripts/verify-hosted-proof.mjs --url PREVIEW_URL');
  }
  return { previewUrl: args[1] };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const fields = Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${fields.join(',')}}`;
  }
  return JSON.stringify(value);
}

function snapshotFingerprint(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function requireBypassSecret(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required for the protected Preview.');
  }
  return value;
}

function documentWithNotes(notes) {
  const data = hostedSaveV3Fixture();
  data.characters['meg-thomas'].notes = notes;
  return data;
}

async function send(fetchImpl, baseUrl, path, { method = 'GET', body, bypassSecret } = {}) {
  const headers = {
    accept: 'application/json',
    [bypassHeader]: bypassSecret,
  };
  const options = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetchImpl(new URL(path, baseUrl), options);
  } catch {
    throw new Error('Hosted proof request failed.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // A non-JSON response is handled as an unexpected endpoint response below.
  }
  return { status: response.status, data };
}

function requireStatus(response, expected, operation) {
  if (response.status !== expected) {
    throw new Error(`${operation} expected HTTP ${expected}; received HTTP ${response.status}.`);
  }
  return response.data;
}

function requireState(response, expectedRevision, expectedData, operation) {
  const state = requireStatus(response, 200, operation);
  assert.equal(state.revision, expectedRevision, `${operation} returned an unexpected revision.`);
  assert.deepEqual(state.data, expectedData, `${operation} returned unexpected save data.`);
  return state;
}

export async function verifyHostedProof(previewUrl, {
  fetchImpl = globalThis.fetch,
  bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
} = {}) {
  const baseUrl = previewOrigin(previewUrl);
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  requireBypassSecret(bypassSecret);

  const request = (path, options = {}) => send(fetchImpl, baseUrl, path, {
    ...options,
    bypassSecret,
  });

  const emptyState = await request('/api/proof/state');
  if (emptyState.status !== 404 || emptyState.data?.error !== 'State not found.') {
    throw new Error(`Expected an empty Preview database; received HTTP ${emptyState.status}.`);
  }

  const revisionOneData = hostedSaveV3Fixture();
  const revisionOne = requireState(await request('/api/proof/state', {
    method: 'PUT',
    body: { expectedRevision: 0, data: revisionOneData },
  }), 1, revisionOneData, 'Initial write');
  requireState(await request('/api/proof/state'), 1, revisionOneData, 'Initial read');

  const revisionTwoData = documentWithNotes('synthetic revision two');
  const revisionTwo = requireState(await request('/api/proof/state', {
    method: 'PUT',
    body: { expectedRevision: revisionOne.revision, data: revisionTwoData },
  }), 2, revisionTwoData, 'Revision two write');

  const stale = await request('/api/proof/state', {
    method: 'PUT',
    body: { expectedRevision: 1, data: documentWithNotes('stale synthetic write') },
  });
  requireStatus(stale, 409, 'Stale write');
  requireState(await request('/api/proof/state'), 2, revisionTwoData, 'Read after stale write');

  const writerAData = documentWithNotes('synthetic concurrent writer A');
  const writerBData = documentWithNotes('synthetic concurrent writer B');
  const concurrent = await Promise.all([
    request('/api/proof/state', {
      method: 'PUT', body: { expectedRevision: 2, data: writerAData },
    }),
    request('/api/proof/state', {
      method: 'PUT', body: { expectedRevision: 2, data: writerBData },
    }),
  ]);
  const winners = concurrent.filter(result => result.status === 200);
  const conflicts = concurrent.filter(result => result.status === 409);
  assert.equal(winners.length, 1, 'Concurrent same-revision writes must have exactly one winner.');
  assert.equal(conflicts.length, 1, 'Concurrent same-revision writes must have exactly one conflict.');
  const winnerData = winners[0].data?.data;
  assert.ok(
    ['synthetic concurrent writer A', 'synthetic concurrent writer B']
      .includes(winnerData?.characters?.['meg-thomas']?.notes),
    'The concurrent winner must contain one submitted synthetic document.',
  );
  const revisionThree = requireState(await request('/api/proof/state'), 3, winnerData, 'Read after concurrent writes');

  const createdBackup = await request('/api/proof/backups', { method: 'POST' });
  const backup = requireStatus(createdBackup, 201, 'Backup creation');
  assert.ok(typeof backup.id === 'string' && backup.id.length > 0, 'Backup creation must return an ID.');
  assert.equal(backup.sourceRevision, revisionThree.revision);
  assert.deepEqual(backup.data, winnerData);
  const backupPath = `/api/proof/backups/${encodeURIComponent(backup.id)}`;
  assert.deepEqual(requireStatus(await request(backupPath), 200, 'Initial backup read'), backup);
  const backupFingerprint = snapshotFingerprint(backup);

  const revisionFourData = documentWithNotes('synthetic revision four');
  requireState(await request('/api/proof/state', {
    method: 'PUT', body: { expectedRevision: 3, data: revisionFourData },
  }), 4, revisionFourData, 'Revision four write');
  assert.deepEqual(requireStatus(await request(backupPath), 200, 'Backup read after later update'), backup);

  return {
    previewUrl: baseUrl,
    initialRevision: 1,
    staleWriteConflict: true,
    concurrentWinners: 1,
    backupId: backup.id,
    backupSourceRevision: backup.sourceRevision,
    backupFingerprint,
    finalRevision: 4,
    backupUnchanged: true,
  };
}

export async function verifyBackupSnapshot(previewUrl, backupId, expectedFingerprint, {
  fetchImpl = globalThis.fetch,
  bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
} = {}) {
  const baseUrl = previewOrigin(previewUrl);
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  requireBypassSecret(bypassSecret);
  if (!backupId || !/^[a-f0-9]{64}$/i.test(expectedFingerprint ?? '')) {
    throw new Error('A backup ID and SHA-256 fingerprint are required.');
  }

  const response = await send(fetchImpl, baseUrl, `/api/proof/backups/${encodeURIComponent(backupId)}`, {
    bypassSecret,
  });
  const backup = requireStatus(response, 200, 'Backup read after direct SQL checks');
  assert.equal(backup.id, backupId, 'The backup endpoint returned a different backup.');
  const actualFingerprint = snapshotFingerprint(backup);
  assert.equal(actualFingerprint, expectedFingerprint, 'The backup snapshot changed after the direct SQL checks.');
  return {
    previewUrl: baseUrl,
    backupId,
    backupSourceRevision: backup.sourceRevision,
    backupFingerprint: actualFingerprint,
    backupUnchanged: true,
  };
}

export async function runVerifierCli(args = process.argv.slice(2), {
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  const { previewUrl, backupId, fingerprint } = parseCliArgs(args);
  const bypassSecret = requireBypassSecret(env?.VERCEL_AUTOMATION_BYPASS_SECRET);
  if (backupId) return verifyBackupSnapshot(previewUrl, backupId, fingerprint, { fetchImpl, bypassSecret });
  return verifyHostedProof(previewUrl, { fetchImpl, bypassSecret });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runVerifierCli();
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Hosted proof verification failed.');
    process.exitCode = 1;
  }
}
