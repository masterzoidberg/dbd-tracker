import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuantityInteraction, updateQuantityInput, acceptQuantityInput, visibleQuantityEntries, regroupQuantityEntries, quantityFocusAfterCommit, groupQuantityEntries, groupQuantityEntriesByItem, sortQuantityEntriesByRarity, stepQuantityInput } from '../src/inventory-interaction.js';
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


test('family grouping keeps verified family order and family-local stock order', () => {
  const familyEntities = [
    {id:'map-zero',order:5,name:'Map Zero',familyId:'map',map:'items'},
    {id:'key-addon-zero',order:3,name:'Key Add-on Zero',familyId:'key',map:'addons'},
    {id:'key-zero',order:1,name:'Key Zero',familyId:'key',map:'items'},
    {id:'key-positive',order:0,name:'Key Positive',familyId:'key',map:'items'},
    {id:'key-addon-positive',order:2,name:'Key Add-on Positive',familyId:'key',map:'addons'},
    {id:'map-positive',order:4,name:'Map Positive',familyId:'map',map:'items'},
  ];
  const families = [{id:'key',displayName:'Keys'},{id:'map',displayName:'Maps'}];
  const state = createQuantityInteraction(familyEntities,{
    'key-positive':2,'key-addon-positive':1,'map-positive':3,
  });
  const grouped = groupQuantityEntries(state, {}, families);
  assert.deepEqual(grouped.map(group => group.family.id), ['key','map']);
  assert.deepEqual(grouped[0].items.map(entity => entity.id), ['key-positive','key-zero']);
  assert.deepEqual(grouped[0].addons.map(entity => entity.id), ['key-addon-positive','key-addon-zero']);
  assert.deepEqual(grouped[1].items.map(entity => entity.id), ['map-positive','map-zero']);
});

test('family grouping keeps pending and invalid zero-stock edits visible without reordering them', () => {
  const familyEntities = [
    {id:'key-positive',order:0,name:'Key Positive',familyId:'key',map:'items'},
    {id:'key-zero',order:1,name:'Key Zero',familyId:'key',map:'items'},
  ];
  const families = [{id:'key',displayName:'Keys'}];
  const base = createQuantityInteraction(familyEntities,{'key-positive':2});
  const pending = updateQuantityInput(base,'key-zero','4');
  assert.deepEqual(groupQuantityEntries(pending,{inStock:true},families)[0].items.map(entity=>entity.id),['key-positive','key-zero']);
  const invalid = acceptQuantityInput(updateQuantityInput(base,'key-zero','bad'),'key-zero').state;
  assert.equal(invalid.raw['key-zero'],'bad');
  assert.deepEqual(groupQuantityEntries(invalid,{inStock:true},families)[0].items.map(entity=>entity.id),['key-positive','key-zero']);
});

test('Survivor Add-ons stay beneath only compatible Items in existing Item order', () => {
  const items = [
    {id:'ranger-med-kit',name:'Ranger Med-Kit',familyId:'med-kit',order:2},
    {id:'mechanics-toolbox',name:"Mechanic's Toolbox",familyId:'toolbox',order:8},
  ];
  const addons = [
    {id:'toolbox-rare',name:'Grip Wrench',familyId:'toolbox',compatibleItemIds:['mechanics-toolbox'],rarity:'Rare',order:7},
    {id:'med-kit-common',name:'Bandages',familyId:'med-kit',compatibleItemIds:['ranger-med-kit'],rarity:'Common',order:0},
    {id:'med-kit-rare',name:'Gauze Roll',familyId:'med-kit',compatibleItemIds:['ranger-med-kit','first-aid-kit'],rarity:'Rare',order:4},
  ];

  const groups = groupQuantityEntriesByItem(items, addons);
  assert.deepEqual(groups.map(group => group.item.id), ['ranger-med-kit','mechanics-toolbox']);
  assert.deepEqual(groups[0].addons.map(addon => addon.id), ['med-kit-common','med-kit-rare']);
  assert.deepEqual(groups[1].addons.map(addon => addon.id), ['toolbox-rare']);
  assert.deepEqual(items.map(item => item.id), ['ranger-med-kit','mechanics-toolbox'],
    'Add-on association does not reorder Items');
});

test('rarity sorting uses normalized rarity and preserves source order for equal rarities', () => {
  const rows = [
    { id:'ultra-rare', order:5, rarity:'Ultra Rare', sourceRarity:'Common' },
    { id:'rare-first', order:4, rarity:'Rare', sourceRarity:'Common' },
    { id:'rare-second', order:2, rarity:'Rare', sourceRarity:'Ultra Rare' },
    { id:'very-rare', order:3, rarity:'Very Rare', sourceRarity:'Common' },
    { id:'common-first', order:0, rarity:'Common', sourceRarity:'Ultra Rare' },
  ];
  const original = structuredClone(rows);
  const order = ['Ultra Rare','Very Rare','Rare','Uncommon','Common'];
  assert.deepEqual(sortQuantityEntriesByRarity(rows, order).map(addon => addon.id),
    ['ultra-rare','very-rare','rare-first','rare-second','common-first']);
  assert.deepEqual(sortQuantityEntriesByRarity(rows, order, 'lowest-to-highest').map(addon => addon.id),
    ['common-first','rare-first','rare-second','very-rare','ultra-rare']);
  assert.deepEqual(rows, original, 'Display ordering never mutates catalog rows');
});

test('quantity stepping shares validation and respects zero and safe-integer boundaries', () => {
  const one = [{id:'a',order:0,name:'Alpha',familyId:'key',map:'items'}];
  const base = createQuantityInteraction(one,{});
  const incremented = stepQuantityInput(base,'a',1);
  assert.equal(incremented.error,null);
  assert.equal(incremented.quantity,1);
  assert.equal(incremented.state.raw.a,'1');
  const zero = stepQuantityInput(base,'a',-1);
  assert.equal(zero.quantity,0);
  const maxState = createQuantityInteraction(one,{a:Number.MAX_SAFE_INTEGER});
  assert.equal(stepQuantityInput(maxState,'a',1).quantity,Number.MAX_SAFE_INTEGER);
  const invalidState = updateQuantityInput(base,'a','bad');
  const invalid = stepQuantityInput(invalidState,'a',1);
  assert.ok(invalid.error);
  assert.equal(invalid.state.raw.a,'bad');
});
