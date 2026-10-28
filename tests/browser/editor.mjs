import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';
import { schemaV1Fixture } from '../fixtures/schema-v1.js';

const bytes = page => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
const ready = page => page.waitForFunction(() => ['Saved locally', 'Read-only', 'Editing unavailable', 'Stored save needs recovery'].includes(document.querySelector('#save-status').textContent));
async function openGlobalDestination(page, name) {
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  if (!await navigation.isVisible()) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await navigation.getByRole('link', { name }).click();
}
async function detail(page, role, name) {
  await openGlobalDestination(page, new RegExp('^' + role));
  await page.getByPlaceholder('Search characters…').fill(name);
  await page.getByRole('link', { name: `View ${name} workspace`, exact: true }).click();
}
async function forcedChange(page, selector, value, type = 'change') {
  await page.locator(selector).evaluate((node, { value, type }) => { node.value = value; node.dispatchEvent(new Event(type, { bubbles: true })); }, { value, type });
}

export async function editorRegression(a, origin) {
  const context = a.context(), b = await context.newPage(), c = await context.newPage();
  context.setDefaultTimeout(15000);
  try {
    await b.goto(origin + '/'); await ready(b);
    assert.equal(await b.locator('#save-status').textContent(), 'Read-only');
    assert.match(await b.locator('#editor-notice').textContent(), /another tracker window/);
    await c.goto(origin + '/'); await ready(c);
    assert.equal(await c.locator('#save-status').textContent(), 'Read-only');
    const independent = await context.browser().newContext();
    const separate = await independent.newPage(); await separate.goto(origin + '/'); await ready(separate);
    assert.equal(await separate.locator('#save-status').textContent(), 'Saved locally', 'Separate profiles are independently usable');
    await independent.close();
    await detail(b, 'Killers', 'The Trapper');
    const accountStateBeforeEdit = await b.evaluate(() => ({
      save: localStorage.getItem('dbdTrackerData'), backups: localStorage.getItem('dbdTrackerBackups'),
    }));
    assert.equal(await b.locator('[data-character-progress-trigger]').count(), 0, 'Read-only Overview values do not advertise an active editor');
    assert.equal(await b.locator('[data-character-progress]').count(), 2, 'Read-only progression values remain readable');
    assert.equal(await b.locator('[data-character-task="progression"]').count(), 0, 'Read-only activation cannot open progression editing');
    assert.deepEqual(await b.evaluate(() => ({
      save: localStorage.getItem('dbdTrackerData'), backups: localStorage.getItem('dbdTrackerBackups'),
    })), accountStateBeforeEdit, 'Programmatic progression edit must not write account data');
    await openGlobalDestination(b, 'Data & backups');
    const accountStateBeforeDeniedActions = await b.evaluate(() => ({
      save: localStorage.getItem('dbdTrackerData'), backups: localStorage.getItem('dbdTrackerBackups'),
    }));
    for (const action of ['import', 'reset']) {
      assert.equal(await b.locator(`[data-action="${action}"]`).first().isDisabled(), true);
      await b.locator(`[data-action="${action}"]`).first().dispatchEvent('click');
    }
    const incoming = freshSave(); incoming.characters['meg-thomas'].bloodwebLevel = 49;
    await b.locator('#import-file').setInputFiles({ name: 'denied.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
    assert.equal(await b.locator('#confirmation').isVisible(), false);
    assert.deepEqual(await b.evaluate(() => ({
      save: localStorage.getItem('dbdTrackerData'), backups: localStorage.getItem('dbdTrackerBackups'),
    })), accountStateBeforeDeniedActions, 'Denied data actions leave account data untouched');
    assert.equal(await b.locator('[data-action="export"]').first().isEnabled(), true);
    for (const width of [500, 700, 900]) {
      await b.setViewportSize({ width, height: 900 });
      assert.equal(await b.locator('[data-action="enable-editing"]').isVisible(), true);
      assert.ok(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await detail(a, 'Survivors', 'Meg Thomas');
    await a.locator('[data-character-progress-trigger]').click();
    await a.locator('[data-character-task-field="bloodwebLevel"]').fill('29');
    await a.getByRole('button', { name: 'Save progression', exact: true }).click();
    await b.waitForFunction(() => document.querySelector('#message').textContent.includes('another tab'));
    await a.close();
    await b.waitForFunction(async () => !(await navigator.locks.query()).held.some(l => l.name === 'dbdTracker-editor'));
    assert.equal(await b.locator('#save-status').textContent(), 'Read-only', 'No automatic takeover');
    // Seed a latest save without a storage event to B, so retry itself must reload it.
    incoming.characters['meg-thomas'].bloodwebLevel = 37;
    await b.evaluate(raw => localStorage.setItem('dbdTrackerData', raw), JSON.stringify(incoming));
    await detail(b, 'Survivors', 'Meg Thomas');
    // Exercise retry with a mounted dialog through the event handler; ordinary
    // users close the modal before clicking the notice behind it.
    await b.locator('[data-action="enable-editing"]').dispatchEvent('click');
    await b.waitForFunction(() => document.querySelector('#save-status').textContent === 'Saved locally');
    await b.locator('[data-character-progress-trigger]').click();
    assert.equal(await b.locator('[data-character-task-field="bloodwebLevel"]').inputValue(), '37');
    await b.locator('[data-character-task-field="bloodwebLevel"]').fill('38');
    await b.getByRole('button', { name: 'Save progression', exact: true }).click();
    assert.equal(JSON.parse((await bytes(b)).dbdTrackerData).characters['meg-thomas'].bloodwebLevel, 38);
    assert.equal(await c.locator('#save-status').textContent(), 'Read-only');
  } finally { await b.close(); await c.close(); }

  // Simultaneous startups on a legacy save: only the owner may migrate/back up.
  const seed = await context.newPage(); await seed.goto(origin + '/'); await ready(seed);
  const legacy = schemaV1Fixture(); delete legacy.accountRulesVersion;
  await seed.evaluate(raw => { localStorage.clear(); localStorage.setItem('dbdTrackerData', raw); }, JSON.stringify(legacy));
  await seed.close();
  const d = await context.newPage(), e = await context.newPage();
  await Promise.all([d.goto(origin + '/'), e.goto(origin + '/')]); await Promise.all([ready(d), ready(e)]);
  assert.deepEqual((await Promise.all([d.locator('#save-status').textContent(), e.locator('#save-status').textContent()])).sort(), ['Read-only', 'Saved locally']);
  const owner = await d.locator('#save-status').textContent() === 'Saved locally' ? d : e;
  const reader = owner === d ? e : d;
  assert.equal(JSON.parse((await bytes(owner)).dbdTrackerBackups).length, 1);
  assert.equal(JSON.parse((await bytes(owner)).dbdTrackerBackups)[0].save.schemaVersion, 1);
  const migrated = JSON.parse((await bytes(owner)).dbdTrackerData);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.planning.prestigeQueues, { survivor: [], killer: [] });
  assert.deepEqual(migrated.characters['meg-thomas'].inventory, { items: {}, addons: {} });
  await openGlobalDestination(reader, 'Data & backups');
  const stable = await bytes(reader);
  for (const action of ['restore', 'delete-backup']) {
    assert.equal(await reader.locator(`[data-action="${action}"]`).first().isDisabled(), true);
    await reader.locator(`[data-action="${action}"]`).first().dispatchEvent('click');
  }
  assert.deepEqual(await bytes(reader), stable);
  // Invalid current data must remain distinct from denied editing; raw export stays available.
  await owner.evaluate(() => localStorage.setItem('dbdTrackerData', '{damaged'));
  await reader.waitForFunction(() => document.querySelector('#message').textContent.includes('invalid data'));
  assert.equal(await reader.locator('[data-action="raw-export"]').isEnabled(), true);
  assert.equal(await reader.locator('[data-action="export"]').first().isDisabled(), true);
  const corrupt = await bytes(reader);
  await reader.locator('#import-file').setInputFiles({ name: 'denied.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(freshSave())) });
  assert.deepEqual(await bytes(reader), corrupt, 'Denied recovery must not write a raw recovery copy');
  await owner.close();
  await reader.waitForFunction(async () => !(await navigator.locks.query()).held.some(l => l.name === 'dbdTracker-editor'));
  await reader.locator('[data-action="enable-editing"]').click();
  await reader.waitForFunction(() => document.querySelector('#save-status').textContent === 'Stored save needs recovery');
  assert.equal(await reader.locator('#save-status').textContent(), 'Stored save needs recovery');
  assert.equal(await reader.locator('[data-action="import"]').isEnabled(), true);
  const crashed = reader.waitForEvent('crash');
  const session = await context.newCDPSession(reader);
  void session.send('Page.crash').catch(() => {});
  await crashed;
  const afterCrash = await context.newPage(); await afterCrash.goto(origin + '/#data'); await ready(afterCrash);
  assert.equal(await afterCrash.locator('#save-status').textContent(), 'Stored save needs recovery', 'Renderer crash releases native ownership');
  assert.equal(await afterCrash.locator('[data-action="import"]').isEnabled(), true);
  await afterCrash.close(); await reader.close();

  for (const mode of ['missing', 'rejected']) {
    const isolated = await context.browser().newContext();
    await isolated.addInitScript(mode => {
      Object.defineProperty(Navigator.prototype, 'locks', { configurable: true, value: mode === 'missing' ? undefined : { request: () => Promise.reject(Error('fixture API rejection')) } });
      Storage.prototype.setItem = function(key, value) { throw Error('Unavailable editor attempted a write: ' + key); };
    }, mode);
    const page = await isolated.newPage(); await page.goto(origin + '/'); await ready(page);
    assert.equal(await page.locator('#save-status').textContent(), 'Editing unavailable');
    assert.match(await page.locator('#editor-notice').textContent(), /unavailable/i);
    await detail(page, 'Survivors', 'Meg Thomas');
    assert.equal(await page.locator('[data-character-progress-trigger]').count(), 0, 'Unavailable editing keeps the Overview progression read-only');
    assert.equal(await page.locator('[data-character-progress]').count(), 2, 'Unavailable editing leaves both values readable');
    assert.equal(await page.locator('[data-character-task="progression"]').count(), 0, 'Unavailable editing cannot open the progression editor');
    assert.deepEqual(await bytes(page), {});
    await isolated.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  try {
    const result = await smokeStage(resolve(import.meta.dirname, '../../release/runtime'), { channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge', regression: editorRegression });
    console.log({ localhost: result.localhost, browser: result.browser, checks: 'M03 editor exclusion, forced mutations, retry/latest data, migration, backups/recovery, renderer crash, separate profiles, missing/rejected API, 500/700/900 notice' });
  }
  catch (error) { console.error(error); process.exitCode = 1; }
}
