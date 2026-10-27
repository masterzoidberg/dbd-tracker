import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave } from '../src/model.js';
import * as characterEdit from '../src/character-edit.js';
const id = 'meg-thomas';

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
