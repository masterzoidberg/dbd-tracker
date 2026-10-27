import test from 'node:test';
import assert from 'node:assert/strict';
import { characters } from '../data/catalog.js';
import { freshSave } from '../src/model.js';
import { applyPlanningAction } from '../src/planning-state.js';

const roleCharacters = role => characters.filter(character => character.role === role);

test('dual Prestige and Playing membership is allowed and Up Next keeps one explicit pin', () => {
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  assert.equal(applyPlanningAction(save, { type: 'addPrestige', role: 'survivor', characterId: 'meg-thomas', targetPrestige: 3 }), true);
  assert.equal(applyPlanningAction(save, { type: 'addPlaying', role: 'survivor', characterId: 'meg-thomas' }), true);
  assert.equal(applyPlanningAction(save, { type: 'pin', role: 'survivor', characterId: 'meg-thomas', intent: 'prestige' }), true);

  assert.deepEqual(save.planning.prestigeQueues.survivor, [{ characterId: 'meg-thomas', targetPrestige: 3 }]);
  assert.deepEqual(save.planning.playingQueues.survivor, [{ characterId: 'meg-thomas' }]);
  assert.deepEqual(save.planning.upNext.survivor, [{ characterId: 'meg-thomas', intent: 'prestige' }]);
});

test('direct pin creates no queue membership and queue removal preserves pin rank and intent', () => {
  const save = freshSave();
  applyPlanningAction(save, { type: 'pin', role: 'survivor', characterId: 'meg-thomas', intent: 'play' });
  applyPlanningAction(save, { type: 'pin', role: 'survivor', characterId: 'dwight-fairfield', intent: 'prestige' });
  save.characters['meg-thomas'].owned = true;
  applyPlanningAction(save, { type: 'addPrestige', role: 'survivor', characterId: 'meg-thomas', targetPrestige: 3 });
  applyPlanningAction(save, { type: 'addPlaying', role: 'survivor', characterId: 'meg-thomas' });
  const beforeRemoval = structuredClone(save.planning.upNext);

  applyPlanningAction(save, { type: 'removePrestige', role: 'survivor', characterId: 'meg-thomas' });
  applyPlanningAction(save, { type: 'removePlaying', role: 'survivor', characterId: 'meg-thomas' });

  assert.deepEqual(save.planning.prestigeQueues.survivor, []);
  assert.deepEqual(save.planning.playingQueues.survivor, []);
  assert.deepEqual(save.planning.upNext, beforeRemoval);
});

test('Favorite and recent edits do not create or reorder queues or pins', () => {
  const save = freshSave();
  const before = structuredClone(save.planning);
  save.characters['meg-thomas'].favorite = true;
  save.characters['meg-thomas'].updatedAt = '2026-10-27T12:00:00Z';
  assert.deepEqual(save.planning, before);
  assert.deepEqual(save.planning.upNext, { survivor: [], killer: [] });
});

test('a sixth Up Next pin requires an explicit same-role replacement and preserves five visible ranks', () => {
  const save = freshSave(), survivors = roleCharacters('survivor').slice(0, 6);
  for (const character of survivors.slice(0, 5)) {
    applyPlanningAction(save, { type: 'pin', role: 'survivor', characterId: character.id, intent: 'play' });
  }
  const full = structuredClone(save.planning.upNext.survivor);
  assert.throws(() => applyPlanningAction(save, {
    type: 'pin', role: 'survivor', characterId: survivors[5].id, intent: 'prestige',
  }), /full|replace/i);
  assert.deepEqual(save.planning.upNext.survivor, full);

  assert.equal(applyPlanningAction(save, {
    type: 'pin', role: 'survivor', characterId: survivors[5].id, intent: 'prestige', replaceCharacterId: survivors[1].id,
  }), true);
  assert.equal(save.planning.upNext.survivor.length, 5);
  assert.deepEqual(save.planning.upNext.survivor[1], { characterId: survivors[5].id, intent: 'prestige' });
  assert.deepEqual(save.planning.upNext.survivor.map(pin => pin.characterId), [
    survivors[0].id, survivors[5].id, survivors[2].id, survivors[3].id, survivors[4].id,
  ]);
});

test('role lanes, intents and action direction are validated without partial mutation', () => {
  const save = freshSave();
  for (const action of [
    { type: 'pin', role: 'survivor', characterId: 'the-trapper', intent: 'play' },
    { type: 'pin', role: 'survivor', characterId: 'meg-thomas', intent: 'favorite' },
    { type: 'addPlaying', role: 'killer', characterId: 'meg-thomas' },
    { type: 'movePin', role: 'survivor', characterId: 'meg-thomas', direction: 2 },
  ]) {
    const before = structuredClone(save);
    assert.throws(() => applyPlanningAction(save, action), /role|intent|direction|lane/i);
    assert.deepEqual(save, before);
  }
});
