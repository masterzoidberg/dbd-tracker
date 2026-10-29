import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleDrive, DRIVE_SCOPE, googleDriveConfig } from '../src/google-drive.js';

const config = {
  clientId: '123.apps.googleusercontent.com',
  apiKey: 'AIza' + 'a'.repeat(35),
  appId: '938560128029',
};

function fixture({ pickerAction = 'PICKED', folder = { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder' }, stored = null, responses = [], pickerLoadFailure = false } = {}) {
  const calls = [], storage = new Map(), pickerCalls = [];
  if (stored) storage.set('dbdTrackerDriveFolder', JSON.stringify(stored));
  let pickerCallback, pickerLoads = 0, pickerVisible = false, pickerShouldFail = pickerLoadFailure;
  const oauth = {
    initTokenClient(options) { return { requestAccessToken() { options.callback({ access_token: 'memory-token', expires_in: 3600, scope: DRIVE_SCOPE }); } }; },
    hasGrantedAllScopes: response => response.scope === DRIVE_SCOPE,
    revoke(_token, callback) { callback({}); },
  };
  class DocsView {
    constructor(id) { this.id = id; pickerCalls.push({ view: id }); }
    setSelectFolderEnabled(value) { pickerCalls.push({ selectFolderEnabled: value }); return this; }
    setIncludeFolders(value) { pickerCalls.push({ includeFolders: value }); return this; }
    setMimeTypes(value) { pickerCalls.push({ mimeTypes: value }); return this; }
  }
  class PickerBuilder {
    setAppId(value) { pickerCalls.push({ appId: value }); return this; }
    setDeveloperKey(value) { pickerCalls.push({ apiKey: value }); return this; }
    setOAuthToken(value) { pickerCalls.push({ token: value }); return this; }
    addView(value) { pickerCalls.push({ addedView: value.id }); return this; }
    setCallback(callback) { pickerCallback = callback; return this; }
    build() { return { setVisible(value) {
      pickerVisible = value;
      if (value && pickerAction !== 'HOLD') queueMicrotask(() => pickerCallback(pickerAction === 'PICKED'
        ? { action: 'PICKED', docs: [folder] }
        : { action: pickerAction }));
    } }; }
  }
  const drive = createGoogleDrive(config, {
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    environment: () => ({ protocol: 'https:', online: true, origin: 'https://example.test' }),
    loadLibraries: async () => ({ oauth }),
    loadPicker: async () => {
      pickerLoads++;
      if (pickerShouldFail) throw Error('synthetic Picker load failure');
      return { ViewId: { FOLDERS: 'FOLDERS' }, DocsView, PickerBuilder, Action: { PICKED: 'PICKED', CANCEL: 'CANCEL' } };
    },
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      const body = next?.body ?? (url.includes('/drive/v3/files/folder-1?')
        ? { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder', trashed: false }
        : {});
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: next?.status ?? 200 });
    },
  });
  return { drive, calls, storage, pickerCalls, get pickerLoads() { return pickerLoads; }, get pickerVisible() { return pickerVisible; }, get pickerCallback() { return pickerCallback; }, setPickerLoadFailure: value => { pickerShouldFail = value; } };
}

test('configuration keeps OAuth available without Picker and rejects malformed Picker values independently', async () => {
  assert.deepEqual(googleDriveConfig(), { clientId: '', apiKey: '', appId: '' });
  assert.deepEqual(googleDriveConfig({ LEDGER_GOOGLE_CLIENT_ID: config.clientId }), { clientId: config.clientId, apiKey: '', appId: '' });
  const oauthOnly = createGoogleDrive({ clientId: config.clientId }, { environment: () => ({ protocol: 'https:', online: true }) });
  assert.equal(oauthOnly.status().available, true);
  assert.equal(oauthOnly.status().pickerAvailable, false);
  const malformed = createGoogleDrive({ ...config, appId: 'not-a-project-number', apiKey: 'not-an-api-key' }, { environment: () => ({ protocol: 'https:', online: true }) });
  assert.equal(malformed.status().available, true);
  assert.equal(malformed.status().pickerAvailable, false);
  await assert.rejects(malformed.selectFolder(), /folder picker.*configured/i);
});

test('Picker stays unloaded until explicit folder selection and exposes folders only', async () => {
  const f = fixture();
  assert.equal(f.pickerLoads, 0);
  assert.equal(f.drive.destination(), null);
  const selected = await f.drive.selectFolder();
  assert.deepEqual(selected, { id: 'folder-1', name: 'Backups' });
  assert.equal(f.pickerLoads, 1);
  assert.equal(f.pickerCalls.find(call => 'view' in call).view, 'FOLDERS');
  assert.ok(f.pickerCalls.some(call => call.selectFolderEnabled === true));
  assert.ok(f.pickerCalls.some(call => call.addedView === 'FOLDERS'));
  assert.ok(f.pickerCalls.some(call => call.appId === config.appId));
  assert.ok(f.pickerCalls.some(call => call.apiKey === config.apiKey));
  assert.ok(f.pickerCalls.some(call => call.token === 'memory-token'));
  assert.deepEqual(f.drive.destination(), selected);
  assert.deepEqual(JSON.parse(f.storage.get('dbdTrackerDriveFolder')), selected);
});

test('Picker cancellation leaves the saved folder preference unchanged', async () => {
  const previous = { id: 'old-folder', name: 'Old backups' };
  const f = fixture({ pickerAction: 'CANCEL', stored: previous });
  assert.equal(await f.drive.selectFolder(), null);
  assert.deepEqual(f.drive.destination(), previous);
  assert.equal(f.calls.length, 0);
});

test('first backup writes latest.json directly into the selected folder and repeat updates the same managed file', async () => {
  const f = fixture({ responses: [
    { body: { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
    { body: { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
    { body: { files: [] } }, { body: { id: 'latest-1' } }, { body: { id: 'latest-1' } },
    { body: { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
    { body: { files: [{ id: 'latest-1' }] } }, { body: { id: 'latest-1' } },
  ] });
  await f.drive.selectFolder();
  await f.drive.exportJson('{"schemaVersion":3}');
  await f.drive.exportJson('{"schemaVersion":3,"updated":true}');
  const create = f.calls.find(call => call.method === 'POST');
  assert.deepEqual(JSON.parse(create.body).parents, ['folder-1']);
  assert.equal(JSON.parse(create.body).name, 'latest.json');
  assert.ok(JSON.parse(create.body).appProperties.ledgerBackup);
  const listUrls = f.calls.filter(call => call.url.includes('/drive/v3/files?') && call.method !== 'POST');
  assert.equal(listUrls.length, 2);
  assert.ok(listUrls.every(call => new URL(call.url).searchParams.get('q').includes("'folder-1' in parents")));
  assert.ok(!listUrls.some(call => new URL(call.url).searchParams.get('q').includes('The Ledger Backups')));
  const uploads = f.calls.filter(call => call.url.includes('/upload/'));
  assert.equal(uploads.length, 2);
  assert.ok(uploads.every(call => call.url.includes('/latest-1?') && call.method === 'PATCH'));
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
});

test('backup refuses an unavailable saved folder instead of falling back to Drive root', async () => {
  const f = fixture({ stored: { id: 'gone', name: 'Removed folder' }, responses: [{ status: 404 }] });
  await assert.rejects(f.drive.exportJson('{}'), error => error.code === 'destination-unavailable');
  assert.equal(f.calls.length, 1);
  assert.ok(!f.calls.some(call => call.url.includes('/drive/v3/files?')));
  assert.equal(f.drive.destination().id, 'gone');
});

test('restore searches only in the remembered folder and returns bytes for the existing importer', async () => {
  const f = fixture({ stored: { id: 'folder-1', name: 'Backups' }, responses: [
    { body: { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
    { body: { files: [{ id: 'latest-1' }] } }, { body: '{"schemaVersion":3}' },
  ] });
  assert.equal(await f.drive.importJson(), '{"schemaVersion":3}');
  const query = new URL(f.calls[1].url).searchParams.get('q');
  assert.match(query, /appProperties/);
  assert.match(query, /'folder-1' in parents/);
  assert.ok(f.calls[2].url.endsWith('/latest-1?alt=media'));
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
});

test('duplicate Picker launches are rejected while one chooser is open', async () => {
  const f = fixture({ pickerAction: 'HOLD' });
  const first = f.drive.selectFolder();
  await new Promise(resolve => setTimeout(resolve, 0));
  await assert.rejects(f.drive.selectFolder(), /already open/i);
  f.pickerCallback({ action: 'CANCEL' });
  assert.equal(await first, null);
  assert.equal(f.pickerLoads, 1);
});

test('Picker load failure is safe and can be retried without changing the selected folder', async () => {
  const previous = { id: 'old-folder', name: 'Old backups' };
  const f = fixture({ stored: previous, pickerLoadFailure: true });
  await assert.rejects(f.drive.selectFolder(), /synthetic Picker load failure/);
  assert.deepEqual(f.drive.destination(), previous);
  assert.equal(f.pickerVisible, false);
  assert.equal(f.calls.length, 0);
  f.setPickerLoadFailure(false);
  assert.deepEqual(await f.drive.selectFolder(), { id: 'folder-1', name: 'Backups' });
  assert.equal(f.pickerLoads, 2);
});
