import { inventoryEntities, survivorInventorySource } from '../data/inventory-catalog.js';

const roles = ['survivor', 'killer'];
const perkCategories = ['all', 'personal', 'general', 'unlocked', 'retained'];
const perkSorts = ['name', 'tier', 'source'];
const densities = ['small', 'medium', 'large'];
const survivorItems = inventoryEntities.filter(entity => entity.role === 'survivor' && entity.map === 'items');
const survivorFamilies = survivorInventorySource.itemFamilies;

function initialContext(role) {
  return {
    section: 'overview',
    mode: null,
    perks: { search: '', category: 'all', onlyUnrecorded: false, allRole: false, sort: 'name', density: 'medium' },
    survivorInventory: role === 'survivor'
      ? { familyId: survivorFamilies[0].id, selectedItemId: '', search: '', map: '', rarity: '', inStock: false, rarityDirection: 'highest-to-lowest' }
      : null,
    killerInventory: role === 'killer'
      ? { search: '', rarity: '', inStock: false, rarityDirection: 'highest-to-lowest' }
      : null,
  };
}

function validRole(role) {
  if (!roles.includes(role)) throw new Error('Workspace context requires a Survivor or Killer role.');
}

function setPerkContext(context, patch) {
  if (!patch || typeof patch !== 'object') return;
  if (typeof patch.search === 'string') context.perks.search = patch.search;
  if (perkCategories.includes(patch.category)) context.perks.category = patch.category;
  if (typeof patch.onlyUnrecorded === 'boolean') context.perks.onlyUnrecorded = patch.onlyUnrecorded;
  if (typeof patch.allRole === 'boolean') context.perks.allRole = patch.allRole;
  if (perkSorts.includes(patch.sort)) context.perks.sort = patch.sort;
  if (densities.includes(patch.density)) context.perks.density = patch.density;
}

function setSurvivorInventoryContext(context, patch) {
  if (!patch || typeof patch !== 'object') return;
  const inventory = context.survivorInventory;
  const previousFamily = inventory.familyId;
  if (typeof patch.familyId === 'string' && survivorFamilies.some(family => family.id === patch.familyId)) inventory.familyId = patch.familyId;
  if (typeof patch.search === 'string') inventory.search = patch.search;
  if (['', 'items', 'addons'].includes(patch.map)) inventory.map = patch.map;
  if (typeof patch.rarity === 'string') inventory.rarity = patch.rarity;
  if (typeof patch.inStock === 'boolean') inventory.inStock = patch.inStock;
  if (['highest-to-lowest', 'lowest-to-highest'].includes(patch.rarityDirection)) inventory.rarityDirection = patch.rarityDirection;

  if (typeof patch.selectedItemId === 'string') {
    const item = survivorItems.find(candidate => candidate.id === patch.selectedItemId);
    inventory.selectedItemId = item?.familyId === inventory.familyId ? item.id : '';
  } else if (inventory.familyId !== previousFamily) {
    inventory.selectedItemId = '';
  }
}

function setKillerInventoryContext(context, patch) {
  if (!patch || typeof patch !== 'object') return;
  const inventory = context.killerInventory;
  if (typeof patch.search === 'string') inventory.search = patch.search;
  if (typeof patch.rarity === 'string') inventory.rarity = patch.rarity;
  if (typeof patch.inStock === 'boolean') inventory.inStock = patch.inStock;
  if (['highest-to-lowest', 'lowest-to-highest'].includes(patch.rarityDirection)) inventory.rarityDirection = patch.rarityDirection;
}

export function createWorkspaceContextMemory() {
  const contexts = Object.fromEntries(roles.map(role => [role, initialContext(role)]));
  return {
    read(role) {
      validRole(role);
      return structuredClone(contexts[role]);
    },
    update(role, patch = {}) {
      validRole(role);
      const context = contexts[role];
      const sections = role === 'survivor'
        ? ['overview', 'perks', 'items-addons', 'edit', 'setup']
        : ['overview', 'perks', 'power-addons', 'edit', 'setup'];
      if (sections.includes(patch.section)) context.section = patch.section;
      if (context.section === 'perks' && ['update', 'legacy'].includes(patch.mode)) context.mode = patch.mode;
      else context.mode = null;
      setPerkContext(context, patch.perks);
      if (role === 'survivor') setSurvivorInventoryContext(context, patch.survivorInventory);
      else setKillerInventoryContext(context, patch.killerInventory);
      return structuredClone(context);
    },
    reset(role) {
      validRole(role);
      contexts[role] = initialContext(role);
    },
  };
}
