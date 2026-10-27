import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { killerPowerByCharacterId, inventoryEntityById } from '../data/inventory-catalog.js';
import { freshSave } from '../src/model.js';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://masterzoidberg.github.io/dbd-tracker';
const expectedBundle = createHash('sha256').update(await readFile(resolve(root, 'dist/app.js'))).digest('hex');
const manifest = JSON.parse(await readFile(resolve(root, 'data/asset-manifest.json'), 'utf8'));
const screenshots = resolve(process.env.TEMP, 'dbd-tracker-live-audit-2026-10-27');
await mkdir(screenshots, { recursive: true });

const bundleResponse = await fetch(`${origin}/dist/app.js?live-audit=${Date.now()}`, {
  cache: 'no-store', headers: { 'Cache-Control': 'no-cache' },
});
assert.equal(bundleResponse.status, 200, 'Live bundle must return HTTP 200');
const liveBundle = createHash('sha256').update(Buffer.from(await bundleResponse.arrayBuffer())).digest('hex');
assert.equal(liveBundle, expectedBundle, 'Live bundle must match the verified release candidate');

const errors = [];
const requests = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    extraHTTPHeaders: { 'Cache-Control': 'no-cache' },
  });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/')
    ? route.continue() : route.abort());
  let page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on('request', request => requests.push(request.url()));
  await page.goto(`${origin}/?live-audit=${Date.now()}#dashboard`);
  await page.getByRole('heading', { name: 'Account overview', exact: true }).waitFor();

  const globalNavigation = page.getByRole('navigation', { name: 'Main navigation' });
  const destinations = await globalNavigation.locator('a').evaluateAll(links => links.map(link => ({
    label: link.textContent.trim(), href: link.getAttribute('href'),
  })));
  assert.equal(destinations.length, 6, 'All six global destinations remain available');

  for (const width of [1920, 1440, 1366, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await page.goto(`${origin}/#dashboard`);
    await page.getByRole('heading', { name: 'Account overview', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      `Dashboard has no horizontal overflow at ${width}px`);
    if ([1440, 390, 320].includes(width)) await page.screenshot({ path: resolve(screenshots, `dashboard-${width}.png`) });
  }

  const step = async (name, run) => { console.log(`BEGIN ${name}`); await run(); console.log(`PASS ${name}`); };
  const killerPowerLiveRegression = async () => {
    const doctorId = 'the-doctor';
    const doctorAddons = Object.values(inventoryEntityById).filter(entity =>
      entity.role === 'killer' && entity.characterId === doctorId).sort((a, b) => a.order - b.order);
    const save = freshSave();
    save.characters[doctorId].inventory.addons[doctorAddons[0].id] = 4;
    await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
    await page.goto(`${origin}/#character/${doctorId}/power-addons`);
    const panel = page.locator('[data-killer-power-panel]');
    await panel.waitFor();
    assert.equal(await panel.locator('[data-power-name]').textContent(), killerPowerByCharacterId[doctorId].powerName);
    assert.equal(await page.locator('[data-killer-addon-card]').count(), doctorAddons.length);
    assert.equal(await page.locator('[data-killer-addon-card][data-character-id="the-doctor"]').count(), doctorAddons.length);
    const powerImage = panel.locator('img[data-power-art]');
    if (await powerImage.count()) {
      await powerImage.evaluate(image => image.decode());
      const imageState = await powerImage.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight, url: image.src }));
      assert.ok(imageState.width > 0 && imageState.height > 0, 'Mapped Power artwork decodes under the Pages base path');
      assert.ok(new URL(imageState.url).pathname.startsWith('/dbd-tracker/images/'), 'Power artwork retains the Pages project prefix');
    }
    const details = panel.locator('[data-action="killer-power-details"]');
    await details.click();
    assert.equal(await page.getByRole('dialog', { name: killerPowerByCharacterId[doctorId].powerName, exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#detail').isVisible(), false, 'Power details close with Escape');
    assert.equal(await details.evaluate(node => document.activeElement === node), true, 'Power details restore trigger focus');
    const quantity = page.locator('[data-killer-quantity]').nth(1);
    const addonId = await quantity.getAttribute('data-killer-quantity');
    await quantity.fill('7');
    await quantity.press('Enter');
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData'))).characters[doctorId].inventory.addons[addonId], 7,
      'Synthetic Add-on quantity persists for the owning Killer');
    for (const width of [320, 500, 760, 1100, 1440, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      for (const characterId of ['the-trapper', 'the-dark-lord']) {
        await page.goto(`${origin}/#character/${characterId}/power-addons`);
        const powerPanel = page.locator('[data-killer-power-panel]');
        await powerPanel.waitFor();
        const artwork = powerPanel.locator('.killer-power-art').boundingBox();
        const copy = powerPanel.locator('.killer-power-copy').boundingBox();
        const [artBox, copyBox] = await Promise.all([artwork, copy]);
        assert.equal(artBox.width, 112);
        assert.equal(artBox.height, 112);
        if (width <= 760) assert.ok(copyBox.y >= artBox.y + artBox.height, `Power stacks at ${width}px`);
        else assert.ok(copyBox.x >= artBox.x + artBox.width, `Power panel is horizontal at ${width}px`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
          `Killer Power & Add-ons has no horizontal overflow at ${width}px`);
        if (characterId === 'the-dark-lord') {
          assert.equal(await powerPanel.locator('[data-power-art-fallback][role="img"]').count(), 1,
            'Missing Power art keeps its accessible fallback');
        }
      }
    }
  };
  const artworkLiveRegression = async () => {
    await page.goto(`${origin}/#survivor-perks`);
    await page.locator('#search').fill('Detective');
    const detective = page.locator('#main [data-action="perk"][data-id="detective-s-hunch"]');
    const icon = detective.locator('img');
    assert.equal(await icon.count(), 1, 'Detective’s Hunch uses its mapped perk icon');
    assert.equal(await icon.getAttribute('src'), manifest.perks['detective-s-hunch'].path);
    await icon.evaluate(image => image.decode());
    const livePath = await icon.evaluate(image => new URL(image.src).pathname);
    assert.ok(livePath.startsWith('/dbd-tracker/images/'), 'Perk artwork resolves through the Pages project prefix');
    await detective.click();
    await page.locator('#detail-title img').waitFor();
    await page.locator('#detail-title img').evaluate(image => image.decode());
    await page.getByRole('button', { name: 'Close details', exact: true }).click();
    await page.goto(`${origin}/#killer-perks`);
    await page.locator('#search').fill('Deadlock');
    const killerPerk = page.locator('#main [data-action="perk"][data-id="deadlock"]');
    assert.equal(await killerPerk.locator('img').count(), 1, 'Deadlock uses its mapped Killer icon');
    await killerPerk.locator('img').evaluate(image => image.decode());
    for (const width of [500, 700, 900, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${origin}/#survivor-perks`);
      await page.locator('#search').fill('Detective');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
        `Perk library has no horizontal overflow at ${width}px`);
    }
  };
  await step('Dashboard', async () => { const { dashboardRegression } = await import('../tests/browser/dashboard.mjs'); await dashboardRegression(page, origin); });
  await step('Survivor and Killer workspaces', async () => { const { characterWorkspaceRegression } = await import('../tests/browser/character-workspace.mjs'); await characterWorkspaceRegression(page, origin); });
  await step('Killer Power and Add-ons (Pages base-path aware)', killerPowerLiveRegression);
  await step('Character Setup', async () => { const { characterSetupRegression } = await import('../tests/browser/character-setup.mjs'); await characterSetupRegression(page, origin); });
  await step('Legacy Edit routes and contextual actions', async () => { const { characterEditRegression } = await import('../tests/browser/character-edit.mjs'); await characterEditRegression(page, origin); });
  await step('Survivor inventory', async () => { const { inventoryRegression } = await import('../tests/browser/inventory.mjs'); await inventoryRegression(page, origin); });
  page.setDefaultTimeout(30000);
  await step('Shell, filtering, focus, history, and save safety', async () => {
    const { filteringRegression, filteringInteractions, focusAndLayouts, shellNavigationRegression } = await import('../tests/browser/filtering.mjs');
    await filteringInteractions(page, origin);
    await filteringRegression(page, origin);
    await focusAndLayouts(page, origin);
    await shellNavigationRegression(page, origin);
  });
  await step('Perk artwork and references (Pages base-path aware)', artworkLiveRegression);
  await step('Correction, recovery, and Data & Backups', async () => {
    const { dataFlowsRegression, personalCorrectionRegression } = await import('../tests/browser/data-flows.mjs');
    await personalCorrectionRegression(page, origin);
    await dataFlowsRegression(page, origin);
    const { recoveryRegression } = await import('../tests/browser/recovery.mjs');
    await recoveryRegression(page, origin);
  });
  await step('Perk libraries and Compact mode', async () => { const { compactRegression } = await import('../tests/browser/compact.mjs'); await compactRegression(page, origin); });
  await step('Portrait and roster artwork', async () => { const { portraitsRegression } = await import('../tests/browser/portraits.mjs'); await portraitsRegression(page, origin, manifest); });
  await step('Survivor and Killer roster cards', async () => { const { collectionCardsRegression } = await import('../tests/browser/collection-cards.mjs'); await collectionCardsRegression(page, origin, manifest); });
  await step('Character Perks workflow', async () => {
    const { characterInventoryRegression } = await import('../tests/browser/character-inventory.mjs');
    await characterInventoryRegression(page, origin);
    const { perkUpdateInteractionRegression } = await import('../tests/browser/perk-update-interaction.mjs');
    await perkUpdateInteractionRegression(page, origin);
  });
  await step('Cross-tab writer and recovery protections', async () => { const { editorRegression } = await import('../tests/browser/editor.mjs'); await editorRegression(page, origin); });
  if (page.isClosed()) {
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    page.on('request', request => requests.push(request.url()));
    await page.goto(`${origin}/#dashboard`);
  }

  for (const [role, characterId, perkId] of [
    ['survivor', 'meg-thomas', 'dark-sense'],
    ['killer', 'the-doctor', 'bitter-murmur'],
  ]) {
    await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), freshSave());
    await page.reload();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.goto(`${origin}/#character/${characterId}/perks`);
      await page.locator('#character-inventory-search').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Update Inventory', exact: true }).count(), 0,
        `${role} Perks has no Update Inventory mode at ${width}px`);
      assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 0,
        `${role} Perks has no mode exit at ${width}px`);
      assert.equal(await page.locator('[data-character-inventory-reference], .character-inventory-editor').count(), 0,
        `${role} Perks has no featured reference panel at ${width}px`);
      assert.equal(await page.locator('.perk-card[aria-pressed="true"]').count(), 0,
        `${role} Perks has no automatically featured perk at ${width}px`);
      const card = page.locator(`.perk-card[data-perk="${perkId}"]`);
      await card.evaluate(node => node.scrollIntoView({ block: 'center' }));
      const before = await card.boundingBox();
      await card.click();
      const picker = page.locator('.character-inventory-quick-picker');
      assert.equal(await picker.locator('strong').textContent(), role === 'survivor' ? 'Dark Sense' : 'Bitter Murmur');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
        `${role} Perks has no horizontal overflow at ${width}px`);
      const pickerBox = await picker.boundingBox();
      assert.ok(pickerBox.x >= 0 && pickerBox.x + pickerBox.width <= width,
        `${role} Tier selector is viewport-clamped at ${width}px`);
      assert.ok(pickerBox.y >= 0 && pickerBox.y + pickerBox.height <= await page.evaluate(() => innerHeight),
        `${role} Tier selector is vertically reachable at ${width}px`);
      const after = await card.boundingBox();
      assert.ok(Math.abs(after.y - before.y) <= 1 && Math.abs(after.height - before.height) <= 1,
        `${role} card stays in place when its Tier selector opens at ${width}px`);
      const detailsAction = picker.getByRole('button', { name: 'Details', exact: true });
      await detailsAction.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#detail[open]').count(), 1, 'Details opens the full reference dialog');
      await page.locator('#detail [data-action="close"]').click();
      assert.equal(await picker.count(), 1, 'Closing Details preserves the compact Tier selector');
      assert.equal(await detailsAction.evaluate(node => node === document.activeElement), true,
        'Closing Details returns focus to its trigger');
      await page.screenshot({ path: resolve(screenshots, `perk-workflow-${role}-${width}.png`) });
      await page.keyboard.press('Escape');
      assert.equal(await picker.count(), 0, 'Escape closes the compact Tier selector');
      assert.equal(await card.evaluate(node => node === document.activeElement), true, 'Escape returns focus to the perk card');
    }
  }

  assert.ok(requests.some(url => url === `${origin}/dist/app.js` || url.startsWith(`${origin}/dist/app.js?`)),
    'The live app bundle was requested');
  assert.ok(requests.every(url => new URL(url).origin === new URL(origin).origin && !new URL(url).pathname.endsWith('.json')),
    'The live runtime makes no external or catalog JSON requests');
  assert.deepEqual(errors, [], 'The live browser audit has no page errors or HTTP failures');
  console.log(JSON.stringify({
    liveBundle,
    browser: `msedge ${browser.version()}`,
    destinations: destinations.map(destination => destination.label),
    screenshots,
    result: 'LIVE AUTOMATED AUDIT PASS',
  }, null, 2));
} finally { await browser.close(); }
