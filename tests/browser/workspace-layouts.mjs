import assert from 'node:assert/strict';
import {freshSave} from '../../src/model.js';
export async function workspaceLayouts(page, origin) {
  const fixture=freshSave();
  Object.assign(fixture.characters['the-ghost-face'],{prestige:Number.MAX_SAFE_INTEGER,owned:true,favorite:true});
  await page.evaluate(save=>localStorage.setItem('dbdTrackerData',JSON.stringify(save)),fixture);
  await page.goto(origin + '/#character/the-ghost-face/overview');
  await page.reload();
  const bytes=await page.evaluate(()=>localStorage.getItem('dbdTrackerData'));
  for (const width of [320, 500, 760, 1100, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('h1').evaluate(n => { n.textContent = 'A very long character name for responsive verification'; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Workspace overflow at ' + width);
    assert.ok((await page.locator('[data-workspace-section="overview"]').boundingBox()).height >= 44, 'Workspace links need 44px targets');
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const routes=['character/meg-thomas/overview','character/meg-thomas','character/meg-thomas/perks',
    'character/meg-thomas/perks/update','character/meg-thomas/perks/legacy','character/meg-thomas/edit',
    'character/meg-thomas/setup','character/meg-thomas/items-addons','character/the-doctor/power-addons',
    'manage/meg-thomas','manage/meg-thomas/update','manage/meg-thomas/legacy','experiment/meg-thomas','experiment/meg-thomas/update'];
  for(const route of routes){
    await page.goto(origin+'/#'+route);await page.reload();
    await page.locator('[data-character-workspace]').waitFor();
    if (route.endsWith('/edit')) {
      await page.waitForFunction(() => location.hash === '#character/meg-thomas/overview');
      assert.equal(await page.locator('[data-character-edit]').count(), 0, 'Retired Edit bookmark resolves to Overview');
    }
    assert.equal(await page.locator('h1').textContent(),route.includes('the-doctor')?'The Doctor':'Meg Thomas');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
    if(route.includes('perks')||route.startsWith('manage/')||route.startsWith('experiment/'))
      assert.equal(await page.locator('[data-workspace-section="perks"]').getAttribute('aria-current'),'page');
  }
  await page.goto(origin+'/#character/meg-thomas');
  await page.locator('[data-workspace-section="overview"][aria-current]').waitFor();
  assert.equal(await page.locator('[data-workspace-section="perks"]').getAttribute('aria-current'),null,'No last-tab memory');
  assert.equal(await page.evaluate(()=>localStorage.getItem('dbdTrackerData')),bytes,'Responsive browsing does not fabricate activity');
}
