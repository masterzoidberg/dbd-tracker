import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptInventoryCatalog, inventoryEntities, inventoryCatalogStatus } from '../data/inventory-catalog.js';
const source=()=>({patch:'test-only',verifiedAt:'2026-10-13',provenance:{references:['https://example.test/research']},itemFamilies:[{id:'key',name:'Keys'}],items:[{sourceId:'key/test-key',familyId:'key',name:'Test Key',rarity:'Common',effect:'Test-only effect',description:null,provenance:{references:['https://example.test/key']}}],addons:[]});
test('adapter freezes source identity independent of display names and preserves flags',()=>{
 const s=source(); s.items[0].needsVerification=true;
 const entities=adaptInventoryCatalog(s,'survivor');
 assert.equal(entities[0].id,'survivor-item-key-test-key'); assert.equal(entities[0].sourceId,'key/test-key');
 assert.equal(entities[0].needsVerification,true); assert.equal(entities[0].description,null);
 s.items[0].name='Translated'; assert.equal(adaptInventoryCatalog(s,'survivor')[0].id,entities[0].id);
});
test('reviewed Survivor snapshot has collision-free frozen IDs flags provenance and compatible stock',()=>{
 assert.equal(inventoryCatalogStatus.survivor,'ready');
 assert.equal(inventoryEntities.filter(e=>e.map==='items').length,38);
 assert.equal(inventoryEntities.filter(e=>e.map==='addons').length,54);
 assert.equal(new Set(inventoryEntities.map(e=>e.familyId)).size,7);
 assert.equal(new Set(inventoryEntities.map(e=>e.sourceId)).size,92);
 assert.equal(new Set(inventoryEntities.map(e=>e.id)).size,92);
 assert.equal(inventoryEntities.filter(e=>e.needsVerification).length,3);
 assert.equal(inventoryEntities.filter(e=>e.map==='addons'&&e.familyId==='firecracker').length,0);
 for(const entity of inventoryEntities){
  assert.equal(entity.id,entity.kind+'-'+entity.sourceId.replace('/','-'));
  assert.ok(entity.provenance.references.length>0);
  if(entity.map==='addons') assert.ok(entity.compatibleItemIds.length>0);
 }
});
test('adapter rejects duplicate kind provenance and mismapped identities',()=>{
 for(const mutate of [
  s=>s.items.push({...s.items[0]}),s=>s.items[0].kind='killer-addon',
  s=>s.provenance={},s=>s.items[0].provenance={},
  s=>s.items[0].sourceId='other/test-key',s=>s.items[0].id='survivor-item-key-translated',
  s=>s.items[0].sourceId='key/Test Key', s=>s.items[0].sourceId='key/test-key\n',
 ]){ const s=source(); mutate(s); assert.throws(()=>adaptInventoryCatalog(s,'survivor')); }
});
