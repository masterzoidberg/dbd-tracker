import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { freshSave } from '../../src/model.js';

const root = resolve(import.meta.dirname, '../..');
const bundles = {};
for (const enabled of [false, true]) {
  const result = await build({ absWorkingDir: root, entryPoints: ['src/app.js'], bundle: true, format: 'iife',
    write: false, define: { __LEDGER_PREVIEW_ACCOUNT__: String(enabled), __LEDGER_GOOGLE_CONFIG__: '{}' } });
  bundles[enabled] = result.outputFiles[0].text;
}
let enabled = false;
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const body = pathname === '/dist/app.js' ? bundles[enabled] : await readFile(path);
    response.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' })[extname(path)] || 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const errors = [], calls = [];
  page.on('pageerror', error => errors.push(error.message));
  let session = null, status = 200, code, hold, release;
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    calls.push({ path, method: request.method(), body: request.postDataJSON() });
    assert.ok(['/api/auth/sign-in/email', '/api/auth/get-session', '/api/auth/sign-out'].includes(path), 'No state or backup API permitted');
    if (hold) await new Promise(resolve => { release = resolve; });
    const body = status !== 200 ? { code, message: '<img src=x onerror=alert(1)>SERVER SECRET' }
      : path.endsWith('get-session') ? session : path.endsWith('sign-out') ? { success: true } : { token: 'discard-this-token' };
    await route.fulfill({ status, json: body });
  });
  const entry = page.getByRole('button', { name: 'Ledger account (Preview)', exact: true });
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  assert.equal(await entry.count(), 0);
  assert.equal(calls.length, 0);
  const fixture = freshSave();
  fixture.characters['meg-thomas'].favorite = true;
  fixture.characters['meg-thomas'].bloodwebLevel = 25;
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  enabled = true;
  await page.reload();
  await entry.waitFor();
  assert.equal(calls.length, 0, 'No automatic authentication requests');
  await page.waitForFunction(() => localStorage.getItem('dbdTrackerData'));
  const saved = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  const statusText = page.locator('#ledger-account-status');
  await entry.focus(); await page.keyboard.press('Enter');
  await statusText.filter({ hasText: 'No active session' }).waitFor();
  assert.equal(await page.locator('#ledger-account-status').getAttribute('aria-live'), 'polite');
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  const password = page.getByLabel('Password', { exact: true });
  await email.fill('reader@example.invalid'); await password.fill('not-persisted');
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).evaluate(el => el === document.activeElement), true);
  for (const [httpStatus, errorCode, text] of [[401, 'INVALID_EMAIL_OR_PASSWORD', 'Email or password'], [403, 'EMAIL_NOT_VERIFIED', 'Verify your email'], [429, null, 'Too many attempts'], [503, null, 'unavailable']]) {
    status = httpStatus; code = errorCode;
    await password.fill('not-persisted');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await statusText.filter({ hasText: text }).waitFor();
    assert.equal(await password.inputValue(), '');
    assert.equal((await statusText.textContent()).includes('SERVER SECRET'), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), saved);
  }
  status = 200; hold = true;
  await password.fill('not-persisted');
  const before = calls.length;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#ledger-account-form button').disabled);
  await page.locator('#ledger-account-form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  assert.equal(calls.length, before + 1);
  await page.keyboard.press('Escape');
  assert.equal(await entry.evaluate(el => el === document.activeElement), true);
  await entry.click();
  assert.equal(calls.length, before + 1, 'Reopen must not start another request');
  hold = false;
  session = { session: { expiresAt: '2099-01-01T00:00:00Z' }, user: { email: 'reader@example.invalid' } };
  release();
  await statusText.filter({ hasText: 'Signed in.' }).waitFor();
  assert.equal(await page.locator('#ledger-account-form').isVisible(), false, 'Authenticated users should see session actions, not the sign-in form');
  assert.equal(await page.locator('#ledger-account').evaluate(el => el.contains(document.activeElement)), true);
  assert.match(await page.locator('#ledger-account-identity').textContent(), /reader@example.invalid/);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), saved);
  status = 503;
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await statusText.filter({ hasText: 'unavailable' }).waitFor();
  assert.match(await page.locator('#ledger-account-identity').textContent(), /reader@example.invalid/);
  status = 200;
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await statusText.filter({ hasText: 'Signed out' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), saved);
  // An existing cookie session is recognized on reopening; expiration clears it on refresh.
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await entry.click();
  await statusText.filter({ hasText: 'Session recognized' }).waitFor();
  session = null;
  await page.getByRole('button', { name: 'Refresh session', exact: true }).click();
  await statusText.filter({ hasText: 'No active session' }).waitFor();
  assert.equal(await email.evaluate(el => el === document.activeElement), true);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), saved);
  await context.unroute('**/api/**');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Refresh session', exact: true }).click();
  await statusText.filter({ hasText: 'unavailable' }).waitFor();
  await page.keyboard.press('Escape');
  if (!await page.getByRole('navigation', { name: 'Main navigation' }).isVisible()) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('link', { name: /Data & backups/ }).click();
  await page.getByRole('heading', { name: 'Data & backups', exact: true }).waitFor();
  const download = page.waitForEvent('download');
  await page.locator('.topbar [data-action=export]').click();
  await download;
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), saved);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('not-persisted') || JSON.stringify(localStorage).includes('discard-this-token')), false);
  await context.setOffline(false);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await context.route('**/api/**', route => route.fulfill({ json: null }));
    await entry.click();
    await statusText.filter({ hasText: 'No active session' }).waitFor();
    const bounds = await page.locator('#ledger-account').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    await page.keyboard.press('Escape');
  }
  const filePage = await context.newPage();
  await filePage.route('**/dist/app.js', route => route.fulfill({ contentType: 'text/javascript', body: bundles.true }));
  const fileCalls = [];
  filePage.on('request', request => { if (request.url().includes('/api/')) fileCalls.push(request.url()); });
  await filePage.goto(pathToFileURL(resolve(root, 'index.html')).href);
  await filePage.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  assert.equal(await filePage.getByRole('button', { name: 'Ledger account (Preview)', exact: true }).count(), 0);
  assert.deepEqual(fileCalls, []);
  assert.deepEqual(errors, []);
  console.log('PASS: default-off, mocked auth states, pending/reopen, keyboard/focus, local-save preservation, offline export, responsive dialog, direct-file; Edge ' + browser.version());
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
