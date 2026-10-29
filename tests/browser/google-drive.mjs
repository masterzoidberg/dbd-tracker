import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { freshSave, parseSave } from '../../src/model.js';

// Exercises the real provider and UI; only Google's external SDK/REST boundary is stubbed.
export async function googleDriveRegression(browser, origin) {
  const compiled = await build({ absWorkingDir: fileURLToPath(new URL('../../', import.meta.url)), entryPoints: ['src/app.js'], bundle: true, write: false, format: 'iife', target: 'es2022',
    define: { __LEDGER_GOOGLE_CONFIG__: JSON.stringify({ clientId: '123.apps.googleusercontent.com' }) } });
  const context = await browser.newContext();
  const errors = [], requests = [];
  const initial = freshSave();
  initial.characters['meg-thomas'].owned = true;
  initial.planning.prestigeQueues.survivor = [{ characterId: 'meg-thomas', targetPrestige: 3 }];
  await context.addInitScript(save => { if (!localStorage.getItem('dbdTrackerData')) localStorage.setItem('dbdTrackerData', JSON.stringify(save)); }, initial);
  await context.addInitScript(() => {
    window.driveTest = { uploaded: null, fail: false, missing: false, downloadFail: false, incoming: '', denied: false };
    const oauth = {
      initTokenClient(options) { return { requestAccessToken() { options.callback(window.driveTest.denied ? { error: 'denied' } : { access_token: 'synthetic-token', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.file' }); } }; },
      hasGrantedAllScopes: () => true, revoke: (token, cb) => cb({}),
    };
    window.google = { accounts: { oauth2: oauth } };
  });
  await context.route('**/*', async route => {
    const url = route.request().url(); requests.push(url);
    if (url === origin + '/dist/app.js') return route.fulfill({ contentType: 'text/javascript', body: compiled.outputFiles[0].text });
    if (url.startsWith(origin + '/')) return route.continue();
    if (url === 'https://accounts.google.com/gsi/client') return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (url.startsWith('https://www.googleapis.com/')) {
      const page = route.request().frame().page(), state = await page.evaluate(() => window.driveTest);
      if (url.includes('alt=media')) return route.fulfill(state.downloadFail ? { status: 500, body: 'synthetic download failure' } : { body: state.incoming });
      if (url.includes('/upload/')) {
        if (state.fail) return route.fulfill({ status: 500, body: '<img onerror=alert(1)>synthetic-token' });
        await page.evaluate(bytes => { window.driveTest.uploaded = bytes; }, route.request().postData());
        return route.fulfill({ json: { id: 'latest' } });
      }
      return route.fulfill({ json: { files: state.missing ? [] : [{ id: url.includes('folder') ? 'folder' : 'latest' }] } });
    }
    throw Error('Unexpected external request: ' + url);
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin + '/#dashboard'); await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    assert.equal(requests.filter(url => url.includes('google')).length, 0, 'Google stays lazy on other routes');
    await page.goto(origin + '/#data');
    await page.getByText('Google Drive not connected', { exact: true }).waitFor();
    await page.evaluate(() => { window.driveTest.denied = true; });
    await page.getByRole('button', { name: 'Connect Google Drive', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-action="drive-connect"]').disabled);
    assert.equal(await page.getByRole('button', { name: 'Import from Google Drive', exact: true }).count(), 0);
    await page.evaluate(() => { window.driveTest.denied = false; });
    await page.getByRole('button', { name: 'Connect Google Drive', exact: true }).click();
    await page.getByText('Connected for this browser session', { exact: true }).waitFor();
    const before = await page.evaluate(() => localStorage.dbdTrackerData);
    await page.getByRole('button', { name: 'Export to Google Drive', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Backed up to Google Drive'));
    const uploaded = await page.evaluate(() => JSON.parse(window.driveTest.uploaded));
    const localDownload = page.waitForEvent('download'); await page.locator('#main [data-action="export"]').click();
    const localExport = JSON.parse(await readFile(await (await localDownload).path(), 'utf8'));
    const comparable = value => { const copy = structuredClone(value); delete copy.exportedAt; return copy; };
    assert.deepEqual(comparable(uploaded), comparable(localExport), 'Drive and local export share the complete canonical payload');
    assert.equal(uploaded.schemaVersion, 3); assert.deepEqual(uploaded.planning, JSON.parse(before).planning);
    assert.ok(!JSON.stringify(uploaded).includes('synthetic-token'));
    assert.equal(await page.evaluate(() => localStorage.dbdTrackerData), before);
    await page.evaluate(() => { window.driveTest.fail = true; });
    await page.getByRole('button', { name: 'Export to Google Drive', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Google Drive backup failed'));
    assert.equal(await page.evaluate(() => localStorage.dbdTrackerData), before);
    assert.equal(await page.locator('#message img').count(), 0);
    const incoming = freshSave(); incoming.characters['meg-thomas'].bloodwebLevel = 37;
    incoming.characters['meg-thomas'].perks['future-perk'] = 2;
    incoming.characters['meg-thomas'].effectivePerks = { kindred: 3 };
    incoming.characters['meg-thomas'].perkInventorySummary = { arbitrary: true };
    await page.evaluate(() => localStorage.setItem('dbdTrackerContinue', JSON.stringify({ version: 1, characterId: 'meg-thomas', role: 'survivor', section: 'perks', visitedAt: new Date().toISOString() })));
    const continueBefore = await page.evaluate(() => localStorage.dbdTrackerContinue);
    await page.evaluate(bytes => { window.driveTest.incoming = bytes; window.driveTest.missing = true; }, JSON.stringify(incoming));
    const importButton = () => page.getByRole('button', { name: 'Import from Google Drive', exact: true });
    await importButton().click(); await page.waitForFunction(() => !document.querySelector('[data-action="drive-import"]').disabled);
    assert.equal(await page.locator('#confirmation').isVisible(), false);
    await page.evaluate(() => { window.driveTest.missing = false; });
    await importButton().click(); await page.locator('#confirm-text').waitFor();
    await page.locator('#import-file').setInputFiles({ name: 'overlapping.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(freshSave())) });
    await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Finish the current import'));
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.dbdTrackerData), before);
    assert.equal(await page.evaluate(() => localStorage.dbdTrackerContinue), continueBefore);
    // Failed backup and failed current write both block replacement and preserve Continue.
    for (const blocked of ['dbdTrackerBackups', 'dbdTrackerData']) {
      await page.evaluate(key => {
        window.originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(name, value) { if (name === key) throw Error('synthetic storage failure'); return window.originalSetItem.call(this, name, value); };
      }, blocked);
      await importButton().click(); await page.locator('#confirm-accept').click();
      await page.waitForFunction(() => !document.querySelector('[data-action="drive-import"]').disabled);
      assert.match(await page.locator('#message').textContent(), /synthetic storage failure/);
      assert.equal(await page.evaluate(() => localStorage.dbdTrackerData), before);
      assert.equal(await page.evaluate(() => localStorage.dbdTrackerContinue), continueBefore);
      await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
    }
    for (const invalid of ['{broken', JSON.stringify({ ...incoming, schemaVersion: 999 }), JSON.stringify({ ...incoming, planning: { invalid: true } })]) {
      await page.evaluate(bytes => { window.driveTest.incoming = bytes; }, invalid);
      await importButton().click(); await page.waitForFunction(() => !document.querySelector('[data-action="drive-import"]').disabled);
      assert.equal(await page.locator('#confirmation').isVisible(), false);
      assert.equal(await page.evaluate(() => localStorage.dbdTrackerData), before);
      assert.equal(await page.evaluate(() => localStorage.dbdTrackerContinue), continueBefore);
    }
    await page.evaluate(bytes => { window.driveTest.incoming = bytes; }, JSON.stringify(incoming));
    await importButton().click(); await page.locator('#confirm-accept').click();
    await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Import complete.'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].bloodwebLevel), 37);
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerContinue')), null);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].perks), { 'future-perk': 2 });
    for (const version of [1, 2]) {
      const legacy = structuredClone(incoming); legacy.schemaVersion = version; delete legacy.planning;
      if (version === 2) legacy.prestigeQueue = [];
      if (version === 1) for (const character of Object.values(legacy.characters)) delete character.inventory;
      await page.evaluate(bytes => { window.driveTest.incoming = bytes; }, JSON.stringify(legacy));
      await importButton().click(); await page.locator('#confirm-accept').click();
      await page.waitForFunction(() => !document.querySelector('[data-action="drive-import"]').disabled);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.dbdTrackerData)), parseSave(JSON.stringify(legacy)).save);
    }
    assert.ok(!await page.evaluate(() => JSON.stringify(localStorage).includes('synthetic-token')));
    const reader = await context.newPage(); await reader.goto(origin + '/#data');
    await reader.getByRole('button', { name: 'Connect Google Drive', exact: true }).click();
    assert.equal(await reader.getByRole('button', { name: 'Import from Google Drive', exact: true }).isDisabled(), true);
    assert.equal(await reader.getByRole('button', { name: 'Export to Google Drive', exact: true }).isDisabled(), false);
    await reader.close();
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await page.getByText('Google Drive not connected', { exact: true }).waitFor();
    assert.equal(await page.locator('#main').getByRole('button', { name: /Export JSON/ }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: /Import JSON/ }).isEnabled(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}
