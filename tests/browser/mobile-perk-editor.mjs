import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';

async function mobilePerkEditorRegression(page, origin) {
  const save = freshSave();
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${origin}/#character/the-doctor/perks`);
    await page.locator('#character-inventory-search').waitFor();

    const card = page.locator('.perk-card[data-perk="bitter-murmur"]');
    await card.evaluate(node => node.scrollIntoView({ block: 'center' }));
    const cardBox = await card.boundingBox();
    await card.click();

    const picker = page.locator('.character-inventory-quick-picker');
    await picker.waitFor();
    const pickerBox = await picker.boundingBox();
    assert.ok(cardBox && pickerBox, `Mobile editor geometry is available at ${width}px`);
    assert.ok(Math.abs(pickerBox.x - cardBox.x) <= 1,
      `Mobile perk editor stays anchored to the tapped card at ${width}px: ${JSON.stringify({ cardBox, pickerBox })}`);
    assert.ok(Math.abs(pickerBox.width - cardBox.width) <= 1,
      `Mobile perk editor restores the older card-width footprint at ${width}px: ${JSON.stringify({ cardBox, pickerBox })}`);

    const columns = await picker.locator('.character-inventory-tier-controls').evaluate(node =>
      getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
    assert.equal(columns, 2, `Mobile tier controls use the older 2x2 layout at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      `Mobile perk editor creates no horizontal overflow at ${width}px`);

    await page.keyboard.press('Escape');
    assert.equal(await picker.count(), 0, `Escape closes the mobile perk editor at ${width}px`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  try {
    const result = await smokeStage(resolve(process.argv[2] || 'release/runtime'), {
      channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge',
      regression: mobilePerkEditorRegression,
    });
    console.log({ localhost: result.localhost, browser: result.browser, checks: 'mobile perk editor footprint' });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
