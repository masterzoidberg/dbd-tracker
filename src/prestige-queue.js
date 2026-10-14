import { characterById, perkById } from '../data/catalog.js';
import { globalTier, isAvailable, prestigeTier } from './model.js';

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
  const rows = validatePrestigeQueue(save.prestigeQueue).map((entry, index) => {
    const character = Object.hasOwn(characterById, entry.characterId) ? characterById[entry.characterId] : null;
    const progress = character && Object.hasOwn(save.characters, entry.characterId) ? save.characters[entry.characterId] : null;
    const owned = Boolean(character && progress?.owned);
    return {
      entry, index, character, progress, owned,
      complete: progress ? progress.prestige >= entry.targetPrestige : null,
      unavailable: !character || !progress || !owned,
      benefit: prestigeTargetBenefit(save, entry.characterId, entry.targetPrestige),
    };
  });
  return { rows, focus: rows.find(row => !row.unavailable && !row.complete) ?? null };
}

export function applyPrestigeQueueAction(save, action) {
  if (!action || !['add', 'target', 'remove', 'move'].includes(action.type)) {
    throw new Error('Invalid Prestige Queue action.');
  }
  const { type, characterId, targetPrestige, direction } = action;
  const next = validatePrestigeQueue(save.prestigeQueue);
  const index = next.findIndex(entry => entry.characterId === characterId);
  if (type === 'add' || type === 'target') {
    const character = Object.hasOwn(characterById, characterId) ? characterById[characterId] : null;
    const progress = character && Object.hasOwn(save.characters, characterId) ? save.characters[characterId] : null;
    if (!character || !progress) throw new Error('Select a resolved character with saved progress.');
    if (type === 'add') {
      if (index !== -1) throw new Error('A goal for this character already exists.');
      if (!progress.owned) throw new Error('New goals require an owned character.');
    } else if (index === -1) throw new Error('No existing goal for this character.');
    if (!Number.isSafeInteger(targetPrestige) || targetPrestige <= 0 || targetPrestige <= progress.prestige) {
      throw new Error('Target Prestige must be a positive safe integer greater than current Prestige.');
    }
    if (type === 'add') next.push({ characterId, targetPrestige });
    else {
      if (next[index].targetPrestige === targetPrestige) return false;
      next[index] = { characterId, targetPrestige };
    }
  } else if (type === 'remove') {
    if (index === -1) return false;
    next.splice(index, 1);
  } else {
    if (direction !== -1 && direction !== 1) throw new Error('Move direction must be -1 or 1.');
    const destination = index + direction;
    if (index === -1 || destination < 0 || destination >= next.length) return false;
    [next[index], next[destination]] = [next[destination], next[index]];
  }
  save.prestigeQueue = next;
  return true;
}
