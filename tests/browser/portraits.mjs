import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAssetManifest } from '../../scripts/generate-assets.mjs';
import { freshSave } from '../../src/model.js';
import { characters } from '../../data/catalog.js';

export async function portraitsRegression(page, origin, manifest) {
  manifest ??= await generateAssetManifest();
  const save = freshSave(); save.characters['meg-thomas'].owned = true; save.characters['meg-thomas'].setupComplete = true;
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), save);
  await page.goto(origin + '/#survivors'); await page.reload();
  assert.equal(await page.locator('.survivor-collection-card').count(), 6, 'Survivors render the first six Lore collection cards');
  const initial = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  for (const role of ['survivor', 'killer']) {
    await page.goto(origin + '/#' + role + 's');
    const expectedIds = characters.filter(c => c.role === role).sort((a, b) => a.name.localeCompare(b.name)).map(c => c.id);
    const renderedIds = [];
    const totalPages = Math.ceil(expectedIds.length / 6);
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const cards = page.locator(`.${role}-collection-card`);
      const pageIds = await cards.evaluateAll(nodes => nodes.map(node => node.dataset.characterId));
      assert.deepEqual(pageIds, expectedIds.slice(pageIndex * 6, (pageIndex + 1) * 6), `${role} page ${pageIndex + 1} shows the expected six Lore cards`);
      const mappedOnPage = pageIds.filter(id => manifest.collectionPortraits[id]);
      const portraits = page.locator('.character-card img[data-collection-hero-art]');
      assert.equal(await portraits.count(), mappedOnPage.length, `${role} page ${pageIndex + 1} uses only mapped Lore portraits`);
      assert.ok(await portraits.evaluateAll(nodes => nodes.every(n => n.alt === '' && n.loading === 'lazy' && n.closest('[aria-hidden="true"]'))));
      renderedIds.push(...pageIds);
      if (pageIndex + 1 < totalPages) await page.getByRole('button', { name: 'Next Page', exact: true }).click();
    }
    assert.deepEqual(renderedIds, expectedIds, `${role} paging reaches each Lore character exactly once`);
  }
  // Explicitly decode all references instead of relying on the lazy viewport.
  const assets = Object.values(manifest.portraits).filter(Boolean);
  const decoded = await page.evaluate(async assets => Promise.all(assets.map(async asset => {
    const image = new Image(); image.src = asset.path;
    try { await image.decode(); return [image.naturalWidth, image.naturalHeight]; }
    catch { return [0, 0]; }
  })), assets);
  assert.equal(decoded.length, 98);
  for (const [index, asset] of assets.entries()) assert.deepEqual(decoded[index], [asset.width, asset.height], asset.path);
  for (const asset of assets.filter(a => a.format === 'webp')) {
    const response = await page.request.get(origin + '/' + asset.path);
    assert.equal(response.headers()['content-type'], 'image/webp');
  }
  for (const id of ['meg-thomas', 'aestri-yazar', 'bill-overbeck', 'yun-jin-lee', 'the-onryo', 'the-ghost-face', 'zarina-kassir']) {
    const character = characters.find(c => c.id === id);
    await page.goto(origin + '/#' + character.role + 's');
    await page.locator('#search').fill(character.name);
    const card = page.locator(`.character-card[data-character-id="${id}"]`);
    const link = card.locator('[data-open-workspace]');
    assert.equal(await card.locator('[data-collection-hero-art]').getAttribute('src'), manifest.collectionPortraits[id].path);
    await link.click();
    assert.equal(await page.locator('.character-workspace-header img').getAttribute('src'), manifest.portraits[id].path);
    assert.equal(await page.locator('.character-workspace-header .character-portrait').evaluate(n => n.getBoundingClientRect().width), 80);
    assert.equal(await page.locator('#detail').isVisible(), false);
    await page.goto(origin + '/#manage/' + id + '/legacy');
    assert.equal(await page.locator('.character-workspace-header img').getAttribute('src'), manifest.portraits[id].path);
    assert.equal(await page.locator('.character-workspace-header img').evaluate(n => getComputedStyle(n).objectFit), 'contain');
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), initial, 'Artwork navigation does not change progression');

  // Corrupt a PNG and a WebP response in this disposable profile; no real files change.
  for (const id of ['meg-thomas', 'the-ghost-face']) {
    const character = characters.find(c => c.id === id);
    await page.goto(origin + '/#' + character.role + 's');
    await page.locator('#search').fill(character.name);
    const card = page.locator(`.character-card[data-character-id="${id}"]`);
    const link = card.locator('[data-open-workspace]');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    const holder = page.locator('.character-workspace-header .character-portrait');
    const image = holder.locator('img[data-character-portrait]');
    await page.waitForFunction(id => document.querySelector(`img[data-character-portrait="${id}"]`)?.naturalWidth > 0, id);
    const before = await holder.boundingBox();
    const broken = origin + '/' + manifest.portraits[id].path + '?portrait-broken=1';
    let requests = 0;
    await page.route(broken, async route => { requests++; await route.fulfill({ status: 200, contentType: 'image/' + manifest.portraits[id].format, body: 'bad image' }); });
    await image.evaluate((n, url) => { n.src = url; }, broken);
    await page.waitForFunction(id => !document.querySelector(`.character-workspace-header img[data-character-portrait="${id}"]`), id);
    assert.equal(requests, 1);
    assert.deepEqual(await holder.boundingBox(), before);
    assert.equal(await holder.evaluate(n => n.classList.contains('has-art')), false);
    await page.getByRole('link', { name: 'Edit Character', exact: true }).click();
    await page.locator('#edit-bloodweb').fill('26');
    await page.getByRole('button', { name: 'Save Character', exact: true }).click();
    assert.equal(await page.locator('#save-status').textContent(), 'Saved locally');
    assert.equal(await page.locator('#detail').isVisible(), false);
    await page.unroute(broken);
  }
  const saved = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  assert.ok(!saved.includes('images/') && !saved.includes('portraits'));
  await page.reload();
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData'))).characters['the-ghost-face'].bloodwebLevel, 26);

  for (const width of [500, 700, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['survivors', 'killers', 'manage/meg-thomas/legacy', 'manage/aestri-yazar/legacy', 'manage/the-ghost-face/legacy']) {
      await page.goto(origin + '/#' + route);
      await page.locator('#search').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Portrait shell overflow ${width}/${route}`);
      if (route.startsWith('manage/')) {
        for (const mode of ['Compact', 'Detailed']) {
          await page.getByRole('radio', { name: mode, exact: true }).check();
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Portrait manager overflow ${width}/${route}/${mode}`);
        }
      } else {
        const card = page.locator('.character-card').first();
        assert.equal(await card.locator('[data-collection-hero-art]').count(), 1, 'First collection character has an explicit Lore portrait');
        assert.equal(await card.locator('[data-collection-hero-art]').evaluate(n => getComputedStyle(n).objectFit), 'contain');
        assert.equal(await card.locator('[data-action="favorite"]').isVisible(), true);
        assert.match(await card.locator('[data-ownership-status]').textContent(), /Owned|Locked/);
        assert.equal(await card.locator('[data-action="ownership"]').count(), 0);
        assert.equal(await card.locator('a[href^="#character/"]').count(), 1);
        await card.locator('[data-open-workspace]').focus(); await page.keyboard.press('Enter');
        const edit = await page.getByRole('link', { name: 'Edit Character', exact: true }).boundingBox();
        assert.ok(edit.x >= 0 && edit.x + edit.width <= width);
        assert.equal(await page.locator('#detail').isVisible(), false);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  console.log(await smokeStage(resolve(process.argv[2] || 'release/runtime'), { channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge', regression: portraitsRegression }));
}
