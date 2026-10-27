import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave, parseSave } from '../../src/model.js';

const original = ' \r\n{"damaged":"<img src=x onerror=alert(1)>"';
const candidate = freshSave();
candidate.characters['meg-thomas'].bloodwebLevel = 31;
candidate.characters['meg-thomas'].favorite = true;
candidate.characters['meg-thomas'].perks = { camaraderie: 0, renewal: 2, 'future-perk': 1 };
candidate.planning.unresolved = [{ queue: 'prestige', role: null, rank: 0,
  record: { characterId: 'future-goal-only', targetPrestige: 9 } }];
candidate.characters['meg-thomas'].inventory.items['survivor-item-test-future'] = 7;
candidate.characters['meg-thomas'].inventory.items['survivor-item-key-broken-key'] = 4;
candidate.characters['meg-thomas'].inventory.addons['survivor-addon-flashlight-battery'] = 6;
candidate.characters['the-doctor'].inventory.addons['killer-addon-test-future'] = 3;
const backup = { id: 'recovery-good', reason: 'Synthetic good backup', createdAt: candidate.updatedAt, save: candidate };
const currentBytes = page => page.evaluate(() => localStorage.getItem('dbdTrackerData'));
const recoveryCopies = page => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('dbdTrackerRecovery-')).map(key => localStorage.getItem(key)));
async function seed(page, origin, backups = JSON.stringify([backup])) {
  await page.evaluate(({ original, backups }) => {
    for (const key of Object.keys(localStorage).filter(key => key.startsWith('dbdTrackerRecovery-'))) localStorage.removeItem(key);
    localStorage.setItem('dbdTrackerData', original);
    localStorage.setItem('dbdTrackerBackups', backups);
  }, { original, backups });
  await page.goto(origin + '/#data'); await page.reload();
  await page.getByRole('heading', { name: 'Data & backups', exact: true }).waitFor();
}
const importFile = (page, value = JSON.stringify(candidate)) => page.locator('#import-file').setInputFiles({ name: 'synthetic-recovery.json', mimeType: 'application/json', buffer: Buffer.from(value) });
async function acceptImport(page) {
  await importFile(page); await page.locator('#confirm-accept').click();
}
async function expectRecovered(page) {
  await page.waitForFunction(() => document.querySelector('#save-status').textContent !== 'Stored save needs recovery');
  const saved = parseSave(await currentBytes(page)).save;
  assert.equal(saved.characters['meg-thomas'].bloodwebLevel, 31);
  assert.equal(saved.characters['meg-thomas'].favorite, true);
  assert.deepEqual(saved.characters['meg-thomas'].perks, { camaraderie: 0, 'second-wind': 2, 'future-perk': 1 });
  assert.deepEqual(saved.planning, candidate.planning);
  assert.deepEqual(saved.characters['meg-thomas'].inventory, candidate.characters['meg-thomas'].inventory);
  assert.deepEqual(saved.characters['the-doctor'].inventory, candidate.characters['the-doctor'].inventory);
  assert.deepEqual(await recoveryCopies(page), [original]);
  assert.equal(await page.locator('#main [data-action="export"]').isEnabled(), true);
  await page.reload();
  assert.equal(await page.locator('#main [data-action="export"]').isEnabled(), true);
  const event = page.waitForEvent('download'); await page.locator('#main [data-action="export"]').click();
  const downloaded = await event;
  assert.deepEqual(parseSave(await readFile(await downloaded.path(), 'utf8')).save, saved);
}

export async function recoveryRegression(page, origin) {
  await seed(page, origin);
  assert.ok(await page.locator('[data-action="export"]').evaluateAll(nodes => nodes.length === 2 && nodes.every(n => n.disabled)), 'Blocked current must not export fallback progress');
  assert.equal(await page.locator('#main img[src="x"]').count(), 0, 'Raw stored text is never rendered as HTML');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export original stored data', exact: true }).click();
  const downloaded = await event;
  assert.equal(await readFile(await downloaded.path(), 'utf8'), original);
  assert.deepEqual(await recoveryCopies(page), []);
  for (const width of [500, 700, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Recovery Data controls overflow at ${width}`);
    for (const selector of ['[data-action="raw-export"]', '[data-action="import"]', '[data-action="restore"]']) assert.equal(await page.locator(selector).first().isVisible(), true);
  }
  await importFile(page); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await currentBytes(page), original); assert.deepEqual(await recoveryCopies(page), []);
  await importFile(page, '{bad incoming JSON');
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('valid JSON'));
  assert.equal(await currentBytes(page), original); assert.deepEqual(await recoveryCopies(page), []);
  const backups = await page.evaluate(() => localStorage.getItem('dbdTrackerBackups'));
  await acceptImport(page);
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Import complete.'));
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups')), backups);
  await expectRecovered(page);

  // Restore works while current is blocked; cancellation and invalid selected items cannot preserve/write anything.
  await seed(page, origin);
  await page.locator('[data-action="restore"]').click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await currentBytes(page), original); assert.deepEqual(await recoveryCopies(page), []);
  await page.locator('[data-action="restore"]').click(); await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Backup restored.'));
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups')), backups);
  await expectRecovered(page);
  await seed(page, origin, JSON.stringify([{ ...backup, save: { schemaVersion: 99 } }]));
  await page.locator('[data-action="restore"]').click();
  if (await page.locator('#confirmation').evaluate(node => node.open)) await page.locator('#confirm-accept').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Unsupported schema'));
  assert.equal(await currentBytes(page), original); assert.deepEqual(await recoveryCopies(page), []);

  // Corrupt collection stays untouched and is an explicit obstruction; recovery import does not read it.
  await seed(page, origin, '{broken backups');
  assert.equal(await page.locator('[data-action="restore"]').count(), 0);
  assert.match(await page.locator('#main').textContent(), /backups.*(read|import)/i);
  await acceptImport(page);
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Import complete.'));
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups')), '{broken backups');
  await expectRecovered(page);

  for (const failure of ['read', 'preserve', 'current']) {
    await seed(page, origin);
    await page.evaluate(failure => {
      window.recoveryGetItem = Storage.prototype.getItem; window.recoverySetItem = Storage.prototype.setItem;
      Storage.prototype.getItem = function(key) { if (failure === 'read' && key === 'dbdTrackerData') throw Error('recovery read denied'); return window.recoveryGetItem.call(this, key); };
      Storage.prototype.setItem = function(key, value) {
        if ((failure === 'preserve' && key.startsWith('dbdTrackerRecovery-')) || (failure === 'current' && key === 'dbdTrackerData')) throw Error('recovery write denied');
        return window.recoverySetItem.call(this, key, value);
      };
    }, failure);
    if (failure === 'read') {
      let downloads = 0;
      const countDownload = () => { downloads++; };
      page.on('download', countDownload);
      await page.locator('[data-action="raw-export"]').click();
      await page.waitForFunction(() => document.querySelector('#message').textContent.includes('read denied'));
      assert.equal(downloads, 0, 'Unreadable original cannot be claimed exported');
      page.off('download', countDownload);
    }
    await page.evaluate(() => { document.querySelector('#message').textContent = ''; });
    await acceptImport(page);
    await page.waitForFunction(() => document.querySelector('#message').textContent.includes('denied'));
    assert.equal(await page.locator('#save-status').textContent(), 'Stored save needs recovery');
    assert.ok(await page.locator('[data-action="export"]').evaluateAll(nodes => nodes.every(n => n.disabled)));
    await page.evaluate(() => { Storage.prototype.getItem = window.recoveryGetItem; Storage.prototype.setItem = window.recoverySetItem; });
    assert.equal(await currentBytes(page), original);
    assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerBackups')), backups);
    assert.deepEqual(await recoveryCopies(page), failure === 'current' ? [original] : []);
  }
  // Leave normal current data for any following regression suite.
  await seed(page, origin); await acceptImport(page);
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Import complete.'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  console.log(await smokeStage(resolve(process.argv[2] || 'release/runtime'), { channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge', regression: recoveryRegression }));
}
