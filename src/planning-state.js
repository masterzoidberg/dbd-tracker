import { characterById } from '../data/catalog.js';

const roles = ['survivor', 'killer'];
const queues = ['prestige', 'playing', 'upNext', 'unknown'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = id => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
  && id !== 'constructor' && id !== 'prototype';
const safeTarget = value => Number.isSafeInteger(value) && value > 0;

export const freshPlanning = () => ({
  prestigeQueues: { survivor: [], killer: [] },
  playingQueues: { survivor: [], killer: [] },
  upNext: { survivor: [], killer: [] },
  unresolved: [],
});

function cloneJson(value, label) {
  let serialized;
  try { serialized = JSON.stringify(value); } catch { throw new Error(`${label} must contain portable JSON data.`); }
  if (serialized === undefined) throw new Error(`${label} must contain portable JSON data.`);
  return JSON.parse(serialized);
}

function denseArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) throw new Error(`${label} entry ${index}: missing record.`);
  }
  return value;
}

function laneRole(role, label) {
  if (!roles.includes(role)) throw new Error(`${label} has an invalid role.`);
  return role;
}

function recordId(record, label) {
  const characterId = record?.characterId;
  if (!safeId(characterId)) throw new Error(`${label} has an invalid character ID.`);
  return characterId;
}

function unresolvedRecord(queue, role, rank, record) {
  return { queue, role, rank, record: cloneJson(record, 'Unresolved planning record') };
}

export function validatePlanningState(input) {
  if (!isObject(input)) throw new Error('Planning state must be an object.');
  for (const field of ['prestigeQueues', 'playingQueues', 'upNext', 'unresolved']) {
    if (!Object.hasOwn(input, field)) throw new Error(`Planning state is missing ${field}.`);
  }

  const planning = freshPlanning();
  const warnings = [];
  const unresolved = denseArray(input.unresolved, 'Planning unresolved records').map((entry, index) => {
    if (!isObject(entry)) throw new Error(`Planning unresolved record ${index} is invalid.`);
    if (!queues.includes(entry.queue)) throw new Error(`Planning unresolved record ${index} has an invalid queue.`);
    if (entry.role !== null && !roles.includes(entry.role)) throw new Error(`Planning unresolved record ${index} has an invalid role.`);
    if (!Number.isSafeInteger(entry.rank) || entry.rank < 0) throw new Error(`Planning unresolved record ${index} has an invalid rank.`);
    if (!Object.hasOwn(entry, 'record')) throw new Error(`Planning unresolved record ${index} is missing its original record.`);
    return cloneJson(entry, `Planning unresolved record ${index}`);
  });

  const retainUnknown = (queue, role, rank, entry, characterId) => {
    unresolved.push(unresolvedRecord(queue, role, rank, entry));
    warnings.push(`Unknown planning character preserved as unresolved: ${characterId}`);
  };

  const validateLanes = (field, queue, validateEntry) => {
    const lanes = input[field];
    if (!isObject(lanes)) throw new Error(`Planning ${field} must contain role lanes.`);
    for (const role of roles) {
      const entries = denseArray(lanes[role], `Planning ${field} ${role}`);
      const seen = new Set();
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (!isObject(entry)) throw new Error(`Planning ${field} ${role} entry ${index} is invalid.`);
        const characterId = recordId(entry, `Planning ${field} ${role} entry ${index}`);
        const validated = validateEntry(entry, index);
        const character = characterById[characterId];
        if (!character) {
          retainUnknown(queue, role, index, entry, characterId);
          continue;
        }
        if (character.role !== role) throw new Error(`Planning ${field} character ${characterId} belongs in the ${character.role} lane.`);
        if (seen.has(characterId)) throw new Error(`Planning ${field} ${role} contains duplicate character ${characterId}.`);
        seen.add(characterId);
        planning[field][role].push(validated);
      }
    }
    for (const extraRole of Object.keys(lanes).filter(role => !roles.includes(role))) {
      unresolved.push(unresolvedRecord('unknown', null, unresolved.length, {
        source: field, role: extraRole, records: lanes[extraRole],
      }));
    }
  };

  validateLanes('prestigeQueues', 'prestige', (entry, index) => {
    if (!safeTarget(entry.targetPrestige)) throw new Error(`Planning prestigeQueues entry ${index} needs a positive safe target.`);
    return { ...cloneJson(entry, 'Prestige queue record'), characterId: entry.characterId, targetPrestige: entry.targetPrestige };
  });
  validateLanes('playingQueues', 'playing', entry => ({
    ...cloneJson(entry, 'Playing queue record'), characterId: entry.characterId,
  }));
  validateLanes('upNext', 'upNext', (entry, index) => {
    if (entry.intent !== 'prestige' && entry.intent !== 'play') throw new Error(`Planning Up Next entry ${index} has an invalid intent.`);
    return { ...cloneJson(entry, 'Up Next pin'), characterId: entry.characterId, intent: entry.intent };
  });

  for (const role of roles) {
    if (planning.upNext[role].length > 5) throw new Error(`Planning Up Next ${role} lane exceeds five active pins.`);
  }
  for (const field of Object.keys(input).filter(key => !['prestigeQueues', 'playingQueues', 'upNext', 'unresolved'].includes(key))) {
    unresolved.push(unresolvedRecord('unknown', null, unresolved.length, { field, value: input[field] }));
  }
  planning.unresolved = unresolved;
  return { planning, warnings };
}

function moveAdjacent(entries, characterId, direction, label) {
  if (direction !== -1 && direction !== 1) throw new Error(`${label} move direction must be -1 or 1.`);
  const index = entries.findIndex(entry => entry.characterId === characterId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= entries.length) return false;
  [entries[index], entries[destination]] = [entries[destination], entries[index]];
  return true;
}

function assertActionCharacter(action, role, label) {
  if (!safeId(action.characterId)) throw new Error(`${label} requires a valid character ID.`);
  const character = characterById[action.characterId];
  if (!character) throw new Error(`${label} requires a resolved character.`);
  if (character.role !== role) throw new Error(`${label} character belongs in the ${character.role} lane.`);
  return character;
}

export function applyPlanningAction(save, action) {
  if (!action || typeof action.type !== 'string') throw new Error('Invalid planning action.');
  const role = laneRole(action.role, 'Planning action');
  const { planning: next } = validatePlanningState(save.planning);
  const id = action.characterId;
  let changed = false;

  if (action.type === 'addPrestige' || action.type === 'setPrestigeTarget') {
    assertActionCharacter(action, role, 'Prestige queue');
    const progress = save.characters[id];
    if (!progress) throw new Error('Prestige queue requires saved character progress.');
    const queue = next.prestigeQueues[role];
    const index = queue.findIndex(entry => entry.characterId === id);
    if (action.type === 'addPrestige') {
      if (index !== -1) throw new Error('A Prestige goal for this character already exists.');
      if (!progress.owned) throw new Error('New Prestige goals require an owned character.');
    } else if (index === -1) throw new Error('No Prestige goal exists for this character.');
    if (!safeTarget(action.targetPrestige) || action.targetPrestige <= progress.prestige) {
      throw new Error('Target Prestige must be a positive safe integer greater than current Prestige.');
    }
    if (action.type === 'addPrestige') queue.push({ characterId: id, targetPrestige: action.targetPrestige });
    else {
      if (queue[index].targetPrestige === action.targetPrestige) return false;
      queue[index] = { ...queue[index], targetPrestige: action.targetPrestige };
    }
    changed = true;
  } else if (action.type === 'removePrestige' || action.type === 'movePrestige') {
    assertActionCharacter(action, role, 'Prestige queue');
    const queue = next.prestigeQueues[role];
    if (action.type === 'removePrestige') {
      const index = queue.findIndex(entry => entry.characterId === id);
      if (index < 0) return false;
      queue.splice(index, 1);
      changed = true;
    } else changed = moveAdjacent(queue, id, action.direction, 'Prestige queue');
  } else if (action.type === 'addPlaying' || action.type === 'removePlaying' || action.type === 'movePlaying') {
    assertActionCharacter(action, role, 'Playing queue');
    const queue = next.playingQueues[role];
    const index = queue.findIndex(entry => entry.characterId === id);
    if (action.type === 'addPlaying') {
      if (index !== -1) throw new Error('This character is already in the Playing Queue.');
      queue.push({ characterId: id });
      changed = true;
    } else if (action.type === 'removePlaying') {
      if (index < 0) return false;
      queue.splice(index, 1);
      changed = true;
    } else changed = moveAdjacent(queue, id, action.direction, 'Playing queue');
  } else if (action.type === 'pin') {
    assertActionCharacter(action, role, 'Up Next pin');
    if (action.intent !== 'prestige' && action.intent !== 'play') throw new Error('Up Next intent must be prestige or play.');
    const pins = next.upNext[role];
    const index = pins.findIndex(pin => pin.characterId === id);
    if (index >= 0) {
      if (pins[index].intent === action.intent) return false;
      pins[index] = { ...pins[index], intent: action.intent };
      changed = true;
    } else if (action.replaceCharacterId !== undefined) {
      const replaceIndex = pins.findIndex(pin => pin.characterId === action.replaceCharacterId);
      if (replaceIndex < 0) throw new Error('Choose an existing same-role pin to replace.');
      pins[replaceIndex] = { characterId: id, intent: action.intent };
      changed = true;
    } else {
      if (pins.length >= 5) throw new Error('Up Next is full; explicitly choose a pin to replace or cancel.');
      pins.push({ characterId: id, intent: action.intent });
      changed = true;
    }
  } else if (action.type === 'unpin' || action.type === 'movePin') {
    assertActionCharacter(action, role, 'Up Next pin');
    const pins = next.upNext[role];
    if (action.type === 'unpin') {
      const index = pins.findIndex(pin => pin.characterId === id);
      if (index < 0) return false;
      pins.splice(index, 1);
      changed = true;
    } else changed = moveAdjacent(pins, id, action.direction, 'Up Next');
  } else throw new Error('Invalid planning action.');

  if (changed) save.planning = validatePlanningState(next).planning;
  return changed;
}
