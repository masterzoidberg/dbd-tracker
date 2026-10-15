import { inventoryEntities } from '../data/inventory-catalog.js';

const verifiedIds = {
  items: new Set(inventoryEntities
    .filter(entity => entity.role === 'survivor' && entity.kind === 'survivor-item' && entity.map === 'items')
    .map(entity => entity.id)),
  addons: new Set(inventoryEntities
    .filter(entity => entity.role === 'survivor' && entity.kind === 'survivor-addon' && entity.map === 'addons')
    .map(entity => entity.id)),
};

function countPositiveKnownTypes(quantities = {}, knownIds) {
  return Object.entries(quantities).filter(([id, quantity]) =>
    knownIds.has(id) && Number.isSafeInteger(quantity) && quantity > 0,
  ).length;
}

export function survivorInventoryCounts(save, characterId) {
  const inventory = save.characters[characterId]?.inventory;
  return {
    items: countPositiveKnownTypes(inventory?.items, verifiedIds.items),
    addons: countPositiveKnownTypes(inventory?.addons, verifiedIds.addons),
  };
}
