import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';
import { smokeStage } from './smoke.mjs';

async function regression(page, origin) {
  page.setDefaultTimeout(8000);
  for (let attempt = 1; attempt <= 12; attempt++) {
    const save = freshSave();
    save.characters['meg-thomas'].notes = 'Existing note';
    await page.goto(origin + '/#character/meg-thomas/overview');
    await page.evaluate(value => localStorage.setItem('dbdTrackerData', JSON.stringify(value)), save);
    await page.reload();
    await page.getByRole('link', { name: 'Perks', exact: true }).click();
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
    await page.locator('[data-character-task-field="notes"]').fill(`History race ${attempt}`);

    await page.goBack();
    await page.locator('#dirty-navigation[open]').waitFor();
    await page.locator('#dirty-navigation [value="stay"]').click();
    await page.waitForFunction(() => location.hash === '#character/meg-thomas/overview');

    await page.goBack();
    await page.locator('#dirty-navigation[open]').waitFor();
    const beforeDiscard = await page.evaluate(() => ({
      hash: location.hash,
      historyLength: history.length,
      workspaceIndex: history.state?.workspaceIndex ?? null,
      dialogOpen: Boolean(document.querySelector('#dirty-navigation')?.open),
    }));
    await page.locator('#dirty-navigation [value="discard"]').click();
    try {
      await page.waitForFunction(() => location.hash === '#character/meg-thomas/perks', null, { timeout: 4000 });
    } catch (error) {
      const afterDiscard = await page.evaluate(() => ({
        hash: location.hash,
        historyLength: history.length,
        workspaceIndex: history.state?.workspaceIndex ?? null,
        dialogOpen: Boolean(document.querySelector('#dirty-navigation')?.open),
        notesEditorPresent: Boolean(document.querySelector('[data-character-task-field="notes"]')),
      }));
      console.error('HISTORY_RACE=' + JSON.stringify({ attempt, beforeDiscard, afterDiscard }));
      throw error;
    }
    assert.equal(await page.locator('#dirty-navigation').evaluate(node => node.open), false);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await smokeStage(resolve(process.argv[2] || '.'), { channel: 'msedge', regression })); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
