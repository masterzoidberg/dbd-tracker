import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave, inventoryTier } from '../../src/model.js';
import { perks, characterById } from '../../data/catalog.js';

const character = 'meg-thomas';
const historical = perks.filter(p => p.role === 'survivor' && p.historicalAvailability?.manualOwnership);
const general = perks.find(p => p.role === 'survivor' && p.general && !p.historicalAvailability);
const native = characterById[character].nativePerkIds;
const fixture = freshSave();
Object.assign(fixture.characters[character], { owned: true, setupComplete: true });
fixture.characters[character].perks[native[1]] = 2;
fixture.characters[character].perks[native[2]] = 3;
fixture.characters[character].perks.bond = 0;
fixture.perkOverrides.bond = { shrineTier: 2 };
fixture.characters[character].perks[historical[1].id] = 0;
fixture.perkOverrides[historical[1].id] = { shrineTier: 1 };
fixture.characters[character].perks[historical[2].id] = 2;

async function seed(page, origin, save = fixture) {
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), save);
  await page.goto(origin + '/#manage/' + character + '/legacy'); await page.reload();
  await page.locator('#search').waitFor();
}
const bytes = page => page.evaluate(() => localStorage.getItem('dbdTrackerData'));
const action = (page, id) => page.locator(`#main [data-action="cycle"][data-perk="${id}"]`);
const row = (page, id) => page.locator(`.compact-perk[data-perk="${id}"]`);
const snapshot = page => page.locator('#main [data-action="cycle"]').evaluateAll(nodes => nodes.map(n => [n.dataset.perk, n.textContent, n.disabled]));

export async function compactRegression(page, origin) {
  await seed(page, origin);
  assert.equal(await page.getByRole('radio', { name: 'Compact', exact: true }).count(), 1, 'Manager must offer Compact');
  assert.equal(await page.getByRole('radio', { name: 'Detailed', exact: true }).isChecked(), true);
  const predecessor = await bytes(page);
  const initial = await snapshot(page);
  await page.getByRole('radio', { name: 'Compact', exact: true }).check();
  assert.deepEqual(await snapshot(page), initial, 'Modes have identical ordered IDs, tiers and eligibility');
  assert.equal(await page.locator('.compact-perk').count(), initial.length);
  assert.equal(await page.locator('#main .table-scroll').count(), 0);
  assert.equal(await bytes(page), predecessor, 'Mode is transient and writes no progression');
  await page.locator('#view-compact').focus(); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#view-detailed').isChecked(), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'view-detailed');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#view-compact').isChecked(), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'view-compact');

  // Both presentations retain the same quick view, advanced group, search and sort.
  await page.locator('#quick-bloodweb-available').click();
  await page.locator('#sort').selectOption('tier');
  await page.locator('#search').fill('Meg');
  await page.locator('#filters-trigger').click();
  await page.locator('#filter-effectiveTier-1').check();
  await page.keyboard.press('Escape');
  const filtered = await snapshot(page);
  assert.ok(filtered.length > 0);
  for (const mode of ['Detailed', 'Compact']) {
    await page.getByRole('radio', { name: mode, exact: true }).check();
    assert.deepEqual(await snapshot(page), filtered);
    assert.equal(await page.locator('#search').inputValue(), 'Meg');
    assert.equal(await page.locator('#sort').inputValue(), 'tier');
    assert.equal(await page.locator('#quick-bloodweb-available').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.filter-summary').count(), 1);
  }
  // If an action holds focus during a programmatic mode change, its stable ID survives.
  await action(page, native[0]).focus();
  const focusId = await page.evaluate(() => document.activeElement.id);
  await page.getByRole('radio', { name: 'Detailed', exact: true }).evaluate(n => { n.checked = true; n.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal(await page.evaluate(() => document.activeElement.id), focusId);
  await page.getByRole('radio', { name: 'Compact', exact: true }).check();
  for (const route of ['manage/dwight-fairfield/legacy', 'manage/the-trapper/legacy', 'survivor-perks', 'manage/meg-thomas/legacy']) {
    await page.goto(origin + '/#' + route);
    await page.locator('#search').waitFor();
    if (route.startsWith('manage/')) assert.equal(await page.getByRole('radio', { name: 'Compact', exact: true }).isChecked(), true);
    else assert.equal(await page.getByRole('radio', { name: 'Compact', exact: true }).count(), 0);
    if (route === 'manage/dwight-fairfield/legacy') assert.equal(await action(page, 'bond').isEnabled(), true, 'Locked character flag introduces no new eligibility gate');
  }
  assert.equal(await bytes(page), predecessor);
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  await page.reload();
  assert.equal(await page.getByRole('radio', { name: 'Detailed', exact: true }).isChecked(), true);

  await page.getByRole('radio', { name: 'Compact', exact: true }).check();
  await action(page, 'bond').click();
  let persisted = JSON.parse(await bytes(page));
  assert.equal(persisted.characters[character].perks.bond, 3, 'Raw zero/global II advances directly to personal III');
  assert.equal(await action(page, 'bond').isDisabled(), true);
  assert.match(await action(page, 'bond').getAttribute('aria-label'), /Maxed/);
  assert.match(await row(page, 'bond').textContent(), /Maxed/);
  assert.equal(persisted.characters[character].perks[native[0]], undefined, 'Automatic minima remain derived');
  await action(page, native[0]).focus(); await page.keyboard.press('Enter');
  assert.equal(JSON.parse(await bytes(page)).characters[character].perks[native[0]], 2, 'Native I advances to II by keyboard');
  assert.equal(await action(page, native[2]).isDisabled(), true);
  await page.reload();
  assert.equal(await action(page, 'bond').textContent(), 'III↑');
  await page.getByRole('radio', { name: 'Compact', exact: true }).check();

  // Automatic ownership never substitutes for a historical raw record.
  for (const [perk, value, label] of [[historical[0], '', 'Not Confirmed'], [historical[1], '0', 'Not Owned'], [historical[2], '2', 'II']]) {
    assert.equal(await row(page, perk.id).locator('select').inputValue(), value);
    assert.match(await row(page, perk.id).textContent(), new RegExp('Recorded: ' + label));
    assert.match(await row(page, perk.id).textContent(), new RegExp('Effective: ' + ['None', 'I', 'II'][historical.indexOf(perk)]));
  }
  assert.equal(await action(page, historical[2].id).isDisabled(), true);
  assert.match(await action(page, historical[2].id).getAttribute('aria-label'), /Not available/);
  assert.match(await row(page, historical[2].id).textContent(), /Not available/);
  assert.equal(await row(page, historical[2].id).locator('option[value="1"]').evaluate(n => n.disabled), true, 'Positive history cannot be downgraded');
  await row(page, historical[0].id).locator('select').selectOption('0');
  assert.equal(JSON.parse(await bytes(page)).characters[character].perks[historical[0].id], 0);
  await row(page, historical[2].id).locator('[data-action="perk"]').click();
  await page.locator('[data-action="account-unlock-tier"][data-field="shrine"][data-tier="1"]').click();
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  assert.equal(await action(page, historical[2].id).isEnabled(), true, 'Account unlock restores eligibility');
  await action(page, historical[2].id).click();
  persisted = JSON.parse(await bytes(page));
  assert.equal(persisted.characters[character].perks[historical[2].id], 3);
  assert.equal(persisted.characters['dwight-fairfield'].perks[historical[2].id], undefined);

  // An upgrade removing a filtered row uses the established next action/results fallback.
  const needs = freshSave();
  for (const id of native) needs.characters[character].perks[id] = 2;
  await seed(page, origin, needs);
  await page.getByRole('radio', { name: 'Compact', exact: true }).check();
  await page.locator('#search').fill('Meg');
  await page.locator('#quick-needs-upgrade').click();
  while (await page.locator('.compact-perk').count()) {
    const actions = page.locator('#main [data-action="cycle"]:not(:disabled)');
    const id = await actions.first().getAttribute('data-perk');
    const count = await actions.count();
    await actions.first().focus(); await page.keyboard.press('Space');
    assert.equal(await row(page, id).count(), 0);
    assert.equal(await page.locator('.compact-perk').count(), count - 1);
    assert.equal(await page.evaluate(() => document.activeElement.id), count > 1 ? await actions.first().getAttribute('id') : 'perk-results');
  }

  // Storage failure keeps the rendered and durable predecessor; missing/broken art never blocks capture.
  await seed(page, origin);
  await page.getByRole('radio', { name: 'Compact', exact: true }).check();
  const beforeFailure = await bytes(page);
  await page.evaluate(() => { window.compactSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'dbdTrackerData') throw Error('compact fixture failure'); return window.compactSetItem.call(this, key, value); }; });
  await action(page, general.id).click();
  assert.equal(await bytes(page), beforeFailure);
  assert.equal(await action(page, general.id).textContent(), '—↑');
  assert.equal(await page.locator('#save-status').textContent(), 'Save failed');
  await page.evaluate(() => { Storage.prototype.setItem = window.compactSetItem; });
  await page.locator('#quick-missing').click();
  await action(page, general.id).click();
  assert.equal(JSON.parse(await bytes(page)).characters[character].perks[general.id], 1);

  for (const width of [500, 700, 900, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await seed(page, origin);
    await page.getByRole('radio', { name: 'Compact', exact: true }).check();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Compact shell overflow at ${width}`);
    const boxes = await page.locator('.topbar button, #save-status').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
    assert.ok(boxes.every(b => b.x >= 0 && b.right <= width), `Topbar bounds ${width}`);
    for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `Topbar overlap ${width}`);
    for (const id of [native[0], 'a-place-for-us']) {
      const r = await row(page, id).boundingBox();
      const button = await action(page, id).boundingBox();
      assert.ok(r.x >= 0 && r.x + r.width <= width);
      assert.ok(button.width >= 32 && button.height >= 40);
      assert.equal(await row(page, id).locator('.perk-art').evaluate(n => n.getBoundingClientRect().width), 44);
    }
    await row(page, native[0]).scrollIntoViewIfNeeded();
    const icon = row(page, native[0]).locator('img');
    await page.waitForFunction(id => document.querySelector(`.compact-perk[data-perk="${id}"] img`)?.naturalWidth > 0, native[0]);
    const before = await row(page, native[0]).boundingBox();
    await icon.evaluate(n => n.dispatchEvent(new Event('error')));
    assert.equal(await row(page, native[0]).locator('img').count(), 0);
    assert.deepEqual(await row(page, native[0]).boundingBox(), before, 'Image failure has no layout shift');
    await action(page, native[0]).click();
    assert.equal(inventoryTier(JSON.parse(await bytes(page)), character, native[0]), 2);
    await page.getByRole('radio', { name: 'Detailed', exact: true }).check();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Detailed scroll bounded at ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  console.log(await smokeStage(resolve(process.argv[2] || 'release/runtime'), { channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge', regression: compactRegression }));
}
