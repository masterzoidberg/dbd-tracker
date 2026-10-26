import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, inventoryTier } from '../src/model.js';
import {
  createCharacterEditSession, updateCharacterEditSession, buildCharacterEditCandidate, characterEditPreview,
} from '../src/character-edit.js';
import * as characterEdit from '../src/character-edit.js';
const id = 'meg-thomas';
function change(session, field, value, save) { return updateCharacterEditSession(session, { field, value }, save); }

test('edit session is pure and no-op candidate preserves timestamps queue and unknown inventory', () => {
  const save = freshSave();
  save.prestigeQueue = [{ characterId: 'future-goal', targetPrestige: 9 }];
  save.characters[id].inventory.items['survivor-item-test-unknown'] = 7;
  const before = structuredClone(save), session = createCharacterEditSession(save, id);
  assert.equal(buildCharacterEditCandidate(save, session).changed, false);
  const edited = change(change(session, 'prestige', '2', save), 'bloodwebLevel', '43', save);
  assert.equal(session.draft.prestige, 0);
  assert.deepEqual(save, before);
  const result = buildCharacterEditCandidate(save, edited);
  assert.deepEqual(result.errors, []);
  assert.equal(result.changed, true);
  assert.equal(result.candidate.characters[id].bloodwebLevel, 43);
  assert.equal(result.candidate.characters[id].updatedAt, before.characters[id].updatedAt);
  assert.equal(result.candidate.updatedAt, before.updatedAt);
  assert.deepEqual(result.candidate.prestigeQueue, before.prestigeQueue);
  assert.deepEqual(result.candidate.characters[id].inventory, before.characters[id].inventory);
  assert.equal(characterEditPreview(save, edited).characters[id].prestige, 2);
});

test('invalid raw numeric text stays dirty blocks commit and can be corrected or reverted', () => {
  const save = freshSave(), initial = createCharacterEditSession(save, id);
  for (const [field, value] of [['prestige', ''], ['prestige', '-1'], ['prestige', '1.5'], ['prestige', '9007199254740992'],
    ['bloodwebLevel', '0'], ['bloodwebLevel', '51'], ['bloodwebLevel', '']]) {
    const edited = change(initial, field, value, save);
    assert.equal(edited.dirty, true);
    assert.equal(edited.rawInputs[field], value);
    const result = buildCharacterEditCandidate(save, edited);
    assert.ok(result.errors.some(e => e.field === field));
    assert.equal(result.candidate, null);
  }
  const reverted = change(change(initial, 'prestige', '2', save), 'prestige', '0', save);
  assert.equal(reverted.dirty, false);
  assert.equal(buildCharacterEditCandidate(save, reverted).changed, false);
});

test('personal tier modes and final Prestige floor validation remain distinct', () => {
  const save = freshSave(), source = 'dwight-fairfield';
  save.characters[source].perks.bond = 2;
  let session = createCharacterEditSession(save, source);
  session = updateCharacterEditSession(session, { field: 'perk', id: 'bond', value: 1, mode: 'personal' }, save);
  session = change(session, 'prestige', '3', save);
  assert.ok(buildCharacterEditCandidate(save, session).errors.some(e => e.id === 'bond'));
  const untouched = change(createCharacterEditSession(save, source), 'prestige', '3', save);
  assert.equal(buildCharacterEditCandidate(save, untouched).candidate.characters[source].perks.bond, 2);
  let cleared = updateCharacterEditSession(createCharacterEditSession(save, source), { field: 'perk', id: 'bond', value: null, mode: 'personal' }, save);
  const candidate = buildCharacterEditCandidate(save, cleared).candidate;
  assert.equal(Object.hasOwn(candidate.characters[source].perks, 'bond'), false);
  assert.equal(inventoryTier(candidate, source, 'bond'), 1);
});

test('historical explicit zero and no-downgrade with deliberate correction survive draft commit', () => {
  const save = freshSave();
  let session = updateCharacterEditSession(createCharacterEditSession(save, id), { field: 'perk', id: 'camaraderie', value: 0, mode: 'historical' }, save);
  assert.equal(buildCharacterEditCandidate(save, session).candidate.characters[id].perks.camaraderie, 0);
  save.characters[id].perks.camaraderie = 3;
  session = updateCharacterEditSession(createCharacterEditSession(save, id), { field: 'perk', id: 'camaraderie', value: 1, mode: 'historical' }, save);
  assert.ok(buildCharacterEditCandidate(save, session).errors.length);
  session = updateCharacterEditSession(createCharacterEditSession(save, id), { field: 'perk', id: 'camaraderie', value: 1, mode: 'correction' }, save);
  assert.equal(buildCharacterEditCandidate(save, session).candidate.characters[id].perks.camaraderie, 1);
});

test('synthetic known quantities use same primitives while unresolved originals remain untouched', () => {
  const save = freshSave(), entityId = 'survivor-item-test-known';
  const entityById = { [entityId]: { id: entityId, kind: 'survivor-item', role: 'survivor', map: 'items' } };
  const session = updateCharacterEditSession(createCharacterEditSession(save, id), { field: 'quantity', map: 'items', id: entityId, text: '12' }, save, { entityById });
  assert.equal(buildCharacterEditCandidate(save, session, { entityById }).candidate.characters[id].inventory.items[entityId], 12);
  assert.deepEqual(save.characters[id].inventory.items, {});
  const invalid = updateCharacterEditSession(session, { field: 'quantity', map: 'items', id: entityId, text: '' }, save, { entityById });
  assert.ok(buildCharacterEditCandidate(save, invalid, { entityById }).errors.length);
});

test('underlying save changes block stale candidate without mutating either input', () => {
  const save = freshSave(), session = change(createCharacterEditSession(save, id), 'notes', 'draft', save);
  const current = structuredClone(save);
  current.characters['the-doctor'].favorite = true;
  const result = buildCharacterEditCandidate(current, session);
  assert.equal(result.conflict, true);
  assert.equal(result.candidate, null);
  assert.equal(session.draft.notes, 'draft');
  assert.equal(current.characters[id].notes, '');
});

test('scoped progression tasks retain invalid raw input and commit only the progression pair', () => {
  assert.equal(typeof characterEdit.createCharacterTaskSession, 'function');
  assert.equal(typeof characterEdit.updateCharacterTaskSession, 'function');
  assert.equal(typeof characterEdit.buildCharacterTaskCandidate, 'function');
  const save = freshSave();
  save.characters[id].notes = 'preserve me';
  const session = characterEdit.createCharacterTaskSession(save, id, 'progression');
  const edited = characterEdit.updateCharacterTaskSession(
    characterEdit.updateCharacterTaskSession(session, { field: 'prestige', value: '2' }, save),
    { field: 'bloodwebLevel', value: '43' }, save,
  );
  const invalid = characterEdit.updateCharacterTaskSession(edited, { field: 'prestige', value: '1.5' }, save);
  assert.equal(invalid.rawInputs.prestige, '1.5');
  assert.equal(invalid.draft.prestige, 2);
  assert.equal(characterEdit.buildCharacterTaskCandidate(save, invalid).candidate, null);
  const result = characterEdit.buildCharacterTaskCandidate(save, edited);
  assert.equal(result.changed, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.candidate.characters[id].prestige, 2);
  assert.equal(result.candidate.characters[id].bloodwebLevel, 43);
  assert.equal(result.candidate.characters[id].notes, 'preserve me');
  assert.equal(result.candidate.characters[id].updatedAt, save.characters[id].updatedAt);
  assert.equal(result.candidate.updatedAt, save.updatedAt);
  assert.equal(save.characters[id].prestige, 0);
});

test('scoped note and boolean tasks cannot batch fields from another task', () => {
  const save = freshSave();
  const note = characterEdit.updateCharacterTaskSession(characterEdit.createCharacterTaskSession(save, id, 'notes'),
    { field: 'notes', value: '<script>full text</script>'.repeat(20) }, save);
  const noteCandidate = characterEdit.buildCharacterTaskCandidate(save, note);
  assert.equal(noteCandidate.candidate.characters[id].notes, '<script>full text</script>'.repeat(20));
  assert.equal(noteCandidate.candidate.characters[id].owned, save.characters[id].owned);
  assert.equal(noteCandidate.candidate.characters[id].favorite, save.characters[id].favorite);

  const owned = characterEdit.updateCharacterTaskSession(characterEdit.createCharacterTaskSession(save, id, 'owned'),
    { field: 'owned', value: true }, save);
  const ownedCandidate = characterEdit.buildCharacterTaskCandidate(save, owned);
  assert.equal(ownedCandidate.candidate.characters[id].owned, true);
  assert.equal(ownedCandidate.candidate.characters[id].notes, save.characters[id].notes);
  assert.equal(ownedCandidate.candidate.characters[id].favorite, save.characters[id].favorite);

  const favorite = characterEdit.updateCharacterTaskSession(characterEdit.createCharacterTaskSession(save, id, 'favorite'),
    { field: 'favorite', value: true }, save);
  const favoriteCandidate = characterEdit.buildCharacterTaskCandidate(save, favorite);
  assert.equal(favoriteCandidate.candidate.characters[id].favorite, true);
  assert.equal(favoriteCandidate.candidate.characters[id].owned, save.characters[id].owned);
  assert.equal(favoriteCandidate.candidate.characters[id].notes, save.characters[id].notes);
});

test('scoped task no-op preserves timestamps and any underlying save change conflicts', () => {
  const save = freshSave();
  const unchanged = characterEdit.buildCharacterTaskCandidate(save, characterEdit.createCharacterTaskSession(save, id, 'progression'));
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.candidate.updatedAt, save.updatedAt);
  assert.equal(unchanged.candidate.characters[id].updatedAt, save.characters[id].updatedAt);

  const session = characterEdit.updateCharacterTaskSession(characterEdit.createCharacterTaskSession(save, id, 'progression'),
    { field: 'prestige', value: '1' }, save);
  const external = structuredClone(save);
  external.characters['the-wraith'].prestige = 1;
  const conflict = characterEdit.buildCharacterTaskCandidate(external, session);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.candidate, null);
  assert.equal(session.rawInputs.prestige, '1');
});
