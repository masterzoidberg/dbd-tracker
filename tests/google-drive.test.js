import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleDrive, DRIVE_SCOPE, googleDriveConfig } from '../src/google-drive.js';
import { freshSave, exportSave } from '../src/model.js';

const config = { clientId: '123.apps.googleusercontent.com' };
function fixture({ responses = [], tokenError = false } = {}) {
  const calls = []; let tokenOptions, time = 1000, loads = 0;
  const oauth = {
    initTokenClient(options) { tokenOptions = options; return { requestAccessToken() {
      options.callback(tokenError ? { error: 'access_denied' } : { access_token: 'private-token', expires_in: 60, scope: DRIVE_SCOPE });
    } }; },
    hasGrantedAllScopes: response => response.scope === DRIVE_SCOPE,
    revoke(token, callback) { calls.push({ revoke: token }); callback({}); },
  };
  const drive = createGoogleDrive(config, {
    environment: () => ({ protocol: 'https:', online: true, origin: 'https://example.test' }), now: () => time,
    loadLibraries: async () => { loads++; return { oauth }; },
    fetch: async (url, options) => { calls.push({ url, ...options }); const next = responses.shift();
      if (next instanceof Error) throw next;
      return new Response(typeof next?.body === 'string' ? next.body : JSON.stringify(next?.body ?? {}), { status: next?.status ?? 200 }); },
  });
  return { drive, calls, get loads() { return loads; }, get tokenOptions() { return tokenOptions; },
    advance: () => { time += 61000; } };
}

test('missing, partial and invalid configuration fail safely without loading Google', async () => {
  assert.deepEqual(googleDriveConfig(), { clientId: '' });
  assert.deepEqual(googleDriveConfig({ LEDGER_GOOGLE_CLIENT_ID: config.clientId }), config);
  for (const value of [{}, { clientId: '' }, { clientId: 'invalid' }]) {
    const drive = createGoogleDrive(value);
    assert.equal(drive.status().available, false);
    await assert.rejects(drive.connect(), /configured/);
  }
});
for (const failedStep of [1, 3, 4]) test(`failure at backup creation/upload step ${failedStep} stops without deleting or changing unrelated files`, async () => {
  const responses = [{ body: { files: [] } }, { body: { id: 'folder' } }, { body: { files: [] } }, { body: { id: 'latest' } }, { body: { id: 'latest' } }];
  responses[failedStep] = { status: 500 };
  const f = fixture({ responses }); await f.drive.connect();
  await assert.rejects(f.drive.exportJson('{}'), /HTTP 500/);
  assert.equal(f.calls.length, failedStep + 1); assert.ok(f.calls.every(call => call.method !== 'DELETE'));
});
test('authorization is explicit, narrow, memory-only, expires, and disconnect clears it', async () => {
  const f = fixture(); assert.equal(f.loads, 0); assert.equal(f.drive.status().connected, false);
  await f.drive.prepare(); assert.equal(f.drive.status().connected, false);
  await f.drive.connect(); assert.equal(f.tokenOptions.scope, DRIVE_SCOPE);
  assert.equal(f.tokenOptions.include_granted_scopes, false);
  assert.equal(f.drive.status().connected, true);
  assert.ok(!JSON.stringify(f.drive).includes('private-token'));
  await f.drive.disconnect(); assert.equal(f.drive.status().connected, false);
  await f.drive.connect(); f.advance(); assert.equal(f.drive.status().connected, false);
});
test('denied authorization leaves a disconnected session', async () => {
  const f = fixture({ tokenError: true }); await assert.rejects(f.drive.connect(), /authorization/i);
  assert.equal(f.drive.status().connected, false); assert.equal(f.calls.length, 0);
});
test('first export creates tagged folder and current file, repeat updates the same IDs with canonical bytes', async () => {
  const f = fixture({ responses: [
    { body: { files: [] } }, { body: { id: 'folder' } }, { body: { files: [] } },
    { body: { id: 'latest' } }, { body: { id: 'latest' } },
    { body: { files: [{ id: 'folder' }] } }, { body: { files: [{ id: 'latest' }] } }, { body: { id: 'latest' } },
  ] });
  const save = freshSave(), before = JSON.stringify(save), bytes = exportSave(save);
  await f.drive.connect(); await f.drive.exportJson(bytes); await f.drive.exportJson(bytes);
  const uploads = f.calls.filter(c => c.url?.includes('/upload/'));
  assert.equal(uploads.length, 2); assert.ok(uploads.every(c => c.body === bytes && c.method === 'PATCH'));
  assert.ok(uploads.every(c => c.url.includes('/latest?')));
  assert.ok(f.calls.filter(c => c.method === 'POST').every(c => JSON.parse(c.body).appProperties.ledgerBackup));
  assert.equal(JSON.stringify(save), before); assert.ok(!bytes.includes('private-token'));
  assert.ok(!JSON.stringify(f.drive.status()).includes('private-token'));
});
for (const status of [401, 403, 500]) test(`Drive ${status} failures never mutate Ledger or reveal provider text`, async () => {
  const f = fixture({ responses: [{ status, body: '<img onerror=alert(1)>private-token' }] });
  const save = freshSave(), before = JSON.stringify(save); await f.drive.connect();
  await assert.rejects(f.drive.exportJson(exportSave(save)), error => !error.message.includes('private-token') && !error.message.includes('<img'));
  assert.equal(JSON.stringify(save), before);
  if (status === 401) assert.equal(f.drive.status().connected, false);
});
test('Client ID alone enables Drive without other public configuration', async () => {
  const f = fixture(); assert.equal(f.drive.status().available, true);
  await f.drive.connect(); assert.equal(f.drive.status().connected, true);
});
test('import downloads only the app-managed latest JSON with an auth header and never creates files', async () => {
  const f = fixture({ responses: [{ body: { files: [{ id: 'folder' }] } }, { body: { files: [{ id: 'latest' }] } }, { body: 'untrusted JSON bytes' }] });
  assert.equal(await f.drive.importJson(), 'untrusted JSON bytes');
  assert.equal(f.calls.length, 3);
  assert.ok(f.calls[2].url.endsWith('/latest?alt=media'));
  assert.equal(f.calls[2].headers.Authorization, 'Bearer private-token');
  assert.ok(f.calls.every(c => !c.method && !c.url.includes('private-token')));
  for (const call of f.calls.slice(0, 2)) {
    const q = new URL(call.url).searchParams.get('q');
    assert.match(q, /appProperties/); assert.match(q, /trashed = false/);
  }
  assert.match(new URL(f.calls[1].url).searchParams.get('q'), /'folder' in parents/);
});
for (const missing of ['folder', 'latest']) test('missing app-managed ' + missing + ' is non-destructive and does not create a backup', async () => {
  const responses = missing === 'folder' ? [{ body: { files: [] } }] : [{ body: { files: [{ id: 'folder' }] } }, { body: { files: [] } }];
  const f = fixture({ responses });
  await assert.rejects(f.drive.importJson(), /No Ledger backup/);
  assert.ok(f.calls.every(c => !c.method));
});
test('download failure leaves the local save untouched and allows retry', async () => {
  const f = fixture({ responses: [{ body: { files: [{ id: 'folder' }] } }, { body: { files: [{ id: 'latest' }] } }, { status: 500 }] });
  const save = freshSave(), before = JSON.stringify(save);
  await assert.rejects(f.drive.importJson(), /HTTP 500/);
  assert.equal(JSON.stringify(save), before); assert.equal(f.drive.status().connected, true);
});
for (const action of ['import', 'export']) test(action + ' follows empty pages before finding the existing folder and current file', async () => {
  const f = fixture({ responses: [
    { body: { files: [], nextPageToken: 'folder-page-2' } }, { body: { files: [{ id: 'folder' }] } },
    { body: { files: [], nextPageToken: 'file-page-2' } }, { body: { files: [{ id: 'latest' }] } },
    { body: action === 'import' ? 'canonical bytes' : { id: 'latest' } },
  ] });
  if (action === 'import') assert.equal(await f.drive.importJson(), 'canonical bytes');
  else await f.drive.exportJson('canonical bytes');
  assert.equal(f.calls.length, 5);
  assert.equal(new URL(f.calls[1].url).searchParams.get('pageToken'), 'folder-page-2');
  assert.equal(new URL(f.calls[3].url).searchParams.get('pageToken'), 'file-page-2');
  assert.ok(f.calls[4].url.includes('/latest?'));
  assert.ok(f.calls.every(call => call.method !== 'POST'), 'Never create duplicates when a later page holds the backup');
});
test('file and offline contexts never load Google libraries', async () => {
  for (const environment of [{ protocol: 'file:', online: true }, { protocol: 'https:', online: false }]) {
    let loaded = false;
    const drive = createGoogleDrive(config, { environment: () => environment, loadLibraries: () => { loaded = true; } });
    assert.equal(drive.status().available, false); await assert.rejects(drive.prepare()); assert.equal(loaded, false);
  }
});
