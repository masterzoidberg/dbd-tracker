import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';

export async function characterSetupRegression(page, origin) {
  page.setDefaultTimeout(5000);
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  save.characters['dwight-fairfield'].owned = true;
  save.characters['the-doctor'].owned = true;
  await page.evaluate(s => localStorage.setItem('dbdTrackerData', JSON.stringify(s)), save);
  await page.goto(origin + '/#character/meg-thomas/setup'); await page.reload();
  await page.locator('[data-character-setup]').waitFor();
  await page.getByRole('button', { name: 'Set Prestige 1', exact: true }).click();
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData'))).characters['meg-thomas'].prestige, 1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForURL('**/#character/meg-thomas/overview');
  let saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters['meg-thomas'].setupComplete, false);
  assert.equal(saved.characters['meg-thomas'].prestige, 1);
  await page.goto(origin + '/#character/dwight-fairfield/setup');
  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await page.waitForURL('**/#character/dwight-fairfield/overview');
  saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters['dwight-fairfield'].setupComplete, true);
  assert.equal(saved.setupComplete, false);
  assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups'))).length >= 1);
  await page.goto(origin + '/#character/meg-thomas/setup');
  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await page.getByRole('button', { name: /Add special unlocks/ }).waitFor();
  await page.getByRole('button', { name: /Add special unlocks/ }).click();
  await page.locator('#character-setup-search').fill('Kindred');
  await page.locator('[data-character-setup-perk="kindred"]').check();
  await page.locator('[data-character-setup-tier="kindred"]').selectOption('2');
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click();
  await page.waitForURL('**/#character/meg-thomas/overview');
  saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters['meg-thomas'].perks.kindred, 2);
  assert.equal(saved.characters['meg-thomas'].setupComplete, true);
  await page.getByRole('button', { name: 'Run character setups', exact: true }).click();
  await page.waitForURL('**/#character/the-doctor/setup');
  await page.getByRole('button', { name: /Skip this character/ }).click();
  saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters['the-doctor'].setupComplete, false);

  save.characters['the-doctor'].perks['bitter-murmur'] = 1;
  save.characters['the-doctor'].notes = 'Preserve Killer setup notes';
  save.characters['the-doctor'].inventory.addons['killer-addon-test-future'] = 8;
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.goto(origin + '/#character/the-doctor/setup');
  await page.getByRole('button', { name: 'Set Prestige 1', exact: true }).click();
  saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters['the-doctor'].prestige, 1, 'Killer Prestige 1 saves immediately');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForURL('**/#character/the-doctor/overview');
  saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters['the-doctor'].setupComplete, false, 'Cancel does not finish Killer setup');
  assert.equal(saved.characters['the-doctor'].perks['bitter-murmur'], 1, 'Cancel preserves the prior Killer record');

  await page.goto(origin + '/#character/the-doctor/setup');
  await page.locator('#character-setup-bloodweb').fill('14');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Add special unlocks/ }).click();
  await page.locator('#character-setup-search').fill('Bitter Murmur');
  await page.locator('[data-character-setup-perk="bitter-murmur"]').check();
  await page.locator('[data-character-setup-tier="bitter-murmur"]').selectOption('2');
  const backupCountBeforeKillerFinish = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups') || '[]')).length;
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click();
  await page.waitForURL('**/#character/the-doctor/overview');
  saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters['the-doctor'].setupComplete, true, 'Killer Finish completes setup');
  assert.equal(saved.characters['the-doctor'].bloodwebLevel, 14, 'Killer Finish saves Bloodweb progress');
  assert.equal(saved.characters['the-doctor'].perks['bitter-murmur'], 2, 'Killer setup adds the selected perk upgrade');
  assert.equal(saved.characters['the-doctor'].notes, 'Preserve Killer setup notes', 'Killer setup preserves notes');
  assert.equal(saved.characters['the-doctor'].inventory.addons['killer-addon-test-future'], 8, 'Killer setup preserves unresolved Add-ons');
  const killerBackups = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups')));
  assert.ok(killerBackups.length > backupCountBeforeKillerFinish, 'Killer Finish backs up before applying setup');
  await page.goto(origin + '/#character/claudette-morel/setup');
  assert.match(await page.locator('#main').textContent(), /requires an owned/i);
  await setupBackSaveRegression(page, origin);
  await batchSetupNavigationRegression(page, origin);
  await batchSkipStayRegression(page, origin);
  await batchSkipSaveRegression(page, origin);
}

export async function setupBackSaveRegression(page, origin) {
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  save.characters['meg-thomas'].bloodwebLevel = 10;
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.goto(origin + '/#character/meg-thomas/setup');
  await page.locator('#character-setup-bloodweb').waitFor();
  await page.locator('#character-setup-bloodweb').fill('21');
  await page.locator('[data-action="character-setup-next"]').click();
  await page.locator('#character-setup-search').fill('Kindred');
  await page.locator('[data-character-setup-perk="kindred"]').check();
  await page.locator('[data-character-setup-tier="kindred"]').selectOption('2');
  await page.locator('[data-action="character-setup-back"]').click();
  const destination = await page.locator('[data-roster-neighbor="next"]').getAttribute('href');
  await page.locator('[data-roster-neighbor="next"]').click();
  await page.locator('#dirty-navigation[open]').waitFor();
  await page.locator('#dirty-navigation [value="save"]').click();
  await page.waitForFunction(expected => location.hash === expected, destination);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters['meg-thomas'].bloodwebLevel, 21);
  assert.equal(saved.characters['meg-thomas'].perks.kindred, 2,
    'Guarded Save preserves perk selections when the setup draft is back on the Bloodweb step');
  assert.equal(saved.characters['meg-thomas'].setupComplete, true);
}

async function startTwoCharacterBatch(page, origin) {
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  save.characters['dwight-fairfield'].owned = true;
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.goto(origin + '/#character/meg-thomas/overview');
  await page.getByRole('button', { name: 'Run character setups', exact: true }).click();
  await page.locator('[data-character-setup]').waitFor();
  const sourceId = new URL(page.url()).hash.match(/#character\/([^/]+)\/setup$/)[1];
  const destinationId = sourceId === 'meg-thomas' ? 'dwight-fairfield' : 'meg-thomas';
  return { sourceId, destinationId };
}

export async function batchSetupNavigationRegression(page, origin) {
  const batch = await startTwoCharacterBatch(page, origin);
  const sourceRoute = `#character/${batch.sourceId}/setup`;
  await page.locator('#character-setup-bloodweb').fill('20');
  await page.locator('[data-action="character-setup-next"]').click();
  await page.locator('[data-action="character-setup-finish"]').click();
  await page.waitForFunction(source => location.hash !== source || document.querySelector('#dirty-navigation')?.open, sourceRoute);
  assert.equal(await page.locator('#dirty-navigation').evaluate(dialog => dialog.open), false,
    'Finishing a batch character clears its saved draft before opening the next one');
  await page.waitForFunction(expected => location.hash === expected, `#character/${batch.destinationId}/setup`);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters[batch.sourceId].bloodwebLevel, 20);
  assert.equal(saved.characters[batch.sourceId].setupComplete, true);
  await page.locator('[data-action="character-setup-next-character"]').click();
  await page.waitForFunction(() => location.hash === '#character/meg-thomas/overview');
}

export async function batchSkipStayRegression(page, origin) {
  const batch = await startTwoCharacterBatch(page, origin);
  const sourceHash = `#character/${batch.sourceId}/setup`;
  await page.locator('#character-setup-bloodweb').fill('20');
  await page.locator('[data-action="character-setup-next-character"]').click();
  await page.locator('#dirty-navigation[open]').waitFor();
  await page.locator('#dirty-navigation [value="stay"]').click();
  assert.equal(new URL(page.url()).hash, sourceHash, 'Stay keeps the current batch character selected');
  await page.locator('[data-action="character-setup-next-character"]').click();
  await page.waitForFunction(source => location.hash !== source || document.querySelector('#dirty-navigation')?.open, sourceHash);
  assert.equal(await page.locator('#dirty-navigation').evaluate(dialog => dialog.open), true,
    'Retrying Skip asks about the same source draft instead of skipping the next character');
  await page.locator('#dirty-navigation [value="discard"]').click();
  await page.waitForFunction(expected => location.hash === expected, `#character/${batch.destinationId}/setup`);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(saved.characters[batch.sourceId].bloodwebLevel, 1, 'Discard leaves the skipped character unchanged');
}

export async function batchSkipSaveRegression(page, origin) {
  const batch = await startTwoCharacterBatch(page, origin);
  await page.locator('#character-setup-bloodweb').fill('20');
  await page.locator('[data-action="character-setup-next-character"]').click();
  await page.locator('#dirty-navigation[open]').waitFor();
  await page.locator('#dirty-navigation [value="save"]').click();
  await page.waitForFunction(expected => location.hash === expected, `#character/${batch.destinationId}/setup`);
  await page.locator('[data-action="character-setup-next-character"]').click();
  const returned = await page.waitForFunction(() => location.hash === '#character/meg-thomas/overview', null, { timeout: 1500 })
    .then(() => true, () => false);
  assert.equal(returned, true, 'Saving a skipped batch character retains the queue through the next character');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  await smokeStage(resolve(process.argv[2] || 'release/runtime'), { regression: characterSetupRegression });
  console.log('Character Setup regression PASS');
}
