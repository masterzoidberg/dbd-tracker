import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {freshSave} from '../../src/model.js';
import {inventoryEntities,inventoryEntityById,inventoryCatalogStatus,survivorInventorySource} from '../../data/inventory-catalog.js';
export async function quantityStepperRegression(page,origin){
 page.setDefaultTimeout(6000);
 const [zero,max]=inventoryEntities.filter(e=>e.map==='items');
 const save=freshSave();save.characters['meg-thomas'].inventory.items[max.id]=Number.MAX_SAFE_INTEGER;
 await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
 await page.goto(origin+'/#character/meg-thomas/items-addons');await page.reload();
 const card=entity=>page.locator('[data-stock-card="'+entity.id+'"]');
 const decrease=entity=>card(entity).getByRole('button',{name:'Decrease quantity of '+entity.name,exact:true});
 const increase=entity=>card(entity).getByRole('button',{name:'Increase quantity of '+entity.name,exact:true});
 await card(zero).waitFor();
 assert.equal(await decrease(zero).count(),1,'Quantity decrement must exist with an entity-specific accessible name');
 assert.equal(await increase(zero).count(),1,'Quantity increment must exist with an entity-specific accessible name');
 assert.equal(await card(zero).getByRole('textbox',{name:'Quantity of '+zero.name,exact:true}).count(),1);
 assert.equal(await decrease(zero).isDisabled(),true,'Decrement disabled at zero');
 assert.equal(await increase(zero).isDisabled(),false);
 assert.equal(await increase(max).isDisabled(),true,'Increment disabled at MAX_SAFE_INTEGER');
 assert.equal(await decrease(max).isDisabled(),false);
 for(const control of [decrease(zero),increase(zero),card(zero).getByRole('textbox')]){
  const box=await control.boundingBox();assert.ok(box.height>=44&&box.width>=44,'Practical quantity targets');
 }
 const field=entity=>card(entity).getByRole('textbox');
 const bytes=()=>page.evaluate(()=>localStorage.getItem('dbdTrackerData'));
 const quantity=async entity=>JSON.parse(await bytes()).characters['meg-thomas'].inventory.items[entity.id]||0;
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
 const departureWrites=await writes();await increase(zero).press('Tab');
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
 await quantityStepperRegression(page,origin);
 await quantityStepperFocusRegression(page,origin);
 page.setDefaultTimeout(6000);
 assert.equal(inventoryCatalogStatus.survivor,'ready');
 const item=inventoryEntities.find(e=>e.map==='items'), addon=inventoryEntities.find(e=>e.map==='addons');
 const save=freshSave(); save.characters['meg-thomas'].inventory.items['survivor-item-future-unresolved']=11;
 await page.evaluate(s=>localStorage.setItem('dbdTrackerData',JSON.stringify(s)),save);
 await page.goto(origin+'/#character/meg-thomas/items-addons'); await page.reload();
 const bytes=()=>page.evaluate(()=>localStorage.getItem('dbdTrackerData'));
 const field=id=>page.locator('[data-inventory-quantity="'+id+'"]');
 const order=()=>page.locator('[data-stock-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockCard));
 await field(item.id).waitFor();
  const banquet=inventoryEntities.find(entity=>entity.name.includes('Banquet')&&entity.rarity==='Event');
  assert.ok(banquet,'Qualified Banquet entity remains displayed as Event');
  const banquetCard=page.locator('[data-stock-card="'+banquet.id+'"]');
  assert.equal(await banquetCard.getAttribute('data-stock-rarity'),'Event');
  assert.equal(await banquetCard.locator('.inventory-rarity-badge').textContent(),'Event');
  assert.match(await banquetCard.getAttribute('class'),/inventory-rarity-event/);
  await page.locator('#inventory-filters').evaluate(el=>el.open=true);
  await page.locator('#inventory-rarity').selectOption('Event');
  assert.equal(await banquetCard.count(),1,'Event filter includes Banquet by displayed rarity');
  assert.equal(await page.locator('[data-stock-card]:not([data-stock-rarity="Event"])').count(),0);
  await page.locator('#inventory-filters').evaluate(el=>el.open=true);
  await page.locator('#inventory-rarity').selectOption('');

  const presentationBytes=await bytes();
  const familyIds=survivorInventorySource.itemFamilies.map(f=>f.id);
  assert.deepEqual(await page.locator('[data-stock-family]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockFamily)),familyIds,'Verified family source order');
  for(const familyId of familyIds){
    const family=page.locator('[data-stock-family="'+familyId+'"]');
    assert.equal(await family.count(),1);
    const subsections=await family.locator('[data-stock-subsection]').evaluateAll(nodes=>nodes.map(n=>n.dataset.stockSubsection));
    assert.deepEqual(subsections,['items','addons'],'Items precede Add-ons in '+familyId);
    assert.equal(await family.locator('[data-action="stock-family-toggle"]').getAttribute('aria-expanded'),'true');
  }
  const emptyAddonFamily=survivorInventorySource.itemFamilies.find(f=>!inventoryEntities.some(e=>e.familyId===f.id&&e.map==='addons'));
  assert.ok(emptyAddonFamily);
  assert.match(await page.locator('[data-stock-family="'+emptyAddonFamily.id+'"] [data-stock-subsection="addons"]').textContent(),/No compatible Add-ons in this catalog./);
  assert.equal(await page.locator('#inventory-family').count(),0,'Family is structure, not a required dropdown');
  assert.equal(await page.locator('#inventory-search').isVisible(),true);
  assert.equal(await page.locator('#inventory-in-stock').isVisible(),true);
  assert.equal(await page.locator('#inventory-filters').count(),1);
  assert.match(await page.locator('#inventory-filters summary').textContent(),/Filters/);

  const familyToggle=page.locator('[data-stock-family="'+item.familyId+'"] [data-action="stock-family-toggle"]');
  await familyToggle.click();
  assert.equal(await familyToggle.getAttribute('aria-expanded'),'false');
  await page.locator('#inventory-search').fill(item.name);
  assert.equal(await familyToggle.getAttribute('aria-expanded'),'true','Search temporarily reveals collapsed matching family');
  await page.locator('#inventory-search').fill('');
  assert.equal(await familyToggle.getAttribute('aria-expanded'),'false','Clearing search restores collapse intent');
  assert.equal(await bytes(),presentationBytes,'Collapse/search presentation state never persists');
  await page.getByRole('button',{name:'Expand all',exact:true}).click();
  assert.equal(await familyToggle.getAttribute('aria-expanded'),'true');
  await page.getByRole('button',{name:'Collapse all',exact:true}).click();
  assert.equal(await page.locator('[data-action="stock-family-toggle"][aria-expanded="false"]').count(),familyIds.length);
  await page.getByRole('button',{name:'Expand all',exact:true}).click();
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
  await page.waitForFunction(id=>JSON.parse(localStorage.dbdTrackerData).characters['meg-thomas'].inventory.items[id]===6,item.id);
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
 await field(addon.id).fill('9'); await field(addon.id).press('Tab'); await page.keyboard.press('Tab');
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
 await page.goto(origin+'/#character/the-doctor/power-addons');
 assert.equal(await page.locator('[data-inventory-quantity]').count(),0);
  await page.goto(origin+'/#character/meg-thomas/items-addons');
  await field(item.id).fill(String(Number.MAX_SAFE_INTEGER));
  await field(item.id).press('Enter');
  for(const width of [320,500,760,1100,1440,1600]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Inventory overflow '+width);
    assert.ok((await field(item.id).boundingBox()).height>=44);
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
 const toggle=page.locator('[data-stock-family="'+item.familyId+'"] [data-action="stock-family-toggle"]');
 await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await page.locator('[data-stock-error-summary] [data-id="'+item.id+'"]').click();
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 assert.equal(await field(item.id).inputValue(),'abc');
 assert.equal(await field(item.id).evaluate(n=>n===document.activeElement),true);
 await field(item.id).fill('1');await field(item.id).press('Enter');
 // Restore the default view after error navigation sets Type to Items.
 await page.locator('#inventory-filters').evaluate(n=>n.open=true);await page.locator('#inventory-map').selectOption('');
 await page.locator('#inventory-in-stock').check();
 await field(item.id).fill('0');await field(item.id).press('Enter');
 assert.equal(await field(neighbor.id).evaluate(n=>n===document.activeElement),true,'Typed zero uses the same family-local fallback');
 await page.locator('#inventory-search').fill(other.name);
 await field(other.id).fill('0');await field(other.id).press('Enter');
 assert.equal(await page.locator('#inventory-search').evaluate(n=>n===document.activeElement),true,'Last visible zero falls back to Search');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {smokeStage}=await import('./smoke.mjs');
 await smokeStage(resolve(process.argv[2]||'release/runtime'),{regression:inventoryRegression});
 console.log('Survivor inventory PASS');
}
