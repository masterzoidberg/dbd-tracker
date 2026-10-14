import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const probePath = resolve(import.meta.dirname, '../probes/editor-scope-a.html');
const key = 'dbdTrackerM03ProbeMarker';
const lockName = 'dbdTracker-m03-scope-probe';
const status = page => page.locator('#lock-status').textContent();
const marker = page => page.locator('#marker').textContent();
async function acquire(page, expected) {
  await page.locator('#acquire').click();
  await page.waitForFunction(expected => document.querySelector('#lock-status').textContent === expected, expected);
}
async function serverFor(html) {
  const server = createServer((request, response) => {
    if (request.url === '/a.html' || request.url === '/b.html') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(html);
    } else response.writeHead(204).end();
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(accept => server.close(accept)) };
}

// Real native locks and storage, disposable profiles, synthetic probe key only.
export async function probeLocalhost(channel) {
  const html = await readFile(probePath, 'utf8');
  assert.equal(html, await readFile(resolve(import.meta.dirname, '../probes/editor-scope-b.html'), 'utf8'), 'File-path variants must contain the same probe');
  const primary = await serverFor(html), secondary = await serverFor(html);
  let browser;
  try {
    browser = await chromium.launch({ channel, headless: true });
    const context = await browser.newContext();
    const origins = [primary.origin, secondary.origin];
    await context.route('**/*', route => origins.some(origin => route.request().url().startsWith(origin + '/')) ? route.continue() : route.abort());
    const a = await context.newPage(), b = await context.newPage(), c = await context.newPage();
    await Promise.all([a.goto(primary.origin + '/a.html'), b.goto(primary.origin + '/a.html'), c.goto(primary.origin + '/b.html')]);
    const runtime = JSON.parse(await a.locator('#report').inputValue());
    assert.equal(runtime.locksAvailable, true); assert.equal(runtime.storageReadable, true); assert.equal(runtime.secureContext, true);
    await a.locator('#write-marker').click();
    const original = await marker(a);
    await b.locator('#read-marker').click(); await c.locator('#read-marker').click();
    assert.equal(await marker(b), original); assert.equal(await marker(c), original);
    await acquire(a, 'Holding'); await acquire(b, 'Denied'); await acquire(c, 'Denied');
    await b.bringToFront();
    const visibility = await a.evaluate(() => document.visibilityState);
    await acquire(b, 'Denied');
    assert.equal(await status(a), 'Holding');
    await a.close();
    assert.equal(await status(b), 'Denied', 'Closing the owner cannot silently acquire the contender');
    await b.waitForFunction(async name => !(await navigator.locks.query()).held.some(lock => lock.name === name), lockName);
    await acquire(b, 'Holding');
    await b.locator('#read-marker').click(); assert.equal(await marker(b), original);

    const separateOrigin = await context.newPage(); await separateOrigin.goto(secondary.origin + '/a.html');
    assert.equal(await marker(separateOrigin), '(no marker)'); await acquire(separateOrigin, 'Holding');
    await separateOrigin.locator('#write-marker').click();
    assert.notEqual(await marker(separateOrigin), original);
    await b.locator('#read-marker').click(); assert.equal(await marker(b), original);
    const separateProfile = await browser.newContext();
    const separate = await separateProfile.newPage(); await separate.goto(primary.origin + '/a.html');
    assert.equal(await marker(separate), '(no marker)'); await acquire(separate, 'Holding');
    await separateProfile.close();
    await b.locator('#release').click(); await b.waitForFunction(() => document.querySelector('#lock-status').textContent === 'Released');

    const e = await context.newPage(), f = await context.newPage();
    await Promise.all([e.goto(primary.origin + '/a.html'), f.goto(primary.origin + '/b.html')]);
    await Promise.all([e.locator('#acquire').click(), f.locator('#acquire').click()]);
    for (const page of [e, f]) await page.waitForFunction(() => ['Holding', 'Denied'].includes(document.querySelector('#lock-status').textContent));
    assert.deepEqual([await status(e), await status(f)].sort(), ['Denied', 'Holding']);
    const owner = await status(e) === 'Holding' ? e : f, contender = owner === e ? f : e;
    const crashed = owner.waitForEvent('crash', { timeout: 10000 });
    const session = await context.newCDPSession(owner);
    void session.send('Page.crash').catch(() => {});
    await crashed;
    await contender.waitForFunction(async name => !(await navigator.locks.query()).held.some(lock => lock.name === name), lockName);
    assert.equal(await status(contender), 'Denied'); await acquire(contender, 'Holding');
    await contender.locator('#read-marker').click(); assert.equal(await marker(contender), original);
    assert.deepEqual(await contender.evaluate(() => Object.keys(localStorage)), [key], 'Probe cannot create tracker saves, backups or recovery entries');
    await context.close();

    // Probe diagnostics must describe API absence/rejection without claiming ownership.
    for (const mode of ['missing', 'rejected']) {
      const diagnostics = await browser.newContext();
      await diagnostics.addInitScript(mode => {
        Object.defineProperty(Navigator.prototype, 'locks', { configurable: true, value: mode === 'missing' ? undefined : { request: () => Promise.reject(Error('probe fixture rejection')) } });
      }, mode);
      const page = await diagnostics.newPage(); await page.goto(primary.origin + '/a.html');
      await acquire(page, mode === 'missing' ? 'Unavailable' : 'Error');
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
      await diagnostics.close();
    }
    return { status: 'PASS', browser: `${channel} ${browser.version()}`, checks: [
      'same-origin storage shared across duplicate URL and different HTTP paths',
      'one holder; duplicate and third-page requests denied',
      'owner remains holder after another page is brought forward',
      'close releases; explicit retry acquires; existing marker retained',
      'different localhost origins and separate profiles have independent storage/locks',
      'simultaneous requests yield exactly one holder',
      'actual renderer crash releases; explicit retry acquires',
      'probe touches only its synthetic marker key',
      'API absence/rejection reported without false ownership',
    ], ownerVisibilityAfterOtherPageBroughtForward: visibility,
    backgroundAndResume: visibility === 'hidden' ? 'background denial checked; real suspend/resume remains manual' : 'MANUAL REQUIRED; headless owner stayed visible' };
  } finally {
    try { await browser?.close(); } finally { await primary.close(); await secondary.close(); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = { status: 'FILE_SCOPE_PROBE_PENDING', localhost: [], directFile: 'MANUAL REQUIRED', applicationChanged: false };
  const reportPath = resolve(import.meta.dirname, '../../release/m03-runtime-probe.json');
  try {
    for (const channel of ['msedge', 'chrome']) {
      const result = await probeLocalhost(channel); report.localhost.push(result); console.log(result);
    }
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    report.status = 'PROBE_FAILED'; report.error = error.message;
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.error(error); process.exitCode = 1;
  }
}
