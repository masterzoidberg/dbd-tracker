import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAssetManifest } from '../../scripts/generate-assets.mjs';
import { freshSave } from '../../src/model.js';

export async function artworkRegression(page, origin, manifest) {
  manifest ??= await generateAssetManifest();
  const requested = [];
  const track = request => requested.push(request.url());
  page.on('request', track);
  const save = freshSave();
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), save);
  await page.goto(origin + '/#survivor-perks'); await page.reload();
  await page.locator('#search').fill('Detective');
  const detective = page.locator('#main [data-action="perk"][data-id="detective-s-hunch"]');
  assert.equal(await detective.locator('img').count(), 1, 'Detective exception must render usable artwork');
  assert.equal(await detective.locator('img').getAttribute('src'), manifest.perks['detective-s-hunch'].path);
  assert.equal(await detective.locator('img').getAttribute('alt'), '');
  assert.equal(await detective.locator('img').getAttribute('loading'), 'lazy');
  await detective.click();
  await page.locator('#detail-title').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#detail-title img')?.naturalWidth > 0);
  assert.equal(await page.locator('#detail-title img').getAttribute('src'), manifest.perks['detective-s-hunch'].path);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();

  // Decode every staged reference explicitly, including icons outside lazy table viewports.
  const killerAddons = Object.values(manifest.inventory).filter(asset => asset?.path.startsWith('images/Powers and Add-ons/'));
  const killerPowers = Object.values(manifest.killerPowers).filter(Boolean);
  assert.equal(killerAddons.length, 880);
  assert.equal(killerPowers.length, 37);
  assert.equal(Object.values(manifest.killerPowers).filter(value => value === null).length, 7);
  const assets = [...Object.values(manifest.perks).filter(Boolean), ...killerAddons, ...killerPowers];
  const decoded = await page.evaluate(async assets => Promise.all(assets.map(async asset => {
    const img = new Image(); img.src = asset.path.split('/').map(encodeURIComponent).join('/');
    try { await img.decode(); return { path: asset.path, width: img.naturalWidth, height: img.naturalHeight }; }
    catch { return { path: asset.path, width: 0, height: 0 }; }
  })), assets);
  assert.equal(decoded.length, 1238);
  for (const [index, image] of decoded.entries()) {
    const asset = assets[index];
    assert.equal(image.width, asset.width, image.path); assert.equal(image.height, asset.height, image.path);
  }
  for (const [route, id, search] of [
    ['survivor-perks', 'a-place-for-us', 'A Place for Us'],
    ['killer-perks', 'deadlock', 'Deadlock'],
    ['killer-perks', 'hex-plaything', 'Plaything'],
    ['killer-perks', 'scourge-hook-gift-of-pain', 'Gift of Pain'],
  ]) {
    await page.goto(origin + '/#' + route);
    await page.locator('#search').fill(search);
    const button = page.locator(`#main [data-action="perk"][data-id="${id}"]`);
    assert.equal(await button.locator('img').count(), 1, `Supplied artwork must render for ${id}`);
    assert.equal(await button.locator('img').getAttribute('src'), manifest.perks[id].path);
    const slot = await button.locator('.perk-art').boundingBox();
    assert.equal(slot.width, 36); assert.equal(slot.height, 36);
    await button.click();
    assert.equal(await page.locator('#detail-title img').count(), 1);
    assert.equal(await page.locator('#detail-title img').getAttribute('src'), manifest.perks[id].path);
    await page.getByRole('button', { name: 'Close details', exact: true }).click();
  }
  assert.ok(!requested.some(url => /images\/killer-perks\/cenobite\//.test(url)), 'Original placeholders must never be requested');

  await page.goto(origin + '/#data');
  await page.locator('#halloween-names').selectOption('original');
  await page.goto(origin + '/#survivor-perks');
  await page.locator('#search').fill('Decisive');
  const originalPath = await page.locator('#main [data-id="decisive-strike"] img').getAttribute('src');
  await page.goto(origin + '/#data'); await page.locator('#halloween-names').selectOption('generic');
  await page.goto(origin + '/#survivor-perks'); await page.locator('#search').fill('Will to Live');
  assert.equal(await page.locator('#main [data-id="decisive-strike"] img').getAttribute('src'), originalPath);
  assert.ok((await page.locator('#main [data-id="decisive-strike"]').textContent()).includes('Will to Live'));
  const persisted = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  assert.ok(!persisted.includes('images/') && !persisted.includes('asset-manifest'));

  // Corrupt a known URL only in this disposable browser; no shipped/source bytes change.
  const path = manifest.perks.adrenaline.path, brokenURL = origin + '/' + path + '?fixture-broken=1';
  await page.goto(origin + '/#manage/meg-thomas/legacy'); await page.locator('#search').fill('Adrenaline');
  const button = page.locator('#main [data-action="perk"][data-id="adrenaline"]');
  await button.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#main [data-id="adrenaline"] img')?.naturalWidth > 0);
  const loadedBox = await button.locator('.perk-art').boundingBox();
  let failedRequests = 0;
  await page.route(brokenURL, async route => { failedRequests++; await route.fulfill({ status: 200, contentType: 'image/png', body: 'fixture invalid PNG' }); });
  await button.locator('img').evaluate((img, path) => { img.src = path + '?fixture-broken=1'; }, path);
  await page.waitForFunction(() => {
    const slot = document.querySelector('#main [data-id="adrenaline"] .perk-art');
    return slot && !slot.querySelector('img') && !slot.classList.contains('has-art');
  });
  assert.equal(failedRequests, 1, 'Error fallback must not retry a broken image');
  const fallbackBox = await button.locator('.perk-art').boundingBox();
  assert.deepEqual(fallbackBox, loadedBox, 'Decode failure must not move or resize the fixed slot');
  assert.equal(fallbackBox.width, 36); assert.equal(fallbackBox.height, 36);
  await page.locator('#tier-meg-thomas-adrenaline').click();
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData'))).characters['meg-thomas'].perks.adrenaline, 2, 'Broken artwork must not prevent progression edits');
  await page.unroute(brokenURL);

  for (const width of [500, 700, 900, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(origin + '/#survivor-perks'); await page.locator('#search').fill('Detective');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Artwork shell overflow ${width}`);
    const slot = await page.locator('#main .perk-art').boundingBox();
    assert.equal(slot.width, 36); assert.equal(slot.height, 36);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  page.off('request', track);
  assert.ok(requested.every(url => new URL(url).origin === origin && !new URL(url).pathname.endsWith('.json')),
    'Artwork must not request external services or catalog/manifest JSON');
  return { decodedIcons: decoded.length, killerAddons: killerAddons.length, killerPowers: killerPowers.length,
    powerFallbacks: Object.values(manifest.killerPowers).filter(value => value === null).length,
    fallbacks: Object.values(manifest.perks).filter(value => value === null).length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  console.log(await smokeStage(resolve(process.argv[2] || 'release/runtime'), { regression: artworkRegression }));
}
