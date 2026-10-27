// Canonical and compatibility character-inventory browser smoke.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';
import { characterById } from '../../data/catalog.js';

const character = 'the-doctor';
const native = characterById[character].nativePerkIds;

const fixture = freshSave();
Object.assign(fixture.characters[character], { owned: true, setupComplete: true });
fixture.characters[character].perks[native[1]] = 2;
fixture.characters[character].perks['bitter-murmur'] = 2;
fixture.characters['the-wraith'].prestige = 2;
fixture.perkOverrides.overcharge = { shrineTier: 1 };
fixture.characters[character].perks.surge = 1;
Object.assign(fixture.characters['ash-williams'], { owned: true, setupComplete: true, prestige: 1 });
fixture.characters['claudette-morel'].prestige = 2;
fixture.characters['meg-thomas'].prestige = 3;
fixture.characters['ash-williams'].perks.camaraderie = 1;

async function seed(page, origin) {
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.goto(origin + '/#manage/' + character);
  await page.reload();
  await page.locator('#character-inventory-search').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Native perks', exact: true }).count(), 1);
  assert.equal(await page.locator('[role="tablist"]').count(), 0);
  assert.equal(await page.locator('[data-action="character-inventory-all-role"]').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Update Inventory', exact: true }).count(), 0);
  await page.goto(origin + '/#character/' + character + '/perks/update');
  await page.waitForFunction(() => location.hash === '#character/the-doctor/perks');
  assert.equal(new URL(page.url()).hash, '#character/the-doctor/perks', 'Old Update bookmarks normalize to ordinary Perks');
  await page.goto(origin + '/#manage/' + character);
}

const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')));
const cards = page => page.locator('.character-inventory-card-grid .perk-card');
const card = (page, id) => page.locator(`.perk-card[data-perk="${id}"]`);

export async function characterInventoryRegression(page, origin) {
  await seed(page, origin);

  const workspace=page.locator('[data-character-workspace]');
  assert.equal(await workspace.locator('[data-character-header]').count(),1);
  assert.equal(await workspace.locator('h1').count(),1,'Shared identity supplies the only h1');
  assert.equal(await workspace.locator('.character-portrait').count(),1,'Perks cannot repeat the character portrait');
  assert.equal(await workspace.getByRole('heading',{name:'Perks',exact:true}).count(),1,'Normal Perks has a simple section heading');
  assert.equal(await workspace.locator('.character-inventory-update-action').count(),0);

  // The Perks workspace is directly editable; opening a picker stays read-only.
  assert.equal(await page.locator('#character-inventory-search').count(), 1);
  assert.equal(await page.locator('.character-inventory-scopes').count(), 1);
  assert.equal(await page.locator('[data-character-inventory-toolbar="perks"]').count(), 1);
  const inventoryCount = await page.locator('.character-inventory-card-grid .perk-card').count();
  assert.ok(inventoryCount > 0);
  assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 0);
  const beforeBrowse = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await page.locator('#character-inventory-sort').selectOption('tier');
  const displayedTierRanks = await page.locator('.character-inventory-card-grid .perk-card-tier').evaluateAll(nodes =>
    nodes.map(node => ({ '—': 0, I: 1, II: 2, III: 3 }[node.textContent.trim()])));
  assert.deepEqual(displayedTierRanks, [...displayedTierRanks].sort((a, b) => b - a), 'The tier sort affects the rendered Browse order');
  await page.locator('#character-inventory-sort').selectOption('name');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), beforeBrowse, 'Search and sort remain read-only');

  // A card opens its compact record editor without writing.
  await page.locator('.character-inventory-card-grid [data-perk="overcharge"]').click();
  assert.equal(new URL(page.url()).hash, '#manage/the-doctor');
  const compactPicker = page.locator('.character-inventory-quick-picker');
  assert.equal(await compactPicker.locator('strong').textContent(), 'Overcharge');
  assert.deepEqual(await compactPicker.locator('dt').allTextContents(), ['Recorded', 'Automatic minimum', 'Effective']);
  assert.equal(await page.locator('[data-character-inventory-reference], .character-inventory-editor').count(), 0,
    'Perk activation never creates a persistent reference panel');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), beforeBrowse, 'Opening a picker does not mutate account data');
  await compactPicker.locator('[data-action="character-inventory-details"]').click();
  assert.equal(await page.locator('#detail[open]').count(), 1, 'Full reference is opened only through Details');
  await page.locator('#detail [data-action="close"]').click();
  await page.keyboard.press('Escape');

  const allCount = await cards(page).count();
  assert.ok(allCount >= 20, 'The Perks page starts from a relevant candidate pool');

  // Category precedence is visible and deduplicated: native-plus-Shrine is one Personal card.
  await page.getByRole('button', { name: 'Native perks', exact: true }).click();
  assert.equal(await cards(page).count(), 3);
  assert.equal(await card(page, 'overcharge').count(), 1);
  assert.match(await card(page, 'overcharge').textContent(), /Native perks/);
  assert.match(await card(page, 'overcharge').textContent(), /Shrine/);

  await page.getByRole('button', { name: 'General', exact: true }).click();
  const generalCount = await cards(page).count();
  assert.ok(generalCount > 0);
  assert.equal(await card(page, 'monitor-abuse').count(), 0, 'Native perks do not duplicate into General');
  await page.locator('#character-inventory-only-unrecorded').check();
  assert.ok((await cards(page).count()) < generalCount);
  assert.equal(await card(page, 'bitter-murmur').count(), 0, 'Only unrecorded uses effective tier zero');
  await page.locator('#character-inventory-only-unrecorded').uncheck();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  const normalCandidateCount = await cards(page).count();
  await page.locator('[data-action="character-inventory-all-role"]').click();
  assert.ok((await cards(page).count()) > normalCandidateCount, 'All-role expands the same-role special acquisition scope');
  await page.locator('[data-action="character-inventory-all-role"]').click();
  assert.equal(await cards(page).count(), normalCandidateCount, 'All-role can return to the normal candidate scope');

  // Direct selection writes one ordinary personal record.
  await card(page, 'bitter-murmur').click();
  await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="bitter-murmur"][data-tier="3"]').click();
  assert.equal((await stored(page)).characters[character].perks['bitter-murmur'], 3);
  assert.equal(await page.locator('.changed-this-update').count(), 0);
  await card(page, 'bitter-murmur').click();
  await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="bitter-murmur"][data-tier="none"]').click();
  assert.equal(Object.hasOwn((await stored(page)).characters[character].perks, 'bitter-murmur'), false);
  assert.equal(await card(page, 'bitter-murmur').evaluate(node => node.classList.contains('perk-tier-none')), true, await card(page, 'bitter-murmur').getAttribute('class'));

  // Automatic floors protect direct correction without inventing a personal record.
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await card(page, 'shadowborn').click();
  assert.equal(await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="shadowborn"][data-tier="1"]').isDisabled(), true);
  await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="shadowborn"][data-tier="3"]').click();
  await card(page, 'shadowborn').click();
  await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="shadowborn"][data-tier="none"]').click();
  const afterFloorClear = await stored(page);
  assert.equal(afterFloorClear.characters[character].perks.shadowborn, undefined);
  assert.equal(await card(page, 'shadowborn').evaluate(node => node.classList.contains('perk-tier-2')), true);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')).changedPerkIds), undefined, 'Session markers are not persisted');

  // A failed one-perk write keeps its intent local until it is retried or discarded.
  const beforeFailedWrite = await stored(page);
  await page.evaluate(() => {
    window.inventoryOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'dbdTrackerData') throw Error('Synthetic inventory write failure');
      return window.inventoryOriginalSetItem.call(this, key, value);
    };
  });
  await card(page, 'monitor-abuse').click();
  await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="monitor-abuse"][data-tier="3"]').click();
  assert.deepEqual(await stored(page), beforeFailedWrite, 'A failed selection leaves canonical data unchanged');
  assert.equal(await page.locator('[data-character-inventory-failed-selection]').count(), 1);
  assert.match(await page.locator('[data-character-inventory-failed-selection]').textContent(), /Not saved/);
  await page.evaluate(() => { Storage.prototype.setItem = window.inventoryOriginalSetItem; delete window.inventoryOriginalSetItem; });
  await page.getByRole('button', { name: 'Retry failed selection', exact: true }).click();
  assert.equal((await stored(page)).characters[character].perks['monitor-abuse'], 3);
  const unchangedTimestamp = (await stored(page)).characters[character].updatedAt;
  await card(page, 'monitor-abuse').click();
  await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="monitor-abuse"][data-tier="3"]').click();
  assert.equal((await stored(page)).characters[character].updatedAt, unchangedTimestamp, 'Repeating a saved tier is a no-op');

  // A failed intent blocks Perks navigation until the user retries, stays, or discards it.
  await page.evaluate(() => {
    window.inventoryOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'dbdTrackerData') throw Error('Synthetic inventory write failure');
      return window.inventoryOriginalSetItem.call(this, key, value);
    };
  });
  const perksRoute = new URL(page.url()).hash;
  await card(page, 'bitter-murmur').click();
  await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="bitter-murmur"][data-tier="2"]').click();
  await page.locator('[data-workspace-section="overview"]').click();
  assert.equal(await page.locator('#dirty-navigation').isVisible(), true);
  assert.equal(await page.locator('#dirty-navigation [value="retry"]').textContent(), 'Retry');
  assert.equal(await page.locator('#dirty-navigation [value="discard"]').textContent(), 'Discard failed selection');
  assert.equal(await page.locator('#dirty-navigation [value="stay"]').textContent(), 'Stay');
  await page.locator('#dirty-navigation [value="stay"]').click();
  assert.equal(new URL(page.url()).hash, perksRoute, 'Stay keeps the source Perks route');
  assert.equal(await page.locator('[data-workspace-section="overview"]').evaluate(node => node === document.activeElement), true,
    'Stay returns focus to the navigation link that opened the dialog');
  await page.locator('[data-workspace-section="overview"]').click();
  await page.locator('#dirty-navigation [value="discard"]').click();
  await page.waitForFunction(() => location.hash === '#character/the-doctor/overview');
  assert.equal(new URL(page.url()).hash, '#character/the-doctor/overview');
  assert.equal((await stored(page)).characters[character].perks['monitor-abuse'], 3,
    'Discarding a later failed selection preserves earlier successful records');
  assert.equal((await stored(page)).characters[character].perks['bitter-murmur'], undefined);
  await page.evaluate(() => { Storage.prototype.setItem = window.inventoryOriginalSetItem; delete window.inventoryOriginalSetItem; });

  // Returning to Perks shows the saved grid without any editing-mode breadcrumbs.
  await page.goto(origin + '/#manage/' + character);
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();
  assert.equal(await page.locator('.changed-this-update').count(), 0);
  assert.equal(await page.locator('.character-inventory-card-grid [data-perk="bitter-murmur"]').count(), 1,
    'Browse keeps relevant General perks visible even without a personal record');
  assert.equal(await page.locator('[data-character-inventory-reference]').count(), 0);
  await page.goto(origin + '/#manage/' + character + '/update');
  await page.locator('#character-inventory-search').waitFor();
  assert.equal(new URL(page.url()).hash, '#character/the-doctor/perks');
  assert.equal(await page.locator('.changed-this-update').count(), 0);
  await page.locator('#character-inventory-only-unrecorded').check();
  assert.equal(await card(page, 'bitter-murmur').count(), 1, 'Cleared General records remain candidate-visible as unrecorded');

  // Failed Update intent cannot follow the character neighbor into another record.
  await page.evaluate(() => {
    window.inventoryOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'dbdTrackerData') throw Error('Synthetic inventory write failure');
      return window.inventoryOriginalSetItem.call(this, key, value);
    };
  });
  await card(page, 'bitter-murmur').click();
  await page.locator('.character-inventory-quick-picker [data-action="character-inventory-set-tier"][data-perk="bitter-murmur"][data-tier="2"]').click();
  const nextCharacterHref = await page.locator('[data-roster-neighbor="next"]').getAttribute('href');
  assert.ok(nextCharacterHref);
  await page.locator('[data-roster-neighbor="next"]').click();
  await page.locator('#dirty-navigation [value="discard"]').click();
  await page.waitForFunction(expected => location.hash === expected, nextCharacterHref);
  assert.equal(new URL(page.url()).hash, nextCharacterHref);
  assert.equal(await page.locator('[data-character-inventory-failed-selection]').count(), 0);
  assert.equal((await stored(page)).characters[character].perks['bitter-murmur'], undefined,
    'Changing character discards only the failed source intent');
  await page.evaluate(() => { Storage.prototype.setItem = window.inventoryOriginalSetItem; delete window.inventoryOriginalSetItem; });

  // Existing manager and account-wide library controls remain on their old routes.
  await page.goto(origin + '/#manage/' + character + '/legacy');
  await page.locator('#filters-trigger').waitFor();
  assert.equal(await page.getByRole('radio', { name: 'Detailed', exact: true }).count(), 1);
  assert.equal(await page.getByRole('radio', { name: 'Compact', exact: true }).count(), 1);
  await page.goto(origin + '/#killer-perks');
  await page.locator('#filters-trigger').waitFor();
  assert.equal(await page.locator('.character-inventory-scopes').count(), 0);
  assert.equal(await page.locator('.character-inventory-card-size-control').count(), 0, 'Card sizing stays out of account-wide libraries');

  // Collection cards open Character Overview for both roles.
  await page.goto(origin + '/#survivors');
  await page.getByPlaceholder('Search characters…').fill('Kate');
  await page.locator('.character-card').filter({ hasText: 'Kate Denson' }).locator('[data-open-workspace]').click();
  assert.equal(new URL(page.url()).hash, '#character/kate-denson/overview');
  await page.goto(origin + '/#killers');
  await page.getByPlaceholder('Search characters…').fill('Doctor');
  await page.locator('.character-card').filter({ hasText: 'The Doctor' }).locator('[data-open-workspace]').click();
  assert.equal(new URL(page.url()).hash, '#character/the-doctor/overview');

  // Account Shrine unlocks continue to flow through globalTier into canonical Update candidates.
  await page.goto(origin + '/#killer-perks');
  await page.locator('[data-action="perk"][data-id="hex-ruin"]').first().click();
  await page.locator('[data-action="account-unlock-tier"][data-field="shrine"][data-tier="1"]').click();
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.goto(origin + '/#manage/the-doctor/update');
  await page.locator('#character-inventory-search').waitFor();
  assert.equal(await page.locator('#character-inventory-only-unrecorded').isChecked(), true,
    'Safe Perks filters survive workspace route changes');
  await page.locator('#character-inventory-only-unrecorded').uncheck();
  await page.getByRole('button', { name: 'Unlocked', exact: true }).click();
  assert.equal(await card(page, 'hex-ruin').count(), 1, 'Shrine unlock appears through globalTier in canonical Update');

  // Canonical desktop presets are UI-only, predictable, and shared by normal and Update views.
  await page.goto(origin + '/#manage/' + character + '/update');
  await page.locator('#character-inventory-search').waitFor();
  const grid = page.locator('.character-inventory-card-grid');
  const sizeControl = size => page.locator(`[data-action="character-inventory-card-size"][data-size="${size}"]`);
  for (const [size, minimum] of [['small', '160px'], ['medium', '190px'], ['large', '220px']]) {
    await sizeControl(size).click();
    assert.equal(await grid.getAttribute('class').then(value => value.includes(`card-size-${size}`)), true);
    assert.equal(await grid.evaluate(node => getComputedStyle(node).getPropertyValue('--character-inventory-card-min').trim()), minimum);
    assert.equal(await page.locator('.character-inventory-editor').count(), 0, 'Update has no persistent selected-perk editor at any card size');
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerUi.characterCardSize')), 'large');
  await page.reload();
  assert.equal(await sizeControl('large').getAttribute('aria-pressed'), 'true');
  await page.evaluate(() => { localStorage.setItem('dbdTrackerUi.characterCardSize', 'invalid'); localStorage.removeItem('dbdTrackerUi.experimentCardSize'); });
  await page.reload();
  assert.equal(await sizeControl('medium').getAttribute('aria-pressed'), 'true', 'Invalid permanent preference falls back to Medium');
  await page.evaluate(() => { localStorage.removeItem('dbdTrackerUi.characterCardSize'); localStorage.setItem('dbdTrackerUi.experimentCardSize', 'large'); });
  await page.reload();
  assert.equal(await sizeControl('large').getAttribute('aria-pressed'), 'true', 'Legacy preference is read during promotion');
  await sizeControl('medium').click();
  assert.equal(Object.hasOwn(await stored(page), 'characterCardSize'), false, 'Card size never enters progression JSON');
  await sizeControl('large').click();
  await page.goto(origin + '/#manage/' + character);
  assert.equal(await page.locator('[data-action="character-inventory-card-size"][data-size="large"]').getAttribute('aria-pressed'), 'true');
  await page.goto(origin + '/#experiment/' + character + '/update');
  await page.locator('#character-inventory-search').waitFor();
  assert.equal(await page.locator('[data-action="character-inventory-card-size"][data-size="large"]').getAttribute('aria-pressed'), 'true');
  assert.equal(new URL(page.url()).hash, '#character/the-doctor/perks');

  // Survivor canonical routes use the same production renderer and remain role-scoped.
  await page.goto(origin + '/#manage/kate-denson');
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();
  assert.ok(await page.locator('.character-inventory-card-grid .perk-card').count() > 0);
  await page.locator('#character-inventory-search').fill('Will to Live');
  assert.equal(await page.locator('.character-inventory-card-grid .perk-card[data-perk="decisive-strike"]').count(), 1,
    'Browse search resolves the legacy licensed alias to one canonical perk');
  await page.locator('#character-inventory-search').fill('');
  assert.equal(new URL(page.url()).hash, '#manage/kate-denson');
  assert.ok(await cards(page).count() > 0);

  // Mobile keeps the approved two-column grid and hides only the desktop preference control.
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.character-inventory-card-size-control').count(), 1);
  assert.equal(await page.locator('.character-inventory-card-size-control').isVisible(), false);
  assert.ok(await page.locator('#character-inventory-sort').evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth;
  }), 'Mobile sort control remains within the viewport');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const mobileCards = await page.locator('.character-inventory-card-grid .perk-card').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right };
  }));
  assert.ok(new Set(mobileCards.map(card => card.left)).size >= 2, 'Mobile Update remains two columns');
  assert.ok(mobileCards.every(card => card.left >= 0 && card.right <= 390));
  assert.equal(await page.locator('.character-inventory-layout').count(), 0, 'Update does not render a separate editor layout');
  assert.equal(await page.locator('.character-inventory-editor').count(), 0, 'Mobile keeps the perk grid as the dominant surface');
  await page.goto(origin + '/#manage/the-doctor');
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + '/#manage/' + character + '/update');
  await page.locator('#character-inventory-search').waitFor();
  assert.equal(await sizeControl('large').getAttribute('aria-pressed'), 'true', 'Desktop preference returns after mobile');

  // One renderer responds to narrow layouts without horizontal page overflow.
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Character inventory shell overflow at ${width}`);
    const boxes = await page.locator('.perk-card').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    }));
    assert.ok(boxes.length > 0);
    assert.ok(boxes.every(box => box.left >= 0 && box.right <= width && box.width >= 120), `Card bounds at ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await quickPickerRegression(page, origin);
  await correctionRegression(page, origin);
}

async function quickPickerRegression(page, origin) {
  const picker = page.locator('.character-inventory-quick-picker');
  const choice = tier => picker.locator(`[data-tier="${tier}"]`);
  for (const [id, perk, floorPerk, historical] of [
    ['the-doctor', 'bitter-murmur', 'shadowborn', 'surge'],
    ['ash-williams', 'dark-sense', 'self-care', 'camaraderie'],
  ]) {
    await page.goto(`${origin}/#manage/${id}/update`);
    await page.locator('#character-inventory-search').waitFor();
    const count = await cards(page).count();
    console.log(`${id}: ${count} candidates`);
    assert.ok(count >= 20);
    assert.equal(new URL(page.url()).hash, `#character/${id}/perks`, 'Old update aliases normalize to ordinary Perks');
    assert.equal(await page.locator('.character-inventory-session-status').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Update Inventory', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /^(Save|Confirm)( changes)?$/i }).count(), 0);
    for (const [tier, color, gradient] of [
      ['1', 'rgb(180, 205, 167)', '#3e8630'],
      ['2', 'rgb(173, 201, 237)', '#335682'],
      ['3', 'rgb(169, 137, 214)', '#6b337d'],
      ['none', 'rgb(89, 96, 103)', '#3b3f43'],
    ]) {
      await card(page, perk).click();
      assert.equal(await picker.count(), 1);
      assert.deepEqual(await picker.locator('[data-action="character-inventory-set-tier"]').allTextContents(), ['Not recorded', 'I', 'II', 'III']);
      const popover = await picker.boundingBox();
      assert.ok(popover.width <= 280, 'The editor stays a compact popover rather than an expanded card');
      assert.ok(popover.x >= 0 && popover.x + popover.width <= 1440);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (tier === '1') await page.screenshot({ path: `${process.env.TEMP}/dbd-${id}-desktop-picker.png` });
      await choice(tier).click();
      assert.equal(await picker.count(), 0);
      assert.equal((await stored(page)).characters[id].perks[perk], tier === 'none' ? undefined : Number(tier));
      const actual = await card(page, perk).evaluate(node => ({
        color: getComputedStyle(node).color,
        field: getComputedStyle(node.querySelector('.perk-art'), '::after').backgroundImage,
        token: getComputedStyle(node).getPropertyValue('--character-inventory-field').trim(),
        numeral: node.querySelector('.perk-card-tier').textContent,
      }));
      console.log(`${id} ${tier}: ${actual.color}; ${actual.field}`);
      assert.equal(actual.color, color);
      assert.ok(actual.token.includes(gradient));
      assert.match(actual.field, /gradient/);
      assert.equal(actual.numeral, tier === 'none' ? '—' : ['','I','II','III'][Number(tier)]);
      assert.match(await card(page, perk).getAttribute('aria-label'), tier === 'none' ? /recorded Not recorded/ : new RegExp(`recorded Tier ${['','I','II','III'][Number(tier)]}`));
      await page.screenshot({ path: `${process.env.TEMP}/dbd-${id}-${tier}.png`, fullPage: false });
    }
    await card(page, perk).click();
    await choice('none').click();
    await card(page, perk).focus();
    await page.keyboard.press('Enter');
    assert.equal(await picker.count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await picker.count(), 0);
    assert.equal(await card(page, perk).evaluate(node => node === document.activeElement), true);
    assert.equal(await card(page, perk).getAttribute('aria-pressed'), 'false', 'Closed popup clears persistent selected state');
    await card(page, perk).click();
    await page.locator('h1').click();
    assert.equal(await picker.count(), 0);
    await card(page, perk).click();
    await card(page, floorPerk).click();
    assert.match(await picker.getAttribute('aria-label'), /Set current tier for/);
    assert.equal(await choice('1').isDisabled(), true);
    // Exercise domain validation even if UI disabling is bypassed.
    const beforeRejected = (await stored(page)).characters[id].perks[floorPerk];
    await choice('1').evaluate(node => { node.disabled = false; });
    await choice('1').click();
    assert.equal((await stored(page)).characters[id].perks[floorPerk], beforeRejected);
    assert.equal(await picker.count(), 1, 'Rejected edits leave the picker available');
    assert.match(await page.locator('#message').textContent(), /automatic minimum/);
    await choice('3').click();
    await card(page, floorPerk).click();
    await choice('none').click();
    assert.equal((await stored(page)).characters[id].perks[floorPerk], undefined);
    assert.equal(await card(page, floorPerk).evaluate(node => node.classList.contains('perk-tier-2')), true);
    await card(page, historical).click();
    assert.equal(await picker.count(), 1, 'Historical ownership remains editable in its distinct compact control');
    assert.deepEqual(await page.locator('[data-character-inventory-historical] option').allTextContents(), ['Not Confirmed', 'Not Owned', 'Tier I', 'Tier II', 'Tier III']);
    await page.locator('[data-character-inventory-historical]').selectOption('2');
    assert.equal((await stored(page)).characters[id].perks[historical], 2);
    await card(page, historical).click();
    assert.equal(await page.locator('[data-character-inventory-historical] option[value="1"]').evaluate(node => node.disabled), true);
    await card(page, perk).click();
    await choice('3').click();
    await page.reload();
    await page.locator('#character-inventory-search').waitFor();
    assert.equal((await stored(page)).characters[id].perks[perk], 3);
    assert.equal(await page.locator('.changed-this-update').count(), 0);
    assert.equal(await picker.count(), 0);
    assert.equal(await cards(page).count(), count);
    await card(page, perk).click();
    await choice('3').click();
    assert.equal(await page.locator('.changed-this-update').count(), 0);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await card(page, perk).click();
      assert.equal(await picker.isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const geometry = await picker.boundingBox();
      assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= width);
      assert.equal(await page.locator('.character-inventory-card-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 2);
      assert.equal(await page.locator('.character-inventory-layout').count(), 0, 'Perks grid has no separate editor column');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await page.screenshot({ path: `${process.env.TEMP}/dbd-${id}-${width}-picker.png` });
      await choice('2').click();
      assert.equal((await stored(page)).characters[id].perks[perk], 2);
      await page.keyboard.press('Tab');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const bottomCard = cards(page).last();
      const beforeScroll = await page.evaluate(() => window.scrollY);
      await bottomCard.click();
      assert.equal(await picker.count(), 1);
      assert.equal(await picker.evaluate(node => node.classList.contains('opens-above')), true);
      const cardBox = await bottomCard.boundingBox();
      const pickerBox = await picker.boundingBox();
      assert.ok(pickerBox.y >= 0 && pickerBox.y + pickerBox.height <= cardBox.y + 1);
      assert.ok(pickerBox.x >= 0 && pickerBox.x + pickerBox.width <= width);
      assert.ok(await page.evaluate(() => window.scrollY) <= beforeScroll, 'Opening bottom-row picker does not require scrolling farther down');
      await page.screenshot({ path: `${process.env.TEMP}/dbd-${id}-${width}-bottom-picker.png` });
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.goto(`${origin}/#experiment/the-doctor/update`);
  await card(page, 'bitter-murmur').click();
  assert.equal(await picker.count(), 1);
  await page.goto(`${origin}/#manage/ash-williams/update`);
  assert.equal(await picker.count(), 0);
}

async function correctionRegression(page, origin) {
  const save = structuredClone(fixture);
  save.characters[character].perks['bitter-murmur'] = 2;
  save.characters[character].perks.shadowborn = 3;
  save.characters['ash-williams'].perks.camaraderie = 2;
  save.characters['meg-thomas'].perks.camaraderie = 0;
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.goto(`${origin}/#manage/${character}`);
  await page.reload();
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();

  await card(page, 'bitter-murmur').click();
  const reference = page.locator('.character-inventory-quick-picker');
  assert.equal(await reference.locator('[data-action="character-inventory-correction-open"]').count(), 1);
  assert.equal(await reference.locator('.character-inventory-correction').locator('[data-action="account-unlock-tier"]').count(), 0,
    'Personal correction stays separate from account-wide controls');
  await reference.locator('[data-action="character-inventory-correction-open"]').click();
  const correction = page.locator('[data-character-inventory-correction]');
  const tier = correction.locator('[data-character-inventory-correction-tier]');
  assert.equal(await reference.locator('[data-action="character-inventory-correction-open"]').getAttribute('aria-expanded'), 'true');
  assert.match(await correction.locator('.character-inventory-correction-facts dd').nth(0).textContent(), /Tier II/);
  assert.match(await correction.locator('[data-character-inventory-correction-preview]').textContent(), /Tier II/);
  await tier.selectOption('1');
  assert.match(await correction.locator('[data-character-inventory-correction-preview]').textContent(), /Tier I/);

  // An explicit correction draft must be resolved before leaving for account-wide perks.
  await page.locator('#global-nav a[href="#killer-perks"]').click();
  assert.equal(await page.locator('#dirty-navigation').isVisible(), true);
  assert.match(await page.locator('#dirty-title').textContent(), /perk correction/i);
  await page.locator('#dirty-navigation [value="stay"]').click();
  assert.equal(new URL(page.url()).hash, '#manage/the-doctor');
  await page.locator('#global-nav a[href="#killer-perks"]').click();
  assert.equal(await page.locator('#dirty-navigation [value="save"]').textContent(), 'Apply correction');
  await page.locator('#dirty-navigation [value="discard"]').click();
  await page.waitForFunction(() => location.hash === '#killer-perks');
  assert.equal((await stored(page)).characters[character].perks['bitter-murmur'], 2,
    'Discarding a pending correction leaves the saved personal record untouched');

  await page.goto(`${origin}/#manage/${character}`);
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();
  await card(page, 'bitter-murmur').click();
  await page.locator('[data-action="character-inventory-correction-open"]').click();
  const bitterCorrection = page.locator('[data-character-inventory-correction]');
  await bitterCorrection.locator('[data-character-inventory-correction-tier]').selectOption('1');
  assert.match(await bitterCorrection.locator('[data-character-inventory-correction-preview]').textContent(), /Tier I/);
  await bitterCorrection.locator('[data-action="character-inventory-correction-cancel"]').click();
  assert.equal((await stored(page)).characters[character].perks['bitter-murmur'], 2,
    'Cancel discards only the unsaved correction draft');
  await page.locator('[data-action="character-inventory-correction-open"]').click();
  const applyBitterCorrection = page.locator('[data-character-inventory-correction]');
  await applyBitterCorrection.locator('[data-character-inventory-correction-tier]').selectOption('1');
  await page.evaluate(() => {
    window.inventoryOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'dbdTrackerData') throw Error('Synthetic correction write failure');
      return window.inventoryOriginalSetItem.call(this, key, value);
    };
  });
  await applyBitterCorrection.locator('[data-action="character-inventory-correction-apply"]').click();
  assert.equal((await stored(page)).characters[character].perks['bitter-murmur'], 2,
    'A failed Apply retains the original saved record');
  assert.equal(await page.locator('[data-character-inventory-correction]').count(), 1,
    'A failed Apply retains the correction draft for retry or Cancel');
  assert.match(await page.locator('[data-character-inventory-correction-error]').textContent(), /Not saved/);
  await page.evaluate(() => { Storage.prototype.setItem = window.inventoryOriginalSetItem; delete window.inventoryOriginalSetItem; });
  await page.locator('[data-action="character-inventory-correction-apply"]').click();
  assert.equal((await stored(page)).characters[character].perks['bitter-murmur'], 1,
    'Apply correction commits a deliberate lower personal record');

  await card(page, 'shadowborn').click();
  await page.locator('[data-action="character-inventory-correction-open"]').click();
  const floorCorrection = page.locator('[data-character-inventory-correction]');
  await floorCorrection.locator('[data-character-inventory-correction-tier]').selectOption('none');
  assert.match(await floorCorrection.locator('[data-character-inventory-correction-preview]').textContent(), /Tier II/,
    'The effective preview retains the derived automatic minimum');
  await floorCorrection.locator('[data-action="character-inventory-correction-apply"]').click();
  assert.equal((await stored(page)).characters[character].perks.shadowborn, undefined,
    'Clearing a record preserves the derived automatic minimum');
  assert.equal(await card(page, 'shadowborn').evaluate(node => node.classList.contains('perk-tier-2')), true);

  await page.goto(`${origin}/#manage/ash-williams`);
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();
  await card(page, 'camaraderie').click();
  await page.locator('[data-action="character-inventory-correction-open"]').click();
  const historicalCorrection = page.locator('[data-character-inventory-correction]');
  await historicalCorrection.locator('[data-character-inventory-correction-tier]').selectOption('1');
  await historicalCorrection.locator('[data-action="character-inventory-correction-apply"]').click();
  assert.equal((await stored(page)).characters['ash-williams'].perks.camaraderie, 1,
    'Historical positive records can use the deliberate correction path');

  await page.goto(`${origin}/#manage/meg-thomas`);
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();
  await card(page, 'camaraderie').click();
  assert.equal(await page.locator('[data-action="character-inventory-correction-open"]').count(), 0,
    'Historical Not Owned zero remains on its existing acquisition path');
  assert.equal(await page.locator('[data-character-inventory-historical="camaraderie"]').inputValue(), '0');

  await page.goto(`${origin}/#manage/${character}`);
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();
  await card(page, 'bitter-murmur').click();
  await page.locator('[data-action="character-inventory-correction-open"]').click();
  const conflictedCorrection = page.locator('[data-character-inventory-correction]');
  await conflictedCorrection.locator('[data-character-inventory-correction-tier]').selectOption('2');
  await page.evaluate(() => {
    const changed = JSON.parse(localStorage.getItem('dbdTrackerData'));
    changed.characters['the-doctor'].favorite = !changed.characters['the-doctor'].favorite;
    localStorage.setItem('dbdTrackerData', JSON.stringify(changed));
    window.dispatchEvent(new StorageEvent('storage', { key: 'dbdTrackerData' }));
  });
  assert.equal(await conflictedCorrection.locator('[data-character-inventory-correction-tier]').isDisabled(), true,
    'A correction is locked after its source save changes externally');
  assert.match(await conflictedCorrection.locator('[data-character-inventory-correction-error]').textContent(), /Stored data changed/);
  await conflictedCorrection.locator('[data-action="character-inventory-correction-cancel"]').click();

  const unlockedFixture = freshSave();
  unlockedFixture.characters['the-wraith'].prestige = 2;
  unlockedFixture.characters['the-doctor'].perks['a-nurses-calling'] = 1;
  unlockedFixture.characters['the-doctor'].perks['hex-ruin'] = 1;
  unlockedFixture.perkOverrides['hex-ruin'] = { shrineTier: 2 };
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), unlockedFixture);
  await page.goto(origin + '/#character/the-doctor/perks');
  await page.reload();
  await page.locator('[data-character-inventory-toolbar="perks"]').waitFor();
  const bytesBeforeUnlocked = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await page.getByRole('button', { name: 'Unlocked', exact: true }).click();
  assert.equal(await card(page, 'shadowborn').count(), 1, 'Prestige-derived Effective Tier appears without a personal record');
  assert.equal(await card(page, 'shadowborn').locator('.perk-card-tier').textContent(), 'II');
  assert.match(await card(page, 'shadowborn').textContent(), /Prestige/, 'Prestige provenance remains visible');
  assert.equal((await stored(page)).characters['the-doctor'].perks.shadowborn, undefined);
  assert.equal(await card(page, 'monitor-abuse').count(), 1, 'native automatic Tier I is included by Unlocked');
  assert.equal(await card(page, 'monitor-abuse').locator('.perk-card-tier').textContent(), 'I');
  assert.equal(await card(page, 'a-nurses-calling').count(), 1, 'recorded Tier I is included by Unlocked');
  assert.equal(await card(page, 'hex-ruin').count(), 1, 'higher Shrine Effective Tier is included by Unlocked');
  assert.equal(await card(page, 'bitter-murmur').count(), 0, 'General availability at Effective Tier zero is excluded');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), bytesBeforeUnlocked,
    'applying Unlocked does not write automatic tiers into the portable save');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  try {
    const result = await smokeStage(resolve(process.argv[2] || 'release/runtime'), {
      channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge',
      regression: characterInventoryRegression,
    });
    console.log({ localhost: result.localhost, browser: result.browser, checks: 'canonical character Perks inventory and save safety' });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
