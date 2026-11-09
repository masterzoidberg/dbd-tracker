import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';
import { smokeStage } from './smoke.mjs';

export async function compactNavigationRegression(page, origin) {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto(origin + '/#character/meg-thomas/overview');
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), freshSave());
  await page.reload();
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click();
  const notes = page.locator('[data-character-task-field="notes"]');
  await notes.fill('Unsaved compact navigation regression');
  const before = await page.evaluate(() => [localStorage.getItem('dbdTrackerData'), localStorage.getItem('dbdTrackerBackups')]);
  const menu = page.locator('#menu-toggle');
  const destination = page.locator('#global-nav a').first();
  for (const capture of [false, true]) {
    for (let iteration = 0; iteration < 3; iteration++) {
      await menu.click();
      await destination.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Stay', exact: true }).waitFor();
      await page.evaluate(() => {
        window.__escapeCloseFinished = false;
        document.querySelector('#dirty-navigation').addEventListener('close', () => { window.__escapeCloseFinished = true; }, { once: true });
      });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__escapeCloseFinished && !document.querySelector('#dirty-navigation').open && document.activeElement.matches('#global-nav a'));
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Stay', exact: true }).waitFor();
      await page.evaluate(capture => {
        window.__lateFocusFinished = false;
        document.querySelector('#dirty-navigation').addEventListener('close', () => {
          requestAnimationFrame(() => {
            document.activeElement.blur();
            window.__lateFocusFinished = true;
          });
        }, { capture, once: true });
      }, capture);
      await page.getByRole('button', { name: 'Stay', exact: true }).press('Enter');
      // Do not accept transient focus before the simulated native restoration.
      await page.waitForFunction(() => window.__lateFocusFinished);
      await page.waitForFunction(() => document.activeElement.id === 'menu-toggle');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('#dirty-navigation').evaluate(node => node.open), false);
      assert.equal(await notes.inputValue(), 'Unsaved compact navigation regression');
      assert.equal(new URL(page.url()).hash, '#character/meg-thomas/overview');
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('dbdTrackerData'), localStorage.getItem('dbdTrackerBackups')]), before);
    }
  }
  // A user choosing another visible control after close owns focus; the
  // pending Menu repair must not take it back on the following frame.
  await menu.click();
  await destination.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Stay', exact: true }).waitFor();
  await page.evaluate(() => {
    window.__newFocusSettled = false;
    document.querySelector('#dirty-navigation').addEventListener('close', () => {
      requestAnimationFrame(() => {
        document.querySelector('[data-character-task-field="notes"]').focus();
        requestAnimationFrame(() => { window.__newFocusSettled = true; });
      });
    }, { once: true });
  });
  await page.getByRole('button', { name: 'Stay', exact: true }).press('Enter');
  await page.waitForFunction(() => window.__newFocusSettled);
  assert.equal(await notes.evaluate(node => node === document.activeElement), true, 'Menu repair does not steal a newer focus destination');
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('dbdTrackerData'), localStorage.getItem('dbdTrackerBackups')]), before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await notes.waitFor({ state: 'detached' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await smokeStage(process.cwd(), { channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge', regression: async (page, origin) => {
    if (process.argv.includes('--slow')) {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await compactNavigationRegression(page, origin);
  } }));
  console.log('PASS: repeated Stay/Escape, both close-listener orders, draft and save/backup preservation.');
}
