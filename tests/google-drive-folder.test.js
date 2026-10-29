import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleDrive, DRIVE_SCOPE, googleDriveConfig } from '../src/google-drive.js';

const config = {
  clientId: '123.apps.googleusercontent.com',
  apiKey: 'AIza' + 'a'.repeat(35),
  appId: '938560128029',
};

function fixture({ pickerAction = 'PICKED', pickerPayload = null, folder = { id: 'folder-1', name: 'Backups', mimeType: 'application/vnd.google-apps.folder' }, stored = null, recent = null, responses = [], pickerLoadFailure = false, pickerTimeoutMs = 120000, failWriteKey = '' } = {}) {
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
      if (value && pickerAction !== 'HOLD') queueMicrotask(() => pickerCallback(pickerPayload || (pickerAction === 'PICKED'
        ? { action: 'PICKED', docs: [folder] }
        : { action: pickerAction })));
    } }; }
  }
  const drive = createGoogleDrive(config, {
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { if (key === failWriteKey) throw Error('synthetic storage failure'); storage.set(key, value); } },
    pickerTimeoutMs,
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
        [folder?.id || 'folder-1']: { id: folder?.id || 'folder-1', name: folder?.name || 'Backups', mimeType: folder?.mimeType || 'application/vnd.google-apps.folder', trashed: false },
        root: { id: 'drive-root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', trashed: false },
        'drive-root': { id: 'drive-root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', trashed: false },
      };
      const body = next?.body ?? (fileId ? folderBodies[fileId] ?? {} : {});
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

test('a Picker callback timeout is recorded when the chooser closes without a callback', async () => {
  const f = fixture({ pickerAction: 'HOLD', pickerTimeoutMs: 5 });
  const selection = f.drive.selectFolder();
  await assert.rejects(Promise.race([selection, new Promise((_, reject) => setTimeout(() => reject(Error('test harness timeout')), 20))]), error => error.code === 'picker-timeout');
  assert.deepEqual(f.drive.selectionDiagnostics(), {
    pickerOpened: true, callbackFired: false, callbackAction: 'not-received', documentCount: null,
    selectedIdPresent: null, selectedNamePresent: null, selectedMimeType: null, folderMimeAccepted: null,
    filesGetAttempted: false, filesGetStatus: null, responseIdPresent: null, responseMimeType: null,
    responseTrashed: null, folderResponseAccepted: null, destinationWriteSucceeded: null,
    recentLocationsWriteSucceeded: null, destinationRecognized: false,
    finalPanelDestination: 'not-selected', outcomeCategory: 'picker-timeout',
  });
});

test('unexpected Picker actions are reported without saving a destination', async () => {
  const f = fixture({ pickerAction: 'ERROR' });
  await assert.rejects(f.drive.selectFolder(), error => error.code === 'picker-action-unexpected');
  const trace = f.drive.selectionDiagnostics();
  assert.equal(trace.callbackFired, true);
  assert.equal(trace.callbackAction, 'ERROR');
  assert.equal(trace.outcomeCategory, 'picker-action-unexpected');
  assert.equal(trace.filesGetAttempted, false);
});

test('a PICKED callback with no documents is reported as unusable', async () => {
  const f = fixture({ pickerPayload: { action: 'PICKED', docs: [] } });
  await assert.rejects(f.drive.selectFolder(), error => error.code === 'picker-folder-invalid');
  const trace = f.drive.selectionDiagnostics();
  assert.equal(trace.documentCount, 0);
  assert.equal(trace.selectedIdPresent, false);
  assert.equal(trace.selectedNamePresent, false);
  assert.equal(trace.selectedMimeType, null);
  assert.equal(trace.outcomeCategory, 'picker-folder-invalid');
});

test('a picked document without an ID is rejected and diagnosed', async () => {
  const f = fixture({ folder: { name: 'Private folder', mimeType: 'application/vnd.google-apps.folder' } });
  await assert.rejects(f.drive.selectFolder(), error => error.code === 'picker-folder-invalid');
  assert.equal(f.drive.selectionDiagnostics().selectedIdPresent, false);
  assert.equal(f.calls.length, 0);
});

test('a picked document without a name remains selectable using the existing fallback', async () => {
  const f = fixture({ folder: { id: 'folder-1', mimeType: 'application/vnd.google-apps.folder' } });
  assert.deepEqual(await f.drive.selectFolder(), { id: 'folder-1', name: 'Backups' });
  assert.equal(f.drive.selectionDiagnostics().selectedNamePresent, false);
  assert.equal(f.drive.selectionDiagnostics().outcomeCategory, 'success');
});

test('missing or incorrect Picker MIME types are rejected before Drive verification', async () => {
  for (const folder of [
    { id: 'folder-1', name: 'Private folder' },
    { id: 'folder-1', name: 'Private folder', mimeType: 'application/json' },
  ]) {
    const f = fixture({ folder });
    await assert.rejects(f.drive.selectFolder(), error => error.code === 'picker-folder-invalid');
    assert.equal(f.drive.selectionDiagnostics().folderMimeAccepted, false);
    assert.equal(f.drive.selectionDiagnostics().filesGetAttempted, false);
  }
});

test('post-Picker files.get failures record their HTTP status', async () => {
  for (const status of [403, 404, 500]) {
    const f = fixture({ responses: [{ status }] });
    await assert.rejects(f.drive.selectFolder());
    const trace = f.drive.selectionDiagnostics();
    assert.equal(trace.callbackAction, 'PICKED');
    assert.equal(trace.folderMimeAccepted, true);
    assert.equal(trace.filesGetAttempted, true);
    assert.equal(trace.filesGetStatus, status);
    assert.equal(trace.destinationWriteSucceeded, null);
    assert.equal(trace.outcomeCategory, status === 403 || status === 404 ? 'folder-verification-failed' : 'google-drive-request-failed');
  }
});

test('malformed files.get JSON is reported as a failed Drive response', async () => {
  const f = fixture({ responses: [{ body: '{not-json' }] });
  await assert.rejects(f.drive.selectFolder());
  const trace = f.drive.selectionDiagnostics();
  assert.equal(trace.filesGetStatus, 200);
  assert.equal(trace.responseIdPresent, false);
  assert.equal(trace.folderResponseAccepted, false);
  assert.equal(trace.outcomeCategory, 'google-drive-request-failed');
});

test('files.get responses that are not live folders are recorded as rejected', async () => {
  for (const body of [
    { id: 'folder-1', name: 'Private folder', mimeType: 'application/json', trashed: false },
    { id: 'folder-1', name: 'Private folder', mimeType: 'application/vnd.google-apps.folder', trashed: true },
  ]) {
    const f = fixture({ responses: [{ body }] });
    await assert.rejects(f.drive.selectFolder(), error => error.code === 'destination-unavailable');
    const trace = f.drive.selectionDiagnostics();
    assert.equal(trace.responseIdPresent, true);
    assert.equal(trace.responseMimeType, body.mimeType);
    assert.equal(trace.responseTrashed, body.trashed);
    assert.equal(trace.folderResponseAccepted, false);
  }
});

test('destination and recent-location storage failures are diagnosed independently', async () => {
  const activeWriteFailure = fixture({ stored: { id: 'existing-folder', name: 'Existing folder' }, failWriteKey: 'dbdTrackerDriveFolder' });
  await assert.rejects(activeWriteFailure.drive.selectFolder(), error => error.code === 'destination-storage-failed');
  let trace = activeWriteFailure.drive.selectionDiagnostics();
  assert.equal(trace.destinationWriteSucceeded, false);
  assert.equal(trace.recentLocationsWriteSucceeded, null);
  assert.equal(trace.destinationRecognized, false);
  assert.equal(trace.finalPanelDestination, 'selected');
  assert.deepEqual(activeWriteFailure.drive.destination(), { id: 'existing-folder', name: 'Existing folder' });

  const recentWriteFailure = fixture({ failWriteKey: 'dbdTrackerDriveRecentFolders' });
  await assert.rejects(recentWriteFailure.drive.selectFolder(), error => error.code === 'recent-storage-failed');
  trace = recentWriteFailure.drive.selectionDiagnostics();
  assert.equal(trace.destinationWriteSucceeded, true);
  assert.equal(trace.recentLocationsWriteSucceeded, false);
  assert.equal(trace.destinationRecognized, true);
  assert.equal(trace.finalPanelDestination, 'selected');
  assert.deepEqual(recentWriteFailure.drive.destination(), { id: 'folder-1', name: 'Backups' });
});

test('successful selection records recognized persistence using an allowlisted sanitized trace', async () => {
  const f = fixture({ folder: { id: 'private-folder-id', name: 'Private folder name', mimeType: 'application/vnd.google-apps.folder' } });
  assert.deepEqual(await f.drive.selectFolder(), { id: 'private-folder-id', name: 'Private folder name' });
  const trace = f.drive.selectionDiagnostics();
  assert.equal(trace.pickerOpened, true);
  assert.equal(trace.callbackFired, true);
  assert.equal(trace.documentCount, 1);
  assert.equal(trace.selectedIdPresent, true);
  assert.equal(trace.selectedNamePresent, true);
  assert.equal(trace.selectedMimeType, 'application/vnd.google-apps.folder');
  assert.equal(trace.folderMimeAccepted, true);
  assert.equal(trace.filesGetAttempted, true);
  assert.equal(trace.filesGetStatus, 200);
  assert.equal(trace.responseIdPresent, true);
  assert.equal(trace.responseMimeType, 'application/vnd.google-apps.folder');
  assert.equal(trace.responseTrashed, false);
  assert.equal(trace.folderResponseAccepted, true);
  assert.equal(trace.destinationWriteSucceeded, true);
  assert.equal(trace.recentLocationsWriteSucceeded, true);
  assert.equal(trace.destinationRecognized, true);
  assert.equal(trace.finalPanelDestination, 'selected');
  assert.equal(trace.outcomeCategory, 'success');
  assert.deepEqual(Object.keys(trace), [
    'pickerOpened', 'callbackFired', 'callbackAction', 'documentCount', 'selectedIdPresent', 'selectedNamePresent',
    'selectedMimeType', 'folderMimeAccepted', 'filesGetAttempted', 'filesGetStatus', 'responseIdPresent',
    'responseMimeType', 'responseTrashed', 'folderResponseAccepted', 'destinationWriteSucceeded',
    'recentLocationsWriteSucceeded', 'destinationRecognized', 'finalPanelDestination', 'outcomeCategory',
  ]);
  const encoded = JSON.stringify(trace);
  for (const forbidden of ['private-folder-id', 'Private folder name', 'memory-token', config.apiKey, 'Authorization']) assert.ok(!encoded.includes(forbidden));
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
