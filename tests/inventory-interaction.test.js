import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuantityInteraction, updateQuantityInput, acceptQuantityInput, visibleQuantityEntries, regroupQuantityEntries, quantityFocusAfterCommit } from '../src/inventory-interaction.js';
const entities = [{id:'b',order:1,name:'Beta',familyId:'key'}, {id:'a',order:0,name:'Alpha',familyId:'key'}, {id:'c',order:2,name:'Gamma',familyId:'map'}];
test('snapshot positive first canonical order stays frozen until successful regroup', () => {
 const base=createQuantityInteraction(entities,{b:2});
 assert.deepEqual(visibleQuantityEntries(base,{}).map(e=>e.id),['b','a','c']);
 const typed=updateQuantityInput(base,'a','5');
 const accepted=acceptQuantityInput(typed,'a');
 assert.equal(accepted.quantity,5); assert.equal(accepted.error,null);
 assert.deepEqual(visibleQuantityEntries(accepted.state,{}).map(e=>e.id),['b','a','c']);
 assert.deepEqual(visibleQuantityEntries(regroupQuantityEntries(accepted.state,{a:5,b:2}),{}).map(e=>e.id),['a','b','c']);
 assert.equal(base.raw.a,'0'); assert.deepEqual(entities.map(e=>e.id),['b','a','c']);
});
test('invalid text and pending stock remain discoverable and draft filters retain edits', () => {
 let s=createQuantityInteraction(entities,{}, {mode:'draft'});
 for(const text of ['', '-1','1.5','9007199254740992','abc']){
  s=updateQuantityInput(s,'a',text); const r=acceptQuantityInput(s,'a'); assert.ok(r.error); assert.equal(r.state.raw.a,text);
  assert.ok(visibleQuantityEntries(r.state,{inStock:true}).some(e=>e.id==='a'));
 }
 s=acceptQuantityInput(updateQuantityInput(s,'a','3'),'a').state;
 assert.equal(visibleQuantityEntries(s,{search:'Gamma'}).length,1);
 assert.equal(s.raw.a,'3'); assert.deepEqual(visibleQuantityEntries(s,{}).map(e=>e.id),['a','b','c']);
 assert.equal(acceptQuantityInput(updateQuantityInput(s,'a','9007199254740991'),'a').quantity,Number.MAX_SAFE_INTEGER);
});
test('focus preserves blur destination and Enter uses old next previous then filter fallback',()=>{
 const before=['a','b','c'];
 assert.equal(quantityFocusAfterCommit(before,{entityId:'a',nextTargetId:'filter',trigger:'blur',visibleIds:['b','c','filter']}),'filter');
 assert.equal(quantityFocusAfterCommit(before,{entityId:'a',trigger:'enter',visibleIds:['a','b']}),'a');
 assert.equal(quantityFocusAfterCommit(before,{entityId:'b',trigger:'enter',visibleIds:['a','c']}),'c');
 assert.equal(quantityFocusAfterCommit(before,{entityId:'b',trigger:'enter',visibleIds:['a']}),'a');
 assert.equal(quantityFocusAfterCommit(before,{entityId:'b',trigger:'enter',visibleIds:[]}),'inventory-search');
});
