import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {freshSave} from '../../src/model.js';
import {inventoryEntities,inventoryEntityById,inventoryCatalogStatus,survivorInventorySource} from '../../data/inventory-catalog.js';
export async function familyNavigationRegression(page,origin){
 page.setDefaultTimeout(6000);
 const fixture=freshSave();
 const sharedAddon=inventoryEntities.find(entity=>entity.map==='addons'&&entity.compatibleItemIds.length>1);
 fixture.characters['meg-thomas'].inventory.addons[sharedAddon.id]=6;
 await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),fixture);
 await page.goto(origin+'/#character/meg-thomas/items-addons');await page.reload();
 await page.locator('[data-stock-workspace]').waitFor();
 const families=survivorInventorySource.itemFamilies;
 const rarityOrder=['Ultra Rare','Very Rare','Rare','Uncommon','Common'];
 const sortIds=(entries,direction)=>{
  const order=direction==='lowest-to-highest'?[...rarityOrder].reverse():rarityOrder;
  return [...order.flatMap(rarity=>entries.filter(addon=>addon.rarity===rarity).map(addon=>addon.id)),
   ...entries.filter(addon=>!rarityOrder.includes(addon.rarity)).map(addon=>addon.id)];
 };
 const nav=page.getByRole('navigation',{name:'Item families',exact:true});
 assert.equal(await nav.count(),1,'A native Item families navigator replaces the all-family document');
 assert.deepEqual(await nav.locator('button').evaluateAll(nodes=>nodes.map(n=>n.dataset.family)),families.map(f=>f.id));
 assert.equal(await page.locator('[role="tablist"], [role="tab"], [role="tabpanel"]').count(),0);
 assert.equal(await page.locator('[data-stock-family]').count(),1);
 assert.equal(await page.locator('[data-stock-family]').getAttribute('data-stock-family'),families[0].id);
 const before=await page.evaluate(()=>localStorage.dbdTrackerData);
 for(const [index,family] of families.entries()){
  const button=nav.getByRole('button',{name:family.displayName,exact:true});
  await button.focus();await button.press(index%2?'Space':'Enter');
  assert.equal(await nav.locator('[aria-pressed="true"]').count(),1);
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert.equal(await button.evaluate(n=>document.activeElement===n),true);
  assert.equal(await page.locator('[data-stock-family]').count(),1);
  assert.equal(await page.locator('[data-stock-family]').getAttribute('data-stock-family'),family.id);
  const familyItems=inventoryEntities.filter(e=>e.familyId===family.id&&e.map==='items').length;
  const familyAddons=inventoryEntities.filter(e=>e.familyId===family.id&&e.map==='addons').length;
  assert.equal(await page.locator('.stock-family-heading p').textContent(),familyItems+' Items · '+familyAddons+' Add-ons (catalog totals)');
  const itemRows=inventoryEntities.filter(entity=>entity.familyId===family.id&&entity.map==='items').sort((a,b)=>a.order-b.order);
  const itemSelect=page.locator('#inventory-item');
  assert.equal(await page.locator('[data-stock-subsection="items"] [data-stock-card] [data-action="stock-item-select"]').count(),itemRows.length,
   'Every Item has a separate Select Item action, distinct from quantity and Details');
  assert.deepEqual(await itemSelect.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value)),itemRows.map(item=>item.id),
   'Each family exposes its Items in catalog order for Add-on compatibility');
  for(const map of ['items','addons']){
   const rows=inventoryEntities.filter(e=>e.familyId===family.id&&e.map===map);
   const selectedItem=inventoryEntityById[await itemSelect.inputValue()];
   const compatible=map==='addons'?rows.filter(entity=>entity.compatibleItemIds.includes(selectedItem.id)):rows;
   const expected=map==='addons'?sortIds(compatible,'highest-to-lowest'):rows.map(entity=>entity.id);
   assert.deepEqual(await page.locator('[data-stock-subsection="'+map+'"] [data-stock-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockCard)),expected);
  }
  for(const item of itemRows){
   await page.locator('[data-stock-card="'+item.id+'"] [data-action="stock-item-select"]').click();
   assert.equal(await itemSelect.inputValue(),item.id,'The Item selector stays synchronized with Item-card selection');
   assert.equal(await page.locator('[data-stock-card="'+item.id+'"] [data-action="stock-item-select"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-stock-subsection="addons"]').getAttribute('data-compatible-item-id'),item.id);
   const compatible=inventoryEntities.filter(entity=>entity.familyId===family.id&&entity.map==='addons'&&entity.compatibleItemIds.includes(item.id));
   assert.deepEqual(await page.locator('[data-stock-subsection="addons"] [data-stock-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.stockCard)),sortIds(compatible,'highest-to-lowest'),
    'Add-ons appear only beneath the selected compatible Item');
  }
  assert.equal(await page.evaluate(()=>localStorage.dbdTrackerData),before,'Family selection cannot persist');
 }
 const sharedItems=sharedAddon.compatibleItemIds.slice(0,2).map(id=>inventoryEntityById[id]);
 const sharedFamily=families.find(family=>family.id===sharedItems[0].familyId);
 await nav.getByRole('button',{name:sharedFamily.displayName,exact:true}).click();
 for(const sharedItem of sharedItems){
  await page.locator('[data-stock-card="'+sharedItem.id+'"] [data-action="stock-item-select"]').click();
  const sharedStock=page.locator('[data-stock-subsection="addons"] [data-stock-card="'+sharedAddon.id+'"] [data-inventory-quantity="'+sharedAddon.id+'"]');
  assert.equal(await sharedStock.inputValue(),'6','A shared Add-on keeps its single Survivor quantity under each compatible Item');
  assert.equal(await page.locator('[data-stock-subsection="addons"] [data-stock-card="'+sharedAddon.id+'"]').count(),1,
   'Compatible Item contexts do not duplicate Add-on stock records');
 }
 const firecrackerFamily=families.find(family=>family.id==='firecracker');
 await nav.getByRole('button',{name:firecrackerFamily.displayName,exact:true}).click();
 for(const firecracker of inventoryEntities.filter(entity=>entity.familyId===firecrackerFamily.id&&entity.map==='items')){
  await page.locator('[data-stock-card="'+firecracker.id+'"] [data-action="stock-item-select"]').click();
  assert.match(await page.locator('[data-stock-subsection="addons"]').textContent(),/This item does not use Add-ons\./,
   'Firecracker-like Items explicitly state that they have no compatible Add-ons');
 }
 await nav.getByRole('button',{name:families.at(-1).displayName,exact:true}).click();
 await page.locator('#inventory-search').fill('unlikely-search-token');
 assert.equal(await page.locator('[data-stock-family]').getAttribute('data-stock-family'),families.at(-1).id,'Rerender retains selection');
 await page.locator('#inventory-search').fill('');
 const reader=await page.context().newPage();
 try{
  await reader.goto(origin+'/#character/meg-thomas/items-addons');
  await reader.waitForFunction(()=>document.querySelector('#save-status').textContent==='Read-only');
  const readerNav=reader.getByRole('navigation',{name:'Item families'});
  await readerNav.getByRole('button',{name:families.at(-1).displayName,exact:true}).click();
  assert.equal(await reader.locator('[data-stock-family]').getAttribute('data-stock-family'),families.at(-1).id);
  assert.equal(await reader.locator('[data-inventory-quantity]').first().isDisabled(),true);
  assert.equal(await reader.locator('[data-action="stock-details"]').first().isEnabled(),true);
 }finally{await reader.close();}
 await page.goto(origin+'/#character/feng-min/items-addons');
 await page.locator('[data-stock-workspace]').waitFor();
 assert.equal(await page.locator('[data-stock-family]').getAttribute('data-stock-family'),families.at(-1).id,'Safe Survivor family context carries to a same-role character');
 await page.locator('#stock-family-nav-'+families.at(-1).id).click();
 await page.getByRole('link',{name:'Edit Character',exact:true}).click();
 assert.equal(await page.locator('[data-stock-family]').getAttribute('data-stock-family'),families[0].id,'New page stock session resets selection');
}
export async function familyTransitionsRegression(page,origin){
 page.setDefaultTimeout(6000);
 const families=survivorInventorySource.itemFamilies;
 const first=inventoryEntities.find(e=>e.familyId===families[0].id&&e.map==='items');
 const second=inventoryEntities.find(e=>e.familyId!==first.familyId&&e.map==='items');
 const save=freshSave();save.characters['meg-thomas'].inventory.items['survivor-item-future-unresolved']=7;
 await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
 await page.goto(origin+'/#character/meg-thomas/items-addons');await page.reload();
 const select=id=>page.locator('#stock-family-nav-'+id);
 const field=id=>page.locator('[data-inventory-quantity="'+id+'"]');
 const current=()=>page.locator('[data-stock-family]').getAttribute('data-stock-family');
 const bytes=()=>page.evaluate(()=>localStorage.dbdTrackerData);
 await field(first.id).fill('37');await select(first.familyId).focus();await page.locator('#inventory-search').focus();
 await page.waitForFunction(id=>JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].inventory.items[id]===37,first.id);
 await field(first.id).fill('39');await page.locator('#inventory-filters summary').click();
 await page.waitForFunction(()=>document.querySelector('#inventory-filters').open);
 assert.equal(await page.locator('#inventory-filters summary').evaluate(n=>n===document.activeElement),true,'Filters retains focus after quantity commit');
 await field(first.id).fill('40');await page.locator('#inventory-filters summary').focus();await page.locator('#inventory-filters summary').press('Enter');
 assert.equal(await page.locator('#inventory-filters').evaluate(n=>n.open),false,'Keyboard Filters toggles after quantity commit');
 await field(first.id).fill('0');await field(first.id).press('Enter');
 const selectedItemBeforeSearch=await page.locator('#inventory-item').inputValue();
 await page.locator('#inventory-search').fill(second.name);
 assert.equal(await page.locator('[data-stock-card]').count(),0,'Other-family search matches cannot leak into selection');
 assert.equal(await current(),first.familyId);assert.match(await page.locator('.stock-family-heading').textContent(),new RegExp(families[0].displayName));
 assert.match(await page.locator('[data-selected-item-context]').textContent(),/Selected Item hidden by current filters/);
 assert.equal(await page.locator('[data-action="stock-filter-reset"]').count(),1,'Active stock filters expose a reset action');
 assert.equal(await page.getByRole('searchbox',{name:'Search '+families[0].displayName,exact:true}).count(),1,'Search communicates selected-family scope');
 assert.match(await page.locator('[data-stock-workspace] .empty').textContent(),/No matches in/);
 await page.locator('[data-action="stock-filter-reset"]').click();
 assert.equal(await page.locator('#inventory-search').inputValue(),'');
 assert.equal(await page.locator('#inventory-item').inputValue(),selectedItemBeforeSearch,'Reset keeps the selected Item context');
 await page.locator('#inventory-search').fill(second.name);
 await select(second.familyId).click();assert.equal(await field(second.id).count(),1);assert.equal(await page.locator('#inventory-search').inputValue(),second.name);
 await page.locator('#inventory-filters').evaluate(n=>n.open=true);
 await page.locator('#inventory-map').selectOption('items');
 await page.locator('#inventory-filters').evaluate(n=>n.open=true);await page.locator('#inventory-rarity').selectOption(second.rarity);
 await page.locator('#inventory-in-stock').check();await select(first.familyId).click();
 assert.equal(await page.locator('#inventory-map').inputValue(),'items');assert.equal(await page.locator('#inventory-rarity').inputValue(),second.rarity);
 assert.equal(await page.locator('#inventory-in-stock').isChecked(),true);assert.equal(await page.locator('#inventory-search').inputValue(),second.name);
 await page.locator('#inventory-search').fill('');assert.equal(await page.locator('#inventory-rarity').inputValue(),second.rarity);assert.equal(await page.locator('#inventory-in-stock').isChecked(),true);
 assert.equal(await page.locator('#inventory-family').count(),0);
 await page.locator('#inventory-in-stock').uncheck();await page.locator('#inventory-filters').evaluate(n=>n.open=true);await page.locator('#inventory-rarity').selectOption('');
 await page.locator('#inventory-filters').evaluate(n=>n.open=true);await page.locator('#inventory-map').selectOption('');
 const noAddonFamily=families.find(f=>!inventoryEntities.some(e=>e.familyId===f.id&&e.map==='addons'));
 await select(noAddonFamily.id).click();
 assert.match(await page.locator('[data-stock-subsection="addons"]').textContent(),/This item does not use Add-ons\./);
 assert.equal(await page.locator('[data-stock-subsection="addons"] .stock-grid').count(),0);
 assert.deepEqual(await page.locator('[data-stock-subsection]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockSubsection)),['items','addons']);
 await select(first.familyId).click();
 const orderedItems=inventoryEntities.filter(e=>e.familyId===first.familyId&&e.map==='items');
 const laterItem=orderedItems.at(-1);
 await field(laterItem.id).fill('2');
 assert.deepEqual(await page.locator('[data-stock-subsection="items"] [data-stock-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockCard)),orderedItems.map(e=>e.id),'Pending raw typing cannot reorder cards');
 await field(laterItem.id).press('Enter');
 assert.deepEqual(await page.locator('[data-stock-subsection="items"] [data-stock-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockCard)),[laterItem.id,...orderedItems.filter(e=>e.id!==laterItem.id).map(e=>e.id)],'Stable commit uses positive then zero canonical order');
 await field(laterItem.id).fill('0');await field(laterItem.id).press('Enter');
 await page.evaluate(()=>{window.familyWrites=0;window.familySetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='dbdTrackerData')window.familyWrites++;return window.familySetItem.call(this,k,v);};});
 await field(first.id).fill('3');await select(second.familyId).click();
 assert.equal(await current(),second.familyId);assert.equal(JSON.parse(await bytes()).characters['meg-thomas'].inventory.items[first.id],3);
 assert.equal(await page.evaluate(()=>window.familyWrites),1,'Valid pending switch persists exactly once');
 await select(first.familyId).click();await field(first.id).fill('abc');await select(second.familyId).click();
 assert.equal(await current(),first.familyId,'Invalid quantity blocks ordinary family navigation');
 assert.equal(await field(first.id).inputValue(),'abc');assert.equal(await field(first.id).evaluate(n=>n===document.activeElement),true);
 assert.equal(await field(first.id).getAttribute('aria-invalid'),'true');assert.equal(await page.evaluate(()=>window.familyWrites),1);
 await field(first.id).fill('4');
 await page.evaluate(()=>{Storage.prototype.setItem=function(k,v){if(k==='dbdTrackerData')throw Error('Synthetic family switch save failure');return window.familySetItem.call(this,k,v);};});
 await select(second.familyId).click();assert.equal(await current(),first.familyId,'Failed save blocks family switch');
 assert.equal(await field(first.id).inputValue(),'4');assert.equal(await field(first.id).evaluate(n=>n===document.activeElement),true);
 assert.match(await page.locator('#stock-error-'+first.id).textContent(),/Not saved/);
 await page.evaluate(()=>{Storage.prototype.setItem=window.familySetItem;delete window.familySetItem;});
 await field(first.id).press('Enter');await select(second.familyId).click();assert.equal(await current(),second.familyId);
 assert.equal(JSON.parse(await bytes()).characters['meg-thomas'].inventory.items['survivor-item-future-unresolved'],7);
 assert.equal(await page.locator('[data-unresolved-stock]').isVisible(),true);
}
export async function artworkCardsRegression(page,origin){
 page.setDefaultTimeout(6000);
 const item=inventoryEntities.find(e=>e.map==='items');
 const save=freshSave();save.characters['meg-thomas'].inventory.items['survivor-item-future-unresolved']=7;
 await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
 await page.goto(origin+'/#character/meg-thomas/items-addons');await page.reload();
 const card=page.locator('[data-stock-card="'+item.id+'"]');
 const field=card.locator('[data-inventory-quantity]');
 const art=card.locator('img');await art.waitFor();
 const box=await art.boundingBox();assert.ok(box.width>96&&box.width<=128&&box.height===box.width,'Desktop background artwork materially exceeds the old 96px thumbnail without distortion');
 assert.equal(await art.getAttribute('src'),item.imagePath);assert.equal(await art.getAttribute('alt'),'');
 assert.equal(await art.evaluate(n=>getComputedStyle(n).objectFit),'contain');
 assert.ok((await card.locator('.stock-card-media').boundingBox()).height-box.height<=48,'Artwork earns media height instead of blank padding');
 assert.equal(await card.locator('.stock-card-meta').textContent(),item.rarity+' · Item');
 assert.ok(await card.evaluate(n=>parseFloat(getComputedStyle(n).borderLeftWidth)<=1),'Strong rarity border is removed');
 const zeroHeight=(await card.boundingBox()).height;
 await card.getByRole('button',{name:'Increase quantity of '+item.name,exact:true}).click();
 assert.equal((await card.boundingBox()).height,zeroHeight,'Stock sign does not alter card geometry');
 const bytes=()=>page.evaluate(()=>localStorage.dbdTrackerData);
 const before=await bytes();await field.fill('7');
 await card.getByRole('button',{name:'Details',exact:true}).click();
 assert.equal(await bytes(),before,'Opening reference Details cannot commit pending quantity');
 await page.getByRole('button',{name:'Close details',exact:true}).click();
 await page.waitForFunction(id=>document.activeElement.id==='stock-details-'+id,item.id);
 assert.equal(await field.inputValue(),'7');await field.press('Enter');
 await card.getByRole('button',{name:'Details',exact:true}).click();
 await page.locator('#inventory-search').evaluate(n=>{n.value='no-matching-card';n.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.getByRole('button',{name:'Close details',exact:true}).click();
 await page.waitForFunction(()=>document.activeElement.id==='inventory-search');
 await page.locator('#inventory-search').fill('');
 const families=survivorInventorySource.itemFamilies;
 for(const width of [320,500,760,1100,1440,1600]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow '+width);
  const nav=page.getByRole('navigation',{name:'Item families'});
  if(width<=500){
   assert.equal(await nav.evaluate(n=>getComputedStyle(n).flexWrap),'nowrap');
   assert.ok(await nav.evaluate(n=>n.scrollWidth>n.clientWidth),'Family strip has bounded internal scrolling');
   const last=nav.getByRole('button',{name:families.at(-1).displayName,exact:true});await last.focus();await last.press('Enter');
   const visible=await last.evaluate(n=>{const parent=n.parentElement.getBoundingClientRect(),r=n.getBoundingClientRect();return r.left>=parent.left-1&&r.right<=parent.right+1;});
   assert.equal(visible,true,'Focused/selected family is visible inside strip');
   const target=await last.boundingBox();assert.ok(target.width>=44&&target.height>=44);
   const first=nav.getByRole('button',{name:families[0].displayName,exact:true});await first.focus();await first.press('Space');
   const positions=await page.locator('[data-stock-subsection="items"] [data-stock-card]').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().left));
   assert.equal(new Set(positions).size,1,'Narrow cards form one usable column');
  }
  for(const control of [field,card.locator('[data-stock-step]').first()]){
   const target=await control.boundingBox();assert.ok(target.width>=44&&target.height>=44,'Quantity target '+width);
  }
  assert.equal(await page.locator('[data-unresolved-stock]').isVisible(),true);
 }
 await page.setViewportSize({width:1440,height:900});
}
export async function quantityStepperRegression(page,origin){
 page.setDefaultTimeout(6000);
 const [zero,max]=inventoryEntities.filter(e=>e.map==='items');
 const save=freshSave();save.characters['meg-thomas'].inventory.items[max.id]=Number.MAX_SAFE_INTEGER;
 await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
 await page.goto(origin+'/#character/meg-thomas/items-addons');await page.reload();
 const card=entity=>page.locator('[data-stock-card="'+entity.id+'"]');
 const decrease=entity=>card(entity).getByRole('button',{name:'Decrease quantity of '+entity.name,exact:true});
 const increase=entity=>card(entity).getByRole('button',{name:'Increase quantity of '+entity.name,exact:true});
 const step=(entity,delta)=>card(entity).locator('[data-stock-step][data-delta="'+delta+'"]');
 await card(zero).waitFor();
 assert.equal(await decrease(zero).count(),1,'Quantity decrement must exist with an entity-specific accessible name');
 assert.equal(await increase(zero).count(),1,'Quantity increment must exist with an entity-specific accessible name');
 assert.equal(await card(zero).getByRole('textbox',{name:'Quantity of '+zero.name,exact:true}).count(),1);
 assert.equal(await decrease(zero).isDisabled(),true,'Decrement disabled at zero');
 assert.equal(await increase(zero).isDisabled(),false);
 assert.equal(await increase(max).isDisabled(),true,'Increment disabled at MAX_SAFE_INTEGER');
 assert.equal(await decrease(max).isDisabled(),false);
 for(const control of [decrease(zero),increase(zero),step(zero,5),step(zero,10),card(zero).getByRole('textbox')]){
  const box=await control.boundingBox();assert.ok(box.height>=44&&box.width>=44,'Practical quantity targets');
 }
 const field=entity=>card(entity).getByRole('textbox');
 const bytes=()=>page.evaluate(()=>localStorage.getItem('dbdTrackerData'));
 const quantity=async entity=>JSON.parse(await bytes()).characters['meg-thomas'].inventory.items[entity.id]||0;
 for(const delta of [-1,1,5,10])assert.equal(await step(zero,delta).count(),1,'Survivor quantity controls include step '+delta);
 await page.evaluate(()=>{
  window.stepWrites=[];window.stepSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key==='dbdTrackerData')window.stepWrites.push(value);return window.stepSetItem.call(this,key,value);};
 });
 const writes=()=>page.evaluate(()=>window.stepWrites.length);
 // Pointer down/up are separated: a pending field must not commit during the button press.
 await field(zero).fill('3');
 const plusBox=await increase(zero).boundingBox();
 await page.mouse.move(plusBox.x+plusBox.width/2,plusBox.y+plusBox.height/2);await page.mouse.down();
 await page.waitForTimeout(60);assert.equal(await writes(),0,'No intermediate blur commit before activation');
 await page.mouse.up();
 assert.equal(await quantity(zero),4,'Step uses pending typed value');
 assert.equal(await writes(),1,'One pointer activation produces one commit');
 assert.equal(await field(zero).evaluate(n=>n===document.activeElement),true,'Focus returns to editable field');
 await decrease(zero).click();assert.equal(await quantity(zero),3);
 await field(zero).fill('1');await field(zero).press('Tab');
 assert.equal(await increase(zero).evaluate(n=>n===document.activeElement),true);
 const keyboardWrites=await writes();await increase(zero).press('Enter');
 assert.equal(await quantity(zero),2);assert.equal(await writes(),keyboardWrites+1,'Keyboard activation commits pending value once');
 await increase(zero).focus();const spaceWrites=await writes();await increase(zero).press('Space');
 assert.equal(await quantity(zero),3);assert.equal(await writes(),spaceWrites+1,'Space activation commits once');
 await field(zero).fill('1');await field(zero).press('Enter');
 await decrease(zero).click();assert.equal(await quantity(zero),0);
 await step(zero,5).click();assert.equal(await quantity(zero),5,'+5 increments the selected Survivor Item');
 await step(zero,10).click();assert.equal(await quantity(zero),15,'+10 accumulates on the selected Survivor Item');
 await step(zero,-1).click();assert.equal(await quantity(zero),14,'−1 remains a single unit decrement');
 await field(zero).fill('0');await field(zero).press('Enter');
 assert.equal(await decrease(zero).isDisabled(),true);
 assert.equal(await field(zero).evaluate(n=>n===document.activeElement),true,'Zero boundary cannot focus disabled decrement');
 for(const raw of ['abc','1.5']){
  const before=await bytes();await field(zero).fill(raw);
  assert.equal(await decrease(zero).isDisabled(),true);assert.equal(await increase(zero).isDisabled(),true);
  await increase(zero).evaluate(n=>n.click());await decrease(zero).evaluate(n=>n.click());
  assert.equal(await field(zero).inputValue(),raw);assert.equal(await bytes(),before);
  await field(zero).press('Enter');assert.equal(await field(zero).getAttribute('aria-invalid'),'true');
 }
 await field(zero).fill('0');await field(zero).press('Enter');
 await field(max).fill(String(Number.MAX_SAFE_INTEGER-1));await field(max).press('Enter');
 await increase(max).click();assert.equal(await quantity(max),Number.MAX_SAFE_INTEGER);
 assert.equal(await increase(max).isDisabled(),true);assert.equal(await field(max).evaluate(n=>n===document.activeElement),true);
 // Tabbing past the stepper without activating it still commits the pending typed edit.
 await field(zero).fill('6');await field(zero).press('Tab');
 const departureWrites=await writes();await increase(zero).press('Tab');await page.keyboard.press('Tab');
 await page.keyboard.press('Tab');await page.keyboard.press('Tab');
 await page.waitForFunction(id=>JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].inventory.items[id]===6,zero.id);
 assert.equal(await writes(),departureWrites+1,'Leaving the control resolves deferred blur once');
 await field(zero).fill('0');await field(zero).press('Enter');
 // Save failure retains the attempted raw value; Enter retries through the ordinary path.
 const failureBytes=await bytes();
 await page.evaluate(()=>{window.failureSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='dbdTrackerData')throw Error('Synthetic step failure');return window.failureSetItem.call(this,k,v);};});
 await increase(zero).click();assert.equal(await bytes(),failureBytes);assert.equal(await field(zero).inputValue(),'1');
 assert.match(await card(zero).locator('[data-stock-error]').textContent(),/Not saved/);
 assert.equal(await field(zero).evaluate(n=>n===document.activeElement),true,'Failed step keeps an editable retry focus');
 await page.evaluate(()=>{Storage.prototype.setItem=window.failureSetItem;delete window.failureSetItem;});
 await field(zero).press('Enter');assert.equal(await quantity(zero),1);
 await decrease(zero).click();
 await field(zero).fill('5');await decrease(max).focus();
 await page.waitForFunction(id=>JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].inventory.items[id]===5,zero.id);
 assert.equal(await decrease(max).evaluate(n=>n===document.activeElement),true,'Blur respects another card step button destination');
 await field(zero).fill('0');await field(zero).press('Enter');
 await page.evaluate(()=>{Storage.prototype.setItem=window.stepSetItem;delete window.stepSetItem;});
 const reader=await page.context().newPage();
 try{
  await reader.goto(origin+'/#character/meg-thomas/items-addons');
  await reader.waitForFunction(()=>document.querySelector('#save-status').textContent==='Read-only');
  const readerButton=(entity,verb)=>reader.getByRole('button',{name:verb+' quantity of '+entity.name,exact:true});
  assert.equal(await readerButton(zero,'Increase').isDisabled(),true);
  assert.equal(await readerButton(max,'Decrease').isDisabled(),true);
  const readerBytes=await reader.evaluate(()=>localStorage.dbdTrackerData);
  await readerButton(zero,'Increase').dispatchEvent('click');
  assert.equal(await reader.evaluate(()=>localStorage.dbdTrackerData),readerBytes,'Forced read-only activation cannot write');
  await page.goto('about:blank');
  await reader.waitForFunction(async()=>!(await navigator.locks.query()).held.some(l=>l.name==='dbdTracker-editor'));
  await reader.getByRole('button',{name:'Enable editing',exact:true}).click();
  await reader.waitForFunction(()=>document.querySelector('#save-status').textContent!=='Read-only');
  assert.equal(await readerButton(zero,'Decrease').isDisabled(),true,'Writer acquisition preserves zero boundary');
  assert.equal(await readerButton(zero,'Increase').isDisabled(),false);
  assert.equal(await readerButton(max,'Increase').isDisabled(),true,'Writer acquisition preserves MAX boundary');
  assert.equal(await readerButton(max,'Decrease').isDisabled(),false);
 }finally{await reader.close();}
 await page.goto(origin+'/#character/meg-thomas/items-addons');
}
export async function inventoryRegression(page,origin){
 await familyNavigationRegression(page,origin);
 await survivorAddonRarityNavigationRegression(page,origin);
 await familyTransitionsRegression(page,origin);
 await artworkCardsRegression(page,origin);
 await quantityStepperRegression(page,origin);
 await quantityStepperFocusRegression(page,origin);
 await quantityNavigationRegression(page,origin);
 page.setDefaultTimeout(6000);
 assert.equal(inventoryCatalogStatus.survivor,'ready');
 const item=inventoryEntities.find(e=>e.map==='items'), addon=inventoryEntities.find(e=>e.map==='addons'&&e.familyId===item.familyId);
 const save=freshSave(); save.characters['meg-thomas'].inventory.items['survivor-item-future-unresolved']=11;
 await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
 await page.goto(origin+'/#character/meg-thomas/items-addons'); await page.reload();
 const bytes=()=>page.evaluate(()=>localStorage.getItem('dbdTrackerData'));
 const field=id=>page.locator('[data-inventory-quantity="'+id+'"]');
 const order=()=>page.locator('[data-stock-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockCard));
 await field(item.id).waitFor();
  const banquet=inventoryEntities.find(entity=>entity.name.includes('Banquet')&&entity.rarity==='Event');
  assert.ok(banquet,'Qualified Banquet entity remains displayed as Event');
  await page.locator('#stock-family-nav-'+banquet.familyId).click();
  const banquetCard=page.locator('[data-stock-card="'+banquet.id+'"]');
  assert.equal(await banquetCard.getAttribute('data-stock-rarity'),'Event');
  assert.equal(await banquetCard.locator('.stock-card-meta').textContent(),'Event · Item');
  await page.locator('#inventory-filters').evaluate(el=>el.open=true);
  await page.locator('#inventory-rarity').selectOption('Event');
  assert.equal(await banquetCard.count(),1,'Event filter includes Banquet by displayed rarity');
  assert.equal(await page.locator('[data-stock-card]:not([data-stock-rarity="Event"])').count(),0);
  await page.locator('#inventory-filters').evaluate(el=>el.open=true);
  await page.locator('#inventory-rarity').selectOption('');

  await page.locator('#stock-family-nav-'+item.familyId).click();
  assert.equal(await page.locator('[data-action="stock-family-toggle"], [data-action="stock-collapse-all"], [data-action="stock-expand-all"]').count(),0,'Obsolete accordion actions are absent');
  assert.equal(await page.locator('#inventory-family').count(),0,'Family is navigation');
  assert.equal(await page.locator('#inventory-search').isVisible(),true);
  assert.equal(await page.locator('#inventory-in-stock').isVisible(),true);
  assert.equal(await page.locator('#inventory-filters').count(),1);
  const decoded=await page.evaluate(async paths=>Promise.all(paths.map(async path=>{
    const image=new Image();image.src=path;try{await image.decode();return image.naturalWidth>0;}catch{return false;}
  })),inventoryEntities.map(e=>e.imagePath).filter(Boolean));
  assert.equal(decoded.length,92);assert.ok(decoded.every(Boolean),'All92 referenced staged Survivor images decode');
 const before=await bytes(), beforeOrder=await order();
 await field(item.id).fill('5');
 assert.equal(await bytes(),before); assert.deepEqual(await order(),beforeOrder);
 await field(item.id).press('Enter');
 assert.equal(JSON.parse(await bytes()).characters['meg-thomas'].inventory.items[item.id],5);
  const committedFamilyItems=await page.locator('[data-stock-family="'+item.familyId+'"] [data-stock-subsection="items"] [data-stock-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockCard));
  assert.equal(committedFamilyItems[0],item.id,'Positive stock moves to the front of its family Items subsection after commit');
 assert.equal(await field(item.id).evaluate(n=>document.activeElement===n),true);
  let committed=await bytes();
  const itemDetails=page.locator('[data-stock-card="'+item.id+'"] [data-action="stock-details"]');
  assert.equal(await page.locator('[data-stock-card="'+item.id+'"] details').count(),0,'Card no longer carries persistent reference disclosure');
  assert.equal(await page.getByText('Reference and compatibility',{exact:true}).count(),0);
  await field(item.id).fill('6');
  await itemDetails.click();
  assert.equal(await bytes(),committed,'Details reference reading retains the pending value without committing');
  assert.equal(await page.locator('#detail').isVisible(),true);
  assert.match(await page.locator('#detail-content').textContent(),new RegExp(item.name));
  assert.match(await page.locator('#detail-content').textContent(),new RegExp(item.rarity));
  assert.ok((await page.locator('#detail-content').textContent()).includes(item.effect.slice(0,24)),'Effect summary appears in Details');
  const source=page.locator('#detail [data-stock-source]').first();
  assert.equal(await source.getAttribute('target'),'_blank');
  assert.match(await source.getAttribute('rel'),/noopener/);
  assert.match(await source.getAttribute('rel'),/noreferrer/);
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  await page.waitForFunction(id=>document.activeElement?.id==='stock-details-'+id,item.id);

  const addonDetails=page.locator('[data-stock-card="'+addon.id+'"] [data-action="stock-details"]');
  await addonDetails.click();
  const addonText=await page.locator('#detail-content').textContent();
  for(const compatibleId of addon.compatibleItemIds) assert.ok(addonText.includes(inventoryEntityById[compatibleId].name),'Exact compatible Item shown');
  await page.getByRole('button',{name:'Close details',exact:true}).click();

  const beforeInvalidDetails=await bytes();
  await field(item.id).fill('bad');
  await itemDetails.click();
  assert.equal(await bytes(),beforeInvalidDetails,'Opening Details cannot persist invalid raw quantity');
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  assert.equal(await field(item.id).inputValue(),'bad','Details cannot normalize or clear invalid raw text');
  await field(item.id).fill('5'); await field(item.id).press('Enter');

  const sameQuantity=JSON.parse(await bytes());
  assert.equal(sameQuantity.characters['meg-thomas'].inventory.items[item.id],5);
  committed=await bytes();
 await page.locator('#inventory-search').focus();
  assert.equal(await bytes(),committed,'Enter then blur must not stamp twice');
  await field(item.id).fill('invalid');
  await page.locator('#inventory-search').click();
  await page.waitForFunction(()=>document.querySelector('[data-stock-error]')?.textContent.length>0);
  assert.equal(await page.locator('#inventory-search').evaluate(n=>document.activeElement===n),true,'Invalid blur respects clicked destination');
 for(const invalid of ['','-1','1.5','9007199254740992']){
  await field(item.id).fill(invalid); await field(item.id).press('Enter');
  assert.equal(await bytes(),committed); assert.equal(await field(item.id).inputValue(),invalid);
 }
 await field(item.id).fill('0'); await page.locator('#inventory-in-stock').check();
 await page.waitForFunction(id=>!JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].inventory.items[id],item.id);
 await page.locator('#inventory-in-stock').uncheck();
 await page.locator('#inventory-filters').evaluate(el=>el.open=true);
 await page.locator('#inventory-map').selectOption('addons');
 await field(addon.id).fill('9'); await field(addon.id).press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
 await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
 await page.waitForFunction(id=>JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].inventory.addons[id]===9,addon.id);
 await page.evaluate(()=>{window.stockSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='dbdTrackerData')throw Error('stock fixture failure');return window.stockSetItem.call(this,k,v);};});
 const failBefore=await bytes();
 await field(addon.id).fill('10'); await field(addon.id).press('Enter');
 assert.equal(await bytes(),failBefore); assert.equal(await field(addon.id).inputValue(),'10');
 assert.match(await page.locator('#stock-error-'+addon.id).textContent(),/Not saved/);
 await page.evaluate(()=>{Storage.prototype.setItem=window.stockSetItem;});
 await field(addon.id).press('Enter');
  await field(addon.id).fill('11');
 await page.getByRole('link',{name:'Overview',exact:true}).click();
  assert.equal(JSON.parse(await bytes()).characters['meg-thomas'].inventory.addons[addon.id],11,'Valid blur commits before navigation');
 await page.getByRole('link',{name:'Edit Character',exact:true}).click();
 const draftBefore=await bytes();
  await field(item.id).fill('bad');
  await page.locator('#inventory-search').fill('nothing matches');
  await page.getByRole('button',{name:'Save Character',exact:true}).click();
  assert.equal(await bytes(),draftBefore);
  assert.equal(await field(item.id).evaluate(n=>document.activeElement===n),true);
  assert.equal(await field(item.id).getAttribute('aria-invalid'),'true');
  for(const width of [320,500,760,1100,1440,1600]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Edit stock overflow '+width);
    assert.ok((await page.getByRole('button',{name:'Save Character',exact:true}).boundingBox()).height>=44,'Save touch target');
  }
  await page.setViewportSize({width:1440,height:900});
 await field(item.id).fill('6'); await field(item.id).press('Enter');
 await page.locator('#inventory-filters').evaluate(el=>el.open=true);
 await page.locator('#inventory-map').selectOption('addons');
 await field(addon.id).fill('12'); await field(addon.id).press('Tab');
 assert.equal(await bytes(),draftBefore);
 await page.locator('#inventory-search').fill('nothing matches');
 await page.getByRole('button',{name:'Save Character',exact:true}).click();
 const saved=JSON.parse(await bytes());
 assert.equal(saved.characters['meg-thomas'].inventory.items[item.id],6);
 assert.equal(saved.characters['meg-thomas'].inventory.addons[addon.id],12);
 assert.equal(saved.characters['meg-thomas'].inventory.items['survivor-item-future-unresolved'],11);
 assert.equal(saved.characters['meg-thomas'].updatedAt,saved.updatedAt);
  await page.getByRole('link',{name:'Edit Character',exact:true}).click();
  const discardBefore=await bytes();
  await field(item.id).fill('77');
  await page.evaluate(()=>{
    const button=document.createElement('button');button.id='draft-reset';button.dataset.action='reset';button.textContent='Synthetic reset';
    document.querySelector('main').append(button);
  });
  await page.locator('#draft-reset').click();
  await page.getByRole('button',{name:'Discard',exact:true}).click();
  await page.locator('#confirmation [value="cancel"]').click();
  assert.equal(await bytes(),discardBefore,'Discard followed by canceled reset cannot autosave a draft quantity');
  assert.equal(await field(item.id).inputValue(),'6','Canceled mutation leaves a fresh canonical edit session');
  await field(item.id).fill('7');
  await page.evaluate(()=>{
    const button=document.createElement('button');button.id='draft-reset';button.dataset.action='reset';button.textContent='Synthetic reset';
    document.querySelector('main').append(button);
  });
  await page.locator('#draft-reset').click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.locator('#confirmation [value="cancel"]').click();
  await field(item.id).fill('8');
  await page.getByRole('button',{name:'Save Character',exact:true}).click();
  assert.equal(JSON.parse(await bytes()).characters['meg-thomas'].inventory.items[item.id],8,'Saved guard followed by canceled replacement remains editable');
  await page.getByRole('link',{name:'Edit Character',exact:true}).click();
  await field(item.id).fill('9');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Discard',exact:true}).click();
  await page.waitForURL('**/#character/meg-thomas/overview');
 await page.goto(origin+'/#character/the-doctor/power-addons');
 await page.waitForFunction(()=>document.querySelector('[data-character-workspace] h1')?.textContent==='The Doctor');
 assert.equal(await page.locator('[data-killer-quantity]').count(),20);
  await page.goto(origin+'/#character/meg-thomas/items-addons');
  await field(item.id).fill(String(Number.MAX_SAFE_INTEGER));
  await field(item.id).press('Enter');
  for(const width of [320,500,760,1100,1440,1600]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Inventory overflow '+width);
    assert.ok((await field(item.id).boundingBox()).height>=44);
    const itemSelector=await page.locator('#inventory-item').boundingBox();
    assert.ok(itemSelector&&itemSelector.x>=0&&itemSelector.x+itemSelector.width<=width,'Compatible Item selector fits '+width+'px');
    assert.equal(await field(item.id).inputValue(),String(Number.MAX_SAFE_INTEGER));
    assert.equal(await page.locator('.stock-grid table').count(),0);
    assert.equal(await field(item.id).getAttribute('aria-invalid'),'false');
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('link',{name:'Overview',exact:true}).click();
  assert.match(await page.locator('[data-character-workspace]').textContent(),/38 Items.*54 Add-ons/);
  assert.doesNotMatch(await page.locator('[data-character-workspace]').textContent(),/Verified inventory data is not yet available/);
  const reader=await page.context().newPage();
  await reader.goto(origin+'/#character/meg-thomas/items-addons');
  await reader.waitForFunction(()=>document.querySelector('#save-status').textContent==='Read-only');
  assert.equal(await reader.locator('[data-inventory-quantity]').first().isDisabled(),true);
  const readerDetails=reader.locator('[data-stock-card="'+item.id+'"] [data-action="stock-details"]');
  assert.equal(await readerDetails.isDisabled(),false,'Details stays available without writer access');
  await readerDetails.click();
  assert.equal(await reader.locator('#detail').isVisible(),true);
  await reader.getByRole('button',{name:'Close details',exact:true}).click();
  assert.equal(await readerDetails.evaluate(node=>document.activeElement===node),true);
  await page.goto(origin+'/#character/meg-thomas/items-addons');
  await field(item.id).fill('14');await field(item.id).press('Enter');
  await reader.waitForFunction(id=>document.querySelector('[data-inventory-quantity="'+id+'"]').value==='14',item.id);
  await reader.close();
  const broken=origin+'/'+item.imagePath+'?stock-image-error=1';
  await page.route(broken,route=>route.fulfill({status:200,contentType:'image/png',body:'broken image'}));
  await page.locator('[data-stock-card="'+item.id+'"] img').evaluate((node,url)=>{node.src=url;},broken);
  await page.locator('[data-stock-card="'+item.id+'"] .stock-art-fallback').waitFor();
  assert.equal(await page.locator('[data-stock-card="'+item.id+'"] img').count(),0);
  await page.unroute(broken);
}
export async function quantityStepperFocusRegression(page,origin){
 page.setDefaultTimeout(6000);
 const item=inventoryEntities.find(e=>e.map==='items');
 const neighbor=inventoryEntities.find(e=>e.map==='addons'&&e.familyId===item.familyId);
 const other=inventoryEntities.find(e=>e.map==='items'&&e.familyId!==item.familyId);
 const save=freshSave();
 save.characters['meg-thomas'].inventory.items[item.id]=1;
 save.characters['meg-thomas'].inventory.items[other.id]=2;
 save.characters['meg-thomas'].inventory.addons[neighbor.id]=3;
 await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
 await page.goto(origin+'/#character/meg-thomas/items-addons');await page.reload();
 const field=id=>page.locator('[data-inventory-quantity="'+id+'"]');
 const decrease=page.getByRole('button',{name:'Decrease quantity of '+item.name,exact:true});
 await page.locator('#inventory-in-stock').check();
 await decrease.click();
 assert.equal(await field(item.id).count(),0,'Committed zero disappears under In Stock');
 assert.equal(await field(neighbor.id).evaluate(n=>n===document.activeElement),true,'Fallback follows rendered family/subsection order, not global Item order');
 await page.locator('#inventory-in-stock').uncheck();
 await field(item.id).fill('abc');await field(item.id).press('Enter');
 await page.locator('#inventory-search').fill('hide-error-field');
 await page.locator('[data-stock-error-summary] [data-id="'+item.id+'"]').click();
 assert.equal(await page.locator('[data-stock-family]').getAttribute('data-stock-family'),item.familyId);
 assert.equal(await field(item.id).inputValue(),'abc');
 assert.equal(await field(item.id).evaluate(n=>n===document.activeElement),true);
 await field(item.id).fill('1');await field(item.id).press('Enter');
 // Restore the default view after error navigation sets Type to Items.
 await page.locator('#inventory-filters').evaluate(n=>n.open=true);await page.locator('#inventory-map').selectOption('');
 await page.locator('#inventory-in-stock').check();
 await field(item.id).fill('0');await field(item.id).press('Enter');
 assert.equal(await field(neighbor.id).evaluate(n=>n===document.activeElement),true,'Typed zero uses the same family-local fallback');
 await page.locator('#inventory-search').fill(other.name);
 await page.locator('#stock-family-nav-'+other.familyId).click();
 await field(other.id).fill('0');await field(other.id).press('Enter');
 assert.equal(await page.locator('#inventory-search').evaluate(n=>n===document.activeElement),true,'Last visible zero falls back to Search');
}

export async function quantityNavigationRegression(page,origin){
 page.setDefaultTimeout(6000);
 const save=freshSave();
 await page.evaluate(value=>localStorage.setItem('dbdTrackerData',JSON.stringify(value)),save);
 const item=inventoryEntities.find(entity=>entity.map==='items'&&entity.familyId==='med-kit');
 const addon=inventoryEntities.find(entity=>entity.map==='addons'&&entity.compatibleItemIds.includes(item.id));
 const field=id=>page.locator('[data-inventory-quantity="'+id+'"]');
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dbdTrackerData')));
 const back=()=>page.locator('.character-workspace-back');
 await page.goto(origin+'/#character/meg-thomas/items-addons');await page.reload();
 await page.locator('#stock-family-nav-'+item.familyId).click();
 await page.locator('#inventory-item').selectOption(item.id);
 await field(addon.id).focus();
 assert.equal(await field(addon.id).inputValue(),'','Focusing zero clears the visible quantity');
 await field(addon.id).fill('17');
 await back().click({delay:80});
 await page.waitForURL('**/#survivors');
 assert.equal((await saved()).characters['meg-thomas'].inventory.addons[addon.id],17,
  'First-click navigation commits the edited Survivor Add-on quantity');

 await page.goto(origin+'/#character/meg-thomas/items-addons');
 await page.locator('#stock-family-nav-'+item.familyId).click();
 await page.locator('#inventory-item').selectOption(item.id);
 assert.equal(await field(addon.id).inputValue(),'17','Quantity remains after returning to inventory');
 await field(addon.id).fill('');
 await back().click({delay:80});
 await page.waitForURL('**/#survivors');
 assert.equal((await saved()).characters['meg-thomas'].inventory.addons[addon.id]||0,0,
  'Blank quantity normalizes to zero before navigation');

 await page.goto(origin+'/#character/meg-thomas/items-addons');
 await page.locator('#stock-family-nav-'+item.familyId).click();
 await page.locator('#inventory-item').selectOption(item.id);
 await field(addon.id).fill('23');
 await page.locator('[data-workspace-section="overview"]').click({delay:80});
 await page.waitForURL('**/#character/meg-thomas/overview');
 assert.equal((await saved()).characters['meg-thomas'].inventory.addons[addon.id],23,
  'Workspace tab navigation commits a pending Survivor quantity');

 await page.locator('[data-workspace-section="items-addons"]').click();
 await page.locator('#stock-family-nav-'+item.familyId).click();
 await page.locator('#inventory-item').selectOption(item.id);
 await field(addon.id).fill('24');
 await page.goBack();
 await page.waitForURL('**/#character/meg-thomas/overview');
 assert.equal((await saved()).characters['meg-thomas'].inventory.addons[addon.id],24,
  'Browser Back commits the pending Survivor quantity');
 await page.goForward();
 await page.waitForURL('**/#character/meg-thomas/items-addons');
 await page.locator('#stock-family-nav-'+item.familyId).click();
 await page.locator('#inventory-item').selectOption(item.id);

 const next=page.locator('a[data-roster-neighbor="next"]');
 const nextHref=await next.getAttribute('href');
 await field(addon.id).fill('25');
 await next.click({delay:80});
 await page.waitForURL(url=>url.hash===nextHref);
 assert.equal((await saved()).characters['meg-thomas'].inventory.addons[addon.id],25,
  'Next character navigation commits the edit before replacing its link');
 const nextCharacterId=nextHref.split('/')[1];
 await page.locator('#stock-family-nav-'+item.familyId).click();
 await page.locator('#inventory-item').selectOption(item.id);
 await field(addon.id).fill('26');
 await page.locator('a[data-roster-neighbor="previous"]').click({delay:80});
 await page.waitForURL('**/#character/meg-thomas/items-addons');
 assert.equal((await saved()).characters[nextCharacterId].inventory.addons[addon.id],26,
  'Previous character navigation commits the edit before replacing its link');

 const killerSave=freshSave();
 await page.evaluate(value=>localStorage.setItem('dbdTrackerData',JSON.stringify(value)),killerSave);
 await page.goto(origin+'/#character/the-doctor/power-addons');
 const killerField=page.locator('[data-killer-quantity]').first();
 const killerId=await killerField.getAttribute('data-killer-quantity');
 await killerField.fill('31');
 await back().click({delay:80});
 await page.waitForURL('**/#killers');
 assert.equal((await saved()).characters['the-doctor'].inventory.addons[killerId],31,
  'First-click navigation commits a Killer Add-on quantity');
}

export async function survivorAddonRarityNavigationRegression(page,origin){
 page.setDefaultTimeout(6000);
 const family='key';
 const addons=inventoryEntities.filter(entity=>entity.familyId===family&&entity.map==='addons').sort((a,b)=>a.order-b.order);
 const items=inventoryEntities.filter(entity=>entity.familyId===family&&entity.map==='items').sort((a,b)=>a.order-b.order);
 const sortIds=(entries,direction)=>{
  const order=direction==='lowest-to-highest'?[...rarityOrder].reverse():rarityOrder;
  return [...order.flatMap(rarity=>entries.filter(addon=>addon.rarity===rarity).map(addon=>addon.id)),
   ...entries.filter(addon=>!rarityOrder.includes(addon.rarity)).map(addon=>addon.id)];
 };
 const rarityOrder=['Ultra Rare','Very Rare','Rare','Uncommon','Common'];
 const save=freshSave();
 await page.evaluate(value=>localStorage.setItem('dbdTrackerData',JSON.stringify(value)),save);
 await page.goto(origin+'/#character/meg-thomas/items-addons');
 await page.locator('#stock-family-nav-'+family).click();
 const itemSelect=page.locator('#inventory-item'),selectedItem=items[0];
 await itemSelect.selectOption(selectedItem.id);
 assert.equal(await page.locator('[data-survivor-rarity-section], [data-addon-rarity-section], [data-addon-rarity-toggle]').count(),0,
  'Survivor Add-ons render without rarity subgroups or collapse controls');
 const itemOrder=()=>page.locator('[data-stock-subsection="items"] [data-stock-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.stockCard));
 assert.deepEqual(await itemOrder(),items.map(item=>item.id),'Survivor Items retain their existing family ordering');
 const bytes=()=>page.evaluate(()=>localStorage.getItem('dbdTrackerData'));
 const controls=page.locator('#addon-rarity-order');
 const addonList=page.locator('[data-stock-subsection="addons"] [data-stock-card]');
 assert.equal(await controls.inputValue(),'highest-to-lowest');
 const itemAddons=addons.filter(addon=>addon.compatibleItemIds.includes(selectedItem.id));
 assert.deepEqual(await addonList.evaluateAll(nodes=>nodes.map(card=>card.dataset.stockCard)),sortIds(itemAddons,'highest-to-lowest'),
  'Highest → Lowest sorts the selected Item Add-ons and preserves equal-rarity source order');
 for(const item of items){
  await itemSelect.selectOption(item.id);
  const compatible=addons.filter(addon=>addon.compatibleItemIds.includes(item.id));
  assert.deepEqual(await addonList.evaluateAll(nodes=>nodes.map(card=>card.dataset.stockCard)),sortIds(compatible,'highest-to-lowest'),
   'Each selected Item shows only its compatible Add-ons in one flat list: '+item.name);
 }
 await itemSelect.selectOption(selectedItem.id);
 const firstAddon=itemAddons.find(addon=>addon.id===sortIds(itemAddons,'highest-to-lowest')[0]);
 const field=id=>page.locator('[data-inventory-quantity="'+id+'"]');
 const zeroField=field(firstAddon.id);
 await zeroField.focus();
 assert.equal(await zeroField.inputValue(),'','Focusing a zero Survivor Add-on clears its visible zero');
 await zeroField.fill('14');await zeroField.press('Enter');
 assert.equal(JSON.parse(await bytes()).characters['meg-thomas'].inventory.addons[firstAddon.id],14);
 assert.equal(await zeroField.inputValue(),'14','Focusing a nonzero Survivor Add-on preserves the value');
 await zeroField.fill('');await page.locator('#inventory-search').focus();
 await page.waitForFunction(id=>!JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].inventory.addons[id],firstAddon.id);
 assert.equal(await zeroField.inputValue(),'0','Blurring an empty Survivor Add-on restores zero');
 const savedZero=await bytes();
 await zeroField.fill('14');await zeroField.press('Enter');
 const savedWithQuantity=await bytes();
 await controls.selectOption('lowest-to-highest');
 assert.deepEqual(await addonList.evaluateAll(nodes=>nodes.map(card=>card.dataset.stockCard)),sortIds(itemAddons,'lowest-to-highest'),
  'Lowest → Highest sorts only the selected Item Add-ons');
 assert.deepEqual(await itemOrder(),items.map(item=>item.id),'Rarity sorting does not reorder Survivor Items');
 assert.equal(await field(firstAddon.id).inputValue(),'14','Rarity sorting keeps quantity attached to its Add-on');
 assert.equal(await bytes(),savedWithQuantity,'Rarity sorting changes presentation only');
 const otherItems=inventoryEntities.filter(item=>item.map==='items'&&item.familyId==='flashlight').sort((a,b)=>a.order-b.order);
 const otherFamilyAddons=inventoryEntities.filter(addon=>addon.familyId==='flashlight'&&addon.map==='addons').sort((a,b)=>a.order-b.order);
 await page.locator('#stock-family-nav-flashlight').click();
 const otherItem=otherItems[0],otherItemAddons=otherFamilyAddons.filter(addon=>addon.compatibleItemIds.includes(otherItem.id));
 await page.locator('#inventory-item').selectOption(otherItem.id);
 assert.deepEqual(await addonList.evaluateAll(nodes=>nodes.map(card=>card.dataset.stockCard)),sortIds(otherItemAddons,'lowest-to-highest'),
  'Sorting applies within the selected Item and never mixes Add-ons from another Item');
 assert.deepEqual(await itemOrder(),otherItems.map(item=>item.id),'Rarity sorting does not reorder the Flashlight Items');
 for(const item of otherItems){
  await page.locator('#inventory-item').selectOption(item.id);
  const compatible=otherFamilyAddons.filter(addon=>addon.compatibleItemIds.includes(item.id));
  assert.deepEqual(await addonList.evaluateAll(nodes=>nodes.map(card=>card.dataset.stockCard)),sortIds(compatible,'lowest-to-highest'),
   'Flashlight Add-ons remain segregated for '+item.name);
 }
 await page.locator('#stock-family-nav-'+family).click();
 await page.locator('#inventory-item').selectOption(selectedItem.id);
 assert.equal(await bytes(),savedWithQuantity,'Changing Item sections does not alter inventory JSON');
 assert.equal(JSON.parse(await bytes()).schemaVersion,2,'Inventory remains valid schema-v2 JSON');
 assert.equal(await bytes(),savedWithQuantity,'Rarity sorting and Item navigation do not change inventory JSON');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {smokeStage}=await import('./smoke.mjs');
 await smokeStage(resolve(process.argv[2]||'release/runtime'),{regression:inventoryRegression});
 console.log('Survivor inventory PASS');
}
