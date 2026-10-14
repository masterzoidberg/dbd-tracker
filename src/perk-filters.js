import { perkSearchText, characterById, perks } from '../data/catalog.js';
import { parseCharacterWorkspaceRoute } from './character-workspace.js';
import { inventoryTier, globalTier, isAvailable, roleCharacters, bloodwebEligible } from './model.js';

const groups = {
  missing: 'ownership', owned: 'ownership', 'all-unlocked': 'ownership',
  '1': 'tier', '2': 'tier', '3': 'tier',
  'global-unlocked': 'category', 'global-locked': 'category', available: 'category',
  'global-1': 'category', 'global-2': 'category', 'global-3': 'category',
  general: 'category', historical: 'category', native: 'category',
  shrine: 'category', legacy: 'category',
  'source-owned': 'source', 'source-locked': 'source',
};

export function matchesPerkFilters(save, perk, characterId, selected = [], search = '') {
  const tier = characterId ? inventoryTier(save, characterId, perk.id) : 0;
  const global = globalTier(save, perk), source = save.characters[perk.sourceCharacterId];
  const matches = {
    available: isAvailable(save, perk) || !!perk.historicalAvailability?.manualOwnership || (characterId ? tier > 0 : roleCharacters(perk.role).some(c => save.characters[c.id].owned && inventoryTier(save, c.id, perk.id) > 0)),
    'all-unlocked': characterId ? tier > 0 : global > 0 || roleCharacters(perk.role).some(c => save.characters[c.id].owned && inventoryTier(save, c.id, perk.id) > 0),
    missing: tier === 0, owned: tier > 0, '1': tier === 1, '2': tier === 2, '3': tier === 3,
    'global-unlocked': isAvailable(save, perk), 'global-locked': !isAvailable(save, perk),
    'global-1': global === 1, 'global-2': global === 2, 'global-3': global === 3,
    general: perk.general, historical: !!perk.historicalAvailability?.manualOwnership,
    native: perk.sourceCharacterId === characterId,
    shrine: (save.perkOverrides[perk.id]?.shrineTier || 0) > 0,
    legacy: (save.perkOverrides[perk.id]?.legacyTier || 0) > 0,
    'source-owned': !!source?.owned, 'source-locked': !!source && !source.owned,
  };
  const active = selected.filter(id => id !== 'all');
  return active.every(id => groups[id] && active.some(other => groups[other] === groups[id] && matches[other]))
    && perkSearchText(perk).toLowerCase().includes(search.toLowerCase().replace(/[’']/g, ''));
}

// M05 foundation only. The existing UI continues to use matchesPerkFilters until M06.
export function getFilterContext(route) {
  if (route === 'survivors' || route === 'killers') return { route, kind: 'collection', role: route === 'survivors' ? 'survivor' : 'killer' };
  if (route === 'survivor-perks' || route === 'killer-perks') return { route, kind: 'perks', role: route === 'survivor-perks' ? 'survivor' : 'killer' };
  if (typeof route !== 'string') return null;
  const descriptor = parseCharacterWorkspaceRoute(route);
  if (descriptor?.status !== 'valid' || descriptor.section !== 'perks' || descriptor.mode !== 'legacy') return null;
  const characterId = descriptor.characterId;
  return { route, kind: 'perks', role: characterById[characterId].role, characterId };
}

export function perkFilterDefinitions(context) {
  if (!context || context.kind !== 'perks') return { quickViews: [], groups: [] };
  const character = !!context.characterId;
  const quickViews = character ? [
    { id: 'all', label: 'All' },
    { id: 'bloodweb-available', label: 'Bloodweb Available', help: 'Eligible to appear for the next tier. Bloodweb appearances are random.' },
    { id: 'owned', label: 'Owned' },
    { id: 'missing', label: 'Missing' },
    { id: 'needs-upgrade', label: 'Needs Upgrade' },
  ] : [
    { id: 'all', label: 'All' },
    { id: 'globally-available', label: 'Globally Available' },
    { id: 'owned-by-my-characters', label: 'Owned by My Characters', help: 'Perks present on at least one character you own. Counts include owned characters of the same role.' },
    { id: 'globally-locked', label: 'Globally Locked' },
  ];
  const group = (id, label, options) => ({ id, label, options: options.map(([id, label]) => ({ id, label })) });
  const groups = [
    group('globalAvailability', 'Global Availability', [['available', 'Available'], ['locked', 'Locked']]),
    ...(character ? [group('effectiveTier', 'Effective Tier', [['0', 'None'], ['1', 'I'], ['2', 'II'], ['3', 'III']])] : []),
    group('origin', 'Perk Origin', [...(character ? [['native', 'Native to this character']] : []), ['general', 'General'], ['historical', 'Legacy General']]),
    group('unlockRecord', 'Account Unlock Record', [['shrine', 'Shrine'], ['legacy', 'Legacy account']]),
    group('source', 'Source Character', [['owned', 'Owned'], ['locked', 'Locked']]),
    ...(!character ? [group('globalTier', 'Global Automatic Tier', [['1', 'I'], ['2', 'II'], ['3', 'III']])] : []),
  ];
  return { quickViews, groups };
}

export function normalizeFilterState(context, state = {}) {
  state ??= {};
  const search = typeof state.search === 'string' ? state.search : '';
  if (context.kind === 'collection') return {
    search,
    status: ['all', 'owned', 'locked'].includes(state.status) ? state.status : 'all',
    prestige: ['all', '0', '1', '2', '3'].includes(state.prestige) ? state.prestige : 'all',
    favorite: state.favorite === true,
    sort: ['name', 'prestige-desc', 'prestige-asc', 'bloodweb', 'perks', 'recent'].includes(state.sort) ? state.sort : 'name',
  };
  const definitions = perkFilterDefinitions(context), groups = {};
  for (const group of definitions.groups) {
    const selected = state.groups?.[group.id];
    if (!Array.isArray(selected)) continue;
    const options = group.options.map(option => option.id).filter(id => selected.includes(id));
    if (options.length) groups[group.id] = options;
  }
  const sorts = ['name', 'source', 'global', ...(context.characterId ? ['tier'] : [])];
  return { search, quick: definitions.quickViews.some(view => view.id === state.quick) ? state.quick : 'all', groups,
    sort: sorts.includes(state.sort) ? state.sort : 'name' };
}

function matchesAdvancedOption(save, perk, context, group, option) {
  switch (group) {
    case 'globalAvailability': return isAvailable(save, perk) === (option === 'available');
    case 'effectiveTier': return inventoryTier(save, context.characterId, perk.id) === Number(option);
    case 'origin':
      if (option === 'native') return characterById[context.characterId].nativePerkIds.includes(perk.id);
      return option === 'general' ? !!perk.general : !!perk.historicalAvailability?.manualOwnership;
    case 'unlockRecord': return (save.perkOverrides[perk.id]?.[option === 'shrine' ? 'shrineTier' : 'legacyTier'] || 0) > 0;
    case 'source': {
      const source = save.characters[perk.sourceCharacterId];
      return !!source && source.owned === (option === 'owned');
    }
    case 'globalTier': return globalTier(save, perk) === Number(option);
    default: return false;
  }
}

function matchesCanonicalState(save, perk, context, state) {
  if (perk.role !== context.role || !perkSearchText(perk).toLowerCase().includes(state.search.toLowerCase().replace(/[’']/g, ''))) return false;
  const tier = context.characterId ? inventoryTier(save, context.characterId, perk.id) : 0;
  let quick;
  switch (state.quick) {
    case 'all': quick = true; break;
    case 'bloodweb-available': quick = bloodwebEligible(save, context.characterId, perk); break;
    case 'owned': quick = tier > 0; break;
    case 'missing': quick = tier === 0; break;
    case 'needs-upgrade': quick = (tier === 1 || tier === 2) && bloodwebEligible(save, context.characterId, perk); break;
    case 'globally-available': quick = isAvailable(save, perk); break;
    case 'globally-locked': quick = !isAvailable(save, perk); break;
    case 'owned-by-my-characters': quick = roleCharacters(perk.role).some(character => save.characters[character.id]?.owned && inventoryTier(save, character.id, perk.id) > 0); break;
    default: quick = false;
  }
  return quick && Object.entries(state.groups).every(([group, selected]) => selected.some(option => matchesAdvancedOption(save, perk, context, group, option)));
}

export function matchesPerkFilterState(save, perk, context, state = {}) {
  return !!context && context.kind === 'perks' && matchesCanonicalState(save, perk, context, normalizeFilterState(context, state));
}

export function selectQuickView(context, state, quick) {
  return normalizeFilterState(context, { ...state, quick, groups: {} });
}

export function toggleAdvancedOption(context, state, groupId, optionId) {
  const next = normalizeFilterState(context, state);
  const group = perkFilterDefinitions(context).groups.find(group => group.id === groupId);
  if (!group?.options.some(option => option.id === optionId)) return next;
  const selected = next.groups[groupId] || [];
  next.groups[groupId] = selected.includes(optionId) ? selected.filter(id => id !== optionId) : [...selected, optionId];
  return normalizeFilterState(context, next);
}

export function clearAdvancedFilters(context, state, groupId) {
  const next = normalizeFilterState(context, state);
  if (groupId === undefined) next.groups = {};
  else delete next.groups[groupId];
  return next;
}

export const activeAdvancedGroupCount = state => Object.values(state.groups || {}).filter(selected => selected.length > 0).length;

export function perkFacetCounts(save, context, state = {}, list = perks) {
  if (!context || context.kind !== 'perks') return {};
  const current = normalizeFilterState(context, state), counts = {};
  const distinct = [...new Map(list.map(perk => [perk.id, perk])).values()];
  for (const group of perkFilterDefinitions(context).groups) {
    counts[group.id] = {};
    for (const option of group.options) {
      const optionState = { ...current, groups: { ...current.groups, [group.id]: [option.id] } };
      counts[group.id][option.id] = distinct.filter(perk => matchesCanonicalState(save, perk, context, optionState)).length;
    }
  }
  return counts;
}

export function createFilterRouteMemory() {
  const snapshots = new Map();
  return {
    read(route) {
      const context = getFilterContext(route);
      return context ? structuredClone(snapshots.get(route) || normalizeFilterState(context)) : null;
    },
    write(route, state) {
      const context = getFilterContext(route);
      if (!context) return false;
      snapshots.set(route, normalizeFilterState(context, state));
      return true;
    },
  };
}
