import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';

export async function characterWorkspaceRegression(page, origin) {
  const { workspaceLayouts } = await import('./workspace-layouts.mjs');
  await workspaceLayouts(page, origin);
  const save = freshSave();
  Object.assign(save.characters['meg-thomas'], { favorite: true, prestige: 2, bloodwebLevel: 43, notes: 'Keep these notes' });
  save.characters['meg-thomas'].inventory.items['survivor-item-test-unknown'] = 7;
  await page.evaluate(s => localStorage.setItem('dbdTrackerData', JSON.stringify(s)), save);
  await page.goto(origin + '/#character/meg-thomas/overview'); await page.reload();
  const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await page.locator('[data-character-workspace]').waitFor();
  assert.equal(await page.locator('[data-character-workspace] h1').textContent(), 'Meg Thomas');
  assert.equal(await page.locator('[data-workspace-section="overview"]').getAttribute('aria-current'), 'page');
  const text = await page.locator('[data-character-workspace]').textContent();
  for (const label of ['Survivor', 'Not owned', 'Favorite', 'P2', '43', 'Keep these notes', 'Native perks']) assert.ok(text.includes(label), label);
  assert.match(text,/38 Items.*54 Add-ons/);
  assert.equal(await page.getByRole('link', { name: 'Edit Character', exact: true }).getAttribute('href'), '#character/meg-thomas/edit');
  assert.equal(await page.locator('[data-inventory-quantity]').count(), 0);
  assert.equal(await page.locator('[data-character-workspace] .character-inventory-grid').count(), 0);
  for (const hash of ['#character/the-doctor/power-addons']) {
    await page.goto(origin + '/' + hash);
    await page.locator('[data-character-workspace]').waitFor();
    assert.match(await page.locator('[data-character-workspace]').textContent(), /unavailable|not yet available/i);
  }
  for (const hash of ['#character/unknown/overview', '#character/meg-thomas/power-addons', '#manage/meg-thomas/extra']) {
    await page.goto(origin + '/' + hash);
    await page.getByRole('heading', { name: 'Character/section unavailable' }).waitFor();
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  await page.goto(origin + '/#character/the-doctor/overview');
  assert.equal(await page.locator('[data-workspace-section="power-addons"]').count(), 1);
  // Popup capability parity: normal identity and Prestige are real Overview links.
  await page.goto(origin + '/#survivors');
  await page.locator('#search').fill('Meg');
  const card = page.locator('.character-card').first();
  assert.equal(await card.locator('.character-name').getAttribute('href'), '#character/meg-thomas/overview');
  assert.equal(await card.locator('.prestige').getAttribute('href'), '#character/meg-thomas/overview');
  assert.equal(await card.locator('.manage-button').getAttribute('href'), '#character/meg-thomas/perks');
  await card.locator('.prestige').click();
  assert.equal(await page.locator('#detail').isVisible(), false);
  await page.getByRole('link', { name: 'Edit Character', exact: true }).click();
  for (const field of ['owned', 'favorite', 'prestige', 'bloodweb', 'notes'])
    assert.equal(await page.locator('#edit-' + field).count(), 1);
  assert.ok(await page.locator('[data-edit-perk]').count() > 0);
  assert.ok(await page.locator('[data-edit-correction]').count() > 0);
  await page.locator('[data-action="perk"]').first().click();
  assert.equal(await page.locator('#detail').isVisible(), true, 'Bounded perk dialog remains');
  assert.equal(await page.locator('#detail [data-personal-tier]').first().isDisabled(), true);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto(origin + '/#dashboard');
  await page.locator('[data-dashboard-section="favorites"] summary').click();
  await page.locator('[data-dashboard-character-link][href="#character/meg-thomas/overview"]').first().click();
  await page.waitForURL('**/#character/meg-thomas/overview');
  assert.equal(await page.locator('#detail').isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  await smokeStage(resolve(process.argv[2] || 'release/runtime'), { regression: characterWorkspaceRegression });
  console.log('Character workspace regression PASS');
}
