import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const workspaceHashes = [
  'character/meg-thomas/overview', 'character/meg-thomas', 'character/meg-thomas/perks',
  'character/meg-thomas/perks/update', 'character/meg-thomas/perks/legacy',
  'character/meg-thomas/edit', 'character/meg-thomas/setup', 'character/meg-thomas/items-addons',
  'character/the-doctor/power-addons', 'manage/meg-thomas', 'manage/meg-thomas/update',
  'manage/meg-thomas/legacy', 'experiment/meg-thomas', 'experiment/meg-thomas/update',
];

const browser = await chromium.launch({ channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge', headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const url = pathToFileURL(resolve(process.argv[2] || 'release/runtime', 'index.html')).href;
  await page.goto(url + '#character/meg-thomas/overview');
  await page.locator('[data-character-workspace]').waitFor();
  const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  for (const hash of workspaceHashes) {
    await page.goto(url + '#' + hash);
    await page.reload();
    await page.locator('[data-character-workspace]').waitFor();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'main','Direct route entry focus');
    assert.equal(await page.locator('h1').textContent(), hash.includes('the-doctor') ? 'The Doctor' : 'Meg Thomas');
  }
  for (const hash of ['character/unknown/overview', 'character/meg-thomas/power-addons', 'character/meg-thomas/perks/update/extra']) {
    await page.goto(url + '#' + hash);
    await page.getByRole('heading', { name: 'Character/section unavailable' }).waitFor();
  }
  await page.goto(url + '#character/meg-thomas/overview');
  await page.getByRole('link', { name: 'Perks', exact: true }).click();
  await page.goBack(); await page.getByRole('link', { name: 'Edit Character', exact: true }).waitFor();
  await page.goForward(); await page.locator('[data-workspace-section="perks"][aria-current]').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  await page.goto(url + '#character/meg-thomas/edit');
  const writer = (await page.locator('#save-status').textContent()) === 'Saved locally';
  if (writer) {
    await page.locator('#edit-bloodweb').fill('37');
    await page.getByRole('button', { name: 'Save Character', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-character-edit]'));
    await page.goto(url + '#character/meg-thomas/overview');
    await page.reload();
    await page.getByRole('link', { name: 'Edit Character', exact: true }).click();
    assert.equal(await page.locator('#edit-bloodweb').inputValue(), '37');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.goto(url+'#dashboard');
    await page.locator('[data-dashboard-character-link][href="#character/meg-thomas/overview"]').first().click();
    await page.getByRole('link',{name:'Edit Character',exact:true}).click();
    await page.locator('#edit-owned').check();
    await page.getByRole('button',{name:'Save Character',exact:true}).click();
    await page.goto(url+'#dashboard');
    await page.getByRole('button',{name:'Add Meg Thomas to queue',exact:true}).click();
    await page.locator('#queue-target').fill('3');
    await page.getByRole('button',{name:'Save target',exact:true}).click();
    await page.reload();
    assert.equal((JSON.parse(await page.evaluate(()=>localStorage.getItem('dbdTrackerData')))).prestigeQueue[0].targetPrestige,3);
    await page.locator('[data-current-focus] a').click();
    await page.locator('[data-character-workspace]').waitFor();
  } else assert.equal(await page.locator('#edit-bloodweb').isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('Direct-file workspace PASS; writer=' + writer + '; genuine 200% zoom OUTSTANDING');
} finally { await browser.close(); }
