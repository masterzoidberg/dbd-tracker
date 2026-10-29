import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleDrive, DRIVE_SCOPE, googleDriveConfig } from '../src/google-drive.js';
import { freshSave, exportSave } from '../src/model.js';

const config = { clientId: '123.apps.googleusercontent.com', apiKey: 'AIza' + 'a'.repeat(35), appId: '938560128029' };
const folder = { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder', trashed: false };

function fixture({ responses = [], tokenError = false, stored = { id: folder.id, name: folder.name } } = {}) {
  const calls = [], storage = new Map([['dbdTrackerDriveFolder', JSON.stringify(stored)]]);
  let tokenOptions, time = 1000, loads = 0, pickerLoads = 0;
  const oauth = {
    initTokenClient(options) { tokenOptions = options; return { requestAccessToken() {
      options.callback(tokenError ? { error: 'access_denied' } : { access_token: 'private-token', expires_in: 60, scope: DRIVE_SCOPE });
    } }; },
    hasGrantedAllScopes: response => response.scope === DRIVE_SCOPE,
    revoke(token, callback) { calls.push({ revoke: token }); callback({}); },
  };
  const drive = createGoogleDrive(config, {
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    environment: () => ({ protocol: 'https:', online: true, origin: 'https://example.test' }), now: () => time,
    loadLibraries: async () => { loads++; return { oauth }; },
    loadPicker: async () => { pickerLoads++; return {}; },
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      const body = next?.body ?? (url.includes('/drive/v3/files/folder-1?') ? folder : {});
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: next?.status ?? 200 });
    },
  });
  return { drive, calls, storage, get loads() { return loads; }, get pickerLoads() { return pickerLoads; }, get tokenOptions() { return tokenOptions; }, advance: () => { time += 61000; } };
}

test('missing, partial and malformed public configuration fails safely without disabling OAuth for Picker omissions', async () => {
  assert.deepEqual(googleDriveConfig(), { clientId: '', apiKey: '', appId: '' });
  assert.deepEqual(googleDriveConfig({ LEDGER_GOOGLE_CLIENT_ID: config.clientId }), { clientId: config.clientId, apiKey: '', appId: '' });
  assert.deepEqual(googleDriveConfig({ LEDGER_GOOGLE_CLIENT_ID: config.clientId, LEDGER_GOOGLE_API_KEY: config.apiKey, LEDGER_GOOGLE_APP_ID: config.appId }), config);
  for (const value of [{}, { clientId: '' }, { clientId: 'invalid' }]) {
    const drive = createGoogleDrive(value);
    assert.equal(drive.status().available, false);
    await assert.rejects(drive.connect(), /configured/);
  }
  for (const partial of [{ clientId: config.clientId }, { ...config, apiKey: 'invalid' }, { ...config, appId: 'not-numeric' }]) {
    const drive = createGoogleDrive(partial, { environment: () => ({ protocol: 'https:', online: true }) });
    assert.equal(drive.status().available, true);
    assert.equal(drive.status().pickerAvailable, false);
    await assert.rejects(drive.selectFolder(), /folder picker.*configured/i);
  }
});

test('authorization is explicit, narrow, memory-only, expires, and disconnect keeps the local folder preference', async () => {
  const f = fixture(); assert.equal(f.loads, 0); assert.equal(f.pickerLoads, 0);
  await f.drive.prepare(); assert.equal(f.drive.status().connected, false);
  await f.drive.connect(); assert.equal(f.tokenOptions.scope, DRIVE_SCOPE);
  assert.equal(f.tokenOptions.include_granted_scopes, false);
  assert.equal(f.drive.status().connected, true);
  assert.ok(!JSON.stringify(f.drive).includes('private-token'));
  await f.drive.disconnect(); assert.equal(f.drive.status().connected, false);
  assert.deepEqual(f.drive.destination(), { id: folder.id, name: folder.name });
  await f.drive.connect(); f.advance(); assert.equal(f.drive.status().connected, false);
});

test('denied authorization leaves a disconnected session and makes no Drive request', async () => {
  const f = fixture({ tokenError: true }); await assert.rejects(f.drive.connect(), /authorization/i);
  assert.equal(f.drive.status().connected, false);
  assert.equal(f.calls.length, 0);
});

test('canonical export updates only the app-managed latest file in the selected folder and leaves Ledger data unchanged', async () => {
  const f = fixture({ responses: [
    { body: folder }, { body: { files: [{ id: 'latest' }] } }, { body: { id: 'latest' } },
  ] });
  const save = freshSave(), before = JSON.stringify(save), bytes = exportSave(save);
  await f.drive.exportJson(bytes);
  const upload = f.calls.find(call => call.url?.includes('/upload/'));
  assert.equal(upload.body, bytes);
  assert.equal(upload.method, 'PATCH');
  assert.ok(upload.url.endsWith('/latest?uploadType=media'));
  const query = new URL(f.calls.find(call => call.url?.includes('/drive/v3/files?')).url).searchParams.get('q');
  assert.match(query, /appProperties/); assert.match(query, /trashed = false/);
  assert.match(query, /'folder-1' in parents/);
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
  assert.equal(JSON.stringify(save), before);
  assert.ok(!bytes.includes('private-token'));
});

for (const status of [401, 403, 500]) test(`Drive ${status} failure does not mutate Ledger or expose response text`, async () => {
  const f = fixture({ responses: [{ body: folder }, { status, body: '<img onerror=alert(1)>private-token' }] });
  const save = freshSave(), before = JSON.stringify(save);
  await assert.rejects(f.drive.exportJson(exportSave(save)), error => !error.message.includes('private-token') && !error.message.includes('<img'));
  assert.equal(JSON.stringify(save), before);
  if (status === 401) assert.equal(f.drive.status().connected, false);
});

test('restore downloads only the app-managed latest JSON from the selected folder and never creates files', async () => {
  const f = fixture({ responses: [
    { body: folder }, { body: { files: [{ id: 'latest' }] } }, { body: 'untrusted JSON bytes' },
  ] });
  assert.equal(await f.drive.importJson(), 'untrusted JSON bytes');
  assert.equal(f.calls.length, 3);
  assert.ok(f.calls[2].url.endsWith('/latest?alt=media'));
  assert.equal(f.calls[2].headers.Authorization, 'Bearer private-token');
  assert.ok(f.calls.every(call => !call.url?.includes('private-token')));
  assert.match(new URL(f.calls[1].url).searchParams.get('q'), /appProperties/);
  assert.match(new URL(f.calls[1].url).searchParams.get('q'), /'folder-1' in parents/);
  assert.equal(f.calls.some(call => call.method === 'POST'), false);
});

test('missing backup reports an explanation without creating a file', async () => {
  const f = fixture({ responses: [{ body: folder }, { body: { files: [] } }] });
  await assert.rejects(f.drive.importJson(), /No Ledger backup was found in the selected Google Drive folder/);
  assert.equal(f.calls.some(call => call.method === 'POST'), false);
});

test('list queries follow pages before creating a backup in the selected folder', async () => {
  const f = fixture({ responses: [
    { body: folder }, { body: { files: [], nextPageToken: 'page-2' } },
    { body: { files: [{ id: 'latest' }] } }, { body: { id: 'latest' } },
  ] });
  await f.drive.exportJson('canonical bytes');
  assert.equal(new URL(f.calls[2].url).searchParams.get('pageToken'), 'page-2');
  assert.ok(f.calls[3].url.includes('/latest?uploadType=media'));
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 0, 'a later page holding the app file prevents duplicates');
});

test('file and offline contexts never load Google libraries or Picker', async () => {
  for (const environment of [{ protocol: 'file:', online: true }, { protocol: 'https:', online: false }]) {
    let loaded = false, pickerLoaded = false;
    const drive = createGoogleDrive(config, { environment: () => environment,
      loadLibraries: () => { loaded = true; }, loadPicker: () => { pickerLoaded = true; } });
    assert.equal(drive.status().available, false);
    await assert.rejects(drive.prepare());
    await assert.rejects(drive.selectFolder());
    assert.equal(loaded, false); assert.equal(pickerLoaded, false);
  }
});
