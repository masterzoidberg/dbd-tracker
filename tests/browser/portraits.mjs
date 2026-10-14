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
  assert.equal(await page.locator('.character-card img[data-character-portrait]').count(), 54, 'Survivor cards must render portraits');
  const initial = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  for (const role of ['survivor', 'killer']) {
    await page.goto(origin + '/#' + role + 's');
    const portraits = page.locator('.character-card img[data-character-portrait]');
    assert.equal(await portraits.count(), characters.filter(c => c.role === role).length);
    assert.ok(await portraits.evaluateAll(nodes => nodes.every(n => n.alt === '' && n.closest('.character-name') && n.loading === 'lazy' && n.closest('[aria-hidden="true"]'))));
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
    const button = page.locator(`.character-name[data-id="${id}"]`);
    assert.equal(await button.locator('img').getAttribute('src'), manifest.portraits[id].path);
    await button.click();
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
    const button = page.locator(`.character-name[data-id="${id}"]`), image = button.locator('img');
    await button.scrollIntoViewIfNeeded();
    await page.waitForFunction(id => document.querySelector(`img[data-character-portrait="${id}"]`)?.naturalWidth > 0, id);
    const before = await button.locator('.character-portrait').boundingBox();
    const broken = origin + '/' + manifest.portraits[id].path + '?portrait-broken=1';
    let requests = 0;
    await page.route(broken, async route => { requests++; await route.fulfill({ status: 200, contentType: 'image/' + manifest.portraits[id].format, body: 'bad image' }); });
    await image.evaluate((n, url) => { n.src = url; }, broken);
    await page.waitForFunction(id => !document.querySelector(`.character-name[data-id="${id}"] img`), id);
    assert.equal(requests, 1);
    assert.deepEqual(await button.locator('.character-portrait').boundingBox(), before);
    assert.equal(await button.locator('.character-portrait').evaluate(n => n.classList.contains('has-art')), false);
    await button.click();
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
        assert.equal(await card.locator('.character-portrait').evaluate(n => n.getBoundingClientRect().width), 64);
        assert.equal(await card.locator('[data-action="favorite"]').isVisible(), true);
        assert.equal(await card.locator('[data-action="ownership"]').isVisible(), true);
        await card.locator('.character-name').focus(); await page.keyboard.press('Enter');
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
