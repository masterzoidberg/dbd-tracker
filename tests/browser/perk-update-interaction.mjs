import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';

const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('dbdTrackerData')));
const card = (page, perkId) => page.locator(`.perk-card[data-perk="${perkId}"]`);

async function openPerks(page, origin, characterId) {
  await page.goto(`${origin}/#character/${characterId}/perks`);
  await page.locator('#character-inventory-search').waitFor();
}

export async function perkUpdateInteractionRegression(page, origin) {
  const save = freshSave();
  await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
  await page.reload();

  for (const { characterId, perkId, nextPerkId } of [
    { characterId: 'the-doctor', perkId: 'bitter-murmur', nextPerkId: 'monitor-abuse' },
    { characterId: 'meg-thomas', perkId: 'dark-sense', nextPerkId: 'adrenaline' },
  ]) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await openPerks(page, origin, characterId);
      const initialData = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
      assert.equal(await page.getByRole('heading', { name: 'Perks', exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Update Inventory', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 0);
      assert.equal(await page.locator('[data-character-inventory-reference], .character-inventory-editor, [data-character-inventory-detail]').count(), 0,
        'No persistent selected-perk reference panel is rendered');
      assert.equal(await page.locator('.perk-card[aria-pressed="true"]').count(), 0, 'No perk is automatically featured');
      assert.equal(await page.locator('.character-inventory-layout').count(), 0);
      assert.equal(await page.locator('[data-character-inventory-toolbar="perks"]').count(), 1);
      assert.ok(await page.locator('.character-inventory-card-grid .perk-card').count() >= 20, 'The collection is immediately available');
      assert.equal(initialData, await page.evaluate(() => localStorage.getItem('dbdTrackerData')), 'Opening Perks performs no account-data write');

      const target = card(page, perkId);
      await target.evaluate(node => node.scrollIntoView({ block: 'center' }));
      const beforeScroll = await page.evaluate(() => window.scrollY);
      const beforePosition = await target.boundingBox();
      const beforeSave = await stored(page);
      if (width === 320) {
        await target.focus();
        await page.keyboard.press(characterId === 'the-doctor' ? 'Enter' : 'Space');
      } else await page.mouse.click(beforePosition.x + beforePosition.width / 2, beforePosition.y + beforePosition.height / 2);

      const picker = page.locator('.character-inventory-quick-picker');
      assert.equal(await picker.count(), 1, 'Activating a perk card opens its compact Tier selector');
      assert.equal(await picker.locator('[data-action="character-inventory-set-tier"]').first().evaluate(node => node === document.activeElement), true,
        'Keyboard activation moves focus into the Tier choices');
      assert.match(await picker.getAttribute('aria-label'), new RegExp(perkId === 'dark-sense' ? 'Dark Sense' : 'Bitter Murmur'));
      assert.deepEqual(await picker.locator('[data-action="character-inventory-set-tier"]').allTextContents(), ['Not recorded', 'I', 'II', 'III']);
      assert.equal(await picker.locator('[data-action="character-inventory-set-tier"][aria-pressed="true"]').count(), 1,
        'The current personal record is announced with aria-pressed');
      for (const label of ['Recorded', 'Automatic minimum', 'Effective']) {
        assert.ok((await picker.textContent()).includes(label), `Popup exposes ${label.toLowerCase()} state`);
      }
      const pickerBox = await picker.boundingBox();
      const pickerParts = await picker.evaluate(node => [...node.children].map(child => ({
        className: child.className, height: child.getBoundingClientRect().height, text: child.textContent.trim().slice(0, 80),
      })));
      assert.ok(pickerBox.width <= 280 && pickerBox.height <= 260,
        `Tier selector stays compact: ${JSON.stringify({ pickerBox, pickerParts })}`);
      assert.ok(pickerBox.x >= 0 && pickerBox.x + pickerBox.width <= width, `Tier selector fits ${width}px viewport: ${JSON.stringify(pickerBox)}`);
      assert.ok(pickerBox.y >= 0 && pickerBox.y + pickerBox.height <= 844, `Tier selector is reachable at ${width}px: ${JSON.stringify(pickerBox)}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${width}px`);
      const afterPosition = await target.boundingBox();
      assert.deepEqual({ x: afterPosition.x, width: afterPosition.width },
        { x: beforePosition.x, width: beforePosition.width }, 'Opening the selector does not resize or reorder the card');
      assert.ok(Math.abs(afterPosition.height - beforePosition.height) <= 1, 'Opening the selector does not resize the card');
      assert.ok(Math.abs(afterPosition.y - beforePosition.y) <= 1, 'Opening the selector does not move the card');
      assert.ok(await picker.locator('button').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44)),
        'Popup actions retain touch-sized targets');
      if (process.env.TEMP) await page.screenshot({ path: `${process.env.TEMP}/dbd-perks-${characterId}-${width}.png` });

      const tier = width === 320 ? '1' : width === 390 ? '2' : width === 768 ? '3' : 'none';
      await picker.locator(`[data-action="character-inventory-set-tier"][data-tier="${tier}"]`).click();
      assert.equal(await picker.count(), 0, 'Successful save closes the selector');
      assert.equal(new URL(page.url()).hash, `#character/${characterId}/perks`, 'Perks stays the ordinary route after a save');
      assert.equal(await target.evaluate(node => node === document.activeElement), true, 'Focus returns to the edited card');
      assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - beforeScroll) <= 1, 'Successful update preserves scroll position');
      const afterSave = await stored(page);
      for (const [id, progress] of Object.entries(beforeSave.characters)) {
        if (id !== characterId) assert.deepEqual(afterSave.characters[id].perks, progress.perks, 'Other characters are untouched');
      }
      for (const [id, value] of Object.entries(beforeSave.characters[characterId].perks)) {
        if (id !== perkId) assert.equal(afterSave.characters[characterId].perks[id], value, 'Other perks on this character are untouched');
      }
      assert.equal(afterSave.characters[characterId].perks[perkId], tier === 'none' ? undefined : Number(tier));
      assert.equal(await target.evaluate((node, value) => node.classList.contains(`perk-tier-${value}`), tier === 'none' ? 'none' : tier), true,
        'The card immediately reflects the recorded result');
      assert.equal(await target.getAttribute('aria-pressed'), 'false', 'Closing the selector leaves no persistent selected-card treatment');

      const nextTarget = card(page, nextPerkId);
      await nextTarget.evaluate(node => node.scrollIntoView({ block: 'center' }));
      await nextTarget.click();
      assert.equal(await picker.count(), 1, 'Another perk can be edited immediately');
      assert.match(await picker.getAttribute('aria-label'), nextPerkId === 'adrenaline' ? /Adrenaline/ : /Monitor & Abuse/);
      await page.keyboard.press('Escape');
      assert.equal(await picker.count(), 0, 'Escape closes the selector');
      assert.equal(await nextTarget.evaluate(node => node === document.activeElement), true, 'Escape restores focus to its card');

      // Full reference details remain available through a deliberate secondary action.
      await nextTarget.click();
      const detailsAction = page.locator('.character-inventory-quick-picker [data-action="character-inventory-details"]');
      await detailsAction.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#detail[open]').count(), 1, 'Details deliberately opens the full perk reference dialog');
      assert.ok(await page.locator('#detail-content').textContent().then(text => text.includes('CHARACTER-OWNED TIERS')));
      assert.equal(await page.locator('[data-character-inventory-reference]').count(), 0, 'Details is not a persistent page panel');
      await page.locator('#detail [data-action="close"]').click();
      assert.equal(await picker.count(), 1, 'Closing Details returns to the compact selector');
      assert.equal(await detailsAction.evaluate(node => node === document.activeElement), true, 'Closing Details returns focus to its trigger');
      await page.keyboard.press('Escape');

      const beforeFailure = await stored(page);
      await page.evaluate(() => {
        window.perkUpdateOriginalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === 'dbdTrackerData') throw Error('Synthetic perk update write failure');
          return window.perkUpdateOriginalSetItem.call(this, key, value);
        };
      });
      await nextTarget.click();
      await page.locator('.character-inventory-quick-picker [data-tier="3"]').click();
      assert.deepEqual(await stored(page), beforeFailure, 'Failed write preserves the persisted record');
      assert.equal(await page.locator('.character-inventory-quick-picker').count(), 0, 'Failed write does not leave a fake selection open');
      assert.equal(await page.locator('[data-character-inventory-failed-selection]').count(), 1, 'Existing retry/discard safety UI remains available');
      assert.equal(await nextTarget.evaluate(node => node.classList.contains('perk-tier-3')), false, 'Failed save does not update the card');
      await page.evaluate(() => { Storage.prototype.setItem = window.perkUpdateOriginalSetItem; delete window.perkUpdateOriginalSetItem; });
      await page.getByRole('button', { name: 'Discard failed selection' }).click();
      assert.deepEqual(await stored(page), beforeFailure, 'Discarding the failed intent leaves saved state unchanged');
      assert.equal(await page.getByRole('button', { name: 'Update Inventory', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 0);
    }
  }

  for (const { characterId, perkId } of [
    { characterId: 'the-doctor', perkId: 'bitter-murmur' },
    { characterId: 'meg-thomas', perkId: 'dark-sense' },
  ]) {
    const saveWithRecord = await stored(page);
    saveWithRecord.characters[characterId].perks[perkId] = 2;
    await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), saveWithRecord);
    await page.reload();
    await openPerks(page, origin, characterId);
    const target = card(page, perkId);
    await target.click();
    const picker = page.locator('.character-inventory-quick-picker');
    const correct = picker.locator('[data-action="character-inventory-correction-open"]');
    assert.equal(await correct.count(), 1, 'Correct personal record remains available as a separate action');
    await correct.click();
    assert.equal(await page.locator('[data-character-inventory-correction]').count(), 1,
      'Correction opens its deliberate editor rather than changing normal Tier controls');
    assert.equal(await picker.locator('[data-action="character-inventory-set-tier"]').count(), 0,
      'The normal Tier selector is replaced while the correction draft is open');
    await page.locator('[data-character-inventory-correction-tier]').selectOption('1');
    await page.locator('[data-action="character-inventory-correction-apply"]').click();
    assert.equal((await stored(page)).characters[characterId].perks[perkId], 1,
      'The separate correction flow still commits its explicit personal record');
    assert.equal(await page.locator('[data-character-inventory-correction]').count(), 0);
    assert.equal(await picker.locator('[data-action="character-inventory-set-tier"]').count(), 4,
      'Applying a correction returns to the ordinary Tier selector');
  }

  for (const oldRoute of [
    '#character/the-doctor/perks/update', '#manage/the-doctor/update', '#experiment/the-doctor/update',
  ]) {
    await page.goto(`${origin}/${oldRoute}`);
    await page.locator('#character-inventory-search').waitFor();
    assert.equal(new URL(page.url()).hash, '#character/the-doctor/perks', `Old route ${oldRoute} normalizes to Perks`);
    assert.equal(await page.getByRole('button', { name: 'Update Inventory', exact: true }).count(), 0);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  try {
    const result = await smokeStage(resolve(process.argv[2] || 'release/runtime'), {
      channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge',
      regression: perkUpdateInteractionRegression,
    });
    console.log({ localhost: result.localhost, browser: result.browser, checks: 'simplified character Perks workflow' });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
