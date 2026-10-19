import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshSave } from '../../src/model.js';

export async function characterWorkspaceRegression(page, origin) {
  await characterWorkspaceResponsive(page,origin);
  const { workspaceLayouts } = await import('./workspace-layouts.mjs');
  await workspaceLayouts(page, origin);
  const save = freshSave();
  Object.assign(save.characters['meg-thomas'], { favorite: true, prestige: 2, bloodwebLevel: 43, notes: 'Keep these notes' });
  save.characters['meg-thomas'].inventory.items['survivor-item-test-unknown'] = 7;
  await page.evaluate(s => localStorage.setItem('dbdTrackerData', JSON.stringify(s)), save);
  await page.goto(origin + '/#character/meg-thomas/overview'); await page.reload();
  const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await page.locator('[data-character-workspace]').waitFor();
  assert.equal(await page.locator('[data-character-workspace] h1').textContent(), 'Meg Thomas');
  assert.equal(await page.locator('[data-workspace-section="overview"]').getAttribute('aria-current'), 'page');
  const text = await page.locator('[data-character-workspace]').textContent();
  for (const label of ['Survivor', 'Not owned', 'Favorite', 'P2', '43', 'Keep these notes', 'Native Perks']) assert.ok(text.includes(label), label);
  assert.match(text,/38 Items.*54 Add-ons/);
  assert.equal(await page.getByRole('link', { name: 'Edit Character', exact: true }).getAttribute('href'), '#character/meg-thomas/edit');
  assert.equal(await page.locator('[data-inventory-quantity]').count(), 0);
  assert.equal(await page.locator('[data-character-workspace] .character-inventory-grid').count(), 0);
  // Shared header is the only normal workspace identity block.
  const workspace = page.locator('[data-character-workspace]');
  assert.equal(await workspace.locator('[data-character-header]').count(), 1);
  assert.equal(await workspace.locator('h1').count(), 1);
  assert.equal(await workspace.locator('.character-workspace-edit').count(), 1);
  assert.equal(await workspace.locator('[data-character-progress="prestige"]').getByText('PRESTIGE',{exact:true}).count(), 1);
  assert.equal(await workspace.locator('[data-character-progress="bloodweb"]').getByText('BLOODWEB',{exact:true}).count(), 1);
  assert.equal(await workspace.locator('.character-workspace-nav').count(), 1);
  assert.equal(await workspace.locator('.character-portrait').count(), 1, 'Overview must not repeat character portrait');

  // Overview is grouped by meaning instead of a full-width panel stack.
  for (const section of ['native-perks','progress','perks','inventory','notes'])
    assert.equal(await workspace.locator('[data-overview-section="'+section+'"]').count(), 1, section);
  const nativeSection = workspace.locator('[data-overview-section="native-perks"]');
  assert.ok(await nativeSection.locator('[data-perk-icon]').count() > 0, 'Native perks reuse artwork');
  assert.match(await nativeSection.textContent(), /Personal record:/);
  const inventorySummary = await workspace.locator('[data-overview-section="inventory"]').textContent();
  assert.match(inventorySummary,/No quantities recorded yet./);
  assert.match(inventorySummary,/1 imported record not in current catalog/i);
  assert.doesNotMatch(inventorySummary,/No stock/i);

  await page.goto(origin + '/#character/the-doctor/overview');
  const killerSummary = page.locator('[data-overview-section="inventory"]');
  const killerSummaryText = await killerSummary.textContent();
  assert.match(killerSummaryText,/Carter's Spark/);
  assert.match(killerSummaryText,/20 Add-ons/);
  assert.doesNotMatch(killerSummaryText,/Power reference data is not yet available/);
  assert.equal(await killerSummary.getByRole('link',{name:'View Power & Add-ons'}).getAttribute('href'), '#character/the-doctor/power-addons');

  await page.setViewportSize({width:320,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Workspace header/Overview overflow at 320');
  assert.ok((await page.locator('.character-workspace-edit').boundingBox()).height>=44,'Edit Character remains a practical target');
  await page.setViewportSize({width:1440,height:900});
  for (const hash of ['#character/the-doctor/power-addons']) {
    await page.goto(origin + '/' + hash);
    await page.locator('[data-character-workspace]').waitFor();
    assert.equal(await page.locator('[data-killer-power-panel]').count(), 1);
    assert.equal(await page.locator('[data-killer-addon-card]').count(), 20);
  }
  for (const hash of ['#character/unknown/overview', '#character/meg-thomas/power-addons', '#manage/meg-thomas/extra']) {
    await page.goto(origin + '/' + hash);
    await page.getByRole('heading', { name: 'Character/section unavailable' }).waitFor();
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  await page.goto(origin + '/#character/the-doctor/overview');
  assert.equal(await page.locator('[data-workspace-section="power-addons"]').count(), 1);
  // Popup capability parity: normal identity and Prestige are real Overview links.
  await page.goto(origin + '/#survivors');
  await page.locator('#search').fill('Meg');
  const card = page.locator('.character-card').first();
  assert.equal(await card.locator('.character-name').getAttribute('href'), '#character/meg-thomas/overview');
  assert.equal(await card.locator('.prestige').getAttribute('href'), '#character/meg-thomas/overview');
  assert.equal(await card.locator('[data-open-workspace]').getAttribute('href'), '#character/meg-thomas/overview');
  await card.locator('.prestige').click();
  assert.equal(await page.locator('#detail').isVisible(), false);
  await page.getByRole('link', { name: 'Edit Character', exact: true }).click();
  for (const field of ['owned', 'favorite', 'prestige', 'bloodweb', 'notes'])
    assert.equal(await page.locator('#edit-' + field).count(), 1);
  assert.ok(await page.locator('[data-edit-perk]').count() > 0);
  assert.ok(await page.locator('[data-edit-correction]').count() > 0);
  await page.locator('[data-action="perk"]').first().click();
  assert.equal(await page.locator('#detail').isVisible(), true, 'Bounded perk dialog remains');
  assert.equal(await page.locator('#detail [data-personal-tier]').first().isDisabled(), true);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto(origin + '/#dashboard');
  await page.locator('[data-dashboard-section="favorites"] summary').click();
  await page.locator('[data-dashboard-character-link][href="#character/meg-thomas/overview"]').first().click();
  await page.waitForURL('**/#character/meg-thomas/overview');
  assert.equal(await page.locator('#detail').isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
}
export async function characterWorkspaceResponsive(page,origin){
  const save=freshSave();
  Object.assign(save.characters['meg-thomas'],{owned:true,favorite:true,prestige:3,bloodwebLevel:27,notes:'Long notes '.repeat(60)});
  await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
  await page.goto(origin+'/#character/meg-thomas/overview');await page.reload();
  for(const width of [320,500,760,1100,1440,1600]){
    await page.setViewportSize({width,height:900});
    const edges=[];
    for(const section of ['overview','perks','items-addons']){
      await page.goto(origin+'/#character/meg-thomas/'+section);
      await page.locator('[data-workspace-section="'+section+'"][aria-current="page"]').waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Workspace overflow '+width+'/'+section);
      const header=page.locator('[data-character-header]');
      assert.equal(await header.count(),1);assert.equal(await page.locator('[data-character-workspace] h1').count(),1);
      assert.equal(await page.locator('[data-character-workspace] .character-portrait').count(),1);
      assert.equal(await header.locator('[data-character-progress]').count(),2);
      assert.ok(await header.locator('.character-portrait').isVisible());
      assert.ok((await header.locator('.character-workspace-edit').boundingBox()).height>=44);
      assert.equal(await header.evaluate(n=>{
        const progress=n.querySelector('.character-workspace-progress'), edit=n.querySelector('.character-workspace-edit');
        return Boolean(progress.compareDocumentPosition(edit)&Node.DOCUMENT_POSITION_FOLLOWING);
      }),true,'Progress precedes Edit Character in logical DOM order');
      const bounds=await header.boundingBox();edges.push([bounds.x,bounds.width]);
      const levels=await page.locator('[data-character-workspace] :is(h1,h2,h3,h4,h5,h6)').evaluateAll(nodes=>nodes.map(n=>Number(n.tagName.slice(1))));
      for(let i=1;i<levels.length;i++)assert.ok(levels[i]<=levels[i-1]+1,'No skipped heading levels '+section);
      const navigation=header.locator('[data-workspace-section="'+section+'"]');await navigation.focus();
      assert.ok(await navigation.evaluate(n=>{const s=getComputedStyle(n);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;}),'Visible navigation focus');
      if(section==='overview'){
        assert.deepEqual(await page.locator('[data-overview-section]').evaluateAll(nodes=>nodes.map(n=>n.dataset.overviewSection)),['native-perks','progress','perks','inventory','notes']);
      }
      if(section==='items-addons'){
        assert.equal(await page.getByRole('navigation',{name:'Item families'}).locator('[aria-pressed="true"]').count(),1);
        const field=page.locator('[data-inventory-quantity]').first();
        assert.match(await field.getAttribute('aria-describedby'),/^stock-error-/);
        const plus=page.locator('[data-stock-step][data-delta="1"]').first();
        assert.match(await plus.getAttribute('aria-label'),/^Increase quantity of /);
        if(width<=500)assert.ok(await page.locator('.stock-family-nav').evaluate(n=>n.scrollWidth>n.clientWidth));
      }
    }
    assert.deepEqual(edges[0],edges[1],'Shared edges Overview/Perks '+width);assert.deepEqual(edges[1],edges[2],'Shared edges Perks/Inventory '+width);
  }
  await page.setViewportSize({width:1440,height:900});
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { smokeStage } = await import('./smoke.mjs');
  await smokeStage(resolve(process.argv[2] || 'release/runtime'), { regression: characterWorkspaceRegression });
  console.log('Character workspace regression PASS');
}
