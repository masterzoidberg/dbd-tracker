import { characterById, perkById } from '../data/catalog.js';
import { globalTier, isAvailable, prestigeTier } from './model.js';
import { applyPlanningAction } from './planning-state.js';

export function validatePrestigeQueue(value) {
  if (!Array.isArray(value)) throw new Error('Prestige Queue must be an array.');
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) throw new Error('Prestige Queue entry ' + index + ': missing record.');
  }
  const ids = new Set();
  return value.map((entry, index) => {
    const fail = message => { throw new Error('Prestige Queue entry ' + index + ': ' + message); };
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('invalid record.');
    const { characterId, targetPrestige } = entry;
    if (typeof characterId !== 'string' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.exec(characterId)?.[0] !== characterId
      || characterId === 'constructor' || characterId === 'prototype') fail('invalid character ID.');
    if (!Number.isSafeInteger(targetPrestige) || targetPrestige <= 0) fail('targetPrestige must be a positive safe integer.');
    if (ids.has(characterId)) fail('duplicate character ID ' + characterId + '.');
    ids.add(characterId);
    return { characterId, targetPrestige };
  });
}

export function prestigeTargetBenefit(save, characterId, targetPrestige) {
  const character = Object.hasOwn(characterById, characterId) ? characterById[characterId] : null;
  const empty = { improvedNativeIds: [], globalTierMilestone: null };
  if (!character || !save.characters[characterId]) return empty;
  if (!Number.isSafeInteger(targetPrestige) || targetPrestige <= 0) {
    throw new Error('Target Prestige must be a positive safe integer.');
  }
  const milestone = prestigeTier(targetPrestige);
  const improvedNativeIds = character.nativePerkIds.filter(id => {
    const perk = perkById[id];
    if (!perk) return false;
    const beforeTier = globalTier(save, perk);
    const afterTier = Math.max(beforeTier, milestone);
    const availableBefore = isAvailable(save, perk);
    return afterTier > beforeTier || (!availableBefore && afterTier > 0);
  });
  return { improvedNativeIds, globalTierMilestone: improvedNativeIds.length ? milestone : null };
}

export function derivePrestigeQueue(save) {
  const rows = ['survivor', 'killer'].flatMap(role => save.planning.prestigeQueues[role].map((entry, index, lane) => {
    const character = Object.hasOwn(characterById, entry.characterId) ? characterById[entry.characterId] : null;
    const progress = character && Object.hasOwn(save.characters, entry.characterId) ? save.characters[entry.characterId] : null;
    const owned = Boolean(character && progress?.owned);
    return {
      entry, index, role, laneLength: lane.length, character, progress, owned,
      complete: progress ? progress.prestige >= entry.targetPrestige : null,
      unavailable: !character || !progress || !owned,
      benefit: prestigeTargetBenefit(save, entry.characterId, entry.targetPrestige),
    };
  }));
  return { rows, focus: rows.find(row => !row.unavailable && !row.complete) ?? null };
}

export function applyPrestigeQueueAction(save, action) {
  if (!action || !['add', 'target', 'remove', 'move'].includes(action.type)) {
    throw new Error('Invalid Prestige Queue action.');
  }
  const { type, characterId, targetPrestige, direction } = action;
  const role = action.role ?? characterById[characterId]?.role;
  if (!role) throw new Error('Select a resolved character for the Prestige Queue.');
  const types = { add: 'addPrestige', target: 'setPrestigeTarget', remove: 'removePrestige', move: 'movePrestige' };
  return applyPlanningAction(save, { type: types[type], role, characterId, targetPrestige, direction });
}
