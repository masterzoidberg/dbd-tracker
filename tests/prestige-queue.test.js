import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePrestigeQueue } from '../src/prestige-queue.js';
import * as queue from '../src/prestige-queue.js';
import { freshSave, globalTier, isAvailable } from '../src/model.js';
import { characterById, perkById } from '../data/catalog.js';

function queueFixture() {
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  save.characters['meg-thomas'].prestige = 1;
  save.characters['dwight-fairfield'].owned = true;
  save.planning.prestigeQueues.survivor = [
    { characterId: 'meg-thomas', targetPrestige: 1 },
    { characterId: 'dwight-fairfield', targetPrestige: 2 },
  ];
  save.planning.prestigeQueues.killer = [{ characterId: 'the-trapper', targetPrestige: 3 }];
  save.planning.unresolved = [{ queue: 'prestige', role: null, rank: 2,
    record: { characterId: 'future-goal-only', targetPrestige: 9 } }];
  return save;
}

test('derived focus skips complete unowned unknown and reactivates corrections without reordering', () => {
  const save = queueFixture(), original = structuredClone(save);
  const derived = queue.derivePrestigeQueue(save);
  assert.equal(derived.focus.entry.characterId, 'dwight-fairfield');
  assert.equal(derived.focus.index, 1);
  assert.equal(derived.rows[0].complete, true);
  assert.equal(derived.rows[1].complete, false);
  assert.equal(derived.rows[2].unavailable, true);
  assert.deepEqual(save, original);
  save.characters['meg-thomas'].prestige = 0;
  assert.equal(queue.derivePrestigeQueue(save).focus.entry.characterId, 'meg-thomas');
  save.characters['meg-thomas'].owned = false;
  assert.equal(queue.derivePrestigeQueue(save).focus.entry.characterId, 'dwight-fairfield');
  save.characters['dwight-fairfield'].owned = false;
  save.characters['the-trapper'].owned = true;
  assert.equal(queue.derivePrestigeQueue(save).focus.entry.characterId, 'the-trapper');
  save.characters['the-trapper'].owned = false;
  assert.equal(queue.derivePrestigeQueue(save).focus, null);
  assert.deepEqual(save.planning, original.planning);
});

test('queue mutations only change manual intent and distinguish creation from persisted validity', () => {
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  const characters = structuredClone(save.characters), timestamp = save.updatedAt;
  assert.equal(queue.applyPrestigeQueueAction(save, { type: 'add', characterId: 'meg-thomas', targetPrestige: 3 }), true);
  assert.throws(() => queue.applyPrestigeQueueAction(save, { type: 'add', characterId: 'meg-thomas', targetPrestige: 6 }), /duplicate|exists/i);
  assert.throws(() => queue.applyPrestigeQueueAction(save, { type: 'add', characterId: 'the-trapper', targetPrestige: 3 }), /owned/i);
  assert.throws(() => queue.applyPrestigeQueueAction(save, { type: 'add', characterId: 'future-goal', targetPrestige: 3 }), /character|resolved/i);
  save.characters['meg-thomas'].owned = false;
  assert.equal(queue.applyPrestigeQueueAction(save, { type: 'target', characterId: 'meg-thomas', targetPrestige: 6 }), true);
  assert.equal(queue.applyPrestigeQueueAction(save, { type: 'target', characterId: 'meg-thomas', targetPrestige: 6 }), false);
  save.characters['meg-thomas'].prestige = 6;
  assert.throws(() => queue.applyPrestigeQueueAction(save, { type: 'target', characterId: 'meg-thomas', targetPrestige: 6 }), /greater|current/i);
  assert.equal(validatePrestigeQueue(save.planning.prestigeQueues.survivor)[0].targetPrestige, 6);
  assert.equal(queue.applyPrestigeQueueAction(save, { type: 'remove', characterId: 'meg-thomas' }), true);
  assert.equal(queue.applyPrestigeQueueAction(save, { type: 'remove', characterId: 'meg-thomas' }), false);
  // These deliberate fixture corrections aside, domain actions never stamp or change characters.
  save.characters['meg-thomas'].owned = true;
  save.characters['meg-thomas'].prestige = 0;
  assert.deepEqual(save.characters, characters);
  assert.equal(save.updatedAt, timestamp);
});

test('moves and removals stay within one role queue and never alter unresolved goals', () => {
  const save = queueFixture(), initial = structuredClone(save);
  assert.equal(queue.applyPrestigeQueueAction(save, { type: 'move', characterId: 'meg-thomas', direction: -1 }), false);
  assert.equal(queue.applyPrestigeQueueAction(save, { type: 'move', characterId: 'dwight-fairfield', direction: -1 }), true);
  assert.deepEqual(save.planning.prestigeQueues.survivor.map(e => e.characterId), ['dwight-fairfield', 'meg-thomas']);
  assert.throws(() => queue.applyPrestigeQueueAction(save, { type: 'move', characterId: 'meg-thomas', direction: 2 }), /direction/i);
  assert.equal(queue.applyPrestigeQueueAction(save, { type: 'remove', characterId: 'the-trapper' }), true);
  assert.deepEqual(save.planning.unresolved, initial.planning.unresolved);
  assert.deepEqual(save.characters, initial.characters);
  assert.deepEqual(save.perkOverrides, initial.perkOverrides);
});

test('invalid queue actions do not mutate queue or other save state', () => {
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  for (const action of [
    { type: 'add', characterId: 'meg-thomas', targetPrestige: 0 },
    { type: 'add', characterId: 'meg-thomas', targetPrestige: 1.5 },
    { type: 'add', characterId: 'meg-thomas', targetPrestige: Number.MAX_SAFE_INTEGER + 1 },
    { type: 'add', characterId: 'meg-thomas', targetPrestige: '1' },
    { type: 'target', characterId: 'meg-thomas', targetPrestige: 1 },
    { type: 'unexpected', characterId: 'meg-thomas' },
  ]) {
    const before = structuredClone(save);
    assert.throws(() => queue.applyPrestigeQueueAction(save, action),
      /positive safe integer|existing goal|No Prestige goal|Invalid Prestige Queue action/);
    assert.deepEqual(save, before);
  }
});

test('catalog-resolved goal without saved progress is unavailable and never fabricates a record', () => {
  const save = freshSave();
  delete save.characters['meg-thomas'];
  save.planning.prestigeQueues.survivor = [{ characterId: 'meg-thomas', targetPrestige: 1 }];
  const { rows, focus } = queue.derivePrestigeQueue(save);
  assert.equal(rows[0].progress, null);
  assert.equal(rows[0].complete, null);
  assert.equal(rows[0].unavailable, true);
  assert.equal(focus, null);
  assert.equal(Object.hasOwn(save.characters, 'meg-thomas'), false);
});

test('native perk benefits respect all override floors and separate higher goals from global milestones', () => {
  const save = freshSave(), id = 'dwight-fairfield', native = characterById[id].nativePerkIds;
  save.perkOverrides[native[0]] = { shrineTier: 3 };
  save.perkOverrides[native[1]] = { shrineTier: 0, legacyTier: 2 };
  save.perkOverrides[native[2]] = { shrineTier: 0, manualTier: 1 };
  const before = structuredClone(save);
  assert.deepEqual(queue.prestigeTargetBenefit(save, id, 1), { improvedNativeIds: [], globalTierMilestone: null });
  assert.deepEqual(queue.prestigeTargetBenefit(save, id, 2), { improvedNativeIds: [native[2]], globalTierMilestone: 2 });
  for (const target of [3, 6, 9, Number.MAX_SAFE_INTEGER]) {
    assert.deepEqual(queue.prestigeTargetBenefit(save, id, target), {
      improvedNativeIds: [native[1], native[2]], globalTierMilestone: 3,
    });
  }
  assert.deepEqual(save, before);
  save.characters[id].prestige = 3;
  assert.deepEqual(queue.prestigeTargetBenefit(save, id, 9), { improvedNativeIds: [], globalTierMilestone: null });
  assert.deepEqual(queue.prestigeTargetBenefit(save, 'future-goal-only', 9), { improvedNativeIds: [], globalTierMilestone: null });
});

test('General native availability is not relabeled as a new unlock', () => {
  const save = freshSave(), id = 'laurie-strode', native = characterById[id].nativePerkIds;
  assert.ok(native.every(perkId => isAvailable(save, perkById[perkId])));
  assert.ok(native.every(perkId => globalTier(save, perkById[perkId]) === 0));
  // Prestige can improve the automatic global tier, while availability was already true.
  const benefit = queue.prestigeTargetBenefit(save, id, 1);
  assert.deepEqual(benefit.improvedNativeIds, native);
  assert.equal(benefit.globalTierMilestone, 1);
  assert.equal(benefit.improvedNativeIds.filter(perkId => !isAvailable(save, perkById[perkId])).length, 0);
});

test('persisted queue validation retains unknown completed and unowned goals in order', () => {
  const input = [
    { characterId: 'future-character', targetPrestige: 9, note: 'not persisted' },
    { characterId: 'meg-thomas', targetPrestige: 1 },
  ];
  const before = structuredClone(input);
  assert.deepEqual(validatePrestigeQueue(input), [
    { characterId: 'future-character', targetPrestige: 9 },
    { characterId: 'meg-thomas', targetPrestige: 1 },
  ]);
  assert.deepEqual(input, before);
  assert.deepEqual(validatePrestigeQueue([]), []);
});

test('persisted queue rejects missing malformed and duplicate records', () => {
  for (const value of [undefined, null, {}, 'queue', [null], [[]], [{}],
    [{ characterId: 'constructor', targetPrestige: 1 }],
    [{ characterId: 'prototype', targetPrestige: 1 }],
    [{ characterId: '__proto__', targetPrestige: 1 }],
    [{ characterId: 'meg-thomas\n', targetPrestige: 1 }],
    [{ characterId: 'Meg Thomas', targetPrestige: 1 }]]) {
    assert.throws(() => validatePrestigeQueue(value), /queue/i);
  }
  assert.throws(() => validatePrestigeQueue([
    { characterId: 'meg-thomas', targetPrestige: 1 },
    { characterId: 'meg-thomas', targetPrestige: 3 },
  ]), /duplicate/i);
});

test('persisted queue targets are positive safe integers with indexed errors', () => {
  for (const targetPrestige of [0, -1, 1.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', true, null]) {
    assert.throws(() => validatePrestigeQueue([{ characterId: 'meg-thomas', targetPrestige }]),
      error => /queue/i.test(error.message) && /0|1/.test(error.message) && /target/i.test(error.message));
  }
  assert.equal(validatePrestigeQueue([{ characterId: 'meg-thomas', targetPrestige: Number.MAX_SAFE_INTEGER }])[0].targetPrestige,
    Number.MAX_SAFE_INTEGER);
});

test('sparse queue slots reject instead of becoming null during serialization', () => {
  assert.throws(() => validatePrestigeQueue(new Array(1)), /queue.*0/i);
  const sparse = [{ characterId: 'meg-thomas', targetPrestige: 1 }];
  sparse.length = 2;
  assert.throws(() => validatePrestigeQueue(sparse), /queue.*1/i);
});
