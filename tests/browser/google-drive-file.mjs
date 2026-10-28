import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage(), external = [], errors = [];
  page.on('request', request => { if (!request.url().startsWith('file:')) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(process.argv[2] || 'release/runtime', 'index.html')).href + '#data');
  await page.getByRole('heading', { name: 'Data & backups', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('#main [data-action="export"]').disabled);
  assert.match(await page.locator('[data-google-drive]').textContent(), /not configured|requires an online/);
  assert.equal(await page.locator('[data-action="drive-connect"]').count(), 0);
  const download = page.waitForEvent('download'); await page.locator('#main [data-action="export"]').click(); await download;
  assert.equal(await page.locator('[data-action="import"]').isEnabled(), true);
  assert.deepEqual(external, []); assert.deepEqual(errors, []);
  console.log('Offline direct-file Data & backups/local export/Drive unavailable PASS');
} finally { await browser.close(); }
