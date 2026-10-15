import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { characters, characterById, perkById, perkName } from '../../data/catalog.js';
import { inventoryEntities } from '../../data/inventory-catalog.js';
import { freshSave, characterStats, rolePerks } from '../../src/model.js';

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
  save.characters['meg-thomas'].bloodwebLevel = 8;
  save.characters['alan-wake'].bloodwebLevel = 44;
  const items = inventoryEntities.filter(entity => entity.kind === 'survivor-item');
  const addons = inventoryEntities.filter(entity => entity.kind === 'survivor-addon');
  save.characters['ace-visconti'].inventory.items[items[0].id] = 20;
  save.characters['ace-visconti'].inventory.items[items[1].id] = 2;
  save.characters['ace-visconti'].inventory.addons[addons[0].id] = 8;
  for (const perk of rolePerks('survivor').slice(0, 8)) save.characters['adam-francis'].perks[perk.id] = 1;
  return save;
}

const byCharacterId = (page, id) => page.locator(`.character-card[data-character-id="${id}"]`);

export async function survivorCollectionRegression(page, origin) {
  const fixture = collectionFixture();
  await mkdir(resolve('test-results'), { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#survivors');
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.reload();
  await page.getByRole('heading', { name: 'Survivors', exact: true }).waitFor();

  assert.equal(await page.locator('.character-card').count(), characters.filter(character => character.role === 'survivor').length);
  const ace = byCharacterId(page, 'ace-visconti');
  assert.equal(await ace.count(), 1);
  const hero = ace.locator('[data-collection-hero-art]');
  assert.equal(await hero.count(), 1, 'Lore hero art is present on the Survivor card');
  assert.equal(await hero.getAttribute('alt'), '');
  assert.equal(await hero.getAttribute('aria-hidden'), 'true');
  await hero.scrollIntoViewIfNeeded();
  await hero.evaluate(image => image.decode());
  assert.ok(await hero.evaluate(image => image.naturalWidth > 0 && image.naturalHeight > 0), 'Hero image decodes');
  assert.equal(await hero.getAttribute('loading'), 'lazy');
  const heroScrim = await hero.evaluate(image => getComputedStyle(image.parentElement, '::after').backgroundImage);
  const [verticalScrim, edgeScrim] = heroScrim.split(/,\s*(?=linear-gradient\()/);
  const alphaStops = gradient => [...gradient.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map(match => Number(match[1]));
  assert.ok(verticalScrim && edgeScrim, 'Portrait scrim combines vertical and edge fades');
  const verticalAlphas = alphaStops(verticalScrim), edgeAlphas = alphaStops(edgeScrim);
  assert.ok(verticalAlphas[0] <= 0.05, 'Top fade remains very light');
  assert.ok(verticalAlphas.at(-1) >= 0.5, 'Bottom fade remains strongest');
  assert.match(edgeScrim, /^linear-gradient\(90deg,/, 'Side edges receive a lighter fade');
  assert.ok(Math.max(...edgeAlphas) < verticalAlphas.at(-1), 'Edge fade stays lighter than the bottom fade');
  assert.match(await ace.locator('.character-name').textContent(), /Ace Visconti/);
  const favorite = ace.locator('[data-action="favorite"]');
  assert.equal(await favorite.getAttribute('aria-label'), 'Favorite Ace Visconti');
  assert.equal(await favorite.getAttribute('aria-pressed'), 'true');
  const ownership = ace.locator('[data-action="ownership"]');
  assert.match(await ownership.textContent(), /Owned/i);
  assert.equal(await ownership.getAttribute('aria-pressed'), 'true');
  assert.match(await ace.locator('.prestige').textContent(), /P1/);
  assert.match(await ace.locator('[data-bloodweb-value]').textContent(), /3\s*\/\s*50/);
  for (const [id, level] of [['ada-wong', 1], ['ace-visconti', 3], ['meg-thomas', 8], ['adam-francis', 22], ['alan-wake', 44]]) {
    const card = byCharacterId(page, id);
    assert.match(await card.locator('[data-bloodweb-value]').textContent(), new RegExp(`^${level}\\s*/\\s*50$`));
    assert.ok(await card.locator('.survivor-bloodweb-track>span').evaluate(fill => fill.getBoundingClientRect().width > 0), `${level}/50 has a visible progress line`);
  }

  const nativeNames = characterById['ace-visconti'].nativePerkIds.map(id => perkName(fixture, perkById[id]));
  const native = ace.locator('[data-native-perks]');
  assert.equal(await native.locator('.native-row').count(), 3);
  for (const name of nativeNames) assert.ok((await native.textContent()).includes(name), `Native perk name: ${name}`);
  assert.deepEqual(await native.locator('.native-row .tier').allTextContents(), ['I', 'I', 'I'], 'Native perk owned tiers remain visible');
  const summary = ace.locator('[data-collection-summary]');
  const stats = characterStats(fixture, 'ace-visconti');
  assert.ok((await summary.textContent()).includes(`${stats.owned} / ${stats.total} Perks`));
  assert.ok((await summary.textContent()).includes(`${stats.tier3} Tier III`));
  assert.ok((await summary.textContent()).includes('2 Items'));
  assert.ok((await summary.textContent()).includes('1 Add-ons'));
  const openWorkspace = ace.locator('[data-open-workspace]');
  assert.equal(await openWorkspace.getAttribute('href'), '#character/ace-visconti/overview');
  assert.match(await openWorkspace.textContent(), /Open workspace/);

  const locked = byCharacterId(page, 'ada-wong');
  assert.equal(await locked.locator('[data-collection-hero-art]').count(), 1);
  assert.match(await locked.locator('[data-action="ownership"]').textContent(), /Locked/i);
  assert.equal(await locked.locator('[data-action="ownership"]').getAttribute('aria-pressed'), 'false');
  assert.match(await locked.locator('.prestige').textContent(), /P0/);
  assert.match(await locked.locator('[data-bloodweb-value]').textContent(), /1\s*\/\s*50/);
  assert.ok((await locked.locator('[data-collection-summary]').textContent()).includes('0 Items'));
  assert.ok((await locked.locator('[data-collection-summary]').textContent()).includes('0 Add-ons'));

  const artwork = page.locator('.character-card img[data-collection-hero-art]');
  assert.equal(await artwork.count(), characters.filter(character => character.role === 'survivor').length);
  const assetResults = [];
  for (let index = 0; index < await artwork.count(); index++) {
    const image = artwork.nth(index);
    await image.scrollIntoViewIfNeeded();
    assetResults.push(await image.evaluate(async element => {
      await element.decode();
      return { width: element.naturalWidth, height: element.naturalHeight, source: element.currentSrc };
    }));
  }
  assert.ok(assetResults.every(asset => asset.width > 0 && asset.height > 0), 'Every current Survivor hero asset decodes');
  assert.ok(assetResults.every(asset => new URL(asset.source).origin === origin), 'Hero art is served locally');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: resolve('test-results/survivor-collection-first-rows.png') });
  await page.screenshot({ path: resolve('test-results/survivor-collection-desktop.png'), fullPage: true });

  const search = page.locator('#search');
  await search.fill('Ada Wong');
  assert.equal(await page.locator('.character-card').count(), 1, 'Search narrows the collection');
  assert.equal(await byCharacterId(page, 'ada-wong').count(), 1);
  await search.fill('');
  await page.locator('[data-action="filter"][data-filter="owned"]').click();
  assert.equal(await page.locator('.character-card').count(), 3, 'Owned filter remains functional');
  await page.locator('[data-action="filter"][data-filter="locked"]').click();
  assert.equal(await page.locator('.character-card').count(), characters.filter(character => character.role === 'survivor').length - 3, 'Locked filter remains functional');
  await page.locator('[data-action="filter"][data-filter="all"]').click();
  await page.locator('#prestige-filter').selectOption('2');
  assert.equal(await page.locator('.character-card').count(), 1, 'Prestige filter remains functional');
  assert.equal(await byCharacterId(page, 'adam-francis').count(), 1);
  await page.locator('#prestige-filter').selectOption('all');

  await page.locator('[data-action="favorites-filter"]').click();
  assert.equal(await page.locator('.character-card').count(), 2, 'Favorites filter remains functional');
  const favoriteCard = byCharacterId(page, 'ace-visconti');
  const favoriteButton = favoriteCard.locator('[data-action="favorite"]');
  await favoriteButton.click();
  assert.equal(await page.evaluate(() => location.hash), '#survivors', 'Favorite control does not navigate');
  assert.equal(await byCharacterId(page, 'ace-visconti').count(), 0, 'Toggling favorite updates the active Favorites filter');
  await page.locator('[data-action="favorites-filter"]').click();

  await page.locator('#sort').selectOption('perks');
  assert.equal(await page.locator('.character-card').first().getAttribute('data-character-id'), 'adam-francis', 'Perk count sort remains functional');
  await page.locator('#sort').selectOption('bloodweb');
  assert.equal(await page.locator('.character-card').first().getAttribute('data-character-id'), 'aestri-yazar', 'Bloodweb sort remains functional');

  const adaOwnership = byCharacterId(page, 'ada-wong').locator('[data-action="ownership"]');
  await adaOwnership.click();
  assert.equal(await byCharacterId(page, 'ada-wong').locator('[data-action="ownership"]').getAttribute('aria-pressed'), 'true', 'Ownership toggle remains functional');
  await byCharacterId(page, 'ace-visconti').locator('[data-open-workspace]').click();
  await page.waitForURL('**/#character/ace-visconti/overview');
  assert.equal(new URL(page.url()).hash, '#character/ace-visconti/overview', 'Open workspace reaches Character Overview');

  await page.goto(origin + '/#survivors');
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.reload();
  const columnCounts = [];
  for (const width of [320, 500, 760, 1100, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}`);
    const metrics = await page.locator('.survivor-collection-grid').evaluate(grid => {
      const gridRect = grid.getBoundingClientRect();
      const cards = [...grid.querySelectorAll('.survivor-collection-card')];
      const cardRects = cards.map(card => {
        const rect = card.getBoundingClientRect();
        const hero = card.querySelector('[data-collection-hero-art]').getBoundingClientRect();
        const summary = card.querySelector('[data-collection-summary]').getBoundingClientRect();
        const native = card.querySelector('[data-native-perks]').getBoundingClientRect();
        const action = card.querySelector('[data-open-workspace]').getBoundingClientRect();
        const name = card.querySelector('.character-name').getBoundingClientRect();
        const favorite = card.querySelector('[data-action="favorite"]').getBoundingClientRect();
        const rows = [...card.querySelectorAll('.native-row')].map(row => {
          const name = row.querySelector('span:first-child').getBoundingClientRect();
          const tier = row.querySelector('.tier').getBoundingClientRect();
          return name.right <= tier.left || tier.right <= name.left;
        });
        return {
          inside: rect.left >= gridRect.left && rect.right <= gridRect.right,
          heroInside: hero.left >= rect.left && hero.right <= rect.right && hero.top >= rect.top && hero.bottom <= rect.bottom,
          summaryAfterNative: summary.top >= native.bottom,
          actionAfterSummary: action.top >= summary.bottom,
          actionHeight: action.height,
          identityClear: name.right <= favorite.left,
          favoriteHeight: card.querySelector('[data-action="favorite"]').getBoundingClientRect().height,
          rows,
          width: rect.width,
        };
      });
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      return { columns, cardRects };
    });
    columnCounts.push(metrics.columns);
    assert.ok(metrics.cardRects.every(card => card.inside), `Cards stay in the collection grid at ${width}`);
    assert.ok(metrics.cardRects.every(card => card.heroInside), `Hero art stays inside its card at ${width}`);
    assert.ok(metrics.cardRects.every(card => card.summaryAfterNative && card.actionAfterSummary), `Perks, metrics, and action stay in order at ${width}`);
    assert.ok(metrics.cardRects.every(card => card.identityClear), `Names remain clear of Favorite at ${width}`);
    assert.ok(metrics.cardRects.every(card => card.rows.every(Boolean)), `Perk names and tiers do not collide at ${width}`);
    assert.ok(metrics.cardRects.every(card => card.actionHeight >= 40 && card.favoriteHeight >= 40), `Favorite and workspace controls remain practical targets at ${width}`);
    if (width === 1600) assert.ok(metrics.cardRects.every(card => card.width <= 440), 'Cards stay dense on large screens');
    if (width === 320) {
      await page.screenshot({ path: resolve('test-results/survivor-collection-320.png') });
      assert.equal(metrics.columns, 1, 'Narrow layout uses one card per row');
    }
  }
  assert.ok(columnCounts.every((count, index) => index === 0 || count >= columnCounts[index - 1]), 'Grid adds columns as available width grows');
  await page.setViewportSize({ width: 1440, height: 900 });
  const focusFavorite = byCharacterId(page, 'ace-visconti').locator('[data-action="favorite"]');
  await focusFavorite.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert.ok(await focusFavorite.evaluate(button => button.matches(':focus-visible') && parseFloat(getComputedStyle(button).outlineWidth) > 0), 'Favorite has visible keyboard focus');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  try {
    console.log(await smokeStage(resolve(process.argv[2] || 'release/runtime'), {
      channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge',
      regression: survivorCollectionRegression,
    }));
    console.log('Survivor collection regression PASS');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
