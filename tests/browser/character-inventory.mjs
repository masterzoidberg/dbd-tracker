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
  await page.getByRole('link', { name: 'Update Inventory', exact: true }).waitFor();
  await page.goto(origin + '/#character/' + character + '/perks/update');
  assert.equal(await page.getByRole('button', { name: 'Native perks', exact: true }).count(), 1);
  assert.equal(await page.locator('[role="tablist"]').count(), 0);
  assert.equal(await page.locator('[data-action="character-inventory-all-role"]').count(), 1);
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
  assert.equal(await workspace.getByRole('link',{name:'Update Inventory',exact:true}).count(),1);

  // Normal mode is an effective inventory, not a missing-perk filter.
  assert.equal(await page.locator('#character-inventory-search').count(), 0);
  assert.match(await page.locator('.character-inventory-intro').textContent(), /\d+ perks tracked/);
  const inventoryCount = await page.locator('.character-inventory-grid .perk-card').count();
  assert.ok(inventoryCount > 0);
  assert.equal(await page.getByText('Update Inventory', { exact: true }).count(), 1);
  assert.equal(await page.locator('.character-inventory-scopes').count(), 0);

  // A normal-view card opens the focused reconciliation editor.
  await page.locator('.character-inventory-grid [data-perk="overcharge"]').click();
  await page.locator('#character-inventory-search').waitFor();
  assert.equal(new URL(page.url()).hash, '#character/the-doctor/perks/update');
  assert.equal(await page.locator('[data-character-inventory-detail] h2').textContent(), 'Overcharge');

  const allCount = await cards(page).count();
  assert.ok(allCount >= 20, 'Update starts from a relevant candidate pool');

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

  // Direct selection writes an ordinary personal record and leaves a session marker.
  await card(page, 'bitter-murmur').click();
  await page.locator('[data-character-inventory-detail] [data-action="character-inventory-set-tier"][data-perk="bitter-murmur"][data-tier="3"]').click();
  assert.equal((await stored(page)).characters[character].perks['bitter-murmur'], 3);
  assert.equal(await page.locator('.changed-this-update').count(), 1);
  assert.match(await page.locator('.character-inventory-session-status').textContent(), /1 changes saved this session/);
  await page.locator('[data-character-inventory-detail] [data-action="character-inventory-set-tier"][data-perk="bitter-murmur"][data-tier="none"]').click();
  assert.equal(Object.hasOwn((await stored(page)).characters[character].perks, 'bitter-murmur'), false);
  assert.equal(await card(page, 'bitter-murmur').evaluate(node => node.classList.contains('perk-tier-none')), true, await card(page, 'bitter-murmur').getAttribute('class'));

  // Automatic floors protect direct correction without inventing a personal record.
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await card(page, 'shadowborn').click();
  assert.equal(await page.locator('[data-character-inventory-detail] [data-action="character-inventory-set-tier"][data-perk="shadowborn"][data-tier="1"]').isDisabled(), true);
  await page.locator('[data-character-inventory-detail] [data-action="character-inventory-set-tier"][data-perk="shadowborn"][data-tier="3"]').click();
  await page.locator('[data-character-inventory-detail] [data-action="character-inventory-set-tier"][data-perk="shadowborn"][data-tier="none"]').click();
  const afterFloorClear = await stored(page);
  assert.equal(afterFloorClear.characters[character].perks.shadowborn, undefined);
  assert.equal(await card(page, 'shadowborn').evaluate(node => node.classList.contains('perk-tier-2')), true);
  assert.match(await page.locator('.character-inventory-session-status').textContent(), /2 changes saved this session/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')).changedPerkIds), undefined, 'Session markers are not persisted');

  // Leaving Update clears visual breadcrumbs while ordinary records remain saved.
  await page.goto(origin + '/#manage/' + character);
  await page.locator('.character-inventory-grid').waitFor();
  assert.equal(await page.locator('.changed-this-update').count(), 0);
  assert.equal(await page.locator('.character-inventory-grid [data-perk="bitter-murmur"]').count(), 0);
  await page.goto(origin + '/#manage/' + character + '/update');
  await page.locator('#character-inventory-search').waitFor();
  assert.equal(await page.locator('.changed-this-update').count(), 0);
  await page.locator('#character-inventory-only-unrecorded').check();
  assert.equal(await card(page, 'bitter-murmur').count(), 1, 'Cleared General records remain candidate-visible as unrecorded');

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
  await page.locator('.character-card').filter({ hasText: 'Kate Denson' }).getByRole('link', { name: /Open workspace/ }).click();
  assert.equal(new URL(page.url()).hash, '#character/kate-denson/overview');
  await page.goto(origin + '/#killers');
  await page.getByPlaceholder('Search characters…').fill('Doctor');
  await page.locator('.character-card').filter({ hasText: 'The Doctor' }).getByRole('link', { name: /Open workspace/ }).click();
  assert.equal(new URL(page.url()).hash, '#character/the-doctor/overview');

  // Account Shrine unlocks continue to flow through globalTier into canonical Update candidates.
  await page.goto(origin + '/#killer-perks');
  await page.locator('[data-action="perk"][data-id="hex-ruin"]').first().click();
  await page.locator('[data-action="account-unlock-tier"][data-field="shrine"][data-tier="1"]').click();
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.goto(origin + '/#manage/the-doctor/update');
  await page.locator('#character-inventory-search').waitFor();
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
    assert.equal(await page.locator('.character-inventory-editor').count(), 1, 'Selected editor remains present at every card size');
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
  assert.equal(new URL(page.url()).hash, '#experiment/the-doctor/update');

  // Survivor canonical routes use the same production renderer and remain role-scoped.
  await page.goto(origin + '/#manage/kate-denson');
  await page.locator('.character-inventory-grid').waitFor();
  assert.ok(await page.locator('.character-inventory-grid .perk-card').count() > 0);
  await page.getByRole('link', { name: 'Update Inventory', exact: true }).click();
  await page.locator('#character-inventory-search').waitFor();
  assert.equal(new URL(page.url()).hash, '#character/kate-denson/perks/update');
  assert.ok(await cards(page).count() > 0);

  // Mobile keeps the approved two-column/shared-editor geometry and hides only the desktop preference control.
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.character-inventory-card-size-control').count(), 1);
  assert.equal(await page.locator('.character-inventory-card-size-control').isVisible(), false);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const mobileCards = await page.locator('.character-inventory-card-grid .perk-card').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right };
  }));
  assert.ok(new Set(mobileCards.map(card => card.left)).size >= 2, 'Mobile Update remains two columns');
  assert.ok(mobileCards.every(card => card.left >= 0 && card.right <= 390));
  assert.equal(await page.locator('.character-inventory-layout').evaluate(node => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length), 1, 'Mobile editor stacks full-width');
  assert.equal(await page.locator('.character-inventory-editor').evaluate(node => getComputedStyle(node).order), '-1');
  await page.goto(origin + '/#manage/the-doctor');
  await page.locator('.character-inventory-grid').waitFor();
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
    assert.match(await page.locator('.character-inventory-session-status').textContent(), /0 changes saved this session.*Saved automatically/);
    assert.equal(await page.getByRole('button', { name: /^(Save|Confirm)( changes)?$/i }).count(), 0);
    for (const [tier, color, gradient] of [
      ['1', 'rgb(180, 205, 167)', '#3e8630'],
      ['2', 'rgb(173, 201, 237)', '#335682'],
      ['3', 'rgb(169, 137, 214)', '#6b337d'],
      ['none', 'rgb(89, 96, 103)', '#3b3f43'],
    ]) {
      await card(page, perk).click();
      assert.equal(await picker.count(), 1);
      assert.deepEqual(await picker.locator('button').allTextContents(), ['Not recorded', 'I', 'II', 'III']);
      const anchor = await card(page, perk).boundingBox();
      const popover = await picker.boundingBox();
      assert.equal(popover.x, anchor.x);
      assert.equal(popover.width, anchor.width);
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
      assert.match(await page.locator('[data-character-inventory-detail]').textContent(), tier === 'none' ? /Not recorded/ : new RegExp(`Tier ${['','I','II','III'][Number(tier)]}`));
      await page.screenshot({ path: `${process.env.TEMP}/dbd-${id}-${tier}.png`, fullPage: false });
    }
    await card(page, perk).click();
    await choice('none').click();
    assert.match(await page.locator('.character-inventory-session-status').textContent(), /1 changes saved this session/);
    await card(page, perk).focus();
    await page.keyboard.press('Enter');
    assert.equal(await picker.count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await picker.count(), 0);
    assert.equal(await card(page, perk).evaluate(node => node === document.activeElement), true);
    await card(page, perk).click();
    await page.locator('h1').click();
    assert.equal(await picker.count(), 0);
    await card(page, perk).click();
    await card(page, floorPerk).click();
    assert.match(await picker.getAttribute('aria-label'), /Quick tier picker/);
    assert.equal(await choice('1').isDisabled(), true);
    // Exercise domain validation even if UI disabling is bypassed.
    const beforeRejected = (await stored(page)).characters[id].perks[floorPerk];
    const beforeCount = await page.locator('.character-inventory-session-status').textContent();
    await choice('1').evaluate(node => { node.disabled = false; });
    await choice('1').click();
    assert.equal((await stored(page)).characters[id].perks[floorPerk], beforeRejected);
    assert.equal(await page.locator('.character-inventory-session-status').textContent(), beforeCount);
    assert.equal(await picker.count(), 1, 'Rejected edits leave the picker available');
    assert.match(await page.locator('#message').textContent(), /automatic minimum/);
    await choice('3').click();
    await card(page, floorPerk).click();
    await choice('none').click();
    assert.equal((await stored(page)).characters[id].perks[floorPerk], undefined);
    assert.equal(await card(page, floorPerk).evaluate(node => node.classList.contains('perk-tier-2')), true);
    await card(page, historical).click();
    assert.equal(await picker.count(), 0);
    await page.locator('[data-character-inventory-historical]').selectOption('2');
    assert.equal((await stored(page)).characters[id].perks[historical], 2);
    await page.waitForFunction(() => document.querySelector('[data-character-inventory-historical]')?.value === '2');
    assert.equal(await page.locator('[data-character-inventory-historical] option[value="1"]').evaluate(node => node.disabled), true);
    await card(page, perk).click();
    await choice('3').click();
    await page.reload();
    await page.locator('#character-inventory-search').waitFor();
    assert.equal((await stored(page)).characters[id].perks[perk], 3);
    assert.equal(await page.locator('.changed-this-update').count(), 0);
    assert.match(await page.locator('.character-inventory-session-status').textContent(), /0 changes saved this session/);
    assert.equal(await picker.count(), 0);
    assert.equal(await cards(page).count(), count);
    await card(page, perk).click();
    await choice('3').click();
    assert.match(await page.locator('.character-inventory-session-status').textContent(), /0 changes saved this session/);
    assert.equal(await page.locator('.changed-this-update').count(), 0);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await card(page, perk).click();
      assert.equal(await picker.isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const geometry = await picker.boundingBox();
      assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= width);
      assert.equal(await page.locator('.character-inventory-card-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 2);
      assert.equal(await page.locator('.character-inventory-layout').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 1);
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  try {
    const result = await smokeStage(resolve(process.argv[2] || 'release/runtime'), {
      channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge',
      regression: characterInventoryRegression,
    });
    console.log({ localhost: result.localhost, browser: result.browser, checks: 'canonical character inventory and Update Inventory workflow' });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
