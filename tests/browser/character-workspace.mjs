import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { characters, perkById, perkName } from '../../data/catalog.js';
import { inventoryEntities, inventoryEntityById, killerPowerByCharacterId, survivorInventorySource } from '../../data/inventory-catalog.js';
import { freshSave } from '../../src/model.js';
import assetManifest from '../../data/asset-manifest.json' with { type: 'json' };
import { collectionPortraitPath, characterPortraitPath } from '../../src/assets.js';

const killerAddonsFor = id => Object.values(inventoryEntityById).filter(entity => entity.role === 'killer' && entity.characterId === id);

export async function characterWorkspaceRegression(page, origin) {
  await survivorOverviewRegression(page, origin);
  await killerOverviewRegression(page, origin);
  await characterRosterNavigationRegression(page,origin);
  await workspaceContextRegression(page, origin);
  await setupDraftNavigationRegression(page, origin);
  await taskDraftPerkMutationRegression(page, origin);
  await characterWorkspaceResponsive(page,origin);
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
  for (const label of ['Survivor', 'Locked', 'Favorite', 'P2', '43', 'Keep these notes', 'Native Perks']) assert.ok(text.includes(label), label);
  assert.match(text,/38 Items.*54 Add-ons/);
  assert.equal(await page.locator('[data-character-workspace] .character-workspace-edit').count(), 0, 'Overview no longer exposes the retired composite editor');
  assert.equal(await page.locator('[data-inventory-quantity]').count(), 0);
  assert.equal(await page.locator('[data-character-workspace] .character-inventory-grid').count(), 0);
  // Shared header is the only normal workspace identity block.
  const workspace = page.locator('[data-character-workspace]');
  assert.equal(await workspace.locator('[data-character-header]').count(), 1);
  assert.equal(await workspace.locator('h1').count(), 1);
  assert.equal(await workspace.locator('.character-workspace-edit').count(), 0);
  assert.equal(await workspace.locator('[data-character-progress="prestige"]').getByText('PRESTIGE',{exact:true}).count(), 1);
  assert.equal(await workspace.locator('[data-character-progress="bloodweb"]').getByText('BLOODWEB',{exact:true}).count(), 1);
  assert.equal(await workspace.locator('.character-workspace-nav').count(), 1);
  assert.equal(await workspace.locator('.character-portrait').count(), 1, 'Overview must not repeat character portrait');

  // Overview is grouped by meaning instead of a full-width panel stack.
  for (const section of ['native-perks','progress','perks','inventory','notes'])
    assert.equal(await workspace.locator('[data-overview-section="'+section+'"]').count(), 1, section);
  const nativeSection = workspace.locator('[data-overview-section="native-perks"]');
  assert.ok(await nativeSection.locator('[data-perk-icon]').count() > 0, 'Native perks reuse artwork');
  assert.match(await nativeSection.textContent(), /Recorded:/);
  const inventorySummary = await workspace.locator('[data-overview-section="inventory"]').textContent();
  assert.match(inventorySummary,/0 Item types in stock/);
  assert.match(inventorySummary,/0 Add-on types in stock/);
  assert.match(inventorySummary,/1 imported record not in current catalog/i);
  assert.doesNotMatch(inventorySummary,/No stock/i);

  await page.goto(origin + '/#character/the-doctor/overview');
  const killerPowerIdentity = page.locator('[data-overview-section="power"]');
  assert.match(await killerPowerIdentity.textContent(), /Carter's Spark/);
  const killerSummary = page.locator('[data-overview-section="inventory"]');
  const killerSummaryText = await killerSummary.textContent();
  assert.ok(killerSummaryText.includes(`${killerAddonsFor('the-doctor').length} Add-ons`));
  assert.doesNotMatch(killerSummaryText,/Power reference data is not yet available/);
  assert.equal(await killerSummary.getByRole('link',{name:'View Power & Add-ons'}).getAttribute('href'), '#character/the-doctor/power-addons');

  await page.setViewportSize({width:320,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Workspace header/Overview overflow at 320');
  assert.ok((await page.locator('.character-workspace-favorite').boundingBox()).height>=44,'Favorite remains a practical target');
  await page.setViewportSize({width:1440,height:900});
  for (const hash of ['#character/the-doctor/power-addons']) {
    await page.goto(origin + '/' + hash);
    await page.locator('[data-character-workspace]').waitFor();
    assert.equal(await page.locator('[data-killer-power-panel]').count(), 1);
    assert.equal(await page.locator('[data-killer-addon-card]').count(), killerAddonsFor('the-doctor').length);
  }
  for (const hash of ['#character/unknown/overview', '#character/meg-thomas/power-addons', '#manage/meg-thomas/extra']) {
    await page.goto(origin + '/' + hash);
    await page.getByRole('heading', { name: 'Character/section unavailable' }).waitFor();
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  await page.goto(origin + '/#character/the-doctor/overview');
  assert.equal(await page.locator('[data-workspace-section="power-addons"]').count(), 1);
  await page.goto(origin + '/#character/the-shape/overview');
  assert.equal(await page.locator('[data-character-header] img[data-character-portrait]').getAttribute('src'), collectionPortraitPath('the-shape', assetManifest),
    'Killer workspace identity uses the approved Lore portrait');
  const slasher = characters.find(character => character.name === 'The Slasher');
  assert.ok(characterPortraitPath(slasher.id, assetManifest), 'The Slasher has a legacy square portrait that must not be substituted');
  await page.goto(origin + '/#character/' + slasher.id + '/overview');
  assert.equal(await page.locator('[data-character-header] img[data-character-portrait]').count(), 0,
    'The Slasher uses a named neutral fallback instead of a square portrait');
  assert.match(await page.locator('[data-character-header] .character-portrait').textContent(), /The Slasher/);
  // Popup capability parity: normal identity and Prestige are real Overview links.
  await page.goto(origin + '/#survivors');
  await page.locator('#search').fill('Meg');
  const card = page.locator('.character-card').first();
  assert.equal(await card.locator('[data-open-workspace]').getAttribute('href'), '#character/meg-thomas/overview');
  assert.equal(await card.locator('a[href^="#character/"]').count(), 1, 'The card exposes one broad workspace link');
  await card.locator('.prestige').click();
  assert.equal(await page.locator('#detail').isVisible(), false);
  await page.locator('[data-character-workspace]').waitFor();
  assert.equal(await page.locator('[data-character-edit]').count(), 0);
  for (const task of ['progression', 'notes'])
    assert.equal(await page.locator('[data-action="character-task-start"][data-task="' + task + '"]').count(), 1,
      task + ' remains available through its focused Overview task');
  assert.equal(await page.locator('[data-action="overview-ownership-toggle"]').count(), 1);
  const notesSection = page.locator('[data-overview-section="notes"]');
  await notesSection.getByRole('button', { name: 'Edit notes', exact: true }).click();
  assert.equal(await notesSection.locator('[data-character-task="notes"]').count(), 1,
    'Notes draft is edited in its Notes section');
  await notesSection.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('[data-action="perk"]').first().click();
  assert.equal(await page.locator('#detail').isVisible(), true, 'Bounded perk dialog remains');
  assert.equal(await page.locator('#detail [data-personal-tier]').first().isDisabled(), false,
    'Writer can use personal-tier controls in the perk dialog');
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.goto(origin + '/#dashboard');
  await page.locator('[data-dashboard-section="favorites"] summary').click();
  await page.locator('[data-dashboard-character-link][href="#character/meg-thomas/overview"]').first().click();
  await page.waitForURL('**/#character/meg-thomas/overview');
  assert.equal(await page.locator('#detail').isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
}

export async function taskDraftPerkMutationRegression(page, origin) {
  const missedGuards = [];
  for (const scenario of [
    { id: 'meg-thomas', perkId: 'sprint-burst', selector: '[data-personal-tier][data-character="meg-thomas"]' },
    { id: 'the-demogorgon', perkId: 'surge', selector: '[data-historical-ownership][data-character="the-demogorgon"]' },
  ]) {
    const save = freshSave();
    await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
    await page.reload();
    await page.goto(origin + '/#character/' + scenario.id + '/overview');
    await page.locator('[data-character-workspace]').waitFor();
    await page.locator('[data-overview-section="notes"] [data-action="character-task-start"][data-task="notes"]').click();
    const note = 'Uncommitted note for ' + scenario.id;
    await page.locator('[data-character-task-field="notes"]').fill(note);
    await page.locator('[data-overview-section="native-perks"] [data-action="perk"][data-id="' + scenario.perkId + '"]').click();
    const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
    await page.locator('#detail-content ' + scenario.selector).selectOption('1');
    const guarded = await page.locator('#dirty-navigation').evaluate(dialog => dialog.open);
    if (!guarded) {
      missedGuards.push(scenario.id + '/' + scenario.perkId);
      continue;
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before,
      'Perk-dialog selection waits for the active task draft decision');
    if (scenario.id === 'meg-thomas') {
      await page.locator('#dirty-navigation [value="stay"]').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before,
        'Stay leaves the selected personal record unchanged');
      assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), note,
        'Stay retains the task draft');
      const personal = page.locator('#detail-content ' + scenario.selector);
      assert.equal(await personal.inputValue(), '0', 'Stay restores the uncommitted perk selector');
      await personal.selectOption('2');
      await page.locator('#dirty-navigation[open]').waitFor();
      await page.locator('#dirty-navigation [value="save"]').click();
      await page.waitForFunction(() => document.querySelector('#dirty-navigation')?.open === false);
      await page.waitForFunction(() => {
        const save = JSON.parse(localStorage.getItem('dbdTrackerData'));
        return save.characters['meg-thomas'].notes === 'Uncommitted note for meg-thomas'
          && save.characters['meg-thomas'].perks['sprint-burst'] === 2;
      });
    } else {
      await page.locator('#dirty-navigation [value="discard"]').click();
      await page.waitForFunction(() => {
        const save = JSON.parse(localStorage.getItem('dbdTrackerData'));
        return save.characters['the-demogorgon'].notes === '' && save.characters['the-demogorgon'].perks.surge === 1;
      });
    }
  }
  assert.deepEqual(missedGuards, [], 'Personal and historical perk-dialog changes resolve active Overview task drafts');
}
async function killerOverviewRegression(page, origin) {
  const killer = characters.find(character => character.id === 'the-doctor');
  const power = killerPowerByCharacterId[killer.id];
  const nativeId = killer.nativePerkIds[0];
  const addonCatalog = killerAddonsFor(killer.id);
  const addon = addonCatalog[0];
  const fixture = freshSave();
  fixture.characters[killer.id].inventory.addons[addon.id] = 4;
  fixture.characters[killer.id].inventory.addons['killer-addon-unknown'] = 9;
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.goto(`${origin}/#character/${killer.id}/overview`);
  await page.reload();
  const workspace = page.locator('[data-character-workspace]');
  await workspace.waitFor();

  const native = workspace.locator(`[data-overview-native-perk="${nativeId}"]`);
  assert.match(await native.textContent(), /On this Killer · Effective Tier/);
  assert.equal(await native.locator(`a[data-open-perk-update="${nativeId}"]`).count(), 1);

  const powerIdentity = workspace.locator('[data-overview-section="power"]');
  assert.equal(await powerIdentity.count(), 1, 'Killer Power identity is a first-class Overview section');
  const overviewOrder = await workspace.locator('[data-overview-section]').evaluateAll(nodes => nodes.map(node => node.dataset.overviewSection));
  assert.ok(overviewOrder.indexOf('power') < overviewOrder.indexOf('native-perks'), 'Power identity precedes native-perk details');
  assert.match(await powerIdentity.textContent(), new RegExp(power.powerName));
  assert.match(await powerIdentity.textContent(), new RegExp(power.shortSummary));
  const details = powerIdentity.getByRole('button', { name: 'Power Details', exact: true });
  assert.equal(await details.count(), 1, 'Overview exposes structured Power reference access beside its summary');

  const summary = workspace.locator('[data-overview-section="inventory"]');
  assert.match(await summary.textContent(), /1 Add-on type in stock/);
  assert.match(await summary.textContent(), /1 imported record not in current catalog/i);
  await details.click();
  assert.equal(await page.locator('#detail-title').textContent(), power.powerName);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  assert.equal(await details.evaluate(node => node === document.activeElement), true);
  await page.locator('[data-workspace-section="power-addons"]').click();
  assert.equal(await page.locator('[data-killer-addon-card]').count(), addonCatalog.length);
  assert.equal(await page.locator('[data-killer-addon-card][data-character-id="the-doctor"] [data-inventory-quantity]').count(), addonCatalog.length);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')).characters['the-doctor'].inventory.addons["killer-addon-unknown"]), 9);
}
async function survivorOverviewRegression(page, origin) {
  const survivor = characters.find(character => character.id === 'meg-thomas');
  const nativeId = survivor.nativePerkIds[0];
  const items = inventoryEntities.filter(entity => entity.role === 'survivor' && entity.map === 'items');
  const addons = inventoryEntities.filter(entity => entity.role === 'survivor' && entity.map === 'addons');
  const save = freshSave();
  Object.assign(save.characters[survivor.id], { owned: true, prestige: 2, bloodwebLevel: 43, notes: 'First note line\nSecond note line' });
  save.characters[survivor.id].perks[nativeId] = 3;
  save.characters[survivor.id].inventory.items[items[0].id] = 8;
  save.characters[survivor.id].inventory.items[items[1].id] = 1;
  save.characters[survivor.id].inventory.addons[addons[0].id] = 5;
  save.characters[survivor.id].inventory.items['survivor-item-test-unknown'] = 7;
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.goto(`${origin}/#character/${survivor.id}/overview`);
  await page.reload();
  await page.locator('[data-character-workspace]').waitFor();

  const native = page.locator(`[data-overview-native-perk="${nativeId}"]`);
  assert.equal(await native.count(), 1, 'Each native perk has a stable, character-scoped summary');
  const nativeText = await native.textContent();
  assert.match(nativeText, /On this Survivor · Effective Tier III/);
  assert.match(nativeText, /Recorded: Tier III/);
  assert.match(nativeText, /Automatic minimum: Tier II/);
  assert.match(nativeText, /Account: Tier II · Prestige/);
  assert.equal(await native.locator(`[data-open-perk-update="${nativeId}"]`).count(), 1,
    'A native perk has a direct route to update its personal record');

  const setup = page.locator('[data-overview-section="progress"]');
  assert.match(await setup.textContent(), /Initial setup incomplete/);
  assert.equal(await setup.locator('a[href$="/setup"]').count(), 1, 'Incomplete setup stays actionable for this locked character');
  const inventory = page.locator('[data-overview-section="inventory"]');
  const inventoryText = await inventory.textContent();
  assert.match(inventoryText, /38 Items/);
  assert.match(inventoryText, /54 Add-ons/);
  assert.match(inventoryText, /2 Item types in stock/,
    'Counts reflect positive known Item types, not copy quantities');
  assert.match(inventoryText, /1 Add-on type in stock/);
  assert.match(inventoryText, /1 imported record not in current catalog/i);

  const favorite = page.locator('.character-workspace-favorite');
  await favorite.click();
  assert.equal(await favorite.getAttribute('aria-pressed'), 'true');
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')))).characters[survivor.id].owned, true,
    'Favorite remains independent from ownership');
  await page.locator('[data-action="overview-ownership-toggle"]').click();
  const updated = await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')));
  assert.equal(updated.characters[survivor.id].owned, false);
  assert.equal(updated.characters[survivor.id].favorite, true);
  assert.equal(updated.characters[survivor.id].perks[nativeId], 3);
  assert.equal(updated.characters[survivor.id].inventory.items[items[0].id], 8,
    'Ownership changes preserve personal perk and stock records');
  await native.locator(`[data-open-perk-update="${nativeId}"]`).click();
  await page.waitForURL(`**/#character/${survivor.id}/perks/update`);
  assert.equal(await page.locator('[data-character-inventory-detail] h2').textContent(), perkName(save, perkById[nativeId]));
}
async function setupDraftNavigationRegression(page, origin) {
  const save = freshSave();
  const survivors = characters.filter(character => character.role === 'survivor');
  const nextSurvivor = survivors[survivors.findIndex(character => character.id === 'meg-thomas') + 1];
  Object.assign(save.characters['meg-thomas'], { owned: true, bloodwebLevel: 10 });
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.goto(origin + '/#character/meg-thomas/setup');
  await page.locator('#character-setup-bloodweb').fill('21');
  await page.locator('[data-roster-neighbor="next"]').click();
  assert.equal(await page.locator('#dirty-navigation').evaluate(dialog => dialog.open), true,
    'Leaving a changed setup draft asks whether to save, discard, or stay');
  assert.equal(await page.locator('#character-setup-bloodweb').inputValue(), '21');
  await page.locator('#dirty-navigation [value="stay"]').click();
  assert.match(page.url(), /#character\/meg-thomas\/setup$/);
  assert.equal(await page.locator('#character-setup-bloodweb').inputValue(), '21', 'Stay retains raw setup input');
  await page.locator('[data-roster-neighbor="next"]').click();
  await page.locator('#dirty-navigation [value="save"]').click();
  await page.waitForURL('**/#character/' + nextSurvivor.id + '/setup');
  const persisted = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(persisted.characters['meg-thomas'].bloodwebLevel, 21, 'Save applies the source character setup before navigating');
  assert.equal(persisted.characters['meg-thomas'].setupComplete, true);
  assert.equal(persisted.characters[nextSurvivor.id].bloodwebLevel, 1, 'Source setup values never target the destination character');

  Object.assign(save.characters['meg-thomas'], { owned: true, bloodwebLevel: 10 });
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.goto(origin + '/#character/meg-thomas/overview');
  await page.locator('[data-overview-section="progress"] a[href="#character/meg-thomas/setup"]').click();
  await page.locator('#character-setup-bloodweb').fill('12');
  await page.goBack();
  await page.locator('#dirty-navigation[open]').waitFor();
  await page.locator('#dirty-navigation [value="stay"]').click();
  assert.match(page.url(), /#character\/meg-thomas\/setup$/, 'Stay restores the source route without a history loop');
  assert.equal(await page.locator('#character-setup-bloodweb').inputValue(), '12');
  await page.goBack();
  await page.locator('#dirty-navigation[open]').waitFor();
  await page.locator('#dirty-navigation [value="discard"]').click();
  await page.waitForURL('**/#character/meg-thomas/overview');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData'))).characters['meg-thomas'].bloodwebLevel, 10,
    'Back with Discard leaves stored setup unchanged');

  Object.assign(save.characters['meg-thomas'], { owned: true, bloodwebLevel: 10 });
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.goto(origin + '/#character/meg-thomas/setup');
  await page.locator('#character-setup-bloodweb').fill('51');
  await page.locator('[data-roster-neighbor="next"]').click();
  assert.equal(await page.locator('#dirty-navigation').evaluate(dialog => dialog.open), true);
  const backupsBeforeInvalidSave = await page.evaluate(() => localStorage.getItem('dbdTrackerBackups'));
  await page.locator('#dirty-navigation [value="save"]').click();
  assert.match(page.url(), /#character\/meg-thomas\/setup$/);
  assert.equal(await page.locator('#character-setup-bloodweb').inputValue(), '51', 'Invalid setup input remains visible after failed Save');
  await page.locator('#message').filter({ hasText: /Bloodweb level must be 1–50/ }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups')), backupsBeforeInvalidSave,
    'Invalid setup input is rejected before creating a backup');
  await page.goBack();
  await page.locator('#dirty-navigation[open]').waitFor();
  await page.locator('#dirty-navigation [value="save"]').click();
  assert.match(page.url(), /#character\/meg-thomas\/setup$/, 'Back Save cannot leave setup with invalid raw input');
  assert.equal(await page.locator('#character-setup-bloodweb').inputValue(), '51');
  await page.locator('#message').filter({ hasText: /Bloodweb level must be 1–50/ }).waitFor();
  await page.locator('[data-roster-neighbor="next"]').click();
  await page.locator('#dirty-navigation [value="discard"]').click();
  await page.waitForURL('**/#character/' + nextSurvivor.id + '/setup');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData'))).characters['meg-thomas'].bloodwebLevel, 10,
    'Discard leaves persisted setup unchanged');

  Object.assign(save.characters['meg-thomas'], { owned: true, bloodwebLevel: 10 });
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();
  await page.goto(origin + '/#character/meg-thomas/setup');
  await page.locator('#character-setup-bloodweb').fill('22');
  await page.locator('[data-roster-neighbor="next"]').click();
  const peer = await page.context().newPage();
  await peer.goto(origin + '/');
  await peer.getByRole('heading', { name: 'Account overview', exact: true }).waitFor();
  const external = freshSave();
  external.characters['meg-thomas'].owned = true;
  external.characters['the-shape'].favorite = true;
  await peer.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), external);
  await page.getByText('Progress updated from another tab.').waitFor();
  await page.locator('#dirty-navigation [value="save"]').click();
  assert.match(page.url(), /#character\/meg-thomas\/setup$/);
  assert.equal(await page.locator('#character-setup-bloodweb').inputValue(), '22', 'External replacement retains the source draft');
  await page.locator('#message').filter({ hasText: /saved data changed while this confirmation was open/i }).waitFor();
  const afterExternal = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
  assert.equal(afterExternal.characters['meg-thomas'].bloodwebLevel, 1);
  assert.equal(afterExternal.characters['the-shape'].favorite, true, 'A stale setup callback cannot overwrite the replacement save');
  await peer.close();
}
export async function workspaceContextRegression(page, origin) {
  const save = freshSave();
  const survivors = characters.filter(character => character.role === 'survivor');
  const killers = characters.filter(character => character.role === 'killer');
  const family = survivorInventorySource.itemFamilies.at(-1);
  const item = inventoryEntities.find(entity => entity.role === 'survivor' && entity.map === 'items' && entity.familyId === family.id);
  const addon = inventoryEntities.find(entity => entity.role === 'survivor' && entity.map === 'addons' && entity.familyId === family.id && entity.compatibleItemIds.includes(item.id));
  const meg = characters.find(character => character.id === 'meg-thomas');
  for (const perkId of meg.nativePerkIds) save.characters['meg-thomas'].perks[perkId] = 1;
  const megIndex = survivors.findIndex(character => character.id === 'meg-thomas');
  const killerIndex = killers.findIndex(character => character.id === 'the-shape');
  save.characters['meg-thomas'].inventory.items[item.id] = 2;
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.goto(origin + '/#character/meg-thomas/items-addons');
  const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));

  await page.locator('[data-action="stock-family-select"][data-family="' + family.id + '"]').click();
  await page.locator('#inventory-item').selectOption(item.id);
  await page.locator('#inventory-search').fill(addon.name.split(' ')[0]);
  await page.locator('#inventory-in-stock').check();
  await page.locator('#inventory-filters-toggle').click();
  await page.locator('#inventory-map').selectOption('addons');
  await page.locator('#inventory-filters-toggle').click();
  await page.locator('#inventory-rarity').selectOption(addon.rarity);
  await page.locator('#addon-rarity-order').selectOption('lowest-to-highest');
  await page.locator('[data-roster-neighbor="next"]').click();
  await page.waitForURL('**/#character/' + survivors[megIndex + 1].id + '/items-addons');
  assert.equal(await page.locator('[data-action="stock-family-select"][aria-pressed="true"]').getAttribute('data-family'), family.id);
  assert.equal(await page.locator('#inventory-item').inputValue(), item.id);
  assert.equal(await page.locator('#inventory-search').inputValue(), addon.name.split(' ')[0]);
  assert.equal(await page.locator('#inventory-in-stock').isChecked(), true);
  assert.equal(await page.locator('#inventory-map').inputValue(), 'addons');
  assert.equal(await page.locator('#inventory-rarity').inputValue(), addon.rarity);
  assert.equal(await page.locator('#addon-rarity-order').inputValue(), 'lowest-to-highest');

  await page.goto(origin + '/#character/the-shape/power-addons');
  await page.locator('#addon-rarity-order').selectOption('highest-to-lowest');
  await page.locator('[data-roster-neighbor="next"]').click();
  await page.waitForURL('**/#character/' + killers[killerIndex + 1].id + '/power-addons');
  assert.equal(await page.locator('#addon-rarity-order').inputValue(), 'highest-to-lowest');
  await page.goto(origin + '/#character/' + survivors[megIndex + 1].id + '/items-addons');
  assert.equal(await page.locator('#addon-rarity-order').inputValue(), 'lowest-to-highest', 'Killer inventory context does not overwrite Survivor preferences');

  await page.goto(origin + '/#character/meg-thomas/perks/update');
  await page.locator('#character-inventory-search').fill('Kindred');
  await page.locator('[data-action="character-inventory-category"][data-category="personal"]').click();
  await page.locator('[data-roster-neighbor="next"]').click();
  await page.waitForURL('**/#character/' + survivors[megIndex + 1].id + '/perks/update');
  assert.equal(await page.locator('#character-inventory-search').inputValue(), 'Kindred', 'Safe Perks query carries across same-role neighbors');
  assert.equal(await page.locator('[data-action="character-inventory-category"][data-category="personal"]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.character-inventory-session-status').textContent(), /0 changes saved this session/, 'character-specific change count resets');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before, 'Browsing context changes do not write account data');

  await page.goto(origin + '/#character/meg-thomas/perks/update');
  await page.locator('#character-inventory-search').fill('');
  await page.locator('[data-action="character-inventory-category"][data-category="all"]').click();
  await page.goto(origin + '/#character/meg-thomas/perks');
  const selectedCard = page.locator('.character-inventory-card-grid .perk-card').last();
  const selectedPerkId = await selectedCard.getAttribute('data-perk');
  const selectedPerkName = (await selectedCard.locator('strong').textContent()).trim();
  await selectedCard.click();
  await page.locator(`[data-open-perk-update="${selectedPerkId}"]`).click();
  await page.waitForURL('**/#character/meg-thomas/perks/update');
  assert.equal(await page.locator('[data-character-inventory-detail] h2').textContent(), selectedPerkName,
    'Opening a perk carries that selection into the same character Update route');
  await page.locator('[data-roster-neighbor="next"]').click();
  await page.waitForURL('**/#character/' + survivors[megIndex + 1].id + '/perks/update');
  assert.notEqual(await page.locator('.character-inventory-card-grid .perk-card.is-selected').getAttribute('data-perk'), selectedPerkId,
    'A selected perk correction does not carry to another character');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before, 'Perk and neighbor navigation remain read-only');
}
export async function characterRosterNavigationRegression(page,origin) {
  const roster=role=>characters.filter(character=>character.role===role);
  const killers=roster('killer'), survivors=roster('survivor');
  const shapeIndex=killers.findIndex(character=>character.id==='the-shape');
  const megIndex=survivors.findIndex(character=>character.id==='meg-thomas');
  const save=freshSave();
  save.characters['the-shape'].inventory.addons['killer-addon-shape-scratched-mirror']=4;
  save.characters['meg-thomas'].inventory.addons['survivor-addon-key-blood-amber']=3;
  await page.evaluate(value=>localStorage.setItem('dbdTrackerData',JSON.stringify(value)),save);
  const bytes=()=>page.evaluate(()=>localStorage.getItem('dbdTrackerData'));
  const before=await bytes();
  const nav=()=>page.locator('[data-character-roster-navigation]');
  const neighbor=direction=>nav().locator('[data-roster-neighbor="'+direction+'"]');
  const expectPage=async(id,section,mode=null)=>{
    await page.waitForURL('**/#character/'+id+'/'+section+(mode?'/'+mode:''));
    assert.equal(await page.locator('[data-workspace-section][aria-current="page"]').getAttribute('data-workspace-section'),section);
  };

  assert.ok(shapeIndex>0&&shapeIndex<killers.length-1,'The Shape is a middle Killer in canonical roster order');
  await page.goto(origin+'/#character/the-shape/power-addons');
  assert.equal(await nav().count(),1,'Killer pages expose character navigation');
  assert.equal(await neighbor('previous').getAttribute('href'),'#character/'+killers[shapeIndex-1].id+'/power-addons');
  assert.equal(await neighbor('previous').getAttribute('aria-label'),'Previous Killer: '+killers[shapeIndex-1].name);
  assert.equal(await neighbor('next').getAttribute('href'),'#character/'+killers[shapeIndex+1].id+'/power-addons');
  assert.equal(await neighbor('next').getAttribute('aria-label'),'Next Killer: '+killers[shapeIndex+1].name);
  await neighbor('next').click();
  await expectPage(killers[shapeIndex+1].id,'power-addons');
  await page.goBack();
  await expectPage('the-shape','power-addons');
  await page.goForward();
  await expectPage(killers[shapeIndex+1].id,'power-addons');
  await page.goto(origin+'/#character/the-shape/perks/update');
  await neighbor('previous').click();
  await expectPage(killers[shapeIndex-1].id,'perks','update');
  await page.goto(origin+'/#character/'+killers[0].id+'/overview');
  assert.equal(await neighbor('previous').isDisabled(),true,'First Killer has no usable Previous link');
  assert.equal(await neighbor('previous').getAttribute('href'),null);
  await page.goto(origin+'/#character/'+killers.at(-1).id+'/overview');
  assert.equal(await neighbor('next').isDisabled(),true,'Final Killer has no usable Next link');
  assert.equal(await neighbor('next').getAttribute('href'),null);

  assert.ok(megIndex>0&&megIndex<survivors.length-1,'Meg is a middle Survivor in canonical roster order');
  await page.goto(origin+'/#character/meg-thomas/items-addons');
  assert.equal(await nav().count(),1,'Survivor pages expose character navigation');
  assert.equal(await neighbor('previous').getAttribute('href'),'#character/'+survivors[megIndex-1].id+'/items-addons');
  assert.equal(await neighbor('next').getAttribute('href'),'#character/'+survivors[megIndex+1].id+'/items-addons');
  await neighbor('next').click();
  await expectPage(survivors[megIndex+1].id,'items-addons');

  await page.goto(origin+'/#character/jake-park/overview');
  await page.locator('.character-workspace-back').click();
  await page.waitForURL('**/#survivors');
  await page.locator('#search').fill('Jill Valentine');
  const jillLink=page.locator('[data-open-workspace][href="#character/jill-valentine/overview"]');
  assert.equal(await jillLink.count(),1,'Jill Valentine is directly available from the Survivor collection');
  await jillLink.click();
  await expectPage('jill-valentine','overview');

  await page.goto(origin+'/#character/meg-thomas/perks');
  await neighbor('previous').click();
  await expectPage(survivors[megIndex-1].id,'perks');
  await page.goto(origin+'/#character/'+survivors[0].id+'/overview');
  assert.equal(await neighbor('previous').isDisabled(),true,'First Survivor has no usable Previous link');
  assert.equal(await neighbor('previous').getAttribute('href'),null);
  await page.goto(origin+'/#character/'+survivors.at(-1).id+'/overview');
  assert.equal(await neighbor('next').isDisabled(),true,'Final Survivor has no usable Next link');
  assert.equal(await neighbor('next').getAttribute('href'),null);

  for(const width of [320,500,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto(origin+'/#character/the-shape/power-addons');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Character navigation does not create horizontal overflow at '+width);
    const link=neighbor('previous');
    await page.locator('.character-workspace-back').focus();
    await page.keyboard.press('Tab');
    assert.equal(await link.evaluate(node=>node===document.activeElement),true,'Tab reaches Previous Killer at '+width);
    assert.ok(await link.evaluate(node=>{const style=getComputedStyle(node);return style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0;}),'Character navigation has visible keyboard focus');
  }
  await page.setViewportSize({width:1440,height:900});
  assert.equal(await bytes(),before,'Character navigation does not modify inventories or save data');
}
export async function characterWorkspaceResponsive(page,origin){
  const save=freshSave();
  Object.assign(save.characters['meg-thomas'],{owned:true,favorite:true,prestige:3,bloodwebLevel:27,notes:'Long notes '.repeat(60)});
  await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
  await page.goto(origin+'/#character/meg-thomas/overview');await page.reload();
  for(const width of [320,500,760,1100,1440,1600]){
    await page.setViewportSize({width,height:900});
    const edges=[];
    for(const section of ['overview','perks','items-addons']){
      await page.goto(origin+'/#character/meg-thomas/'+section);
      await page.locator('[data-workspace-section="'+section+'"][aria-current="page"]').waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Workspace overflow '+width+'/'+section);
      const header=page.locator('[data-character-header]');
      assert.equal(await header.count(),1);assert.equal(await page.locator('[data-character-workspace] h1').count(),1);
      assert.equal(await page.locator('[data-character-workspace] .character-portrait').count(),1);
      assert.equal(await header.locator('[data-character-progress]').count(),2);
      assert.ok(await header.locator('.character-portrait').isVisible());
      assert.ok((await header.locator('.character-workspace-favorite').boundingBox()).height>=44);
      assert.equal(await header.evaluate(n=>{
        const progress=n.querySelector('.character-workspace-progress'), nav=n.querySelector('.character-workspace-nav');
        return Boolean(progress.compareDocumentPosition(nav)&Node.DOCUMENT_POSITION_FOLLOWING);
      }),true,'Progress precedes workspace navigation in logical DOM order');
      const bounds=await header.boundingBox();edges.push([bounds.x,bounds.width]);
      const levels=await page.locator('[data-character-workspace] :is(h1,h2,h3,h4,h5,h6)').evaluateAll(nodes=>nodes.map(n=>Number(n.tagName.slice(1))));
      for(let i=1;i<levels.length;i++)assert.ok(levels[i]<=levels[i-1]+1,'No skipped heading levels '+section);
      const navigation=header.locator('[data-workspace-section="'+section+'"]');await navigation.focus();
      assert.ok(await navigation.evaluate(n=>{const s=getComputedStyle(n);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;}),'Visible navigation focus');
      if(section==='overview'){
        assert.deepEqual(await page.locator('[data-overview-section]').evaluateAll(nodes=>nodes.map(n=>n.dataset.overviewSection)),['native-perks','progress','perks','inventory','notes']);
      }
      if(section==='items-addons'){
        assert.equal(await page.getByRole('navigation',{name:'Item families'}).locator('[aria-pressed="true"]').count(),1);
        const field=page.locator('[data-inventory-quantity]').first();
        assert.match(await field.getAttribute('aria-describedby'),/^stock-error-/);
        const plus=page.locator('[data-stock-step][data-delta="1"]').first();
        assert.match(await plus.getAttribute('aria-label'),/^Increase quantity of /);
        if(width<=500)assert.ok(await page.locator('.stock-family-nav').evaluate(n=>n.scrollWidth>n.clientWidth));
      }
    }
    assert.deepEqual(edges[0],edges[1],'Shared edges Overview/Perks '+width);assert.deepEqual(edges[1],edges[2],'Shared edges Perks/Inventory '+width);
  }
  await page.setViewportSize({width:1440,height:900});
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  await smokeStage(resolve(process.argv[2] || 'release/runtime'), { regression: characterWorkspaceRegression });
  console.log('Character workspace regression PASS');
}
