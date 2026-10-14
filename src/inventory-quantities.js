import { characterById } from '../data/catalog.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Same slug grammar/reserved names as model.js; require the entire ID to match.
const safeId = id => typeof id === 'string'
  && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.exec(id)?.[0] === id
  && id !== 'constructor' && id !== 'prototype';
const validQuantity = value => Number.isSafeInteger(value) && value >= 0;
const namespaces = [
  { kind: 'survivor-item', role: 'survivor', map: 'items' },
  { kind: 'survivor-addon', role: 'survivor', map: 'addons' },
  { kind: 'killer-addon', role: 'killer', map: 'addons' },
];

export function freshInventory() {
  return { items: {}, addons: {} };
}

function validateEntity(characterId, map, id, entityById) {
  const context = characterId + ' / ' + map + ' / ' + id;
  const fail = message => { throw new Error(message + ': ' + context + '.'); };
  if (!safeId(characterId)) fail('Invalid character ID');
  if (!safeId(id)) fail('Invalid inventory ID');
  const namespace = namespaces.find(entry => id.startsWith(entry.kind + '-') && id.length > entry.kind.length + 1);
  if (!namespace || namespace.map !== map) fail('Invalid inventory namespace or map');
  const character = Object.hasOwn(characterById, characterId) ? characterById[characterId] : null;
  if (character && character.role !== namespace.role) fail('Inventory belongs to the wrong role');
  if (!isObject(entityById)) fail('Invalid inventory catalog');
  if (!Object.hasOwn(entityById, id)) return null;
  const entity = entityById[id];
  if (!isObject(entity) || entity.id !== id || entity.kind !== namespace.kind
    || entity.role !== namespace.role || entity.map !== map) {
    fail('Incompatible inventory catalog definition');
  }
  // Unknown characters have no inferred role/owner. Known definitions still require the right map.
  if (character && namespace.kind === 'killer-addon' && entity.characterId !== characterId) {
    fail('Add-on belongs to a different Killer owner');
  }
  return entity;
}

export function canonicalizeQuantityMaps(inventory, characterId, entityById) {
  if (!safeId(characterId) || !isObject(inventory)) {
    throw new Error('Invalid inventory for ' + characterId + '.');
  }
  const canonical = freshInventory();
  const warnings = [];
  for (const map of ['items', 'addons']) {
    if (!Object.hasOwn(inventory, map) || !isObject(inventory[map])) {
      throw new Error('Invalid inventory map for ' + characterId + ' / ' + map + '.');
    }
    for (const [id, quantity] of Object.entries(inventory[map])) {
      const entity = validateEntity(characterId, map, id, entityById);
      if (!validQuantity(quantity)) {
        throw new Error('Invalid quantity for ' + characterId + ' / ' + map + ' / ' + id + '; use non-negative safe integers.');
      }
      if (!entity) warnings.push('Unknown inventory ID preserved: ' + characterId + ' / ' + map + ' / ' + id + '.');
      if (quantity > 0) canonical[map][id] = quantity;
    }
  }
  return { inventory: canonical, warnings };
}

export function parseQuantityInput(text) {
  if (typeof text !== 'string' || text.trim() !== text || !/^[0-9]+$/.test(text)
    || !validQuantity(Number(text))) {
    throw new Error('Quantity must be a whole number from 0 to Number.MAX_SAFE_INTEGER.');
  }
  return Number(text);
}

export function assertQuantityEntity(characterId, map, id, entityById) {
  const entity = validateEntity(characterId, map, id, entityById);
  if (!Object.hasOwn(characterById, characterId) || !entity) {
    throw new Error('Quantity editing requires a resolved applicable entity: ' + characterId + ' / ' + map + ' / ' + id + '.');
  }
}
