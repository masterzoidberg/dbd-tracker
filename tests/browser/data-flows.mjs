import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { freshSave } from '../../src/model.js';

export async function personalCorrectionRegression(page, origin) {
  const save = freshSave();
  save.characters['meg-thomas'].perks = { kindred: 3, 'sprint-burst': 3, 'borrowed-time': 3 };
  save.characters['dwight-fairfield'].perks.kindred = 2;
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), save);
  await page.goto(origin + '/#manage/meg-thomas/legacy'); await page.reload();
  const open = async id => page.locator(`#main [data-action="perk"][data-id="${id}"]`).click();
  const control = id => page.locator(`#personal-tier-meg-thomas-${id}`);
  const stored = () => page.evaluate(() => JSON.parse(localStorage.dbdTrackerData));
  await open('kindred');
  await control('kindred').selectOption('1');
  assert.equal((await stored()).characters['meg-thomas'].perks.kindred, 1);
  await control('kindred').selectOption('0');
  assert.equal(Object.hasOwn((await stored()).characters['meg-thomas'].perks, 'kindred'), false);
  assert.equal((await stored()).characters['dwight-fairfield'].perks.kindred, 2);
  await page.locator('[data-action="close"]').click();
  await open('sprint-burst'); await control('sprint-burst').selectOption('0');
  assert.equal(Object.hasOwn((await stored()).characters['meg-thomas'].perks, 'sprint-burst'), false);
  assert.match(await page.locator('#detail-tier-meg-thomas-sprint-burst').textContent(), /^I↑$/);
  await page.locator('[data-action="close"]').click();
  await open('borrowed-time'); await control('borrowed-time').selectOption('1');
  assert.equal((await stored()).characters['meg-thomas'].perks['borrowed-time'], 1);
  await control('borrowed-time').selectOption('0');
  assert.equal(await page.locator('#detail [data-historical-ownership="borrowed-time"][data-character="meg-thomas"]').inputValue(), '');
  await page.locator('[data-action="close"]').click();
  await page.reload(); await open('kindred');
  assert.equal(await control('kindred').inputValue(), '0');
  await page.evaluate(() => {
    window.correctionSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'dbdTrackerData') throw Error('correction fixture failure'); return window.correctionSetItem.call(this, key, value); };
  });
  try {
    await control('kindred').selectOption('3');
    assert.equal(await control('kindred').inputValue(), '0');
    assert.equal(Object.hasOwn((await stored()).characters['meg-thomas'].perks, 'kindred'), false);
    assert.equal(await page.locator('#detail-message').isVisible(), true);
  } finally { await page.evaluate(() => { Storage.prototype.setItem = window.correctionSetItem; delete window.correctionSetItem; }); }
  const reader = await page.context().newPage();
  try {
    await reader.goto(origin + '/#manage/meg-thomas/legacy');
    await reader.locator('#main [data-action="perk"][data-id="kindred"]').click();
    assert.equal(await reader.locator('#personal-tier-meg-thomas-kindred').isDisabled(), true);
  } finally { await reader.close(); }
  await page.locator('[data-action="close"]').click();
}

// Recurring release gate: normal data actions and cancellations in synthetic storage only.
export async function dataFlowsRegression(page, origin) {
  const before = freshSave();
  before.characters['meg-thomas'].bloodwebLevel = 25;
  before.characters['meg-thomas'].favorite = true;
  before.characters['meg-thomas'].owned = true;
  before.planning.unresolved = [{ queue: 'prestige', role: null, rank: 0,
    record: { characterId: 'future-goal-only', targetPrestige: 9 } }];
  before.characters['meg-thomas'].inventory.items['survivor-item-test-future'] = 8;
  before.characters['meg-thomas'].inventory.items['survivor-item-key-broken-key'] = 17;
  before.characters['meg-thomas'].inventory.addons['survivor-addon-test-future'] = 5;
  before.characters['meg-thomas'].inventory.addons['survivor-addon-flashlight-battery'] = 12;
  before.characters['the-doctor'].inventory.addons['killer-addon-test-future'] = 7;
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), before);
  await page.goto(origin+'/#dashboard');await page.reload();
  await page.locator('#queue-management > summary').click();
  await page.locator('#queue-add-survivor').click();
  await page.locator('#queue-character').selectOption('meg-thomas');
  await page.locator('[data-action="queue-select"]').click();
  await page.locator('#queue-target').fill('6');
  await page.getByRole('button',{name:'Save target',exact:true}).click();
  before.planning.prestigeQueues.survivor.push({characterId:'meg-thomas',targetPrestige:6});
  assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('dbdTrackerData'))).planning,before.planning);
  await page.goto(origin + '/#data'); await page.reload();
  const bytes = () => page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  const predecessor = await bytes();
  assert.ok((await page.locator('#main').textContent()).includes('SCHEMA v3'));
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#main [data-action="export"]').click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.characters['meg-thomas'].bloodwebLevel, 25);
  assert.equal(exported.characters['meg-thomas'].favorite, true);
  assert.equal(exported.schemaVersion, 3);
  assert.deepEqual(exported.planning, before.planning);
  assert.deepEqual(exported.characters['meg-thomas'].inventory, before.characters['meg-thomas'].inventory);
  assert.deepEqual(exported.characters['the-doctor'].inventory, before.characters['the-doctor'].inventory);
  assert.ok(!JSON.stringify(exported).includes('images/'));
  const incoming = structuredClone(exported); delete incoming.exportedAt;
  incoming.characters['meg-thomas'].bloodwebLevel = 31;
  incoming.characters['meg-thomas'].perks['borrowed-time'] = 0;
  incoming.characters['meg-thomas'].perks['unknown-safe-perk'] = 2;
  const importFile = async value => page.locator('#import-file').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(value) });
  await importFile(JSON.stringify(incoming));
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await bytes(), predecessor, 'Import cancellation preserves the current save');
  await importFile(JSON.stringify(incoming)); await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Import complete.'));
  const imported = JSON.parse(await bytes());
  assert.equal(imported.characters['meg-thomas'].bloodwebLevel, 31);
  assert.equal(imported.characters['meg-thomas'].perks['borrowed-time'], 0);
  assert.equal(imported.characters['meg-thomas'].perks['unknown-safe-perk'], 2);
  assert.deepEqual(imported.planning, before.planning);
  assert.deepEqual(imported.characters['meg-thomas'].inventory, before.characters['meg-thomas'].inventory);
  assert.ok(await page.locator('[data-action="restore"]').count() >= 1);
  const importedBytes = await bytes();
  await page.locator('[data-action="restore"]').first().click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await bytes(), importedBytes, 'Restore cancellation preserves imported progression');
  await page.locator('[data-action="restore"]').first().click(); await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Backup restored.'));
  assert.equal(JSON.parse(await bytes()).characters['meg-thomas'].bloodwebLevel, 25);
  assert.deepEqual(JSON.parse(await bytes()).planning, before.planning);
  assert.deepEqual(JSON.parse(await bytes()).characters['the-doctor'].inventory, before.characters['the-doctor'].inventory);
  const restoredBytes = await bytes();
  await importFile('invalid JSON');
  await page.waitForFunction(() => document.querySelector('#message').className === 'error');
  assert.equal(await bytes(), restoredBytes, 'Malformed import preserves the valid current save');
  await page.locator('[data-action="reset"]').click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await bytes(), restoredBytes, 'Reset cancellation preserves restored progression');
  await page.locator('[data-action="reset"]').click(); await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Progress reset.'));
  const reset = JSON.parse(await bytes());
  assert.equal(reset.characters['meg-thomas'].bloodwebLevel, 1);
  assert.equal(reset.characters['meg-thomas'].favorite, false);
  assert.ok(await page.locator('[data-action="restore"]').count() >= 3);
  assert.deepEqual(reset.planning, freshSave().planning);
  assert.deepEqual(reset.characters['meg-thomas'].inventory, { items: {}, addons: {} });

  // A v1 replacement has no stock/planning state; its confirmation must disclose the empty defaults.
  const legacy = structuredClone(before);
  legacy.schemaVersion = 1;
  delete legacy.planning;
  for (const progress of Object.values(legacy.characters)) delete progress.inventory;
  await importFile(JSON.stringify(legacy));
  assert.match(await page.locator('#confirm-text').textContent(), /empty.*queue.*inventory|queue.*inventory.*empty/i);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await bytes(), JSON.stringify(reset));
  await importFile(JSON.stringify(legacy)); await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Import complete.'));
  const migrated = JSON.parse(await bytes());
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.planning, freshSave().planning);
  assert.deepEqual(migrated.characters['meg-thomas'].inventory, { items: {}, addons: {} });
  const oldBackup = { id: 'v1-fixture', reason: 'Synthetic v1 backup', createdAt: before.updatedAt, save: legacy };
  await page.evaluate(b => localStorage.setItem('dbdTrackerBackups', JSON.stringify([b])), oldBackup);
  await page.reload();
  await page.locator('[data-action="restore"]').first().click();
  assert.match(await page.locator('#confirm-text').textContent(), /empty.*queue.*inventory|queue.*inventory.*empty/i);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
}
