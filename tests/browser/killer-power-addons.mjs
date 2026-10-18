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
  await killerDialogFocusRegression(page, origin);
  await killerQuantityRegression(page, origin);
}

export async function killerDialogFocusRegression(page, origin) {
  await page.goto(origin + '/#character/the-doctor/power-addons');
  await page.locator('[data-action="killer-power-details"]').click();
  await page.evaluate(() => {
    document.querySelector('#detail').close();
    document.querySelector('[data-killer-quantity]').focus();
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-killer-quantity]').first().evaluate(node => document.activeElement === node), true,
    'Delayed dialog close preserves a newer focus destination');
}

export async function killerQuantityRegression(page, origin) {
  await page.goto(origin + '/#character/the-doctor/power-addons');
  const addons = Object.values(inventoryEntityById).filter(entity => entity.characterId === 'the-doctor').sort((a,b) => a.order-b.order);
  const [first, second] = addons;
  const field = id => page.locator('[data-killer-quantity="' + id + '"]');
  const step = (id, delta) => page.locator('[data-killer-stock-step][data-id="' + id + '"][data-delta="' + delta + '"]');
  const details = page.locator('[data-action="killer-addon-details"][data-id="' + first.id + '"]');
  const powerDetails = page.locator('[data-action="killer-power-details"]');
  const bytes = () => page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  const quantity = async id => JSON.parse(await bytes()).characters['the-doctor'].inventory.addons[id];
  const initial = JSON.parse(await bytes());
  const originalOthers = Object.fromEntries(Object.entries(initial.characters).filter(([id]) => id !== 'the-doctor'));
  assert.deepEqual(await page.locator('[data-killer-quantity]').evaluateAll(nodes => nodes.map(node => node.value)), Array(20).fill('0'));
  const sourceOrder = await page.locator('[data-killer-addon-card]').evaluateAll(nodes => nodes.map(node => node.dataset.addonId));
  await step(first.id, 1).click();
  assert.equal(await quantity(first.id), 1, 'Increment persists to the selected Killer Add-on map');
  assert.equal(await field(first.id).evaluate(node => document.activeElement === node), true);
  assert.equal(await step(first.id, -1).isDisabled(), false);
  await step(first.id, -1).click();
  assert.equal(await quantity(first.id), undefined, 'Zero omits the persisted key');
  assert.equal(await step(first.id, -1).isDisabled(), true);
  await field(first.id).fill('5');
  await field(first.id).press('Enter');
  assert.equal(await quantity(first.id), 5);
  assert.equal(await field(first.id).evaluate(node => document.activeElement === node), true);
  const entered = await bytes();
  await field(second.id).focus();
  await page.waitForTimeout(100);
  assert.equal(await bytes(), entered, 'Enter followed by blur does not write twice');
  await field(second.id).fill('7');
  await field(first.id).focus();
  await page.waitForFunction(id => JSON.parse(localStorage.dbdTrackerData).characters['the-doctor'].inventory.addons[id] === 7, second.id);
  assert.equal(await field(first.id).evaluate(node => document.activeElement === node), true, 'Blur preserves the next field focus');
  await field(second.id).fill(String(Number.MAX_SAFE_INTEGER));
  await field(second.id).press('Enter');
  assert.equal(await quantity(second.id), Number.MAX_SAFE_INTEGER);
  assert.equal(await step(second.id, 1).isDisabled(), true);
  await page.reload();
  assert.equal(await field(first.id).inputValue(), '5', 'Quantity survives reload');
  assert.equal(await field(second.id).inputValue(), String(Number.MAX_SAFE_INTEGER));
  assert.deepEqual(await page.locator('[data-killer-addon-card]').evaluateAll(nodes => nodes.map(node => node.dataset.addonId)), sourceOrder,
    'Stock changes never change canonical rarity/source order');

  for (const raw of ['6', 'bad']) {
    await field(first.id).fill(raw);
    const before = await bytes();
    for (const trigger of [details, powerDetails]) {
      await trigger.click();
      assert.equal(await bytes(), before, 'Details does not commit pending input');
      await page.getByRole('button', {name:'Close details',exact:true}).click();
      assert.equal(await field(first.id).inputValue(), raw, 'Details retains pending text');
      assert.equal(await trigger.evaluate(node => document.activeElement === node), true);
    }
    // Saving a neighbor must also preserve this uncommitted editor.
    await field(second.id).fill('8');
    await field(second.id).press('Enter');
    assert.equal(await field(first.id).inputValue(), raw);
    assert.equal(await quantity(first.id), 5);
  }
  const beforeInvalid = await bytes();
  for (const invalid of ['', '-1', '1.5', '9007199254740992', ' 2', '1e2', 'bad']) {
    await field(first.id).fill(invalid);
    await field(first.id).press('Enter');
    assert.equal(await bytes(), beforeInvalid);
    assert.equal(await field(first.id).inputValue(), invalid);
    assert.equal(await field(first.id).getAttribute('aria-invalid'), 'true');
    assert.equal(await field(first.id).evaluate(node => document.activeElement === node), true);
    assert.equal(await step(first.id, 1).isDisabled(), true);
  }
  await field(second.id).focus();
  await page.waitForTimeout(100);
  assert.equal(await field(second.id).evaluate(node => document.activeElement === node), true, 'Invalid blur respects the new focus');
  assert.equal(await bytes(), beforeInvalid);
  await field(first.id).fill('9');
  await page.evaluate(() => {
    window.killerSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'dbdTrackerData') throw Error('Killer quantity fixture failure');
      return window.killerSetItem.call(this, key, value);
    };
  });
  try {
    await field(first.id).press('Enter');
    assert.equal(await bytes(), beforeInvalid);
    assert.equal(await field(first.id).inputValue(), '9', 'Failed save retains input for retry');
    assert.match(await page.locator('#killer-stock-error-' + first.id).textContent(), /Not saved/);
    assert.equal(await field(first.id).evaluate(node => document.activeElement === node), true);
  } finally {
    await page.evaluate(() => { Storage.prototype.setItem = window.killerSetItem; delete window.killerSetItem; });
  }
  await field(first.id).press('Enter');
  assert.equal(await quantity(first.id), 9, 'Retained failed input can be retried');
  const saved = JSON.parse(await bytes());
  assert.equal(saved.schemaVersion, 2);
  assert.deepEqual(Object.fromEntries(Object.entries(saved.characters).filter(([id]) => id !== 'the-doctor')), originalOthers,
    'Saving Doctor Add-ons preserves every other character');

  const reader = await page.context().newPage();
  try {
    await reader.goto(origin + '/#character/the-doctor/power-addons');
    await reader.waitForFunction(() => document.querySelector('#save-status').textContent === 'Read-only');
    assert.equal(await reader.locator('[data-inventory-quantity][data-killer-quantity]').count(), 20);
    assert.equal(await reader.locator('[data-killer-quantity]:disabled').count(), 20);
    assert.equal(await reader.locator('[data-killer-stock-step]:disabled').count(), 40);
    const before = await bytes();
    const readerQuantity = await reader.locator('[data-killer-quantity]').first().inputValue();
    await reader.locator('[data-killer-stock-step][data-delta="1"]').first().dispatchEvent('click');
    assert.equal(await bytes(), before, 'Forced reader activation cannot write');
    assert.equal(await reader.locator('[data-killer-quantity]').first().inputValue(), readerQuantity,
      'Denied reader activation cannot change displayed quantity');
    await reader.locator('[data-action="killer-addon-details"]').first().click();
    assert.equal(await reader.locator('#detail').isVisible(), true, 'Reader retains Details access');
    await reader.getByRole('button', {name:'Close details',exact:true}).click();
    await field(first.id).fill('10'); await field(first.id).press('Enter');
    await reader.waitForFunction(id => document.querySelector('[data-killer-quantity="' + id + '"]').value === '10', first.id);
    await field(first.id).fill('11');
    const beforeLoss = await bytes();
    // Revoke the actual native writer lock after input, before commit.
    await reader.evaluate(() => navigator.locks.request('dbdTracker-editor', {steal:true}, () => {}));
    await field(first.id).press('Enter');
    assert.equal(await bytes(), beforeLoss, 'Losing writer ownership cannot commit pending input');
    assert.equal(await field(first.id).inputValue(), '11', 'Writer loss retains pending input');
    assert.match(await page.locator('#killer-stock-error-' + first.id).textContent(), /Not saved.*Read-only/);
    assert.equal(await field(first.id).isDisabled(), true);
    await page.getByRole('button', {name:'Enable editing',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#save-status').textContent === 'Saved locally');
    assert.equal(await field(first.id).inputValue(), '11');
    await field(first.id).press('Enter');
    assert.equal(await quantity(first.id), 11, 'Retained input can be retried after acquiring writer ownership');
  } finally { await reader.close(); }
}
