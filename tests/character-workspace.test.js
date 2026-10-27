import test from 'node:test';
import assert from 'node:assert/strict';
import { characterWorkspaceHref, characterWorkspaceNeighbors, parseCharacterWorkspaceRoute } from '../src/character-workspace.js';
import { createCharacterInventorySession, syncCharacterInventorySession } from '../src/character-inventory.js';
import { characters } from '../data/catalog.js';

test('canonical routes and bare alias use one explicit descriptor', () => {
  for (const [id, sections] of [
    ['meg-thomas', ['overview', 'perks', 'items-addons', 'setup']],
    ['the-doctor', ['overview', 'perks', 'power-addons', 'setup']],
  ]) for (const section of sections) {
    const href = '#character/' + id + '/' + section;
    assert.equal(characterWorkspaceHref(id, section), href);
    assert.equal(parseCharacterWorkspaceRoute(href).canonicalRoute, href);
    assert.equal(parseCharacterWorkspaceRoute(href.slice(1)).status, 'valid');
  }
  assert.equal(parseCharacterWorkspaceRoute('#character/meg-thomas').canonicalRoute, '#character/meg-thomas/overview');
  for (const mode of ['update', 'legacy']) {
    assert.equal(characterWorkspaceHref('meg-thomas', 'perks', mode), '#character/meg-thomas/perks/' + mode);
  }
});

test('five old aliases keep Perks meaning without inventing legacy experiment', () => {
  for (const [old, target] of [
    ['manage/meg-thomas', 'perks'], ['manage/meg-thomas/update', 'perks/update'],
    ['manage/meg-thomas/legacy', 'perks/legacy'], ['experiment/meg-thomas', 'perks'],
    ['experiment/meg-thomas/update', 'perks/update'],
  ]) assert.equal(parseCharacterWorkspaceRoute('#' + old).canonicalRoute, '#character/meg-thomas/' + target);
  assert.equal(parseCharacterWorkspaceRoute('#experiment/meg-thomas/legacy').status, 'unavailable');
});

test('retired Edit bookmarks resolve to Overview while manage and experiment aliases keep Perks meaning', () => {
  for (const id of ['meg-thomas', 'the-doctor']) {
    const route = parseCharacterWorkspaceRoute('#character/' + id + '/edit');
    assert.equal(route.status, 'valid');
    assert.equal(route.section, 'overview');
    assert.equal(route.source, 'legacy-edit');
    assert.equal(route.canonicalRoute, '#character/' + id + '/overview');
    assert.throws(() => characterWorkspaceHref(id, 'edit'));
  }
  assert.equal(parseCharacterWorkspaceRoute('#manage/meg-thomas').canonicalRoute, '#character/meg-thomas/perks');
  assert.equal(parseCharacterWorkspaceRoute('#experiment/meg-thomas').canonicalRoute, '#character/meg-thomas/perks');
});

test('recognized invalid hashes remain unavailable instead of top-level fallback', () => {
  for (const route of [
    '#character', '#character/unknown/overview', '#character/constructor/perks',
    '#character/meg-thomas/perks/update/extra', '#character/meg-thomas/',
    '#character/the-doctor/items-addons', '#character/meg-thomas/power-addons',
    '#manage/unknown', '#manage/meg-thomas/extra', '#experiment/meg-thomas/update/extra',
  ]) assert.equal(parseCharacterWorkspaceRoute(route).status, 'unavailable', route);
  for (const route of ['', '#dashboard', '#survivors', null]) assert.equal(parseCharacterWorkspaceRoute(route), null);
  assert.throws(() => characterWorkspaceHref('unknown'));
  assert.throws(() => characterWorkspaceHref('meg-thomas', 'power-addons'));
  assert.throws(() => characterWorkspaceHref('meg-thomas', 'edit', 'legacy'));
});

test('character neighbors follow canonical role order and preserve supported tabs', () => {
  const roster=role=>characters.filter(character=>character.role===role);
  const killers=roster('killer'), survivors=roster('survivor');
  const shape=killers.findIndex(character=>character.id==='the-shape');
  const meg=survivors.findIndex(character=>character.id==='meg-thomas');
  const killerPower=characterWorkspaceNeighbors('the-shape','power-addons');
  assert.deepEqual(killerPower.previous,{id:killers[shape-1].id,name:killers[shape-1].name,href:'#character/'+killers[shape-1].id+'/power-addons'});
  assert.deepEqual(killerPower.next,{id:killers[shape+1].id,name:killers[shape+1].name,href:'#character/'+killers[shape+1].id+'/power-addons'});
  assert.equal(characterWorkspaceNeighbors('the-shape','perks','update').next.href,'#character/'+killers[shape+1].id+'/perks/update');
  const survivorInventory=characterWorkspaceNeighbors('meg-thomas','items-addons');
  assert.deepEqual(survivorInventory.previous,{id:survivors[meg-1].id,name:survivors[meg-1].name,href:'#character/'+survivors[meg-1].id+'/items-addons'});
  assert.deepEqual(survivorInventory.next,{id:survivors[meg+1].id,name:survivors[meg+1].name,href:'#character/'+survivors[meg+1].id+'/items-addons'});
  assert.equal(characterWorkspaceNeighbors('meg-thomas','perks').next.href,'#character/'+survivors[meg+1].id+'/perks');
  assert.equal(characterWorkspaceNeighbors(killers[0].id).previous,null);
  assert.equal(characterWorkspaceNeighbors(killers.at(-1).id).next,null);
  assert.equal(characterWorkspaceNeighbors(survivors[0].id).previous,null);
  assert.equal(characterWorkspaceNeighbors(survivors.at(-1).id).next,null);
  assert.equal(characterWorkspaceNeighbors('the-shape','items-addons').next.href,'#character/'+killers[shape+1].id+'/overview');
});

test('equivalent update aliases retain canonical session identity and draft selection', () => {
  const session = createCharacterInventorySession('#manage/meg-thomas/update');
  session.search = 'kindred';
  session.selectedPerkId = 'kindred';
  for (const href of ['#experiment/meg-thomas/update', '#character/meg-thomas/perks/update']) {
    assert.equal(syncCharacterInventorySession(session, href), session);
  }
  assert.notEqual(syncCharacterInventorySession(session, '#character/the-doctor/perks/update'), session);
});
