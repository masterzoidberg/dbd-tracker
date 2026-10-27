import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { characters } from '../../data/catalog.js';
import { freshSave } from '../../src/model.js';

const CONTINUE_KEY = 'dbdTrackerContinue';
const sectionOrder = ['snapshot', 'up-next', 'continue'];
const roleCharacters = role => characters.filter(character => character.role === role);
const setContinue = (page, characterId, role, section = 'overview', visitedAt = '2026-10-27T12:00:00.000Z') => page.evaluate(
  ({ key, characterId, role, section, visitedAt }) => localStorage.setItem(key, JSON.stringify({ version: 1, characterId, role, section, visitedAt })),
  { key: CONTINUE_KEY, characterId, role, section, visitedAt },
);
const storedSave = page => page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')));

function populatedFixture() {
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  save.characters['meg-thomas'].prestige = 1;
  save.characters['dwight-fairfield'].owned = false;
  save.characters['claudette-morel'].owned = true;
  save.characters['feng-min'].owned = true;
  save.characters['nea-karlsson'].owned = true;
  save.characters['jake-park'].owned = true;
  save.characters['meg-thomas'].prestige = 1;
  save.planning.prestigeQueues.survivor = [
    { characterId: 'meg-thomas', targetPrestige: 1 },
    { characterId: 'dwight-fairfield', targetPrestige: 3 },
  ];
  save.planning.prestigeQueues.killer = [{ characterId: 'the-trapper', targetPrestige: 1 }];
  save.planning.playingQueues.survivor = [
    { characterId: 'meg-thomas' }, { characterId: 'dwight-fairfield' },
  ];
  save.planning.upNext.survivor = [
    { characterId: 'meg-thomas', intent: 'prestige' },
    { characterId: 'dwight-fairfield', intent: 'play' },
    { characterId: 'claudette-morel', intent: 'play' },
    { characterId: 'feng-min', intent: 'prestige' },
    { characterId: 'nea-karlsson', intent: 'play' },
  ];
  save.planning.upNext.killer = [{ characterId: 'the-trapper', intent: 'play' }];
  return save;
}

async function captureDashboard(page, state) {
  if (process.env.DBD_CAPTURE_DASHBOARD !== '1') return;
  await page.locator('[data-up-next-row] img').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.querySelectorAll('[data-up-next-row] img')].every(image => image.complete));
  const output = resolve('test-results/dashboard');
  await mkdir(output, { recursive: true });
  for (const [width, height, name] of [
    [1920, 1080, 'wide'], [1440, 1000, 'laptop'], [1366, 768, 'laptop-short'],
    [1280, 900, 'shell-collapse'], [1024, 768, 'tablet'], [390, 844, 'phone'], [320, 800, 'phone-narrow'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: resolve(output, `${state}-${name}.png`), fullPage: true });
  }
}

export async function dashboardRegression(page, origin) {
  page.setDefaultTimeout(10000);
  await page.goto(origin + '/#dashboard');
  await page.evaluate(({ key, save }) => { localStorage.removeItem(key); localStorage.setItem('dbdTrackerData', JSON.stringify(save)); },
    { key: CONTINUE_KEY, save: freshSave() });
  await page.reload();
  await page.getByRole('heading', { name: 'Progression Snapshot', exact: true }).waitFor();
  assert.deepEqual(await page.locator('[data-dashboard-section]').evaluateAll(nodes => nodes.map(node => node.dataset.dashboardSection)), sectionOrder);
  assert.deepEqual(await page.locator('[data-dashboard-section] > h2').allTextContents(), [
    'Progression Snapshot', 'Up Next', 'Continue where you left off',
  ]);
  assert.equal(await page.locator('[data-up-next-row]').count(), 0, 'empty lanes are not auto-filled');
  assert.match(await page.locator('[data-up-next-lane="survivor"]').textContent(), /No survivors pinned/);
  assert.match(await page.locator('[data-up-next-lane="killer"]').textContent(), /No killers pinned/);
  assert.equal(await page.locator('[data-continue-empty]').count(), 1);
  assert.equal(await page.locator('[data-dashboard-section="suggestions"]').count(), 0);
  assert.equal(await page.locator('[data-current-focus]').count(), 0);
  assert.equal(await page.locator('[data-dashboard-section="distribution"]').count(), 0);
  await captureDashboard(page, 'empty');

  const partial = populatedFixture();
  partial.planning.upNext.killer = [];
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), partial);
  await page.reload();
  assert.equal(await page.locator('[data-up-next-lane="survivor"] [data-up-next-row]').count(), 5);
  assert.equal(await page.locator('[data-up-next-lane="killer"] [data-up-next-row]').count(), 0,
    'one role lane can be empty while the other is populated');

  const fixture = populatedFixture();
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await setContinue(page, 'the-doctor', 'killer', 'power-addons');
  await page.reload();
  assert.equal(await page.locator('[data-up-next-row]').count(), 6);
  assert.deepEqual(await page.locator('[data-up-next-lane="survivor"] [data-up-next-row]').evaluateAll(nodes => nodes.map(node => node.dataset.characterId)), [
    'meg-thomas', 'dwight-fairfield', 'claudette-morel', 'feng-min', 'nea-karlsson',
  ]);
  assert.equal(await page.locator('[data-up-next-lane="killer"] [data-up-next-row]').count(), 1);
  assert.equal(await page.locator('#up-next-intent-meg-thomas').inputValue(), 'prestige');
  assert.match(await page.locator('[data-up-next-row][data-character-id="meg-thomas"]').textContent(), /Prestige Queue.*Playing Queue/);
  assert.match(await page.locator('[data-up-next-row][data-character-id="dwight-fairfield"]').textContent(), /Not owned/);
  assert.match(await page.locator('[data-dashboard-section="continue"]').textContent(), /Killer.*Power & Add-ons.*The Doctor/);
  const savedBeforeUi = await storedSave(page);
  assert.equal(JSON.stringify(savedBeforeUi).includes(CONTINUE_KEY), false, 'Continue is absent from the portable account save');
  await captureDashboard(page, 'populated');

  await page.locator('[data-continue-link]').click();
  await page.locator('[data-character-workspace]').waitFor();
  assert.equal(await page.evaluate(() => location.hash), '#character/the-doctor/power-addons');

  const continueRecord = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), CONTINUE_KEY);
  await page.goto(origin + '/#survivor-perks');
  await page.locator('#search').fill('Kindred');
  assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), CONTINUE_KEY), continueRecord,
    'library navigation and search do not replace Continue with filter telemetry');
  await page.goto(origin + '/#dashboard');
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, characterId: 'unknown-character', role: 'killer', section: 'overview', visitedAt: '2026-10-27T12:00:00Z' })), CONTINUE_KEY);
  await page.reload();
  assert.equal(await page.locator('[data-continue-link]').count(), 0, 'unknown local Continue record is ignored');
  await setContinue(page, 'the-doctor', 'killer', 'power-addons');
  await page.reload();
  assert.equal(await page.locator('[data-continue-link]').getAttribute('href'), '#character/the-doctor/power-addons');
  await page.goto(origin + '/#character/meg-thomas/perks/update');
  await page.locator('[data-character-workspace]').waitFor();
  let resume = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), CONTINUE_KEY);
  assert.deepEqual([resume.characterId, resume.section], ['meg-thomas', 'perks']);
  await page.goto(origin + '/#character/meg-thomas/setup');
  await page.locator('[data-character-workspace]').waitFor();
  resume = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), CONTINUE_KEY);
  assert.equal(resume.section, 'overview', 'temporary Setup route resumes at stable Overview');

  await page.goto(origin + '/#dashboard');
  const megIntent = page.locator('#up-next-intent-meg-thomas');
  await megIntent.selectOption('play');
  assert.equal(await page.locator('#up-next-intent-meg-thomas').inputValue(), 'play');
  assert.equal((await storedSave(page)).planning.prestigeQueues.survivor[0].characterId, 'meg-thomas');
  assert.deepEqual((await storedSave(page)).planning.playingQueues.survivor.map(entry => entry.characterId), ['meg-thomas', 'dwight-fairfield']);
  await page.locator('#up-next-move-down-meg-thomas').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'up-next-intent-meg-thomas', 'keyboard reorder keeps focus on the moved row');
  assert.deepEqual(await page.locator('[data-up-next-lane="survivor"] [data-up-next-row]').evaluateAll(nodes => nodes.map(node => node.dataset.characterId)), [
    'dwight-fairfield', 'meg-thomas', 'claudette-morel', 'feng-min', 'nea-karlsson',
  ]);
  assert.match(await page.locator('#filter-status').textContent(), /Meg Thomas moved to position 2 of 5/);

  const fullLane = structuredClone((await storedSave(page)).planning.upNext.survivor);
  await page.locator('[data-up-next-lane="survivor"] [data-action="up-next-pin"]').click();
  assert.equal(await page.locator('#up-next-character option').count(), roleCharacters('survivor').length - 5);
  assert.equal(await page.locator('#up-next-replace option').count(), 6);
  await page.locator('#up-next-replace').selectOption('');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.deepEqual((await storedSave(page)).planning.upNext.survivor, fullLane, 'canceling full-lane swap is a no-op');
  await page.locator('[data-up-next-lane="survivor"] [data-action="up-next-pin"]').click();
  await page.locator('#up-next-character').selectOption('jake-park');
  await page.locator('#up-next-intent').selectOption('prestige');
  await page.locator('#up-next-replace').selectOption('dwight-fairfield');
  await page.getByRole('button', { name: 'Swap pin', exact: true }).click();
  const swapped = (await storedSave(page)).planning.upNext.survivor;
  assert.equal(swapped.length, 5);
  assert.deepEqual(swapped[0], { characterId: 'jake-park', intent: 'prestige' }, 'swap preserves selected rank');
  assert.equal(swapped.some(pin => pin.characterId === 'dwight-fairfield'), false);
  assert.match(await page.locator('#filter-status').textContent(), /Jake Park pinned with Prestige intent at position 1 of 5/);

  await page.locator('#up-next-intent-claudette-morel').selectOption('play');
  const directPin = (await storedSave(page)).planning;
  assert.equal(directPin.prestigeQueues.survivor.some(entry => entry.characterId === 'claudette-morel'), false);
  assert.equal(directPin.playingQueues.survivor.some(entry => entry.characterId === 'claudette-morel'), false);
  await page.locator('#queue-management > summary').click();
  assert.equal(await page.locator('[data-queue-role]').count(), 2);
  assert.equal(await page.locator('[data-management-queue="prestige"]').count(), 2);
  assert.equal(await page.locator('[data-management-queue="playing"]').count(), 2);
  assert.match(await page.locator('[data-management-queue="prestige"][data-role="survivor"]').textContent(), /Complete/);
  assert.match(await page.locator('[data-management-queue="prestige"][data-role="survivor"]').textContent(), /Unavailable.*Not owned/);

  await page.locator('[data-playing-character="survivor"]').selectOption('claudette-morel');
  await page.locator('[data-action="playing-add"][data-role="survivor"]').click();
  assert.equal((await storedSave(page)).planning.playingQueues.survivor.at(-1).characterId, 'claudette-morel');
  await page.locator('#playing-move-up-dwight-fairfield').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'playing-remove-dwight-fairfield');
  assert.equal((await storedSave(page)).planning.playingQueues.survivor[0].characterId, 'dwight-fairfield');
  await page.locator('#playing-remove-claudette-morel').click();
  assert.equal((await storedSave(page)).planning.playingQueues.survivor.some(entry => entry.characterId === 'claudette-morel'), false);
  assert.equal((await storedSave(page)).planning.upNext.survivor.some(pin => pin.characterId === 'claudette-morel'), true,
    'removing Playing membership preserves an independent pin');

  await page.locator('#queue-add-survivor').click();
  await page.locator('#queue-character').selectOption('claudette-morel');
  await page.locator('[data-action="queue-select"]').click();
  await page.locator('#queue-target').fill('4');
  await page.locator('[data-action="queue-save"]').click();
  assert.equal((await storedSave(page)).planning.prestigeQueues.survivor.at(-1).characterId, 'claudette-morel');
  await page.locator('#queue-target-claudette-morel').click();
  await page.locator('#queue-target').fill('6');
  await page.locator('[data-action="queue-save"]').click();
  assert.equal((await storedSave(page)).planning.prestigeQueues.survivor.find(entry => entry.characterId === 'claudette-morel').targetPrestige, 6);
  await page.locator('#queue-move-claudette-morel').click();
  assert.equal((await storedSave(page)).planning.prestigeQueues.survivor[1].characterId, 'claudette-morel');
  const pinBeforeRemoval = structuredClone((await storedSave(page)).planning.upNext.survivor);
  await page.locator('#queue-remove-meg-thomas').click();
  assert.deepEqual((await storedSave(page)).planning.upNext.survivor, pinBeforeRemoval, 'queue removal leaves pin order and intent untouched');
  const killerPrestigeBefore = structuredClone((await storedSave(page)).planning.prestigeQueues.killer);
  await page.locator('#up-next-unpin-the-trapper').click();
  assert.deepEqual((await storedSave(page)).planning.prestigeQueues.killer, killerPrestigeBefore, 'unpinning leaves the Prestige Queue untouched');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'up-next-pin', 'unpin preserves focus at the lane action');

  const readOnly = await page.context().newPage();
  try {
    await readOnly.goto(origin + '/#dashboard');
    await readOnly.waitForFunction(() => document.querySelector('#save-status').textContent === 'Read-only');
    assert.equal(await readOnly.locator('[data-action="up-next-pin"][data-role="killer"]').isDisabled(), true);
    assert.equal(await readOnly.locator('#queue-add-killer').isDisabled(), true);
  } finally { await readOnly.close(); }

  const afterQueueOperations = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), CONTINUE_KEY);
  assert.equal(afterQueueOperations.section, 'overview', 'queue edits do not alter Continue');
  assert.equal(JSON.stringify(await storedSave(page)).includes(CONTINUE_KEY), false);

  await setContinue(page, 'meg-thomas', 'survivor', 'overview');
  await page.goto(origin + '/#data');
  const imported = freshSave(); imported.characters['the-doctor'].owned = true;
  await page.locator('#import-file').setInputFiles({ name: 'continue-cancel.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await page.locator('#confirmation[open]').waitFor();
  await page.locator('[value="cancel"]').click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key) !== null, CONTINUE_KEY), true, 'cancelled import preserves Continue');
  await page.locator('#import-file').setInputFiles({ name: 'continue-import.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await page.locator('#confirmation[open]').waitFor();
  await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Import complete'));
  assert.match(await page.locator('#message').textContent(), /Import complete/);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), CONTINUE_KEY), null, 'successful import clears Continue');

  await page.goto(origin + '/#character/the-doctor/power-addons');
  await page.locator('[data-character-workspace]').waitFor();
  await page.goto(origin + '/#data');
  await page.locator('[data-action="restore"]').first().click();
  await page.locator('#confirmation[open]').waitFor();
  await page.locator('[value="cancel"]').click();
  assert.ok(await page.evaluate(key => localStorage.getItem(key), CONTINUE_KEY), 'cancelled restore preserves Continue');
  await page.locator('[data-action="restore"]').first().click();
  await page.locator('#confirmation[open]').waitFor();
  await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Backup restored'));
  assert.equal(await page.evaluate(key => localStorage.getItem(key), CONTINUE_KEY), null, 'successful restore clears Continue');

  await page.goto(origin + '/#character/meg-thomas/overview');
  await page.locator('[data-character-workspace]').waitFor();
  await page.goto(origin + '/#data');
  await page.locator('[data-action="reset"]').click();
  await page.locator('#confirmation[open]').waitFor();
  await page.locator('[value="cancel"]').click();
  assert.ok(await page.evaluate(key => localStorage.getItem(key), CONTINUE_KEY), 'cancelled reset preserves Continue');
  await page.locator('[data-action="reset"]').click();
  await page.locator('#confirmation[open]').waitFor();
  await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Progress reset'));
  assert.equal(await page.evaluate(key => localStorage.getItem(key), CONTINUE_KEY), null, 'successful reset clears Continue');

  const firstTab = page;
  await firstTab.goto(origin + '/#dashboard');
  const secondTab = await page.context().newPage();
  try {
    await secondTab.goto(origin + '/#character/the-doctor/power-addons');
    await secondTab.locator('[data-character-workspace]').waitFor();
    await firstTab.waitForFunction(() => document.querySelector('[data-continue-link]')?.getAttribute('href') === '#character/the-doctor/power-addons');
    assert.match(await firstTab.locator('[data-dashboard-section="continue"]').textContent(), /The Doctor/);
  } finally { await secondTab.close(); }

  const stableSave = await firstTab.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await firstTab.evaluate(() => {
    window.originalContinueSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'dbdTrackerContinue') throw new Error('Continue preference denied');
      return window.originalContinueSetItem.call(this, key, value);
    };
  });
  await firstTab.goto(origin + '/#character/meg-thomas/perks/update');
  await firstTab.locator('[data-character-workspace]').waitFor();
  assert.equal(await firstTab.evaluate(() => location.hash), '#character/meg-thomas/perks');
  assert.equal(await firstTab.evaluate(() => localStorage.getItem('dbdTrackerData')), stableSave, 'Continue storage failure does not block route or alter account data');
  await firstTab.evaluate(() => { Storage.prototype.setItem = window.originalContinueSetItem; });

  for (const [width, height] of [[1920,1080],[1440,1000],[1366,768],[1280,900],[1024,768],[768,1024],[390,844],[320,800]]) {
    await firstTab.setViewportSize({ width, height });
    await firstTab.goto(origin + '/#dashboard');
    assert.equal(await firstTab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Dashboard overflow at ${width}px`);
    for (const button of await firstTab.locator('.up-next-lane > button:visible, .up-next-controls button:visible, #queue-management button:visible').all()) {
      const box=await button.boundingBox();
      assert.ok(box.height>=44, `Dashboard action target under 44px at ${width}px`);
    }
  }

}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  await smokeStage(resolve(process.argv[2] || 'release/runtime'), { regression: dashboardRegression });
  console.log('Dashboard regression PASS');
}
