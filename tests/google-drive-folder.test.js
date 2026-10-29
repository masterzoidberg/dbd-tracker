import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleDrive, DRIVE_SCOPE, googleDriveConfig } from '../src/google-drive.js';

const config = {
  clientId: '123.apps.googleusercontent.com',
  apiKey: 'AIza' + 'a'.repeat(35),
  appId: '938560128029',
};

function fixture({ pickerAction = 'PICKED', folder = { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder' }, stored = null, recent = null, responses = [], pickerLoadFailure = false } = {}) {
  const calls = [], storage = new Map(), pickerCalls = [];
  if (stored) storage.set('dbdTrackerDriveFolder', JSON.stringify(stored));
  if (recent) storage.set('dbdTrackerDriveRecentFolders', JSON.stringify(recent));
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
    setMode(value) { pickerCalls.push({ mode: value }); return this; }
  }
  class PickerBuilder {
    setAppId(value) { pickerCalls.push({ appId: value }); return this; }
    setDeveloperKey(value) { pickerCalls.push({ apiKey: value }); return this; }
    setOAuthToken(value) { pickerCalls.push({ token: value }); return this; }
    setTitle(value) { pickerCalls.push({ title: value }); return this; }
    setMaxItems(value) { pickerCalls.push({ maxItems: value }); return this; }
    setSelectableMimeTypes(value) { pickerCalls.push({ selectableMimeTypes: value }); return this; }
    enableFeature(value) { pickerCalls.push({ feature: value }); return this; }
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
      return { ViewId: { FOLDERS: 'FOLDERS' }, DocsViewMode: { LIST: 'LIST' }, Feature: { NAV_HIDDEN: 'NAV_HIDDEN' }, DocsView, PickerBuilder, Action: { PICKED: 'PICKED', CANCEL: 'CANCEL' } };
    },
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      const fileId = decodeURIComponent(url.match(/\/drive\/v3\/files\/([^?]+)/)?.[1] || '');
      const folderBodies = {
        'folder-1': { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder', trashed: false },
        root: { id: 'drive-root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', trashed: false },
        'drive-root': { id: 'drive-root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', trashed: false },
      };
      const body = next?.body ?? folderBodies[fileId] ?? {};
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
  assert.ok(f.pickerCalls.some(call => call.mode === 'LIST'));
  assert.ok(f.pickerCalls.some(call => call.title === 'Choose backup folder'));
  assert.ok(f.pickerCalls.some(call => call.maxItems === 1));
  assert.ok(f.pickerCalls.some(call => call.selectableMimeTypes === 'application/vnd.google-apps.folder'));
  assert.ok(f.pickerCalls.some(call => call.feature === 'NAV_HIDDEN'));
  assert.deepEqual(f.drive.destination(), selected);
  assert.deepEqual(JSON.parse(f.storage.get('dbdTrackerDriveFolder')), selected);
});

test('My Drive root is a normal remembered destination and backs up without opening Picker', async () => {
  const f = fixture({ responses: [
    { body: { id: 'drive-root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
    { body: { id: 'drive-root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
    { body: { files: [] } }, { body: { id: 'latest-root' } }, { body: { id: 'latest-root' } },
  ] });
  assert.deepEqual(await f.drive.useMyDrive(), { id: 'drive-root', name: 'My Drive', isRoot: true });
  assert.deepEqual(f.drive.recentDestinations(), [{ id: 'drive-root', name: 'My Drive', isRoot: true }]);
  await f.drive.exportJson('{"schemaVersion":3}');
  assert.equal(f.pickerLoads, 0);
  const create = f.calls.find(call => call.method === 'POST');
  assert.deepEqual(JSON.parse(create.body).parents, ['drive-root']);
});

test('My Drive preference is tied to the validated root ID after account changes', async () => {
  const f = fixture({ responses: [
    { body: { id: 'old-account-root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
    { body: { id: 'new-account-root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
  ] });
  const selected = await f.drive.useMyDrive();
  assert.deepEqual(selected, { id: 'old-account-root', name: 'My Drive', isRoot: true });
  await assert.rejects(f.drive.exportJson('{}'), error => error.code === 'destination-unavailable');
  assert.deepEqual(f.drive.destination(), selected);
  assert.equal(f.calls.length, 2, 'a different account root is rejected before backup lookup or upload');
});

test('recent destinations are unique, limited to three, and validated before activation', async () => {
  const f = fixture({ recent: [
    { id: 'folder-1', name: 'Backups' },
    { id: 'folder-2', name: 'Games' },
    { id: 'folder-3', name: 'Archive' },
    { id: 'folder-4', name: 'Old' },
  ], stored: { id: 'active', name: 'Active' }, responses: [
    { body: { id: 'folder-2', name: 'Games renamed', mimeType: 'application/vnd.google-apps.folder', trashed: false } },
  ] });
  assert.deepEqual(await f.drive.useRecentDestination('folder-2'), { id: 'folder-2', name: 'Games renamed' });
  assert.deepEqual(f.drive.destination(), { id: 'folder-2', name: 'Games renamed' });
  assert.equal(f.drive.recentDestinations().length, 3);
  assert.equal(f.drive.recentDestinations()[0].id, 'folder-2');
  assert.equal(new Set(f.drive.recentDestinations().map(item => item.id)).size, 3);
  assert.equal(f.calls.length, 1, 'recent selection validates accessibility without creating a backup');
});

test('an inaccessible recent location is removed without replacing the active destination', async () => {
  const active = { id: 'folder-1', name: 'Active folder' };
  const f = fixture({ stored: active, recent: [{ id: 'gone', name: 'Old folder' }], responses: [{ status: 404 }] });
  await assert.rejects(f.drive.useRecentDestination('gone'), error => error.code === 'destination-unavailable');
  assert.deepEqual(f.drive.destination(), active);
  assert.deepEqual(f.drive.recentDestinations(), []);
  assert.equal(f.calls.length, 1);
});

test('Picker rejects any result that does not explicitly identify a folder', async () => {
  for (const folder of [
    { id: 'file-1', name: 'not-a-folder', mimeType: 'application/json' },
    { id: 'unknown-type', name: 'missing-mime-type' },
  ]) {
    const f = fixture({ folder });
    await assert.rejects(f.drive.selectFolder(), /did not return a folder/i);
    assert.equal(f.drive.destination(), null);
    assert.deepEqual(f.drive.recentDestinations(), []);
    assert.equal(f.calls.length, 0);
  }
});

test('backup and restore without a destination fail without launching Picker', async () => {
  const f = fixture();
  await assert.rejects(f.drive.exportJson('{}'), error => error.code === 'destination-missing');
  await assert.rejects(f.drive.importJson(), error => error.code === 'destination-missing');
  assert.equal(f.pickerLoads, 0);
  assert.equal(f.calls.length, 0);
});

test('Picker cancellation leaves the saved folder preference unchanged', async () => {
  const previous = { id: 'old-folder', name: 'Old backups' };
  const previousRecent = [previous, { id: 'older-folder', name: 'Older backups' }];
  const f = fixture({ pickerAction: 'CANCEL', stored: previous, recent: previousRecent });
  assert.equal(await f.drive.selectFolder(), null);
  assert.deepEqual(f.drive.destination(), previous);
  assert.deepEqual(f.drive.recentDestinations(), previousRecent);
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
