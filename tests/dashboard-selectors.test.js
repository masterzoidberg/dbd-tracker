import test from 'node:test';
import assert from 'node:assert/strict';
import {characters,perkById} from '../data/catalog.js';
import {freshSave,isAvailable} from '../src/model.js';
import {suggestedP1Targets,recentCharacters,favoriteCharacters} from '../src/dashboard-selectors.js';

test('P1 ranking unchanged and independent of queue',()=>{
  const save=freshSave();
  assert.deepEqual(suggestedP1Targets(save),[]);
  for(const c of characters.slice(0,12)) {save.characters[c.id].owned=true;save.characters[c.id].bloodwebLevel=20;}
  const expected=characters.filter(c=>save.characters[c.id].owned).map(character=>({character,missing:character.nativePerkIds.filter(id=>!isAvailable(save,perkById[id])).length})).filter(r=>r.missing).sort((a,b)=>b.missing-a.missing||save.characters[b.character.id].bloodwebLevel-save.characters[a.character.id].bloodwebLevel||a.character.name.localeCompare(b.character.name)).slice(0,5);
  assert.deepEqual(suggestedP1Targets(save),expected);
  save.prestigeQueue=[{characterId:expected[0].character.id,targetPrestige:9}];
  assert.deepEqual(suggestedP1Targets(save),expected);
  for(const c of characters.slice(0,12)) save.characters[c.id].prestige=3;
  assert.deepEqual(suggestedP1Targets(save),[]);
});

test('recent parsed instants retain bytes and include unowned without invented activity',()=>{
  const save=freshSave();
  const ids=['meg-thomas','dwight-fairfield','the-trapper'];
  save.characters[ids[0]].updatedAt='2026-10-14T09:00:00-04:00';
  save.characters[ids[1]].updatedAt='2026-10-14T13:00:00Z';
  save.characters[ids[2]].updatedAt='2026-10-14T14:00:00.000Z';
  save.characters['unknown-character']={updatedAt:'2027-01-01T00:00:00Z'};
  const original=JSON.stringify(save);
  assert.deepEqual(recentCharacters(save).map(c=>c.id),[ids[2],ids[1],ids[0]]);
  assert.equal(recentCharacters(save,1).length,1);
  assert.equal(JSON.stringify(save),original);
});

test('favorite unowned remains independent and sorted by name',()=>{
  const save=freshSave();
  save.characters['meg-thomas'].favorite=true;
  save.characters['dwight-fairfield'].favorite=true;
  const original=JSON.stringify(save);
  assert.deepEqual(favoriteCharacters(save).map(c=>c.id),['dwight-fairfield','meg-thomas']);
  assert.equal(JSON.stringify(save),original);
  assert.deepEqual(save.prestigeQueue,[]);
});

test('P1 native General and account override access lower missing counts',()=>{
  const save=freshSave();
  for(const c of characters) save.characters[c.id].owned=true;
  for(const perk of Object.values(perkById)) save.perkOverrides[perk.id]={shrineTier:3};
  assert.deepEqual(suggestedP1Targets(save),[]);
  for(const c of characters) save.characters[c.id].updatedAt=null;
  save.characters['meg-thomas'].updatedAt='not a date';
  assert.deepEqual(recentCharacters(save),[]);
});
