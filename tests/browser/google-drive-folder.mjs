import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';
import { freshSave } from '../../src/model.js';
import { googleDriveRegression } from './google-drive.mjs';

const clientId = '123.apps.googleusercontent.com';
const apiKey = 'AIza' + 'a'.repeat(35);
const appId = '938560128029';

export async function googleDriveFolderRegression(browser, origin) {
  const compiled = await build({ absWorkingDir: fileURLToPath(new URL('../../', import.meta.url)), entryPoints: ['src/app.js'], bundle: true, write: false, format: 'iife', target: 'es2022',
    define: { __LEDGER_GOOGLE_CONFIG__: JSON.stringify({ clientId, apiKey, appId }) } });
  const context = await browser.newContext();
  const errors = [], requests = [], files = new Map(), uploads = [];
  const initial = freshSave();
  await context.addInitScript(save => { localStorage.setItem('dbdTrackerData', JSON.stringify(save)); }, initial);
  await context.addInitScript(() => {
    window.driveTest = { pickerAction: 'HOLD', selected: { id: 'folder-one', name: 'First folder', mimeType: 'application/vnd.google-apps.folder' }, pickerOpens: 0, uploads: 0, incoming: '', missing: false, unavailable: [], failGetStatus: 0, pickerConfig: {}, copiedDiagnostic: '' };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.driveTest.copiedDiagnostic = value; } } });
    const oauth = {
      initTokenClient(options) { return { requestAccessToken() { options.callback({ access_token: 'memory-only-token', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.file' }); } }; },
      hasGrantedAllScopes: () => true, revoke: (_token, callback) => callback({}),
    };
    const picker = {
      ViewId: { FOLDERS: 'FOLDERS' }, DocsViewMode: { LIST: 'LIST' }, Feature: { NAV_HIDDEN: 'NAV_HIDDEN' }, Action: { PICKED: 'PICKED', CANCEL: 'CANCEL' },
      DocsView: class { constructor(id) { this.id = id; window.driveTest.pickerConfig.view = id; } setSelectFolderEnabled(value) { this.selectFolderEnabled = value; window.driveTest.pickerConfig.selectFolderEnabled = value; return this; } setIncludeFolders(value) { window.driveTest.pickerConfig.includeFolders = value; return this; } setMimeTypes(value) { this.mimeTypes = value; window.driveTest.pickerConfig.mimeTypes = value; return this; } setMode(value) { window.driveTest.pickerConfig.mode = value; return this; } },
    };
    // The fake Picker calls back after visibility changes while preserving the SDK boundary.
    picker.PickerBuilder = class {
      setAppId(value) { this.appId = value; window.driveTest.pickerConfig.appId = value; return this; }
      setDeveloperKey(value) { this.apiKey = value; window.driveTest.pickerConfig.hasApiKey = !!value; return this; }
      setOAuthToken(value) { this.token = value; window.driveTest.pickerConfig.hasOAuthToken = !!value; return this; }
      setTitle(value) { window.driveTest.pickerConfig.title = value; return this; }
      setMaxItems(value) { window.driveTest.pickerConfig.maxItems = value; return this; }
      setSelectableMimeTypes(value) { window.driveTest.pickerConfig.selectableMimeTypes = value; return this; }
      enableFeature(value) { window.driveTest.pickerConfig.feature = value; return this; }
      addView(value) { this.view = value; return this; }
      setCallback(callback) { this.callback = callback; return this; }
      build() { const builder = this; return { setVisible(value) {
        if (!value) return;
        window.driveTest.pickerOpens++;
        const finish = action => builder.callback(action === 'PICKED'
          ? { action: 'PICKED', docs: [window.driveTest.selected] }
          : { action });
        if (window.driveTest.pickerAction === 'HOLD') window.driveTest.finishPicker = finish;
        else queueMicrotask(() => finish(window.driveTest.pickerAction));
      } }; }
    };
    window.google = { accounts: { oauth2: oauth }, picker };
    window.gapi = { load: (name, options) => { if (name === 'picker') options.callback(); } };
  }, initial);
  await context.route('**/*', async route => {
    const url = route.request().url(); requests.push(url);
    if (url === origin + '/dist/app.js') return route.fulfill({ contentType: 'text/javascript', body: compiled.outputFiles[0].text });
    if (url.startsWith(origin + '/')) return route.continue();
    if (url === 'https://accounts.google.com/gsi/client' || url === 'https://apis.google.com/js/api.js') return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (url.startsWith('https://www.googleapis.com/')) {
      const page = route.request().frame().page(), state = await page.evaluate(() => window.driveTest);
      const path = new URL(url).pathname;
      const folderMatch = path.match(/\/drive\/v3\/files\/(folder-one|folder-two|root|drive-root)/);
      if (folderMatch) {
        const id = folderMatch[1], responseId = id === 'root' ? 'drive-root' : id, name = id === 'folder-one' ? 'First folder' : id === 'folder-two' ? 'Second folder' : 'My Drive';
        if (state.failGetStatus && id === 'folder-one') return route.fulfill({ status: state.failGetStatus, body: 'synthetic private response body' });
        if (state.unavailable.includes(id)) return route.fulfill({ status: 404, body: 'synthetic missing folder' });
        return route.fulfill({ json: { id: responseId, name, mimeType: 'application/vnd.google-apps.folder', trashed: false } });
      }
      if (url.includes('alt=media')) return route.fulfill({ body: state.incoming });
      if (url.includes('/upload/')) {
        const fileId = path.split('/').at(-1);
        uploads.push({ fileId, bytes: route.request().postData() });
        await page.evaluate(() => { window.driveTest.uploads++; });
        return route.fulfill({ json: { id: fileId } });
      }
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        assert.equal(body.name, 'latest.json');
        assert.deepEqual(body.parents, [body.parents[0]]);
        const fileId = 'latest-' + body.parents[0]; files.set(body.parents[0], fileId);
        return route.fulfill({ json: { id: fileId } });
      }
      const query = new URL(url).searchParams.get('q') || '';
      const parent = query.match(/'([^']+)' in parents/)?.[1];
      if (state.missing || !parent || !files.has(parent)) return route.fulfill({ json: { files: [] } });
      return route.fulfill({ json: { files: [{ id: files.get(parent) }] } });
    }
    throw Error('Unexpected external request: ' + url);
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin + '/#dashboard');
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    assert.equal(requests.some(url => /google|apis\.google/.test(url)), false, 'dashboard does not load Google SDKs');
    await page.goto(origin + '/#data');
    await page.getByRole('heading', { name: 'Data & backups', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Connect Google Drive', exact: true }).waitFor();
    assert.equal(await page.locator('[data-google-drive]').getByText(/latest\.json|The Ledger Backups/).count(), 0, 'disconnected panel does not show internal file paths');
    assert.equal(requests.includes('https://apis.google.com/js/api.js'), false, 'visiting Data does not load Picker');
    await page.getByRole('button', { name: 'Connect Google Drive', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Connected' }).waitFor();

    const restore = () => page.getByRole('button', { name: 'Restore from Drive', exact: true });
    const localBeforeChoose = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
    assert.equal(await page.getByRole('button', { name: 'Backup now', exact: true }).count(), 0, 'no active Backup now before a destination is chosen');
    assert.equal(await restore().isDisabled(), true, 'restore cannot unexpectedly open Picker without a destination');
    assert.equal(await page.getByRole('button', { name: 'Use My Drive', exact: true }).isEnabled(), true, 'root can be selected without Picker');
    assert.match(await page.locator('[data-google-drive]').textContent(), /Choose where The Ledger should keep its backup/);
    assert.equal(requests.includes('https://apis.google.com/js/api.js'), false, 'connected Data page still does not load Picker');
    await page.getByRole('button', { name: 'Choose backup folder', exact: true }).click();
    await page.waitForFunction(() => window.driveTest.pickerOpens === 1);
    await page.getByText('Choosing backup folder…', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-google-drive]').getAttribute('aria-busy'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Choose backup folder', exact: true }).isDisabled(), true, 'busy state blocks duplicate Picker launches');
    assert.equal(await restore().isDisabled(), true, 'restore stays disabled while Picker is open');
    await page.evaluate(() => window.driveTest.finishPicker('CANCEL'));
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerDriveFolder')), null, 'cancelled destination choice leaves no active folder');
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerDriveRecentFolders')), null, 'cancelled destination choice leaves recent locations unchanged');
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), localBeforeChoose);
    assert.equal(await page.locator('#confirmation').isVisible(), false);
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'drive-choose-folder', null, { timeout: 1000 });

    const backup = () => page.getByRole('button', { name: 'Backup now', exact: true });
    await page.evaluate(() => { window.driveTest.pickerAction = 'PICKED'; window.driveTest.selected = { id: 'file-one', name: 'Not a folder', mimeType: 'application/json' }; });
    await page.getByRole('button', { name: 'Choose backup folder', exact: true }).click();
    await page.evaluate(() => window.driveTest.finishPicker('PICKED'));
    await page.waitForFunction(() => document.querySelector('#message').textContent.includes('did not return a folder'));
    const invalidSelectionError = page.locator('[data-google-drive] [role="alert"]');
    await invalidSelectionError.getByText('Google Picker did not return a usable folder.', { exact: false }).waitFor();
    await page.locator('[data-drive-diagnostics]').waitFor();
    const invalidTraceText = await page.locator('[data-drive-diagnostics] pre').textContent();
    assert.match(invalidTraceText, /"callbackAction": "PICKED"/);
    assert.match(invalidTraceText, /"selectedMimeType": "application\/json"/);
    assert.doesNotMatch(invalidTraceText, /file-one|Not a folder|memory-only-token|Authorization|synthetic private response body|AIza/);
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'drive-choose-folder', null, { timeout: 1000 });
    await page.getByRole('button', { name: 'Copy diagnostic', exact: true }).click();
    const copiedTrace = await page.evaluate(() => window.driveTest.copiedDiagnostic);
    assert.deepEqual(JSON.parse(copiedTrace), JSON.parse(invalidTraceText));
    assert.doesNotMatch(copiedTrace, /file-one|Not a folder|memory-only-token|Authorization|synthetic private response body|AIza/);
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerDriveFolder')), null, 'file result is not stored as a destination');
    assert.equal(uploads.length, 0, 'Picker cancellation does not back up');
    await page.evaluate(() => { window.driveTest.selected = { id: 'folder-one', name: 'First folder', mimeType: 'application/vnd.google-apps.folder' }; window.driveTest.failGetStatus = 403; });
    await page.getByRole('button', { name: 'Choose backup folder', exact: true }).click();
    await page.evaluate(() => window.driveTest.finishPicker('PICKED'));
    await page.locator('[data-google-drive] [role="alert"]').getByText('The Ledger could not verify access to this folder.', { exact: false }).waitFor();
    const deniedTraceText = await page.locator('[data-drive-diagnostics] pre').textContent();
    assert.match(deniedTraceText, /"filesGetAttempted": true/);
    assert.match(deniedTraceText, /"filesGetStatus": 403/);
    assert.doesNotMatch(deniedTraceText, /folder-one|First folder|memory-only-token|Authorization|synthetic private response body|AIza/);

    await page.evaluate(() => { window.driveTest.failGetStatus = 0; });
    await page.evaluate(() => { window.driveTest.selected = { id: 'folder-one', name: 'First folder', mimeType: 'application/vnd.google-apps.folder' }; });
    await page.getByRole('button', { name: 'Choose backup folder', exact: true }).click();
    await page.evaluate(() => window.driveTest.finishPicker('PICKED'));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder') || 'null')?.id === 'folder-one');
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'drive-export', null, { timeout: 1000 });
    assert.equal(await page.locator('[data-drive-diagnostics]').count(), 0, 'diagnostic details stay hidden after successful selection');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder'))), { id: 'folder-one', name: 'First folder' });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerDriveRecentFolders'))), [{ id: 'folder-one', name: 'First folder' }]);
    assert.equal(uploads.length, 0, 'choosing a folder never starts a backup');
    assert.deepEqual(await page.evaluate(() => window.driveTest.pickerConfig), {
      view: 'FOLDERS', selectFolderEnabled: true, includeFolders: true, mimeTypes: 'application/vnd.google-apps.folder',
      mode: 'LIST', title: 'Choose backup folder', maxItems: 1, selectableMimeTypes: 'application/vnd.google-apps.folder', feature: 'NAV_HIDDEN',
      appId, hasApiKey: true, hasOAuthToken: true,
    });
    await backup().click();
    await page.getByText('Backed up to Google Drive', { exact: false }).waitFor();
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].fileId, 'latest-folder-one');
    assert.equal(requests.filter(url => url === 'https://apis.google.com/js/api.js').length, 1, 'Picker bootstrap loads only after explicit selection');
    assert.equal(await page.locator('[data-google-drive] .primary').getAttribute('data-action'), 'drive-export');
    assert.equal(await page.locator('[data-google-drive] [data-action="drive-import"]').getAttribute('class'), null, 'Restore is a secondary action');

    const pickerCount = await page.evaluate(() => window.driveTest.pickerOpens);
    await backup().click();
    await page.waitForFunction(() => window.driveTest.uploads === 2);
    assert.equal(await page.evaluate(() => window.driveTest.pickerOpens), pickerCount, 'repeat backup reuses the chosen folder');
    assert.equal(uploads.length, 2);
    assert.equal(uploads[1].fileId, uploads[0].fileId, 'repeat backup updates the same latest file');

    await page.evaluate(() => { window.driveTest.pickerAction = 'CANCEL'; });
    await page.getByRole('button', { name: 'Change folder', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder'))), { id: 'folder-one', name: 'First folder' });
    assert.equal(uploads.length, 2, 'cancelling Change folder leaves the old Drive backup untouched');

    const localBeforeUnavailable = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
    await page.evaluate(() => { window.driveTest.unavailable = ['folder-one']; });
    await backup().click();
    await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Google Drive backup failed'));
    assert.equal(uploads.length, 2, 'an unavailable destination is never silently replaced by Drive root');
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), localBeforeUnavailable);
    assert.match(await page.locator('[data-google-drive]').textContent(), /Your saved Google Drive backup location is no longer available/);
    assert.equal(await page.getByRole('button', { name: 'Choose another folder', exact: true }).isEnabled(), true);
    await page.evaluate(() => { window.driveTest.unavailable = []; window.driveTest.pickerAction = 'CANCEL'; });
    await page.getByRole('button', { name: 'Choose another folder', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder'))), { id: 'folder-one', name: 'First folder' });

    await page.evaluate(() => { window.driveTest.selected = { id: 'folder-two', name: 'Second folder', mimeType: 'application/vnd.google-apps.folder' }; window.driveTest.pickerAction = 'PICKED'; });
    await page.getByRole('button', { name: 'Choose another folder', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder') || 'null')?.id === 'folder-two');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder'))), { id: 'folder-two', name: 'Second folder' });
    assert.equal(uploads.length, 2, 'changing folder leaves the old Drive file untouched');
    await backup().click();
    await page.waitForFunction(() => window.driveTest.uploads === 3);
    assert.equal(uploads.length, 3);
    assert.equal(uploads[2].fileId, 'latest-folder-two', 'next backup uses the new destination');

    const savedBeforeRestore = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
    const incoming = freshSave(); incoming.characters['meg-thomas'].bloodwebLevel = 31;
    await page.evaluate(bytes => { window.driveTest.incoming = bytes; }, JSON.stringify(incoming));
    await restore().click();
    await page.locator('#confirm-text').waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), savedBeforeRestore, 'cancelled restore does not replace local progress');
    assert.ok(requests.some(url => new URL(url).searchParams.get('q')?.includes("'folder-two' in parents")), 'restore searches only the current selected destination');

    await page.getByRole('button', { name: 'Use First folder', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder') || 'null')?.id === 'folder-one');
    assert.equal(uploads.length, 3, 'using a recent location does not start a backup');
    await page.getByRole('button', { name: 'Use My Drive', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder') || 'null')?.id === 'drive-root');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder'))), { id: 'drive-root', name: 'My Drive', isRoot: true });
    assert.equal(await page.locator('[data-google-drive]').getByText('My Drive', { exact: true }).count(), 1);
    assert.equal(uploads.length, 3, 'choosing My Drive does not start a backup');
    const pickerCountBeforeRootBackup = await page.evaluate(() => window.driveTest.pickerOpens);
    await backup().click();
    await page.waitForFunction(() => window.driveTest.uploads === 4);
    assert.equal(await page.evaluate(() => window.driveTest.pickerOpens), pickerCountBeforeRootBackup, 'root backup skips Picker');
    assert.equal(uploads[3].fileId, 'latest-drive-root');

    const pickerRequestsBeforeReload = requests.filter(url => url === 'https://apis.google.com/js/api.js').length;
    await page.reload();
    await page.getByRole('button', { name: 'Connect Google Drive', exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerDriveFolder'))), { id: 'drive-root', name: 'My Drive', isRoot: true });
    await page.getByRole('button', { name: 'Connect Google Drive', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Connected' }).waitFor();
    const pickerCountAfterReload = await page.evaluate(() => window.driveTest.pickerOpens);
    await backup().click();
    await page.waitForFunction(() => window.driveTest.uploads === 1);
    assert.equal(uploads.length, 5, 'the remembered root remains active after reload');
    assert.equal(uploads[4].fileId, 'latest-drive-root');
    assert.equal(await page.evaluate(() => window.driveTest.pickerOpens), pickerCountAfterReload, 'reload does not make Backup now reopen Picker');
    assert.equal(requests.filter(url => url === 'https://apis.google.com/js/api.js').length, pickerRequestsBeforeReload, 'reload and backup do not reload Picker');

    const destinationBeforeDisconnect = await page.evaluate(() => localStorage.getItem('dbdTrackerDriveFolder'));
    const recentsBeforeDisconnect = await page.evaluate(() => localStorage.getItem('dbdTrackerDriveRecentFolders'));
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await page.getByRole('button', { name: 'Connect Google Drive', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerDriveFolder')), destinationBeforeDisconnect, 'disconnect preserves the local destination preference');
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerDriveRecentFolders')), recentsBeforeDisconnect, 'disconnect preserves browser-local recent destinations');
    assert.equal(await page.locator('#main').getByRole('button', { name: /Export JSON/ }).isEnabled(), true);
    assert.equal(await page.locator('#main').getByRole('button', { name: /Import JSON/ }).isEnabled(), true);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 850 }); await page.waitForTimeout(20);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Data & backups must not overflow at ${width}px`);
    }
    assert.ok(!JSON.stringify(await page.evaluate(() => Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))).includes('memory-only-token'));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '../..');
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const inside = relative(root, path);
      if (inside.startsWith('..' + sep) || inside === '..' || isAbsolute(inside)) { response.writeHead(403).end(); return; }
      const body = await readFile(path);
      response.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' }[extname(path)] || 'application/octet-stream' }); response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  let browser;
  try {
    browser = await chromium.launch({ channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge', headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await googleDriveRegression(browser, origin);
    await googleDriveFolderRegression(browser, origin);
    console.log('Google Drive import/export and folder Picker/browser regressions PASS');
  } finally {
    try { await browser?.close(); } finally { await new Promise(accept => server.close(accept)); }
  }
}
