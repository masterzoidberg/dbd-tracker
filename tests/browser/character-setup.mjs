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
  await page.goto(origin + '/#character/claudette-morel/setup');
  assert.match(await page.locator('#main').textContent(), /requires an owned/i);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  await smokeStage(resolve(process.argv[2] || 'release/runtime'), { regression: characterSetupRegression });
  console.log('Character Setup regression PASS');
}
