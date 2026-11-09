import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { freshSave } from '../../src/model.js';
import { inventoryEntityById } from '../../data/inventory-catalog.js';
import { smokeStage } from './smoke.mjs';
import { dredgeExportFixture } from '../fixtures/character-export.js';

async function downloadText(page, name) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const download = await pending;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { filename: download.suggestedFilename(), text: Buffer.concat(chunks).toString('utf8') };
}
async function openMenu(page) {
  await page.locator('#character-export-trigger').click();
  await page.locator('#character-export-menu:popover-open').waitFor();
  // Native toggle is queued: positioning and first-button focus complete there.
  await page.waitForFunction(() => document.querySelector('#character-export-trigger').getAttribute('aria-expanded') === 'true'
    && document.activeElement === document.querySelector('#character-export-menu button'));
}

export async function characterExportRegression(page, origin) {
  const save = freshSave();
  const addon = Object.values(inventoryEntityById).find(row => row.characterId === 'the-artist');
  const item = Object.values(inventoryEntityById).find(row => row.map === 'items');
  const survivorAddon = Object.values(inventoryEntityById).find(row => row.role === 'survivor' && row.map === 'addons');
  Object.assign(save.characters['the-artist'], { owned: true, prestige: 4, bloodwebLevel: 37, notes: 'Export <safe> | notes\nSecond line' });
  save.characters['the-artist'].inventory.addons[addon.id] = 8;
  save.characters['the-artist'].perks['grim-embrace'] = 2;
  save.characters['meg-thomas'].inventory.items[item.id] = 6;
  save.characters['meg-thomas'].inventory.addons[survivorAddon.id] = 4;
  save.characters['the-trapper'].notes = 'Unrelated private character note';
  await page.goto(origin + '/#character/the-artist/overview');
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.locator('[data-character-progress-trigger]').waitFor();
  const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  const backupsBefore = await page.evaluate(() => localStorage.getItem('dbdTrackerBackups'));
  const requests = [];
  const listen = request => requests.push(request.url());
  page.on('request', listen);
  await page.setViewportSize({ width: 1440, height: 950 });
  assert.equal(await page.locator('.character-workspace-actions .character-workspace-favorite + #character-export-trigger').count(), 1);
  await openMenu(page);
  await page.waitForFunction(() => document.querySelector('#character-export-trigger').getAttribute('aria-expanded') === 'true');
  assert.equal(await page.locator('#character-export-menu').getAttribute('role'), 'dialog');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Export JSON');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Copy Summary');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Export JSON');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#character-export-menu:popover-open').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'character-export-trigger');
  await openMenu(page);
  await page.locator('#character-export-trigger').click();
  assert.equal(await page.locator('#character-export-menu:popover-open').count(), 0, 'Clicking the trigger again closes its popover');
  await openMenu(page);
  await page.locator('h1').click();
  assert.equal(await page.locator('#character-export-menu:popover-open').count(), 0);

  for (const [format, name] of [['json', 'Export JSON'], ['md', 'Export Markdown (.md)'], ['txt', 'Export Text (.txt)'], ['csv', 'Export CSV (.csv)']]) {
    await openMenu(page);
    const output = await downloadText(page, name);
    assert.match(output.filename, new RegExp('^the-artist-character-\\d{4}-\\d{2}-\\d{2}\\.' + format + '$'));
    assert.match(output.text, /The Artist/);
    assert.doesNotMatch(output.text, /Unrelated private character note/);
    assert.doesNotMatch(output.text, /accountRules|reference|effectiveTier|automaticMinimum|Birds of Torment|Perk reference descriptions|Not recorded \/ unavailable/);
    assert.ok(output.text.length < 2000, 'Compact character report, not a catalog dump');
    if (format === 'json') {
      const data = JSON.parse(output.text);
      assert.equal(data.exportSchemaVersion, 2);
      assert.equal(data.inventory.addons.find(row => row.id === addon.id).quantity, 8);
      assert.equal(data.progression.prestige, 4);
      assert.equal(data.progression.bloodwebLevel, 37);
      assert.deepEqual(data.perks, [{ id: 'grim-embrace', name: 'Grim Embrace', tier: 2 }]);
    } else if (format === 'md') {
      assert.match(output.text, /### Grim Embrace \| Tier 2/);
      assert.doesNotMatch(output.text, /### Grim Embrace \| Tier 3/);
    } else if (format === 'csv') {
      assert.match(output.text, /"Perks","Grim Embrace","","2","","grim-embrace"/);
    }
    assert.equal(await page.locator('#character-export-menu:popover-open').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  }
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    async writeText(text) { document.documentElement.dataset.copiedCharacter = text; },
  } }));
  await openMenu(page);
  await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
  assert.match(await page.locator('html').getAttribute('data-copied-character'), /^# The Artist/);
  const copied = await page.locator('html').getAttribute('data-copied-character');
  assert.match(copied, /### Grim Embrace \| Tier 2/);
  assert.doesNotMatch(copied, /reference|accountRules|Birds of Torment/);
  assert.ok(copied.length < 2000);
  assert.equal(await page.locator('#message').textContent(), 'Character summary copied.');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await openMenu(page);
  await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
  assert.match(await page.locator('#message').textContent(), /Clipboard unavailable.*Download Markdown/);
  await page.keyboard.press('Escape');

  // Drafts must never be saved as a side effect of export activation.
  await page.locator('[data-character-progress-trigger]').click();
  await page.locator('[data-character-task-field="bloodwebLevel"]').fill('41');
  await page.locator('#character-export-trigger').click();
  assert.match(await page.locator('#message').textContent(), /Save or discard pending edits/);
  assert.equal(await page.locator('#character-export-menu:popover-open').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  await page.getByRole('button', { name: 'Save progression', exact: true }).click();
  await openMenu(page);
  assert.equal(JSON.parse((await downloadText(page, 'Export JSON')).text).progression.bloodwebLevel, 41);

  await page.goto(origin + '/#character/the-artist/power-addons');
  const quantity = page.locator('[data-killer-quantity]').first();
  const quantityBefore = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await quantity.fill('19');
  await page.locator('#character-export-trigger').click();
  assert.match(await page.locator('#message').textContent(), /Save or discard pending edits/);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), quantityBefore, 'Export cannot trigger a quantity blur save');
  await quantity.press('Enter');
  await openMenu(page);
  assert.ok(JSON.parse((await downloadText(page, 'Export JSON')).text).inventory.addons.some(row => row.quantity === 19));

  await page.goto(origin + '/#character/meg-thomas/overview');
  const survivorBefore = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await openMenu(page);
  const survivor = JSON.parse((await downloadText(page, 'Export JSON')).text);
  assert.equal(survivor.character.id, 'meg-thomas');
  assert.equal(survivor.inventory.items.find(row => row.id === item.id).quantity, 6);
  assert.equal(survivor.inventory.addons.find(row => row.id === survivorAddon.id).quantity, 4);
  assert.deepEqual(survivor.perks, []);
  assert.ok(!Object.hasOwn(survivor, 'reference'));
  for (const name of ['Export Markdown (.md)', 'Export Text (.txt)', 'Export CSV (.csv)']) {
    await openMenu(page);
    const output = await downloadText(page, name);
    assert.ok(output.text.includes(item.name) && output.text.includes(survivorAddon.name));
    assert.doesNotMatch(output.text, /reference|accountRules|effectiveTier/);
    if (name === 'Export Markdown (.md)') {
      assert.match(output.text, /## Items/);
      assert.match(output.text, /## Add-ons/);
      assert.doesNotMatch(output.text, /## Notes|## Planning|## Perks/);
    }
  }
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    async writeText(text) { document.documentElement.dataset.copiedCharacter = text; },
  } }));
  await openMenu(page);
  await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
  const survivorCopy = await page.locator('html').getAttribute('data-copied-character');
  assert.match(survivorCopy, /^# Meg Thomas/);
  assert.ok(survivorCopy.includes(item.name) && survivorCopy.includes(survivorAddon.name));
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), survivorBefore);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openMenu(page);
    const menu = await page.locator('#character-export-menu').boundingBox();
    assert.ok(menu.x >= 0 && menu.x + menu.width <= width, 'Export popover fits at ' + width);
    assert.ok(menu.y >= 0 && menu.y + menu.height <= 900);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width);
    assert.ok((await page.locator('#character-export-trigger').boundingBox()).height >= 44);
    await page.keyboard.press('Escape');
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups')), backupsBefore);
  assert.ok(requests.every(url => !/\/api\//.test(url)), 'Export never calls an API');
  page.off('request', listen);
  await page.setViewportSize({ width: 1440, height: 900 });
}

export async function characterSummaryRegression(page, origin) {
  const save = dredgeExportFixture();
  save.characters['the-dredge'].perks['hex-plaything'] = 2;
  await page.goto(origin + '/#character/the-dredge/overview');
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.locator('#character-export-trigger').waitFor();
  const before = await page.evaluate(() => [localStorage.getItem('dbdTrackerData'), localStorage.getItem('dbdTrackerBackups')]);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    async writeText(text) { document.documentElement.dataset.copiedCharacter = text; },
  } }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await openMenu(page);
    await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
    const copy = await page.locator('html').getAttribute('data-copied-character');
    assert.ok(copy.startsWith('# The Dredge\n\nPrestige: 1\nBloodweb: 33\n'));
    assert.match(copy, /### Hex: Plaything \| Tier 2/);
    assert.match(copy, /within 20 metres/);
    assert.match(copy, /90 seconds/);
    assert.match(copy, /### Caffeine Tablets \| Common Add-On\n\nQuantity: 46/);
    assert.equal(copy.split('Caffeine Tablets').length - 1, 1);
    assert.doesNotMatch(copy, /Exported At|## Planning|24\/20\/16|&amp;|\| ---/);
    await openMenu(page);
    assert.equal((await downloadText(page, 'Export Markdown (.md)')).text, copy);
    await openMenu(page);
    const txt = (await downloadText(page, 'Export Text (.txt)')).text;
    assert.match(txt, /^The Dredge\n\nPrestige: 1\nBloodweb: 33/);
    assert.match(txt, /Hex: Plaything \| Tier 2/);
    assert.match(txt, /within 20 metres/);
    assert.doesNotMatch(txt, /^#+ /m);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('dbdTrackerData'), localStorage.getItem('dbdTrackerBackups')]), before);
}

async function directFileRegression() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve('index.html')).href + '#character/the-artist/overview');
    await page.locator('#character-export-trigger').waitFor();
    const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
    await openMenu(page);
    assert.equal(JSON.parse((await downloadText(page, 'Export JSON')).text).character.id, 'the-artist');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
    await openMenu(page);
    await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
    assert.match(await page.locator('#message').textContent(), /Download Markdown instead/);
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  } finally { await browser.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(await smokeStage(process.cwd(), { regression: async (page, origin) => {
      await characterExportRegression(page, origin);
      await characterSummaryRegression(page, origin);
    } }));
    await directFileRegression();
    console.log('PASS: Character Export downloads, copy/fallback, saved-state safety, responsive UI and direct-file use.');
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
