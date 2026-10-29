import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';

async function settleHistoryGuard(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function characterContextualTaskRegression(page, origin) {
  page.setDefaultTimeout(30000);
  const bytes = () => page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  for (const [id, otherId, role, unknownAddonId] of [
    ['meg-thomas', 'the-doctor', 'Survivor', 'survivor-addon-future-unresolved'],
    ['the-doctor', 'meg-thomas', 'Killer', 'killer-addon-future-unresolved'],
  ]) {
    const save = freshSave();
    save.characters[id].notes = 'Existing note';
    save.characters[id].prestige = 2;
    save.characters[id].bloodwebLevel = 23;
    save.characters[id].inventory.addons[unknownAddonId] = 7;
    await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
    await page.goto(origin + '/#character/' + id + '/overview');
    await page.reload();
    const before = await bytes();
    assert.equal(JSON.parse(before).characters[id].notes, 'Existing note', role + ' synthetic starting note was seeded');
    assert.match(await page.locator('[data-character-header]').textContent(), new RegExp(role));

    const progressTrigger = page.getByRole('button', { name: /^Edit Prestige and Bloodweb progress/ });
    assert.equal(await progressTrigger.count(), 1, role + ' has one direct progression trigger');
    assert.equal(await page.locator('[data-character-progress-trigger]').count(), 1, role + ' progression values share one keyboard stop');
    assert.equal(await page.locator('[data-overview-section="progress"]').count(), 0, role + ' no longer has the Progress / setup card');
    assert.equal(await page.locator('[data-overview-section="setup"]').count(), 1, role + ' retains subordinate setup status');
    assert.equal(await page.getByRole('button', { name: 'Edit progression', exact: true }).count(), 0,
      role + ' does not require a separate Edit progression button');

    await page.locator('[data-character-progress="prestige"]').click();
    let progressionEditor = page.getByRole('dialog', { name: 'Edit progress', exact: true });
    assert.equal(await progressionEditor.count(), 1, role + ' Prestige value opens the shared editor');
    assert.equal(await page.locator('[data-character-task-field="prestige"]').inputValue(), '2');
    assert.equal(await page.locator('[data-character-task-field="bloodwebLevel"]').inputValue(), '23');
    assert.equal(await page.locator('[data-character-task-field="prestige"]').evaluate(node => node === document.activeElement), true,
      role + ' opening moves focus into the editor');
    await progressionEditor.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await progressTrigger.evaluate(node => node === document.activeElement), true, role + ' Cancel returns focus to the trigger');
    assert.equal(await bytes(), before, role + ' opening and canceling does not write');
    await page.locator('[data-character-progress="bloodweb"]').click();
    progressionEditor = page.getByRole('dialog', { name: 'Edit progress', exact: true });
    assert.equal(await progressionEditor.count(), 1, role + ' Bloodweb value opens the same editor');
    assert.equal(await page.locator('[data-character-task-field="prestige"]').inputValue(), '2');
    assert.equal(await page.locator('[data-character-task-field="bloodwebLevel"]').inputValue(), '23');
    await progressionEditor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await progressTrigger.press('Enter');
    assert.equal(await page.locator('[data-character-task="progression"]').count(), 1, role + ' Enter opens progression editing');
    await page.locator('[data-character-task-field="prestige"]').fill('9');
    await page.locator('[data-character-task-field="bloodwebLevel"]').fill('41');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-character-task="progression"]').count(), 0, role + ' Escape cancels the editor');
    assert.equal(await progressTrigger.evaluate(node => node === document.activeElement), true, role + ' Escape returns focus to the trigger');
    assert.equal(await bytes(), before, role + ' Escape cancellation does not write');
    await progressTrigger.press('Space');
    assert.equal(await page.locator('[data-character-task="progression"]').count(), 1, role + ' Space opens progression editing');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await progressTrigger.click();
    assert.equal(await page.getByLabel('Prestige', { exact: true }).inputValue(), '2', role + ' Prestige has a programmatic label');
    assert.equal(await page.getByLabel('Bloodweb level (1–50)', { exact: true }).inputValue(), '23', role + ' Bloodweb has a programmatic label');
    await page.locator('[data-character-task-field="prestige"]').fill('1.5');
    await page.locator('[data-character-task-field="bloodwebLevel"]').fill('43');
    await page.getByRole('button', { name: 'Save progression', exact: true }).click();
    assert.equal(await page.locator('[data-character-task-field="prestige"]').inputValue(), '1.5', role + ' invalid raw Prestige remains visible');
    assert.equal(await bytes(), before, role + ' invalid progression does not write');
    let prestigeDescription = await page.locator('[data-character-task-field="prestige"]').getAttribute('aria-describedby');
    assert.ok(prestigeDescription, role + ' invalid Prestige references its error text');
    assert.equal(await page.locator('#' + prestigeDescription.split(/\s+/)[0]).isVisible(), true, role + ' Prestige error is visible');
    for (const invalid of ['', '-1', '-0', '1.5', '9007199254740992']) {
      await page.locator('[data-character-task-field="prestige"]').fill(invalid);
      await page.getByRole('button', { name: 'Save progression', exact: true }).click();
      assert.equal(await page.locator('[data-character-task-field="prestige"]').inputValue(), invalid,
        role + ' invalid raw Prestige is retained: ' + JSON.stringify(invalid));
      assert.equal(await bytes(), before, role + ' invalid Prestige never writes: ' + JSON.stringify(invalid));
    }
    await page.locator('[data-character-task-field="prestige"]').fill('3');
    await page.locator('[data-character-task-field="bloodwebLevel"]').fill('51');
    await page.getByRole('button', { name: 'Save progression', exact: true }).click();
    assert.equal(await page.locator('[data-character-task-field="bloodwebLevel"]').inputValue(), '51', role + ' invalid raw Bloodweb remains visible');
    assert.equal(await page.locator('[data-character-task-field="bloodwebLevel"]').getAttribute('aria-invalid'), 'true');
    const bloodwebDescription = await page.locator('[data-character-task-field="bloodwebLevel"]').getAttribute('aria-describedby');
    assert.ok(bloodwebDescription, role + ' invalid Bloodweb references its error text');
    assert.match(await page.locator('#' + bloodwebDescription.split(/\s+/)[0]).textContent(), /1–50/);
    assert.equal(await page.locator('[data-character-task-errors][role="alert"]').count(), 1, role + ' validation is announced');
    assert.equal(await bytes(), before, role + ' invalid Bloodweb does not write');
    await page.locator('[data-character-task-field="bloodwebLevel"]').fill('43');
    await page.getByRole('button', { name: 'Save progression', exact: true }).click();
    let stored = JSON.parse(await bytes());
    assert.equal(stored.characters[id].prestige, 3, role + ' accepts Prestige above P100');
    assert.equal(stored.characters[id].bloodwebLevel, 43, role + ' saves Bloodweb with Prestige atomically');
    assert.equal(stored.characters[id].notes, 'Existing note', role + ' progression leaves Notes untouched');
    assert.deepEqual(stored.characters[id].inventory.addons, save.characters[id].inventory.addons, role + ' progression preserves unknown inventory');
    assert.deepEqual(stored.characters[otherId], save.characters[otherId], role + ' progression cannot update another character');
    assert.equal(await progressTrigger.evaluate(node => node === document.activeElement), true, role + ' successful Save returns focus to progression');
    const native = page.locator('[data-overview-native-perk]').first();
    assert.match(await native.textContent(), /Effective Tier III/, role + ' Prestige updates this character\'s effective native tier');
    assert.match(await native.textContent(), /Account: Tier III/, role + ' Prestige updates account access');

    for (const allowed of ['100', String(Number.MAX_SAFE_INTEGER), '0']) {
      await progressTrigger.click();
      await page.locator('[data-character-task-field="prestige"]').fill(allowed);
      await page.getByRole('button', { name: 'Save progression', exact: true }).click();
      assert.equal(JSON.parse(await bytes()).characters[id].prestige, Number(allowed),
        role + ' supported Prestige value saves without an artificial cap: ' + allowed);
    }

    const afterProgression = await bytes();
    await progressTrigger.click();
    await page.getByRole('button', { name: 'Save progression', exact: true }).click();
    assert.equal(await bytes(), afterProgression, role + ' no-op save preserves timestamps and bytes');
    await progressTrigger.click();
    await page.locator('[data-character-task-field="bloodwebLevel"]').fill('44');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await bytes(), afterProgression, role + ' Cancel does not write a progression draft');
    assert.equal(await progressTrigger.evaluate(node => node === document.activeElement), true, role + ' canceled draft returns focus');

    await progressTrigger.click();
    await page.locator('[data-character-task-field="prestige"]').fill('4');
    await page.locator('[data-character-task-field="bloodwebLevel"]').fill('44');
    const beforeProgressionFailure = await bytes();
    const displayedBeforeProgressionFailure = await page.locator('.character-workspace-progress').textContent();
    await page.evaluate(() => {
      window.originalProgressionSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'dbdTrackerData') throw Error('Synthetic progression write failure');
        return window.originalProgressionSetItem.call(this, key, value);
      };
    });
    await page.getByRole('button', { name: 'Save progression', exact: true }).click();
    assert.equal(await page.locator('[data-character-task-field="prestige"]').inputValue(), '4', role + ' failed Save retains Prestige draft');
    assert.equal(await page.locator('[data-character-task-field="bloodwebLevel"]').inputValue(), '44', role + ' failed Save retains Bloodweb draft');
    assert.equal(await page.locator('[data-character-task-errors][role="alert"]').isVisible(), true, role + ' failed Save exposes an error');
    assert.equal(await bytes(), beforeProgressionFailure, role + ' failed Save writes neither progression value');
    assert.equal(await page.locator('.character-workspace-progress').textContent(), displayedBeforeProgressionFailure, role + ' failed Save does not display unpersisted values');
    await page.evaluate(() => { Storage.prototype.setItem = window.originalProgressionSetItem; });
    await page.getByRole('button', { name: 'Save progression', exact: true }).click();
    stored = JSON.parse(await bytes());
    assert.equal(stored.characters[id].prestige, 4, role + ' retry saves Prestige');
    assert.equal(stored.characters[id].bloodwebLevel, 44, role + ' retry saves Bloodweb atomically');
    assert.equal(await progressTrigger.evaluate(node => node === document.activeElement), true, role + ' successful retry returns focus');

    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    const note = '<script>full note</script>'.repeat(30);
    await page.locator('[data-character-task-field="notes"]').fill(note);
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    stored = JSON.parse(await bytes());
    assert.equal(stored.characters[id].notes, note, role + ' Notes preserve complete escaped plain text');
    assert.equal(await page.locator('[data-overview-section="notes"] script').count(), 0, role + ' Notes render as text');
    assert.deepEqual(stored.characters[id].inventory.addons, save.characters[id].inventory.addons, role + ' Notes preserve inventory');
    const afterNote = await bytes();

    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    await page.locator('[data-character-task-field="notes"]').fill('Canceled note');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await bytes(), afterNote, role + ' Cancel does not write a Notes draft');

    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    await page.locator('[data-character-task-field="notes"]').fill('Retain on failure');
    const beforeFailure = await bytes();
    await page.evaluate(() => {
      window.originalTaskSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'dbdTrackerData') throw Error('Synthetic write failure');
        return window.originalTaskSetItem.call(this, key, value);
      };
    });
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Retain on failure', role + ' failed save retains raw Notes');
    assert.equal(await bytes(), beforeFailure, role + ' failed save leaves stored bytes unchanged');
    await page.evaluate(() => { Storage.prototype.setItem = window.originalTaskSetItem; });
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    assert.equal(JSON.parse(await bytes()).characters[id].notes, 'Retain on failure', role + ' can retry the same failed Notes save');

    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    await page.locator('[data-character-task-field="notes"]').fill('Conflict draft');
    await page.evaluate(({ otherId }) => {
      const oldValue = localStorage.getItem('dbdTrackerData');
      const incoming = JSON.parse(oldValue);
      incoming.characters[otherId].favorite = !incoming.characters[otherId].favorite;
      const newValue = JSON.stringify(incoming);
      localStorage.setItem('dbdTrackerData', newValue);
      window.dispatchEvent(new StorageEvent('storage', { key: 'dbdTrackerData', oldValue, newValue }));
    }, { otherId });
    assert.equal(await page.locator('#save-status').textContent(), 'Saved locally', role + ' valid external replacement remains writable');
    assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Conflict draft', role + ' storage replacement retains the draft');
    assert.equal(await page.getByRole('button', { name: 'Save note', exact: true }).isDisabled(), true, role + ' stale task cannot overwrite replacement save');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await page.locator('[data-action="overview-ownership-toggle"]').click();
    stored = JSON.parse(await bytes());
    assert.equal(stored.characters[id].owned, true, role + ' ownership action saves immediately');
    const favorite = page.locator('.character-workspace-favorite');
    await favorite.click();
    stored = JSON.parse(await bytes());
    assert.equal(await favorite.getAttribute('aria-pressed'), 'true');
    assert.equal(stored.characters[id].favorite, true, role + ' Favorite saves independently and immediately');
    assert.deepEqual(stored.characters[id].inventory.addons, save.characters[id].inventory.addons, role + ' state actions preserve inventory');

    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    await page.locator('[data-character-task-field="notes"]').fill('Guarded data replacement draft');
    const beforeGuardedReplacement = await bytes();
    await page.locator('[data-action="enable-editing"]').dispatchEvent('click');
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="stay"]').click();
    assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Guarded data replacement draft', role + ' writer retry cannot discard a task draft');
    assert.equal(await bytes(), beforeGuardedReplacement, role + ' writer retry leaves the current save intact');
    await page.locator('#import-file').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(beforeGuardedReplacement) });
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="stay"]').click();
    assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Guarded data replacement draft', role + ' import cancellation retains the task draft');
    assert.equal(await bytes(), beforeGuardedReplacement, role + ' import cancellation preserves the current save');
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.id = 'test-phase10-reset'; button.dataset.action = 'reset'; button.textContent = 'Synthetic reset request';
      document.querySelector('main').append(button);
    });
    await page.locator('#test-phase10-reset').click();
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="stay"]').click();
    assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Guarded data replacement draft', role + ' reset cancellation retains the task draft');
    assert.equal(await bytes(), beforeGuardedReplacement, role + ' reset cancellation preserves the current save');
    await page.locator('#test-phase10-reset').evaluate(button => button.remove());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    const beforeDiscard = await bytes();
    await progressTrigger.click();
    await page.locator('[data-character-task-field="prestige"]').fill('5');
    await page.getByRole('link', { name: 'Perks', exact: true }).click();
    await page.getByRole('button', { name: 'Stay', exact: true }).click();
    assert.ok(page.url().endsWith('/overview'), role + ' Stay keeps the source task open');
    assert.equal(await page.locator('[data-character-task-field="prestige"]').inputValue(), '5', role + ' Stay retains raw progression');
    assert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), true,
      role + ' unload remains guarded while a task draft is dirty');
    await page.getByRole('link', { name: 'Perks', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/perks');
    assert.equal(await bytes(), beforeDiscard, role + ' Discard leaves the task unapplied');

    await page.goto(origin + '/?phase10-history-' + id + '#character/' + id + '/overview');
    await page.reload();
    await page.getByRole('link', { name: 'Perks', exact: true }).click();
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    const beforeHistoryDraft = await bytes();
    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    await page.locator('[data-character-task-field="notes"]').fill('Back navigation draft');
    await page.goBack();
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="stay"]').click();
    await settleHistoryGuard(page);
    assert.ok(page.url().endsWith('/overview'), role + ' Back Stay restores the source route');
    assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Back navigation draft', role + ' Back Stay retains the task draft');
    await page.goBack();
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="discard"]').click();
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/perks');
    assert.equal(await bytes(), beforeHistoryDraft, role + ' Back Discard does not save the draft');

    await page.goForward();
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/overview');
    await page.getByRole('link', { name: 'Perks', exact: true }).click();
    await page.goBack();
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/overview');
    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    await page.locator('[data-character-task-field="notes"]').fill('Forward navigation draft');
    await page.goForward();
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="stay"]').click();
    await settleHistoryGuard(page);
    assert.ok(page.url().endsWith('/overview'), role + ' Forward Stay restores the source route');
    assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Forward navigation draft', role + ' Forward Stay retains the task draft');
    await page.goForward();
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="discard"]').click();
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/perks');
    assert.equal(await bytes(), beforeHistoryDraft, role + ' Forward Discard does not save the draft');

    await page.goto(origin + '/?phase10-legacy-' + id + '#character/' + id + '/edit');
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/overview');
    assert.equal(await page.locator('[data-character-edit]').count(), 0, role + ' direct Edit bookmark resolves to Overview');
    const beforeLegacyRoute = await bytes();
    await page.reload();
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/overview');
    assert.equal(await bytes(), beforeLegacyRoute, role + ' refreshing a legacy bookmark does not save');
    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    await page.locator('[data-character-task-field="notes"]').fill('Legacy route draft');
    await page.evaluate(id => { location.hash = '#character/' + id + '/edit'; }, id);
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="stay"]').click();
    await settleHistoryGuard(page);
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/overview');
    assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Legacy route draft', role + ' Stay retains the task draft on a legacy route attempt');
    assert.equal(await bytes(), beforeLegacyRoute, role + ' Stay on legacy route does not write');
    await page.evaluate(id => { location.hash = '#character/' + id + '/edit'; }, id);
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="discard"]').click();
    await page.waitForFunction(hash => location.hash === hash, '#character/' + id + '/overview');
    assert.equal(await bytes(), beforeLegacyRoute, role + ' Discard then legacy-route resolution does not save');
  }
}
export async function characterEditRegression(page, origin) {
  await characterContextualTaskRegression(page, origin);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  await smokeStage(resolve(process.argv[2] || 'release/runtime'), { regression: characterEditRegression });
  console.log('Character Edit regression PASS');
}
