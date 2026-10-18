import assert from 'node:assert/strict';
import { killerPowerByCharacterId, inventoryEntityById } from '../../data/inventory-catalog.js';
import killerRuntime from '../../data/killer-runtime-catalog.json' with { type: 'json' };
import assetManifest from '../../data/asset-manifest.json' with { type: 'json' };

const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Ultra Rare'];

export async function killerPowerAddonsRegression(page, origin, manifest) {
  manifest ||= assetManifest;
  const doctorId = 'the-doctor';
  const doctorPower = killerPowerByCharacterId[doctorId];
  const doctorAddons = Object.values(inventoryEntityById)
    .filter(entity => entity.role === 'killer' && entity.characterId === doctorId)
    .sort((a, b) => a.order - b.order);

  await page.goto(origin + '/#character/' + doctorId + '/power-addons');
  const workspace = page.locator('[data-character-workspace]');
  await workspace.locator('[data-killer-power-panel]').waitFor();
  const powerPanel = workspace.locator('[data-killer-power-panel]');
  assert.equal(await powerPanel.locator('[data-power-name]').textContent(), doctorPower.powerName);
  assert.equal(await powerPanel.locator('[data-power-summary]').textContent(), doctorPower.shortSummary);

  const groups = workspace.locator('[data-killer-rarity-section]');
  assert.deepEqual(await groups.evaluateAll(nodes => nodes.map(node => node.dataset.rarity)), rarityOrder);
  assert.equal(await workspace.locator('[data-killer-addon-card]').count(), 20);
  const displayedIds = await groups.evaluateAll(nodes => nodes.flatMap(group =>
    [...group.querySelectorAll('[data-killer-addon-card]')].map(card => card.dataset.addonId)));
  assert.deepEqual(displayedIds, rarityOrder.flatMap(rarity => doctorAddons
    .filter(addon => addon.rarity === rarity).map(addon => addon.id)), 'Add-ons retain source order inside each rarity');
  assert.deepEqual(await workspace.locator('[data-killer-addon-card]').evaluateAll(nodes =>
    [...new Set(nodes.map(node => node.dataset.characterId))]), [doctorId], 'Only the selected Killer Add-ons are shown');
  assert.equal(await workspace.locator('[data-killer-quantity]').count(), 20);
  assert.equal(await workspace.locator('[data-action="stock-family-select"], [data-action="stock-family-toggle"], #inventory-in-stock').count(), 0);

  const detailsTrigger = workspace.locator('[data-action="killer-power-details"]');
  await detailsTrigger.click();
  assert.equal(await page.locator('#detail').isVisible(), true);
  const powerDetails = page.locator('#detail-content');
  for (const [field, heading, firstValue] of [
    ['fullExplanation', 'Full Explanation', doctorPower.fullExplanation],
    ['components', 'Components', doctorPower.components[0].name],
    ['mechanics', 'Mechanics', doctorPower.mechanics[0].name],
    ['resources', 'Resources', doctorPower.resources[0].name],
    ['survivorInteractions', 'Survivor Interactions', doctorPower.survivorInteractions[0].name],
    ['powerStates', 'Power States', doctorPower.powerStates[0].name],
    ['addonRelevantMechanics', 'Add-on-Relevant Mechanics', typeof doctorPower.addonRelevantMechanics === 'string' ? doctorPower.addonRelevantMechanics : (typeof doctorPower.addonRelevantMechanics[0] === 'string' ? doctorPower.addonRelevantMechanics[0] : doctorPower.addonRelevantMechanics[0].name)],
    ['complexRules', 'Complex Rules', doctorPower.complexRules[0].name],
  ]) {
    assert.equal(await powerDetails.locator(`[data-power-detail-field="${field}"] h3`).textContent(), heading, field);
    const rendered = await powerDetails.locator(`[data-power-detail-field="${field}"]`).textContent();
    assert.ok(rendered.includes(firstValue), `${field}: ${rendered} does not include ${firstValue}`);
  }
  assert.doesNotMatch(await powerDetails.textContent(), /research sources|verification notes|confidence|patch history/i);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  assert.equal(await detailsTrigger.evaluate(node => document.activeElement === node), true, 'Power dialog restores focus');

  const firstAddon = doctorAddons[0];
  const addonTrigger = workspace.locator(`[data-action="killer-addon-details"][data-id="${firstAddon.id}"]`);
  await addonTrigger.click();
  assert.equal(await page.locator('#detail-content [data-killer-addon-effect]').textContent(), firstAddon.effect);
  assert.doesNotMatch(await page.locator('#detail-content').textContent(), /research sources|verification notes|confidence|patch history/i);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  assert.equal(await addonTrigger.evaluate(node => document.activeElement === node), true, 'Add-on dialog restores focus');

  const doctorSave = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await page.goto(origin + '/#character/the-trapper/power-addons');
  const trapper = killerRuntime.killers.find(killer => killer.characterId === 'the-trapper');
  assert.equal(await page.locator('[data-power-name]').textContent(), trapper.power.powerName);
  assert.equal(await page.locator('[data-killer-addon-card]').count(), 20);
  assert.equal(await page.locator('[data-killer-addon-card][data-character-id="the-doctor"]').count(), 0);

  await page.goto(origin + '/#character/the-dark-lord/power-addons');
  const fallback = page.locator('[data-killer-power-panel] [data-power-art-fallback]');
  assert.equal(await fallback.count(), 1);
  assert.equal(await fallback.getAttribute('role'), 'img');
  assert.equal(await fallback.getAttribute('aria-label'), 'Power artwork unavailable');

  await page.goto(origin + '/#character/the-trapper/power-addons');
  const mappedPower = trapper.power.artwork.path;
  assert.ok(mappedPower && manifest.killerPowers['the-trapper'].path === mappedPower);
  assert.equal(await page.locator('[data-killer-power-panel] img[data-power-art]').getAttribute('src'), mappedPower);
  const reviewKiller = killerRuntime.killers.find(killer => killer.addons.some(addon => addon.artwork.confidence === 'REVIEW'));
  const reviewAddon = reviewKiller.addons.find(addon => addon.artwork.confidence === 'REVIEW');
  await page.goto(origin + '/#character/' + reviewKiller.characterId + '/power-addons');
  assert.equal(await page.locator(`[data-killer-addon-card][data-addon-id="${reviewAddon.id}"] img`).getAttribute('src'), reviewAddon.artwork.path);

  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), doctorSave,
    'Opening Killer workspaces and details never mutates Survivor inventory or saved state');

  await page.goto(origin + '/#character/the-good-guy/power-addons');
  const escapedSummary = killerRuntime.killers.find(killer => killer.characterId === 'the-good-guy').power.shortSummary;
  const summary = page.locator('[data-power-summary]');
  assert.equal(await summary.textContent(), escapedSummary);
  assert.ok((await summary.evaluate(node => node.innerHTML)).includes('&amp;'), 'Canonical ampersands are escaped in rendered markup');
}
