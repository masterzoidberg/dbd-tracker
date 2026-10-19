import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { characters, characterById, perkById, perkName } from '../../data/catalog.js';
import { inventoryEntityById } from '../../data/inventory-catalog.js';
import { freshSave, characterStats, rolePerks } from '../../src/model.js';
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
  assert.equal(await page.locator('.survivor-collection-card').count(), characters.filter(character => character.role === 'survivor').length);
  const ace = byCharacterId(page, 'ace-visconti');
  const hero = ace.locator('[data-collection-hero-art]');
  assert.equal(await hero.getAttribute('src'), manifest.collectionPortraits['ace-visconti'].path);
  assert.equal(await hero.getAttribute('alt'), '');
  await hero.scrollIntoViewIfNeeded();
  await hero.evaluate(image => image.decode());
  assert.equal(await hero.evaluate(image => getComputedStyle(image).objectFit), 'contain');
  const [verticalScrim, edgeScrim] = (await hero.evaluate(image => getComputedStyle(image.parentElement, '::after').backgroundImage)).split(/,\s*(?=linear-gradient\()/);
  assert.ok(verticalScrim && edgeScrim, 'Hero artwork has a lower fade and lighter edge scrim');
  assert.match(await ace.locator('.character-name').textContent(), /Ace Visconti/);
  assert.equal(await ace.locator('[data-action="favorite"]').getAttribute('aria-pressed'), 'true');
  assert.match(await ace.locator('[data-action="ownership"]').textContent(), /Owned/i);
  assert.equal(await ace.locator('[data-action="ownership"]').getAttribute('aria-pressed'), 'true');
  assert.match(await ace.locator('.prestige').textContent(), /P1/);
  assert.match(await ace.locator('[data-bloodweb-value]').textContent(), /3\s*\/\s*50/);
  assert.ok(await ace.locator('.collection-bloodweb-track>span').evaluate(fill => fill.getBoundingClientRect().width > 0));

  const nativeNames = characterById['ace-visconti'].nativePerkIds.map(id => perkName(fixture, perkById[id]));
  const native = ace.locator('[data-native-perks]');
  assert.equal(await native.locator('.native-row').count(), 3);
  for (const name of nativeNames) assert.ok((await native.textContent()).includes(name));
  assert.deepEqual(await native.locator('.native-row .tier').allTextContents(), ['I', 'I', 'I']);
  const summary = ace.locator('[data-collection-summary]');
  const stats = characterStats(fixture, 'ace-visconti');
  assert.ok((await summary.textContent()).includes(`${stats.owned} / ${stats.total} Perks`));
  assert.ok((await summary.textContent()).includes(`${stats.tier3} Tier III`));
  assert.ok((await summary.textContent()).includes('2 Items'));
  assert.ok((await summary.textContent()).includes('1 Add-ons'));
  assert.equal(await ace.locator('[data-open-workspace]').getAttribute('href'), '#character/ace-visconti/overview');

  const locked = byCharacterId(page, 'ada-wong');
  assert.ok((await locked.locator('[data-collection-summary]').textContent()).includes('0 Items'));
  assert.ok((await locked.locator('[data-collection-summary]').textContent()).includes('0 Add-ons'));
  const slasher = byCharacterId(page, 'the-slasher');
  assert.equal(await slasher.locator('[data-collection-hero-art]').count(), 0, 'Missing Lore art uses no guessed portrait fallback');
  assert.equal(await page.locator('.survivor-collection-card img[data-collection-hero-art]').count(), 54);
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
  await page.locator('[data-action="filter"][data-filter="owned"]').click();
  assert.equal(await page.locator('.survivor-collection-card').count(), 3, 'Owned filter remains functional');
  await page.locator('[data-action="filter"][data-filter="locked"]').click();
  assert.equal(await page.locator('.survivor-collection-card').count(), 51, 'Locked filter remains functional');
  await page.locator('[data-action="filter"][data-filter="all"]').click();
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
  await byCharacterId(page, 'ada-wong').locator('[data-action="ownership"]').click();
  assert.equal(await byCharacterId(page, 'ada-wong').locator('[data-action="ownership"]').getAttribute('aria-pressed'), 'true');
  await byCharacterId(page, 'ada-wong').locator('[data-action="ownership"]').click();
  await byCharacterId(page, 'ace-visconti').locator('[data-open-workspace]').click();
  await page.waitForURL('**/#character/ace-visconti/overview');

  await page.goto(origin + '/#killers');
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), fixture);
  await page.reload();
  assert.equal(await page.locator('.killer-collection-grid').count(), 1, 'Killers use the same collection card system');
  assert.equal(await page.locator('.killer-collection-card').count(), characters.filter(character => character.role === 'killer').length);
  const trapper = byCharacterId(page, 'the-trapper');
  assert.equal(await trapper.locator('[data-collection-hero-art]').getAttribute('src'), manifest.collectionPortraits['the-trapper'].path);
  assert.match(await trapper.locator('[data-action="ownership"]').textContent(), /Owned/i);
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
  const spiritOwnership = byCharacterId(page, 'the-spirit').locator('[data-action="ownership"]');
  await spiritOwnership.click();
  assert.equal(await spiritOwnership.getAttribute('aria-pressed'), 'true', 'Killer ownership remains editable');
  await spiritOwnership.click();
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
    assert.equal(await grid.locator('.character-card img[data-collection-hero-art]').count(), role === 'survivor' ? 54 : 43);
    if (role === 'killer') {
      const killerDecoded = await grid.locator('img[data-collection-hero-art]').evaluateAll(async images => Promise.all(images.map(async image => {
        image.loading = 'eager';
        try { await image.decode(); return image.naturalWidth > 0 && image.naturalHeight > 0; }
        catch { return false; }
      })));
      assert.ok(killerDecoded.every(Boolean), 'All mapped Killer Lore art is visible in the review screenshot');
    }
    for (const width of [320, 500, 760, 1100, 1440, 1600]) {
      await page.setViewportSize({ width, height: 900 });
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
          const summary = card.querySelector('[data-collection-summary]').getBoundingClientRect();
          const native = card.querySelector('[data-native-perks]').getBoundingClientRect();
          const action = card.querySelector('[data-open-workspace]').getBoundingClientRect();
          const rows = [...card.querySelectorAll('.native-row')].map(row => {
            const label = row.querySelector('span:first-child').getBoundingClientRect();
            const tier = row.querySelector('.tier').getBoundingClientRect();
            return label.right <= tier.left || tier.right <= label.left;
          });
          return {
            inside: rect.left >= gridRect.left && rect.right <= gridRect.right,
            heroInside: !hero || (hero.left >= rect.left && hero.right <= rect.right && hero.top >= rect.top && hero.bottom <= rect.bottom),
            identityClear: name.right <= favorite.left,
            ordered: summary.top >= native.bottom && action.top >= summary.bottom,
            rows,
            width: rect.width,
            actionHeight: action.height,
            favoriteHeight: favorite.height,
          };
        });
        return { columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length, cardRects };
      });
      assert.ok(metrics.cardRects.every(card => card.inside && card.heroInside && card.identityClear && card.ordered), `${role} card content fits at ${width}`);
      assert.ok(metrics.cardRects.every(card => card.rows.every(Boolean)), `${role} perk names and tiers do not collide at ${width}`);
      assert.ok(metrics.cardRects.every(card => card.actionHeight >= 40 && card.favoriteHeight >= 40), `${role} action targets stay usable at ${width}`);
      if (width === 1600) assert.ok(metrics.cardRects.every(card => card.width <= 440), `${role} cards remain dense at 1600px`);
      if (width === 320) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(project, `test-results/${role}-collection-320.png`) });
        assert.equal(metrics.columns, 1, `${role} uses a single card column at 320px`);
      }
      if (width === 1440) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: resolve(project, `${'test-results'}/${role}-collection-desktop.png`), fullPage: true });
      }
    }
  }
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
