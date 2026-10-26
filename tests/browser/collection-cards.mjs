import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { characters, characterById, perkById, perkName } from '../../data/catalog.js';
import { inventoryEntityById } from '../../data/inventory-catalog.js';
import { freshSave, rolePerks } from '../../src/model.js';
import { generateAssetManifest } from '../../scripts/generate-assets.mjs';

const project = resolve(import.meta.dirname, '../..');

function collectionFixture() {
  const save = freshSave();
  Object.assign(save.characters['ace-visconti'], {
    owned: true, favorite: true, prestige: 1, bloodwebLevel: 3, updatedAt: '2026-10-01T00:00:00.000Z',
  });
  Object.assign(save.characters['adam-francis'], {
    owned: true, favorite: false, prestige: 2, bloodwebLevel: 22, updatedAt: '2026-10-02T00:00:00.000Z',
  });
  Object.assign(save.characters['aestri-yazar'], {
    owned: true, favorite: true, prestige: 3, bloodwebLevel: 50, updatedAt: '2026-10-03T00:00:00.000Z',
  });
  Object.assign(save.characters['the-trapper'], {
    owned: true, favorite: true, prestige: 2, bloodwebLevel: 31, updatedAt: '2026-10-04T00:00:00.000Z',
  });
  save.characters['meg-thomas'].bloodwebLevel = 8;
  save.characters['alan-wake'].bloodwebLevel = 44;
  save.characters['ash-williams'].prestige = 100;
  save.characters['ash-williams'].bloodwebLevel = 50;
  const entities = Object.values(inventoryEntityById);
  const items = entities.filter(entity => entity.role === 'survivor' && entity.kind === 'survivor-item');
  const survivorAddons = entities.filter(entity => entity.role === 'survivor' && entity.kind === 'survivor-addon');
  const killerAddons = entities.filter(entity => entity.role === 'killer' && entity.kind === 'killer-addon' && entity.characterId === 'the-trapper');
  save.characters['ace-visconti'].inventory.items[items[0].id] = 20;
  save.characters['ace-visconti'].inventory.items[items[1].id] = 2;
  save.characters['ace-visconti'].inventory.addons[survivorAddons[0].id] = 8;
  save.characters['the-trapper'].inventory.addons[killerAddons[0].id] = 12;
  save.characters['the-trapper'].inventory.addons[killerAddons[1].id] = 1;
  save.characters['the-trapper'].inventory.addons[killerAddons[2].id] = 0;
  for (const perk of rolePerks('survivor').slice(0, 8)) save.characters['adam-francis'].perks[perk.id] = 1;
  return save;
}

const byCharacterId = (page, id) => page.locator(`.character-card[data-character-id="${id}"]`);

async function openCollectionFilters(page) {
  const panel = page.locator('#collection-filters');
  if (!await panel.evaluate(node => node.open)) await panel.locator('summary').click();
}

async function sixResultToolbarRegression(page, origin, fixture) {
  for (const role of ['survivor', 'killer']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + '/#' + role + 's');
    await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
    await page.reload();

    const grid = page.locator(`.${role}-collection-grid`);
    const total = characters.filter(character => character.role === role).length;
    const orderedIds = characters.filter(character => character.role === role)
      .sort((a, b) => a.name.localeCompare(b.name)).map(character => character.id);
    const status = page.locator('#collection-page-status');
    assert.equal(await grid.locator('.character-collection-card').count(), 6, `${role} always shows six results`);
    assert.match(await status.textContent(), new RegExp(`Page 1 of ${Math.ceil(total / 6)}`));
    assert.match(await status.textContent(), new RegExp(`1–6 of ${total}`));
    assert.equal(await page.locator('#collection-page-size').count(), 0, 'There is no competing page-size selector');
    assert.equal(await page.locator('.character-collection-grid + .collection-pagination').count(), 1, 'Primary pagination follows results');

    const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
    await page.getByRole('button', { name: 'Next Page', exact: true }).click();
    assert.equal(await grid.locator('.character-collection-card').count(), 6);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'collection-results-heading', 'Page changes focus and reveal the result set');
    assert.deepEqual(await grid.locator('.character-collection-card').evaluateAll(cards => cards.map(card => card.dataset.characterId)), orderedIds.slice(6, 12));
    assert.match(await status.textContent(), /Page 2 of/);
    assert.match(await status.textContent(), new RegExp(`7–12 of ${total}`));
    await page.setViewportSize({ width: 1024, height: 768 });
    assert.match(await status.textContent(), /Page 2 of/ , 'resizing preserves the logical page');

    await page.locator('#sort').selectOption('prestige-desc');
    assert.match(await status.textContent(), new RegExp(`Page 1 of ${Math.ceil(total / 6)}`), 'sort changes reset the page safely');
    await openCollectionFilters(page);
    await page.locator('#ownership-filter').selectOption('owned');
    const ownedCount = role === 'survivor' ? 3 : 1;
    assert.equal(await grid.locator('.character-collection-card').count(), ownedCount, 'Ownership filters the full matching set before paging');
    assert.ok(await page.locator('[data-active-filter="ownership"]').isVisible(), 'active restrictions remain visible');
    assert.match(await status.textContent(), new RegExp(`Page 1 of ${Math.ceil(ownedCount / 6)}`));

    const query = role === 'survivor' ? 'Ace Visconti' : 'The Trapper';
    await page.locator('#search').fill(query);
    assert.equal(await grid.locator('.character-collection-card').count(), 1, 'search combines with ownership filters');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'search', 'search caret focus survives local rerender');
    assert.equal(await page.locator('[data-action="collection-clear-search"]').isVisible(), true, 'Clear search is a separate action');
    if (role === 'survivor') {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(project, 'test-results/survivor-collection-filtered.png'), fullPage: true });
    }
    await page.locator('[data-action="collection-reset-filters"]').click();
    assert.equal(await page.locator('#search').inputValue(), query, 'Reset filters retains search');
    assert.equal(await page.locator('#sort').inputValue(), 'prestige-desc', 'Reset filters retains sort');
    assert.equal(await grid.locator('.character-collection-card').count(), 1);
    await page.locator('[data-action="collection-clear-search"]').click();
    assert.equal(await grid.locator('.character-collection-card').count(), 6, 'Clear search is independent from filter reset');

    await page.locator('#search').fill('No Such Character');
    assert.equal(await grid.locator('.character-collection-card').count(), 0);
    assert.ok(await page.locator('.empty').isVisible(), 'zero results have an explicit empty state');
    assert.equal(await page.locator('#collection-page-next').count(), 0, 'empty results do not expose a dead pager');
    if (role === 'survivor') {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(project, 'test-results/survivor-collection-zero-results.png'), fullPage: true });
      await page.locator('#search').fill('');
      await openCollectionFilters(page);
      await page.locator('#ownership-filter').selectOption('locked');
      assert.equal(await grid.locator('.character-collection-card').count(), 6);
      assert.match(await status.textContent(), /Page 1 of 9/);
      for (let pageNumber = 1; pageNumber < 9; pageNumber++) await page.getByRole('button', { name: 'Next Page', exact: true }).click();
      assert.match(await status.textContent(), /Page 9 of 9/);
      assert.match(await status.textContent(), /49–51 of 51/);
      assert.equal(await grid.locator('.character-collection-card').count(), 3, 'the final filtered Survivor page is partial');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(project, 'test-results/survivor-collection-final-filtered-page.png'), fullPage: true });
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before, 'search, filters, sort, paging and resize do not mutate the save');
  }
}

async function rosterReturnContextRegression(page, origin, fixture) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#survivors');
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.reload();
  const saveBeforeNavigation = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));

  await page.locator('#search').fill('a');
  await openCollectionFilters(page);
  await page.locator('#ownership-filter').selectOption('locked');
  await page.locator('#sort').selectOption('recent');
  await page.getByRole('button', { name: 'Next Page', exact: true }).click();
  assert.match(await page.locator('#collection-page-status').textContent(), /Page 2 of/);

  const originLink = page.locator('.survivor-collection-card [data-open-workspace]').first();
  const originCharacterId = await originLink.getAttribute('data-id');
  await originLink.focus();
  await page.evaluate(() => window.scrollTo(0, 420));
  const rosterScrollY = await page.evaluate(() => window.scrollY);
  await originLink.evaluate(link => link.click());
  await page.waitForURL(`**/#character/${originCharacterId}/overview`);
  await page.goBack();
  await page.waitForURL('**/#survivors');

  assert.equal(await page.locator('#search').inputValue(), 'a', 'Back restores the Survivor query');
  assert.equal(await page.locator('#ownership-filter').inputValue(), 'locked', 'Back restores the Survivor ownership filter');
  assert.equal(await page.locator('#sort').inputValue(), 'recent', 'Back restores the Survivor sort');
  assert.match(await page.locator('#collection-page-status').textContent(), /Page 2 of/, 'Back restores the Survivor page');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), `#character/${originCharacterId}/overview`,
    'Back returns focus to the character workspace link that opened the workspace');
  assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - rosterScrollY) < 8, 'Back restores the roster scroll position');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), saveBeforeNavigation, 'Roster context is not written to the portable save');

  await page.locator('#global-nav a[href="#killers"]').click();
  await page.locator('#search').fill('e');
  await openCollectionFilters(page);
  await page.locator('#ownership-filter').selectOption('locked');
  await page.locator('#sort').selectOption('prestige-asc');
  await page.getByRole('button', { name: 'Next Page', exact: true }).click();
  assert.match(await page.locator('#collection-page-status').textContent(), /Page 2 of/);

  await page.locator('#global-nav a[href="#survivors"]').click();
  assert.equal(await page.locator('#search').inputValue(), 'a', 'Survivor query remains independent from Killer context');
  assert.equal(await page.locator('#ownership-filter').inputValue(), 'locked');
  assert.equal(await page.locator('#sort').inputValue(), 'recent');
  assert.match(await page.locator('#collection-page-status').textContent(), /Page 2 of/);
  await page.locator('#global-nav a[href="#killers"]').click();
  assert.equal(await page.locator('#search').inputValue(), 'e', 'Killer query returns with its own context');
  assert.equal(await page.locator('#ownership-filter').inputValue(), 'locked');
  assert.equal(await page.locator('#sort').inputValue(), 'prestige-asc');
  assert.match(await page.locator('#collection-page-status').textContent(), /Page 2 of/);
}

export async function collectionCardsRegression(page, origin, manifest) {
  manifest ??= await generateAssetManifest(project);
  const fixture = collectionFixture();
  await mkdir(resolve(project, 'test-results'), { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#survivors');
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.reload();
  await page.getByRole('heading', { name: 'Survivors', exact: true }).waitFor();

  assert.equal(await page.locator('.survivor-collection-grid').count(), 1, 'Survivors use the restored collection card grid');
  assert.equal(await page.locator('.survivor-collection-card').count(), 6, 'Survivors show the first six results');
  assert.match(await page.locator('.heading-count').textContent(), /3\s*owned\s*·\s*54 Survivors/i, 'Header separates owned count from catalog size');
  assert.match(await page.locator('#collection-results-heading').textContent(), /1–6 of 54 matching/, 'Results show the matching range separately');
  assert.equal(await page.locator('.survivor-collection-card [data-collection-summary]').count(), 0, 'Survivor cards have no inventory-stat panels');
  assert.equal(await page.locator('.survivor-collection-card .character-name').first().evaluate(node => node.tagName), 'H2', 'each card exposes its character name as a heading');
  assert.match(await byCharacterId(page, 'ash-williams').locator('.prestige').textContent(), /P100/, 'Prestige has no invented P100 cap');
  assert.equal(await byCharacterId(page, 'ash-williams').locator('.prestige').getAttribute('aria-label'), 'Prestige 100');
  assert.equal(await byCharacterId(page, 'aestri-yazar').locator('.character-name').textContent(), 'Aestri Yazar & Baermar Uraz', 'paired names remain complete');
  const ace = byCharacterId(page, 'ace-visconti');
  assert.equal(await ace.locator('a[href^="#character/"]').count(), 1, 'Each card has exactly one workspace navigation tab stop');
  const cardLink = ace.locator('[data-open-workspace]');
  assert.equal(await cardLink.evaluate(node => node.tagName), 'A', 'The broad card target is a real anchor');
  assert.equal(await cardLink.getAttribute('href'), '#character/ace-visconti/overview');
  assert.equal(await cardLink.getAttribute('target'), null, 'The native link keeps normal context-menu and new-tab behavior');
  assert.equal(await cardLink.locator('[data-action="favorite"]').count(), 0, 'Favorite is outside the navigation anchor');
  assert.equal(await ace.locator('[data-action="ownership"]').count(), 0, 'Roster ownership is display-only');
  assert.equal(await ace.locator('[data-native-perks] button').count(), 0, 'Card navigation has no nested perk controls');
  const cardRect = await ace.boundingBox(), linkRect = await cardLink.boundingBox();
  const cardContentRect = await ace.evaluate(card => {
    const rect = card.getBoundingClientRect(), style = getComputedStyle(card);
    const left = parseFloat(style.borderLeftWidth), right = parseFloat(style.borderRightWidth);
    const top = parseFloat(style.borderTopWidth), bottom = parseFloat(style.borderBottomWidth);
    return { x: rect.x + left, y: rect.y + top, width: rect.width - left - right, height: rect.height - top - bottom };
  });
  assert.ok(cardRect && linkRect && ['x', 'y', 'width', 'height'].every(key => Math.abs(cardContentRect[key] - linkRect[key]) < 1),
    `The real anchor covers the broad card content surface (${JSON.stringify({ cardRect, cardContentRect, linkRect })})`);
  const hero = ace.locator('[data-collection-hero-art]');
  assert.equal(await hero.getAttribute('src'), manifest.collectionPortraits['ace-visconti'].path);
  assert.equal(await hero.getAttribute('alt'), '');
  await hero.scrollIntoViewIfNeeded();
  await hero.evaluate(image => image.decode());
  assert.equal(await hero.evaluate(image => getComputedStyle(image).objectFit), 'contain');
  const [verticalScrim, edgeScrim] = (await hero.evaluate(image => getComputedStyle(image.parentElement, '::after').backgroundImage)).split(/,\s*(?=linear-gradient\()/);
  assert.ok(verticalScrim && edgeScrim, 'Hero artwork has a lower fade and lighter edge scrim');
  assert.match(await ace.locator('.character-name').textContent(), /Ace Visconti/);
  const aceFavorite = ace.locator('[data-action="favorite"]');
  assert.equal(await aceFavorite.getAttribute('aria-pressed'), 'true');
  assert.match(await ace.locator('[data-ownership-status]').textContent(), /Owned/i);
  assert.equal(await aceFavorite.evaluate(button => button.closest('a')), null, 'Favorite is an independent sibling control');
  const beforeFavoriteFailure = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await page.evaluate(() => {
    window.collectionOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'dbdTrackerData') throw new Error('simulated save failure');
      return window.collectionOriginalSetItem.call(this, key, value);
    };
  });
  await aceFavorite.click();
  assert.equal(await aceFavorite.getAttribute('aria-pressed'), 'true', 'Failed Favorite save does not show a successful toggle');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), beforeFavoriteFailure);
  await page.evaluate(() => { Storage.prototype.setItem = window.collectionOriginalSetItem; delete window.collectionOriginalSetItem; });

  await openCollectionFilters(page);
  await page.locator('[data-action="favorites-filter"]').click();
  await aceFavorite.click();
  assert.equal(await ace.count(), 0, 'Removing a Favorite from filtered results removes its card');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), '#character/aestri-yazar/overview',
    'Focus moves to the next result when a Favorite removes its own card');
  assert.equal(await page.evaluate(() => location.hash), '#survivors', 'Favorite activation does not navigate');
  await page.locator('[data-action="favorites-filter"]').click();
  const restoreFavorite = byCharacterId(page, 'ace-visconti').locator('[data-action="favorite"]');
  await restoreFavorite.focus();
  await restoreFavorite.click();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'favorite', 'a successful Favorite toggle restores focus to Favorite');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.id), 'ace-visconti');
  assert.match(await ace.locator('.prestige').textContent(), /P1/);
  assert.match(await ace.locator('[data-bloodweb-value]').textContent(), /3\s*\/\s*50/);
  assert.ok(await ace.locator('.collection-bloodweb-track>span').evaluate(fill => fill.getBoundingClientRect().width > 0));

  const nativeNames = characterById['ace-visconti'].nativePerkIds.map(id => perkName(fixture, perkById[id]));
  const native = ace.locator('[data-native-perks]');
  assert.equal(await native.locator('.native-row').count(), 3);
  for (const name of nativeNames) assert.ok((await native.textContent()).includes(name));
  assert.equal(await native.locator('button').count(), 0, 'native account access is informational on the roster');
  assert.ok((await native.textContent()).includes('Tier I'), 'source Prestige supplies the account access tier');
  assert.equal(await ace.locator('[data-collection-summary]').count(), 0, 'Survivor cards omit personal inventory-stat panels');
  assert.equal(await ace.locator('[data-action="perk"]').count(), 0, 'Survivor cards have no perk-dialog controls');
  assert.equal(await ace.locator('[data-open-workspace]').getAttribute('href'), '#character/ace-visconti/overview');

  await page.locator('#search').fill('Ada Wong');
  const locked = byCharacterId(page, 'ada-wong');
  assert.match(await locked.locator('[data-ownership-status]').textContent(), /Locked/i);
  assert.equal(await locked.locator('[data-action="ownership"]').count(), 0, 'Ownership is read-only in the roster');
  assert.equal(await locked.locator('.native-row').count(), 3);
  assert.ok((await locked.locator('[data-native-perks]').textContent()).includes('Not unlocked'),
    'an automatic native Tier I is not shown as an account unlock at global tier zero');
  assert.equal(await locked.locator('[data-collection-summary]').count(), 0);
  await locked.locator('[data-collection-hero-art]').dispatchEvent('error');
  assert.equal(await locked.locator('[data-collection-hero-art]').count(), 0);
  assert.equal(await locked.locator('.collection-art-fallback').textContent(), 'Portrait unavailable', 'a failed Survivor portrait has a restrained fallback');
  assert.equal(await locked.locator('.collection-art-fallback').getAttribute('aria-hidden'), 'true');
  assert.equal(await locked.locator('[data-open-workspace]').getAttribute('href'), '#character/ada-wong/overview', 'portrait failure keeps workspace navigation');

  await page.locator('#search').fill('Adam Francis');
  const adam = byCharacterId(page, 'adam-francis');
  assert.match(await adam.locator('[data-ownership-status]').textContent(), /Owned/i);
  assert.ok((await adam.locator('[data-native-perks]').textContent()).includes('Tier II'), 'native account access uses the highest global tier');

  await page.locator('#search').fill('Laurie Strode');
  const laurie = byCharacterId(page, 'laurie-strode');
  const generalNativeId = characterById['laurie-strode'].nativePerkIds.find(id => perkById[id].general);
  assert.ok(generalNativeId, 'fixture includes a General native perk at global tier zero');
  const generalNativeName = perkName(fixture, perkById[generalNativeId]);
  const generalNativeRow = laurie.locator('.native-row').filter({ hasText: generalNativeName });
  assert.ok((await generalNativeRow.textContent()).includes('General · available'), 'General availability is shown without an automatic Tier');
  assert.doesNotMatch(await generalNativeRow.textContent(), /Tier I/);

  await page.locator('#search').fill('The Slasher');
  const slasher = byCharacterId(page, 'the-slasher');
  assert.equal(await slasher.locator('[data-collection-hero-art]').count(), 0, 'Missing Lore art uses no guessed portrait fallback');
  await page.locator('#search').fill('');
  assert.equal(await page.locator('.survivor-collection-card img[data-collection-hero-art]').count(), 6);
  const survivorImages = page.locator('.survivor-collection-card img[data-collection-hero-art]');
  const survivorDecoded = await survivorImages.evaluateAll(async images => Promise.all(images.map(async image => {
    image.loading = 'eager';
    try { await image.decode(); return image.naturalWidth > 0 && image.naturalHeight > 0; }
    catch { return false; }
  })));
  assert.ok(survivorDecoded.every(Boolean), 'All mapped Survivor Lore art is visible in the review screenshot');

  const manifestAssets = Object.values(manifest.collectionPortraits).filter(Boolean);
  const decoded = await page.evaluate(async assets => Promise.all(assets.map(async asset => {
    const image = new Image(); image.src = asset.path;
    try { await image.decode(); return [image.naturalWidth, image.naturalHeight]; }
    catch { return [0, 0]; }
  })), manifestAssets);
  assert.equal(decoded.length, 97);
  for (const [index, asset] of manifestAssets.entries()) assert.deepEqual(decoded[index], [asset.width, asset.height], asset.path);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(project, 'test-results/survivor-collection-desktop.png'), fullPage: true });
  const search = page.locator('#search');
  await search.fill('Ada Wong');
  assert.equal(await page.locator('.survivor-collection-card').count(), 1, 'Search narrows Survivors');
  await search.fill('');
  await openCollectionFilters(page);
  await page.locator('#ownership-filter').selectOption('owned');
  assert.equal(await page.locator('.survivor-collection-card').count(), 3, 'Owned filter remains functional');
  await page.locator('#ownership-filter').selectOption('locked');
  assert.equal(await page.locator('.survivor-collection-card').count(), 6, 'Locked filter remains functional and paginated');
  assert.match(await page.locator('#collection-page-status').textContent(), /of 51/);
  await page.locator('#ownership-filter').selectOption('all');
  await page.locator('#prestige-filter').selectOption('2');
  assert.equal(await page.locator('.survivor-collection-card').count(), 1, 'Prestige filter remains functional');
  await page.locator('#prestige-filter').selectOption('all');
  await page.locator('[data-action="favorites-filter"]').click();
  assert.equal(await page.locator('.survivor-collection-card').count(), 2, 'Favorites filter remains functional');
  await byCharacterId(page, 'ace-visconti').locator('[data-action="favorite"]').click();
  assert.equal(await page.evaluate(() => location.hash), '#survivors', 'Favorite interaction does not navigate');
  assert.equal(await byCharacterId(page, 'ace-visconti').count(), 0, 'Toggling Favorite updates the active filter');
  await page.locator('[data-action="favorites-filter"]').click();
  await byCharacterId(page, 'ace-visconti').locator('[data-action="favorite"]').click();
  await page.locator('#sort').selectOption('perks');
  assert.equal(await page.locator('.survivor-collection-card').first().getAttribute('data-character-id'), 'adam-francis');
  await page.locator('#sort').selectOption('bloodweb');
  assert.equal(await page.locator('.survivor-collection-card').first().getAttribute('data-character-id'), 'aestri-yazar');
  await page.locator('#search').fill('Ada Wong');
  assert.match(await byCharacterId(page, 'ada-wong').locator('[data-ownership-status]').textContent(), /Locked/i);
  assert.equal(await byCharacterId(page, 'ada-wong').locator('[data-action="ownership"]').count(), 0);
  await page.locator('#search').fill('Ace Visconti');
  await byCharacterId(page, 'ace-visconti').locator('[data-open-workspace]').click();
  await page.waitForURL('**/#character/ace-visconti/overview');

  await page.goto(origin + '/#killers');
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.reload();
  assert.equal(await page.locator('.killer-collection-grid').count(), 1, 'Killers use the same collection card system');
  assert.equal(await page.locator('.killer-collection-card').count(), 6, 'Killers show the first six results');
  await page.locator('#search').fill('The Trapper');
  const trapper = byCharacterId(page, 'the-trapper');
  assert.equal(await trapper.locator('[data-collection-hero-art]').getAttribute('src'), manifest.collectionPortraits['the-trapper'].path);
  assert.match(await trapper.locator('[data-ownership-status]').textContent(), /Owned/i);
  assert.match(await trapper.locator('.prestige').textContent(), /P2/);
  assert.match(await trapper.locator('[data-bloodweb-value]').textContent(), /31\s*\/\s*50/);
  assert.equal(await trapper.locator('[data-native-perks] .native-row').count(), 3);
  assert.ok((await trapper.locator('[data-collection-summary]').textContent()).includes('2 Add-ons'));
  assert.ok(!(await trapper.locator('[data-collection-summary]').textContent()).includes('13'), 'Add-on summary counts types rather than copies');
  const trapperFavorite = trapper.locator('[data-action="favorite"]');
  await trapperFavorite.click();
  assert.equal(await page.evaluate(() => location.hash), '#killers', 'Killer Favorite does not navigate');
  assert.equal(await trapperFavorite.getAttribute('aria-pressed'), 'false');
  await trapperFavorite.click();
  await page.locator('#search').fill('The Spirit');
  const spiritOwnership = byCharacterId(page, 'the-spirit').locator('[data-action="ownership"]');
  assert.equal(await spiritOwnership.count(), 0, 'Killer ownership is display-only in the roster');
  assert.match(await byCharacterId(page, 'the-spirit').locator('[data-ownership-status]').textContent(), /Locked/i);
  await page.locator('#search').fill('The Trapper');
  await trapper.locator('[data-open-workspace]').click();
  await page.waitForURL('**/#character/the-trapper/overview');
  await page.getByRole('link', { name: 'Power & Add-ons', exact: true }).click();
  await page.locator('[data-killer-power-addons]').waitFor();

  await page.goto(origin + '/#survivors');
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.reload();
  for (const role of ['survivor', 'killer']) {
    await page.goto(origin + '/#' + role + 's');
    if (role === 'killer') {
      await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
      await page.reload();
    }
    const grid = page.locator(`.${role}-collection-grid`);
    assert.equal(await grid.locator('.character-card img[data-collection-hero-art]').count(), 6);
    await page.locator('#sort').selectOption('name');
    const orderedIds = characters.filter(character => character.role === role).sort((a, b) => a.name.localeCompare(b.name)).map(character => character.id);
    assert.equal(await page.locator('#collection-page-size').count(), 0, `${role} roster has no page-size selector`);
    const saveBeforePaging = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
    const pageLabel = () => page.locator('#collection-page-status').textContent();
    assert.match(await pageLabel(), new RegExp(`Page 1 of ${Math.ceil(orderedIds.length / 6)}`));
    assert.deepEqual(await grid.locator('.character-collection-card').evaluateAll(cards => cards.map(card => card.dataset.characterId)), orderedIds.slice(0, 6));
    assert.equal(await page.locator('#collection-page-prev').isDisabled(), true);
    await page.getByRole('button', { name: 'Next Page', exact: true }).click();
    assert.match(await pageLabel(), new RegExp(`Page 2 of ${Math.ceil(orderedIds.length / 6)}`));
    assert.deepEqual(await grid.locator('.character-collection-card').evaluateAll(cards => cards.map(card => card.dataset.characterId)), orderedIds.slice(6, 12));
    if (role === 'survivor') {
      await page.setViewportSize({ width: 320, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Six-result paging fits at 320px');
      const paging = await page.locator('.collection-pagination').boundingBox();
      assert.ok(paging && paging.x >= 0 && paging.x + paging.width <= 320, 'Page controls stay within a narrow viewport');
      assert.ok((await page.locator('.collection-pagination button').first().boundingBox()).height >= 44, 'Page controls remain usable touch targets');
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    const lastPage = Math.ceil(orderedIds.length / 6);
    for (let current = 2; current < lastPage; current++) await page.getByRole('button', { name: 'Next Page', exact: true }).click();
    assert.match(await pageLabel(), new RegExp(`Page ${lastPage} of ${lastPage}`));
    assert.equal(await grid.locator('.character-collection-card').count(), orderedIds.length % 6 || 6);
    assert.equal(await page.locator('#collection-page-next').isDisabled(), true);
    await page.getByRole('button', { name: 'Previous Page', exact: true }).click();
    assert.match(await pageLabel(), new RegExp(`Page ${lastPage - 1} of ${lastPage}`));

    await page.getByRole('button', { name: 'Next Page', exact: true }).click();
    const lastCharacterName = characterById[orderedIds.at(-1)].name;
    await page.locator('#search').fill(lastCharacterName);
    assert.equal(await grid.locator('.character-collection-card').count(), 1, 'Search filters before paging');
    assert.match(await pageLabel(), /Page 1 of 1/, 'Search resets the current page');
    assert.match(await pageLabel(), /1–1 of 1/);
    assert.equal(await page.locator('#collection-page-next').isDisabled(), true);
    await page.locator('[data-action="collection-clear-search"]').click();
    assert.equal(await grid.locator('.character-collection-card').count(), 6, `${role} clear search restores the fixed page size`);
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), saveBeforePaging, 'Search and paging do not alter account data');
    if (role === 'killer') {
      const killerDecoded = await grid.locator('img[data-collection-hero-art]').evaluateAll(async images => Promise.all(images.map(async image => {
        image.loading = 'eager';
        try { await image.decode(); return image.naturalWidth > 0 && image.naturalHeight > 0; }
        catch { return false; }
      })));
      assert.ok(killerDecoded.every(Boolean), 'All mapped Killer Lore art is visible in the review screenshot');
    }
    for (const width of [320, 390, 500, 760, 768, 1024, 1100, 1280, 1320, 1360, 1366, 1440, 1600, 1920]) {
      const height = { 320: 800, 390: 844, 768: 1024, 1366: 768 }[width] || 900;
      await page.setViewportSize({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}/${role}`);
      const metrics = await grid.evaluate(element => {
        const gridRect = element.getBoundingClientRect();
        const cards = [...element.querySelectorAll('.character-collection-card')];
        const cardRects = cards.map(card => {
          const rect = card.getBoundingClientRect();
          const image = card.querySelector('[data-collection-hero-art]');
          const hero = image?.getBoundingClientRect();
          const name = card.querySelector('.character-name').getBoundingClientRect();
          const favorite = card.querySelector('[data-action="favorite"]').getBoundingClientRect();
          const summary = card.querySelector('[data-collection-summary]')?.getBoundingClientRect();
          const native = card.querySelector('[data-native-perks]').getBoundingClientRect();
          const action = card.querySelector('.collection-workspace-action').getBoundingClientRect();
          const rows = [...card.querySelectorAll('.native-row')].map(row => {
            const label = row.querySelector('span:first-child').getBoundingClientRect();
          const tier = row.lastElementChild.getBoundingClientRect();
            return label.right <= tier.left || tier.right <= label.left;
          });
          return {
            id: card.dataset.characterId,
            inside: rect.left >= gridRect.left && rect.right <= gridRect.right,
            heroInside: !hero || (hero.left >= rect.left && hero.right <= rect.right && hero.top >= rect.top && hero.bottom <= rect.bottom),
            identityClear: name.right <= favorite.left,
            ordered: summary ? summary.top >= native.bottom && action.top >= summary.bottom : action.top >= native.bottom,
            name: { left: name.left, right: name.right },
            favorite: { left: favorite.left, right: favorite.right },
            summaryTop: summary?.top ?? null,
            nativeBottom: native.bottom,
            actionTop: action.top,
            summaryBottom: summary?.bottom ?? null,
            rows,
            width: rect.width,
            actionHeight: action.height,
            favoriteHeight: favorite.height,
          };
        });
        return { columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length, cardRects };
      });
      assert.ok(metrics.cardRects.every(card => card.inside && card.heroInside && card.identityClear && card.ordered),
        `${role} card content fits at ${width}: ${JSON.stringify(metrics.cardRects.filter(card => !card.inside || !card.heroInside || !card.identityClear || !card.ordered))}`);
      assert.ok(metrics.cardRects.every(card => card.rows.every(Boolean)), `${role} perk names and tiers do not collide at ${width}`);
      assert.ok(metrics.cardRects.every(card => card.actionHeight >= 40 && card.favoriteHeight >= 40), `${role} action targets stay usable at ${width}`);
      if (role === 'survivor') {
        const expectedColumns = { 320: 1, 390: 1, 500: 1, 760: 2, 768: 2, 1024: 2, 1100: 3, 1280: 3, 1320: 3, 1360: 3, 1366: 3, 1440: 3, 1600: 3, 1920: 3 }[width];
        assert.equal(metrics.columns, expectedColumns, `Survivors use the fitted ${expectedColumns}-column layout at ${width}`);
        if (width >= 760) assert.ok(metrics.cardRects.every(card => card.width >= 320), `Survivor cards retain a useful minimum width at ${width}`);
        const prestigeFlow = await byCharacterId(page, 'ash-williams').evaluate(card => {
          const prestigeText = document.createRange();
          prestigeText.selectNodeContents(card.querySelector('.prestige'));
          const bloodweb = card.querySelector('.collection-bloodweb').getBoundingClientRect();
          return { prestigeTextRight: prestigeText.getBoundingClientRect().right, bloodwebLeft: bloodweb.left };
        });
        assert.ok(prestigeFlow.prestigeTextRight + 6 <= prestigeFlow.bloodwebLeft,
          `P100 remains separated from Bloodweb at ${width}: ${JSON.stringify(prestigeFlow)}`);
      }
      if (width >= 1600) assert.ok(metrics.cardRects.every(card => card.width <= 440), `${role} cards remain dense at ${width}px`);
      if (width === 320) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(project, `test-results/${role}-collection-320.png`) });
        assert.equal(metrics.columns, 1, `${role} uses a single card column at 320px`);
      }
      if (width === 390 && role === 'survivor') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(project, 'test-results/survivor-collection-390.png') });
      }
      if (width === 768 && role === 'survivor') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(project, 'test-results/survivor-collection-tablet.png'), fullPage: true });
      }
      if (width === 1440) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(project, `${'test-results'}/${role}-collection-desktop.png`), fullPage: true });
      }
      if (role === 'survivor' && width === 1920) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(project, 'test-results/survivor-collection-wide.png'), fullPage: true });
      }
    }
  }
  await sixResultToolbarRegression(page, origin, fixture);
  await rosterReturnContextRegression(page, origin, fixture);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  try {
    console.log(await smokeStage(resolve(process.argv[2] || project), {
      channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge',
      regression: collectionCardsRegression,
    }));
    console.log('Character collection card regression PASS');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
