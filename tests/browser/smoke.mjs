import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative, extname, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Serve only the supplied stage on a free loopback port. Each browser gets a disposable profile.
export async function smokeStage(stage, { channel = 'msedge', regression, manifest } = {}) {
  stage = resolve(stage);
  const requests = [], errors = [];
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(stage, '.' + (name === '/' ? '/index.html' : name));
      const inside = relative(stage, path);
      if (inside.startsWith('..' + sep) || inside === '..' || isAbsolute(inside)) { response.writeHead(403).end(); return; }
      const body = await readFile(path);
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  let browser;
  try {
    browser = await chromium.launch({ channel, headless: true });
    const context = await browser.newContext();
    const origin = `http://127.0.0.1:${server.address().port}`;
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    page.on('request', request => requests.push(request.url()));
    await page.goto(origin + '/');
    await page.getByRole('heading', { name: 'Account overview', exact: true }).waitFor();
    const globalNavigation = page.getByRole('navigation', { name: 'Main navigation' });
    if (!await globalNavigation.isVisible()) await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await globalNavigation.getByRole('link', { name: /^Survivors/ }).click();
    await page.getByPlaceholder('Search characters…').fill('Meg');
    await page.getByRole('link', { name: 'View Meg Thomas workspace', exact: true }).click();
    await page.getByRole('link', { name: 'Edit Character', exact: true }).click();
    await page.locator('#edit-bloodweb').fill('25');
    await page.locator('#edit-favorite').check();
    await page.getByRole('button', { name: 'Save Character', exact: true }).click();
    assert.equal(await page.locator('#save-status').textContent(), 'Saved locally');
    const saved = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
    assert.equal(JSON.parse(saved).characters['meg-thomas'].bloodwebLevel, 25);
    assert.equal(JSON.parse(saved).characters['meg-thomas'].favorite, true);
    await page.reload();
    await page.getByRole('link', { name: 'Edit Character', exact: true }).click();
    assert.equal(await page.locator('#edit-bloodweb').inputValue(), '25');
    assert.equal(await page.locator('#edit-favorite').isChecked(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), saved);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    if (regression) await regression(page, origin, manifest);
    else {
      const {dashboardRegression}=await import('./dashboard.mjs');
      await dashboardRegression(page,origin);
      const {characterWorkspaceRegression}=await import('./character-workspace.mjs');
      await characterWorkspaceRegression(page,origin);
      const {killerPowerAddonsRegression}=await import('./killer-power-addons.mjs');
      await killerPowerAddonsRegression(page,origin,manifest);
      const {characterSetupRegression}=await import('./character-setup.mjs');
      await characterSetupRegression(page,origin);
      const {characterEditRegression}=await import('./character-edit.mjs');
      await characterEditRegression(page,origin);
      const {inventoryRegression}=await import('./inventory.mjs');
      await inventoryRegression(page,origin);
      page.setDefaultTimeout(30000);
      const { filteringRegression, filteringInteractions, focusAndLayouts, shellNavigationRegression } = await import('./filtering.mjs');
      await filteringInteractions(page, origin);
      await filteringRegression(page, origin);
      await focusAndLayouts(page, origin);
      await shellNavigationRegression(page, origin);
      const { artworkRegression } = await import('./artwork.mjs');
      await artworkRegression(page, origin, manifest);
      const { dataFlowsRegression, characterEditingRegression, personalCorrectionRegression } = await import('./data-flows.mjs');
      await characterEditingRegression(page, origin);
      await personalCorrectionRegression(page, origin);
      await dataFlowsRegression(page, origin);
      const { compactRegression } = await import('./compact.mjs');
      await compactRegression(page, origin);
      const { portraitsRegression } = await import('./portraits.mjs');
      await portraitsRegression(page, origin, manifest);
      const { recoveryRegression } = await import('./recovery.mjs');
      await recoveryRegression(page, origin);
      const { characterInventoryRegression } = await import('./character-inventory.mjs');
      await characterInventoryRegression(page, origin);
      // The editor regression deliberately crashes a renderer, which also closes
      // this original page. Run page-based regressions before that recovery check.
      const { collectionCardsRegression } = await import('./collection-cards.mjs');
      await collectionCardsRegression(page, origin, manifest);
      const { editorRegression } = await import('./editor.mjs');
      await editorRegression(page, origin);
    }
    assert.ok(requests.some(url => url === origin + '/dist/app.js'));
    assert.ok(requests.every(url => new URL(url).origin === origin && !new URL(url).pathname.endsWith('.json')), 'Runtime must not request external services or catalog JSON.');
    assert.deepEqual(errors, []);
    return { localhost: 'AUTOMATED PASS', browser: `${channel} ${browser.version()}`, checks: ['startup', 'Bloodweb/favorite edit', 'reload persistence', 'six labeled global destinations at wide and compact widths; Menu keyboard/Escape/focus, current route, skip-link contrast and navigation save safety', 'Filtering predicates/facets/route memory', 'native popover/focus/caret/skip/history', 'tier success/failure focus', '500/700/900/1440 shell and panel', 'all 321 perks, 880 Killer Add-ons and 37 Powers decode against manifest dimensions', 'Killer Power/Add-ons details, quantity persistence/writer/focus and 320/500/760/1100/1440/1600 layouts', 'artwork aliases/nulls/error fallback/editing', 'export/import/backup/restore/reset and cancellations', 'Compact/Detailed ordered results, transient mode and route lifecycle', 'Compact next-tier floor/history/keyboard/focus/storage failure', 'Compact 500/700/900/1440 shell, actions and image fallback', 'all 98 portraits decode; PNG/WebP MIME and canonical mappings', 'portrait card/detail/manager layouts, fallback and editing', 'corrupt-current raw export/import/restore, corrupt backups and recovery failures', 'recovery Data controls at 500/700/900/1440', 'canonical character inventory/update routes, aliases, direct tiers, account unlock propagation, card presets and responsive cards', 'Survivor/Killer Lore collection cards, summary counts, controls, routes and 320/500/760/1100/1440/1600 layouts', 'no external/catalog/manifest JSON requests'] };
  } finally {
    try { await browser?.close(); } finally { await new Promise(accept => server.close(accept)); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const channel = process.argv.includes('--chrome') ? 'chrome' : 'msedge';
  try { console.log(await smokeStage(resolve(import.meta.dirname, '../../release/runtime'), { channel })); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
