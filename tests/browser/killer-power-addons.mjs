import assert from 'node:assert/strict';
import { killerPowerByCharacterId, inventoryEntityById } from '../../data/inventory-catalog.js';
import { freshSave } from '../../src/model.js';
import killerRuntime from '../../data/killer-runtime-catalog.json' with { type: 'json' };
import assetManifest from '../../data/asset-manifest.json' with { type: 'json' };

const rarityOrder = ['Ultra Rare', 'Very Rare', 'Rare', 'Uncommon', 'Common'];

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

  assert.equal(await workspace.locator('[data-killer-addon-card]').count(), 20);
  assert.equal(await workspace.locator('[data-addon-rarity-section], [data-addon-rarity-toggle]').count(), 0,
    'Killer Add-ons render without rarity subgroup containers or collapse controls');
  const displayedIds = await workspace.locator('[data-killer-addon-card]').evaluateAll(nodes =>
    nodes.map(card => card.dataset.addonId));
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
  assert.equal(decodeURIComponent(await page.locator('[data-killer-power-panel] img[data-power-art]').getAttribute('src')), mappedPower);
  const reviewKiller = killerRuntime.killers.find(killer => killer.addons.some(addon => addon.artwork.confidence === 'REVIEW'));
  const reviewAddon = reviewKiller.addons.find(addon => addon.artwork.confidence === 'REVIEW');
  await page.goto(origin + '/#character/' + reviewKiller.characterId + '/power-addons');
  assert.equal(decodeURIComponent(await page.locator(`[data-killer-addon-card][data-addon-id="${reviewAddon.id}"] img`).getAttribute('src')), reviewAddon.artwork.path);

  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), doctorSave,
    'Opening Killer workspaces and details never mutates Survivor inventory or saved state');

  await page.goto(origin + '/#character/the-good-guy/power-addons');
  const escapedSummary = killerRuntime.killers.find(killer => killer.characterId === 'the-good-guy').power.shortSummary;
  const summary = page.locator('[data-power-summary]');
  assert.equal(await summary.textContent(), escapedSummary);
  assert.ok((await summary.evaluate(node => node.innerHTML)).includes('&amp;'), 'Canonical ampersands are escaped in rendered markup');
  await killerReservedArtworkRegression(page, origin);
  await killerResponsiveRegression(page, origin);
  await killerDialogFocusRegression(page, origin);
  await killerQuantityRegression(page, origin);
  await killerPendingNavigationRegression(page, origin);
  await killerRarityNavigationRegression(page, origin);
}

export async function killerPendingNavigationRegression(page, origin) {
  const route = origin + '/#character/the-doctor/power-addons';
  await page.goto(route);
  const ids = await page.locator('[data-killer-quantity]').evaluateAll(nodes => nodes.slice(0,2).map(node => node.dataset.killerQuantity));
  const field = id => page.locator('[data-killer-quantity="' + id + '"]');
  const bytes = () => page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  const openAndClose = async action => {
    const before = await bytes();
    await page.locator('[data-action="' + action + '"]').first().click();
    assert.equal(await bytes(), before, 'Details retains pending edits without saving');
    await page.getByRole('button', {name:'Close details',exact:true}).click();
  };
  for (const action of ['killer-power-details', 'killer-addon-details']) {
    await page.goto(route);
    for (const id of ids) { await field(id).fill('5'); await openAndClose(action); }
    await page.getByRole('link', {name:'Overview',exact:true}).click();
    const saved = JSON.parse(await bytes()).characters['the-doctor'].inventory.addons;
    for (const id of ids) assert.equal(saved[id], 5, action + ': navigation saves every pending quantity after Details');

    await page.goto(route);
    await field(ids[0]).fill('invalid'); await openAndClose(action);
    const invalidBefore = await bytes();
    await page.getByRole('link', {name:'Overview',exact:true}).click();
    assert.equal(page.url(), route, action + ': invalid pending edit blocks navigation');
    assert.equal(await bytes(), invalidBefore);
    assert.equal(await field(ids[0]).inputValue(), 'invalid');
    assert.equal(await field(ids[0]).evaluate(node => node === document.activeElement), true);
    await field(ids[0]).fill('6'); await openAndClose(action);
    await page.evaluate(() => {
      window.killerNavigationSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if(key === 'dbdTrackerData') throw Error('Killer navigation save failure');
        return window.killerNavigationSetItem.call(this,key,value);
      };
    });
    try {
      await page.getByRole('link', {name:'Overview',exact:true}).click();
      assert.equal(page.url(), route, action + ': failed pending save blocks navigation');
      assert.equal(await bytes(), invalidBefore);
      assert.equal(await field(ids[0]).inputValue(), '6');
      assert.equal(await field(ids[0]).evaluate(node => node === document.activeElement), true);
    } finally {
      await page.evaluate(() => {Storage.prototype.setItem = window.killerNavigationSetItem;delete window.killerNavigationSetItem;});
    }
    await page.getByRole('link', {name:'Overview',exact:true}).click();
    assert.equal(JSON.parse(await bytes()).characters['the-doctor'].inventory.addons[ids[0]],6);
    await page.goto(route);
    await field(ids[0]).fill('7'); await openAndClose(action);
    await page.evaluate(() => { location.hash = '#character/the-doctor/overview'; });
    await page.locator('[data-killer-power-panel]').waitFor({state:'detached'});
    assert.equal(JSON.parse(await bytes()).characters['the-doctor'].inventory.addons[ids[0]],7,
      action + ': hash navigation also saves pending quantities');
    await page.goto(route);
    await field(ids[0]).fill('invalid'); await openAndClose(action);
    const beforeHash = await bytes();
    await page.evaluate(() => { location.hash = '#character/the-doctor/overview'; });
    await page.waitForFunction(id => document.querySelector('[data-killer-quantity="' + id + '"]')?.getAttribute('aria-invalid') === 'true', ids[0]);
    assert.equal(page.url(),route,action + ': invalid edit restores the prior hash route');
    assert.equal(await bytes(),beforeHash);
    assert.equal(await field(ids[0]).inputValue(),'invalid');
    assert.equal(await field(ids[0]).evaluate(node => node === document.activeElement),true);
    await field(ids[0]).fill('8'); await field(ids[0]).press('Enter');
  }
}

export async function killerReservedArtworkRegression(page, origin) {
  await page.goto(origin + '/#character/the-skull-merchant/power-addons');
  const addon = killerRuntime.killers.find(killer => killer.characterId === 'the-skull-merchant')
    .addons.find(addon => addon.name === 'Adi Valente #1');
  const card = page.locator(`[data-killer-addon-card][data-addon-id="${addon.id}"]`);
  const assertDecoded = async image => {
    await image.evaluate(image => image.decode());
    const decoded = await image.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight, url: image.src }));
    assert.equal(decoded.width, 300);
    assert.equal(decoded.height, 300);
    assert.equal(new URL(decoded.url).hash, '');
    assert.equal(decodeURIComponent(new URL(decoded.url).pathname.slice(1)), addon.artwork.path);
  };
  await card.scrollIntoViewIfNeeded();
  await assertDecoded(card.locator('img'));
  await card.locator('[data-action="killer-addon-details"]').click();
  await assertDecoded(page.locator('#detail .stock-detail-media img'));
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
}

export async function killerResponsiveRegression(page, origin) {
  const viewport = page.viewportSize();
  try {
    for (const width of [320, 500, 760, 1100, 1440, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      for (const characterId of ['the-trapper', 'the-dark-lord']) {
        await page.goto(origin + '/#character/' + characterId + '/power-addons');
        const panel = page.locator('[data-killer-power-panel]');
        await panel.waitFor();
        await panel.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        const art = await panel.locator('.killer-power-art').boundingBox();
        const copy = await panel.locator('.killer-power-copy').boundingBox();
        assert.equal(art.width, 112, `Stable Power art width at ${width}: ${characterId}`);
        assert.equal(art.height, 112, `Stable Power art height at ${width}: ${characterId}`);
        if (width <= 760) assert.ok(copy.y >= art.y + art.height, `Power panel stacks at ${width}`);
        else assert.ok(copy.x >= art.x + art.width, `Power panel is horizontal at ${width}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Killer page overflow at ${width}`);
        assert.equal(await page.locator('[data-killer-rarity-section], [data-addon-rarity-toggle]').count(), 0,
          'Flat Killer Add-on lists have no rarity headers or collapse controls at ' + width);
        assert.equal(await page.locator('[data-killer-addon-card]').count(), 20);
        const bounds = await page.locator('[data-killer-power-addons]').evaluate(node => {
          const elements = [...node.querySelectorAll('.stock-grid, [data-killer-addon-card], button, input')];
          return elements.map(element => {
            const { x, width, height } = element.getBoundingClientRect();
            return { tag: element.tagName, x, width, height };
          });
        });
        for (const box of bounds) {
          assert.ok(box.x >= 0 && box.x + box.width <= width, `Killer content stays inside ${width}: ${JSON.stringify(box)}`);
          if (box.tag === 'BUTTON' || box.tag === 'INPUT') {
            assert.ok(box.width >= 44 && box.height >= 44, `44px action/quantity target at ${width}: ${JSON.stringify(box)}`);
          }
        }
      }
    }
  } finally { await page.setViewportSize(viewport); }
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
  assert.equal(await page.locator('[data-killer-quantity]').count(), 20);
  for (const delta of [-1, 1, 5, 10]) assert.equal(await step(first.id, delta).count(), 1,
    'Killer quantity controls include step ' + delta);
  const rarityOrderControl = page.locator('#addon-rarity-order');
  const firstRarityField = page.locator('[data-killer-addon-card]').first().locator('[data-killer-quantity]');
  const firstRarityId = await firstRarityField.getAttribute('data-killer-quantity');
  await rarityOrderControl.focus();
  await rarityOrderControl.press('Tab');
  assert.equal(await firstRarityField.evaluate(node => document.activeElement === node), true,
    'Tab can move from rarity order to the first Add-on quantity');
  assert.equal(await firstRarityField.inputValue(), '', 'Focusing zero clears its visible text');
  await firstRarityField.fill('14');
  await firstRarityField.press('Enter');
  assert.equal(await quantity(firstRarityId), 14, 'Typing after the zero is cleared saves a number');
  await firstRarityField.focus();
  assert.equal(await firstRarityField.inputValue(), '14', 'Focusing a nonzero quantity preserves it');
  await firstRarityField.fill('0');
  await firstRarityField.press('Enter');
  assert.equal(await quantity(firstRarityId), undefined, 'Returning to zero keeps sparse numeric inventory');
  await firstRarityField.press('Tab');
  await page.keyboard.press('Tab');
  await page.waitForFunction(id => document.querySelector('[data-killer-quantity="' + id + '"]').value === '0', firstRarityId);
  assert.equal(await quantity(firstRarityId), undefined, 'Leaving a zero field blank restores zero without a save entry');
  assert.deepEqual(await page.locator('[data-killer-quantity]').evaluateAll(nodes => nodes.map(node => node.value)), Array(20).fill('0'));
  const sourceOrder = await page.locator('[data-killer-addon-card]').evaluateAll(nodes => nodes.map(node => node.dataset.addonId));
  await step(first.id, 1).click();
  assert.equal(await quantity(first.id), 1, 'Increment persists to the selected Killer Add-on map');
  assert.equal(await field(first.id).evaluate(node => document.activeElement === node), true);
  assert.equal(await step(first.id, -1).isDisabled(), false);
  await step(first.id, -1).click();
  assert.equal(await quantity(first.id), undefined, 'Zero omits the persisted key');
  assert.equal(await step(first.id, -1).isDisabled(), true);
  await step(first.id, 5).click();
  assert.equal(await quantity(first.id), 5, '+5 commits to the selected Killer Add-on');
  await step(first.id, 10).click();
  assert.equal(await quantity(first.id), 15, '+10 accumulates on the selected Killer Add-on');
  await step(first.id, -1).click();
  assert.equal(await quantity(first.id), 14, 'Decrement remains a single unit after quick increments');
  await field(first.id).fill('0');
  await field(first.id).press('Enter');
  assert.equal(await quantity(first.id), undefined, 'Quick quantity controls preserve sparse zero values');
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
    assert.equal(await reader.locator('[data-killer-stock-step]:disabled').count(), 80);
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
    await field(first.id).fill('12');
    await field(first.id).press('Enter');
    assert.equal(await bytes(), beforeLoss, 'Losing writer ownership cannot commit pending input');
    assert.equal(await field(first.id).inputValue(), '12', 'Writer loss retains text entered after revocation');
    assert.match(await page.locator('#killer-stock-error-' + first.id).textContent(), /Not saved.*Read-only/);
    assert.equal(await field(first.id).isDisabled(), true);
    await page.getByRole('button', {name:'Enable editing',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#save-status').textContent === 'Saved locally');
    assert.equal(await field(first.id).inputValue(), '12');
    await field(first.id).press('Enter');
    assert.equal(await quantity(first.id), 12, 'Retained input can be retried after acquiring writer ownership');
  } finally { await reader.close(); }
}

export async function killerRarityNavigationRegression(page, origin) {
  const shape = killerRuntime.killers.find(killer => killer.characterId === 'the-shape');
  const shapeAddons = shape.addons;
  const route = origin + '/#character/the-shape/power-addons';
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), freshSave());
  await page.goto(route);
  const rarityOrder = ['Ultra Rare', 'Very Rare', 'Rare', 'Uncommon', 'Common'];
  const expectedIds = order => [...order.flatMap(rarity => shapeAddons
    .filter(addon => addon.rarity === rarity).map(addon => addon.id)), ...shapeAddons
    .filter(addon => !rarityOrder.includes(addon.rarity)).map(addon => addon.id)];
  const cards = page.locator('[data-killer-addon-card]');
  assert.equal(await page.locator('[data-killer-addon-card]').count(), 20);
  assert.equal(await page.locator('[data-killer-rarity-section], [data-addon-rarity-section], [data-addon-rarity-toggle]').count(), 0,
    'Killer Add-ons render as one flat list without rarity groups or collapse controls');
  assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(card => card.dataset.addonId)), expectedIds(rarityOrder),
    'Highest → Lowest keeps source order among Add-ons with equal rarity');
  const dataRarities = await page.locator('[data-killer-addon-card]').evaluateAll(nodes =>
    Object.fromEntries(nodes.map(node => [node.dataset.addonId, node.dataset.rarity])));
  for (const addon of shapeAddons) assert.equal(dataRarities[addon.id], addon.rarity, addon.name + ' uses normalized rarity');
  for (const [id, name, artworkPath] of [
    ['killer-addon-shape-jewellery', 'Jewelry', 'images/Powers and Add-ons/Shape/With Background/Jewelry.png'],
    ['killer-addon-shape-jewellery-box', 'Jewelry Box', 'images/Powers and Add-ons/Shape/With Background/Jewelry Box.png'],
  ]) {
    const card = page.locator('[data-killer-addon-card][data-addon-id="' + id + '"]');
    assert.equal(await card.locator('.stock-card-title').textContent(), name);
    assert.equal(decodeURIComponent(await card.locator('img').getAttribute('src')), artworkPath);
  }

  const controls = page.locator('#addon-rarity-order');
  assert.equal(await controls.inputValue(), 'highest-to-lowest');
  const bytes = () => page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  const field = id => page.locator('[data-killer-quantity="' + id + '"]');
  await field('killer-addon-shape-jewellery').fill('14');
  await field('killer-addon-shape-jewellery').press('Enter');
  const saved = await bytes();
  await controls.selectOption('lowest-to-highest');
  assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(card => card.dataset.addonId)), expectedIds([...rarityOrder].reverse()),
    'Lowest → Highest reverses rarity order while retaining source order within each rarity');
  assert.equal(await field('killer-addon-shape-jewellery').inputValue(), '14', 'Sorting retains existing quantities');
  assert.equal(await bytes(), saved, 'Rarity sorting does not mutate inventory data');
  assert.equal(await page.getByText(/Collapse All|Expand All|Group by rarity/i).count(), 0,
    'No abandoned rarity grouping controls remain');
}
