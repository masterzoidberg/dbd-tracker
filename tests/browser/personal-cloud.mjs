import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const bundle = await build({ absWorkingDir: root, entryPoints: ['src/app.js'], bundle: true, write: false, format: 'iife',
  define: { __LEDGER_ACCOUNT_ENABLED__: 'true', __LEDGER_GOOGLE_CONFIG__: '{}' } });
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/dist/app.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text); }
  const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (relative(root, file).startsWith('..') || isAbsolute(relative(root, file))) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let remote = null, backups = [], backupCreationFails = false;
const errors = [];
async function device(viewport) {
  const context = await browser.newContext({ viewport });
  let signedIn = false;
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/api/auth/get-session') return json(signedIn ? { user: { id: 'owner', email: 'owner@example.invalid' } } : null);
    if (path === '/api/auth/sign-in/email') { signedIn = true; return json({}); }
    if (path === '/api/auth/sign-out') { signedIn = false; return json({ success: true }); }
    if (path === '/api/ledger/state') {
      if (!signedIn) return json({}, 401);
      if (request.method() === 'PUT') {
        const { data, expectedRevision } = request.postDataJSON();
        if (expectedRevision !== (remote?.revision ?? 0)) return json({}, 409);
        remote = { data, revision: expectedRevision + 1 };
      }
      return remote ? json(remote) : json({}, 404);
    }
    if (path === '/api/ledger/backups') {
      if (!signedIn) return json({}, 401);
      if (request.method() === 'GET') return json(backups.map(({ id, sourceRevision, createdAt }) => ({ id, sourceRevision, createdAt })).reverse());
      if (backupCreationFails) return json({}, 500);
      if (!remote) return json({}, 404);
      const point = { id: `00000000-0000-4000-8000-${String(backups.length + 1).padStart(12, '0')}`,
        sourceRevision: remote.revision, data: structuredClone(remote.data), createdAt: new Date().toISOString() };
      backups.push(point); return json(point, 201);
    }
    if (path.startsWith('/api/ledger/backups/')) {
      if (!signedIn) return json({}, 401);
      const point = backups.find(point => point.id === path.split('/').at(-1));
      return point ? json(point) : json({}, 404);
    }
    return json({}, 404);
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('button', { name: 'Account · Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('owner@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-Passphrase-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('#ledger-use-local:enabled').waitFor();
  assert.match(await page.locator('#ledger-use-local').locator('..').textContent(), /THIS DEVICE/);
  assert.match(await page.locator('#ledger-use-cloud').locator('..').textContent(), /CLOUD SAVE/);
  assert.deepEqual(await page.locator('.ledger-account-versions button').evaluateAll(buttons => buttons.map(button => button.id)),
    ['ledger-use-local', 'ledger-use-cloud']);
  return { page, context };
}
async function waitSaved(page) {
  await page.waitForFunction(() => document.querySelector('#ledger-account-status').textContent === 'Saved to your account.'
    && !document.querySelector('#ledger-cloud-refresh').disabled);
}
const current = page => page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')));
try {
  const first = await device({ width: 1440, height: 900 });
  assert.equal(remote, null);
  await first.page.locator('#ledger-use-local').click(); await waitSaved(first.page);
  assert.equal(await first.page.locator('.ledger-account-versions button:visible').count(), 0);
  assert.deepEqual(await current(first.page), remote.data);
  await first.page.locator('#ledger-point-create').click();
  await first.page.locator('.ledger-save-point').waitFor();
  assert.equal(backups[0].sourceRevision, 1);
  const pointDownload = first.page.waitForEvent('download');
  await first.page.getByRole('button', { name: /^Download save point/ }).click();
  assert.match((await pointDownload).suggestedFilename(), /ledger-cloud-save-\d{4}-\d{2}-\d{2}\.json/);
  await first.page.locator('#ledger-recovery summary').click();
  const download = first.page.waitForEvent('download');
  await first.page.getByRole('button', { name: /Download preserved copy 1/ }).click();
  assert.match((await download).suggestedFilename(), /ledger-preserved-1\.json/);
  await first.page.locator('#ledger-account-close').click();
  const second = await device({ width: 390, height: 844 });
  await second.page.locator('#ledger-use-cloud').click(); await waitSaved(second.page);
  assert.deepEqual(await current(second.page), remote.data);
  await second.page.locator('#ledger-account-close').click();
  await second.page.goto(origin + '/#characters/survivor');
  // Navigate through the existing character workspace and make an actual UI edit.
  const nav = second.page.getByRole('navigation', { name: 'Main navigation' });
  if (!await nav.isVisible()) await second.page.getByRole('button', { name: 'Menu', exact: true }).click();
  await nav.getByRole('link', { name: /^Survivors/ }).click();
  await second.page.getByPlaceholder('Search characters…').fill('Meg');
  await second.page.getByRole('link', { name: 'View Meg Thomas workspace', exact: true }).click();
  await second.page.locator('.character-workspace-favorite').click();
  await waitSaved(second.page);
  assert.equal(remote.data.characters['meg-thomas'].favorite, true);
  await first.page.getByRole('button', { name: /^Account ·/ }).click();
  await first.page.locator('#ledger-cloud-refresh').click(); await waitSaved(first.page);
  assert.equal((await current(first.page)).characters['meg-thomas'].favorite, true);
  first.page.once('dialog', dialog => dialog.dismiss());
  await first.page.getByRole('button', { name: /^Restore save point/ }).click();
  assert.equal(remote.revision, 2, 'Canceling restore leaves the cloud save unchanged');
  backupCreationFails = true;
  first.page.once('dialog', dialog => dialog.accept());
  await first.page.getByRole('button', { name: /^Restore save point/ }).click();
  await first.page.waitForFunction(() => document.querySelector('#ledger-account-status').textContent.includes('Cloud save points are unavailable'));
  assert.equal(remote.revision, 2, 'A failed safety backup prevents restore');
  assert.equal((await current(first.page)).characters['meg-thomas'].favorite, true);
  backupCreationFails = false;
  first.page.once('dialog', dialog => dialog.accept());
  await first.page.getByRole('button', { name: /^Restore save point/ }).click(); await waitSaved(first.page);
  assert.equal(remote.revision, 3);
  assert.equal(remote.data.characters['meg-thomas'].favorite, false);
  assert.equal(backups[1].data.characters['meg-thomas'].favorite, true, 'The current cloud save becomes a new save point before restore');
  // A second tab on the same device cannot write or replace the save.
  const readonly = await first.context.newPage();
  readonly.on('pageerror', error => errors.push(error.message));
  await readonly.goto(origin);
  await readonly.getByRole('button', { name: /^Account ·/ }).click();
  await readonly.waitForFunction(() => document.querySelector('#ledger-account-status').textContent.includes('Read-only'));
  await readonly.close();
  // Keyboard close and mobile width stay usable.
  await first.page.keyboard.press('Escape');
  assert.equal(await first.page.locator('#ledger-account').evaluate(dialog => dialog.open), false);
  assert.equal(await second.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await second.page.setViewportSize({ width: 320, height: 700 });
  await second.page.getByRole('button', { name: /^Account ·/ }).click();
  assert.equal(await second.page.locator('#ledger-account').evaluate(dialog => dialog.getBoundingClientRect().width <= innerWidth - 16), true);
  assert.deepEqual(errors, []);
  console.log('PASS: two device contexts, sign-in, explicit linking, UI edit sync, save point restore, writer lock, mobile width and keyboard close (mocked APIs).');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
