import { parseCharacterWorkspaceRoute } from './character-workspace.js';
import { characterById, perkName, perkSearchText } from '../data/catalog.js';
import {
  rolePerks,
  inventoryTier,
  automaticTier,
  recordedTier,
  globalTier,
  effectivePerkInventory,
  correctPersonalPerkTier,
} from './model.js';

export const CHARACTER_INVENTORY_CATEGORIES = ['all', 'personal', 'general', 'unlocked', 'retained'];
export const CHARACTER_CARD_SIZES = ['small', 'medium', 'large'];
export const DEFAULT_CHARACTER_CARD_SIZE = 'medium';

export function normalizeCharacterCardSize(value) {
  return CHARACTER_CARD_SIZES.includes(value) ? value : DEFAULT_CHARACTER_CARD_SIZE;
}

function updateRouteKey(route) {
  const parsed = parseCharacterWorkspaceRoute(route);
  return parsed?.status === 'valid' && parsed.section === 'perks' && parsed.mode === 'update' ? parsed.canonicalRoute : '';
}

export function parseCharacterInventoryRoute(route) {
  const parsed = parseCharacterWorkspaceRoute(route);
  if (parsed?.status !== 'valid' || parsed.section !== 'perks') return null;
  return { characterId: parsed.characterId, mode: parsed.mode || 'inventory',
    source: parsed.source === 'experiment' ? 'experiment' : 'canonical', canonicalRoute: parsed.canonicalRoute };
}

export function characterInventoryCandidateInfo(save, characterId, perk) {
  const character = characterById[characterId];
  if (!character || character.role !== perk.role) throw new Error('Select a same-role character and perk.');

  const native = character.nativePerkIds.includes(perk.id);
  const general = Boolean(perk.general);
  const accountUnlocked = globalTier(save, perk) > 0;
  const recorded = Object.hasOwn(save.characters[characterId].perks, perk.id);
  const tracked = inventoryTier(save, characterId, perk.id) > 0;
  const reasons = [];
  if (native) reasons.push('personal');
  if (general) reasons.push('general');
  if (accountUnlocked) reasons.push('account');
  if (tracked) reasons.push('tracked');

  const primaryCategory = native ? 'personal' : general ? 'general' : accountUnlocked ? 'unlocked' : (tracked || recorded) ? 'retained' : null;
  const sourcePrestige = characterById[perk.sourceCharacterId] ? save.characters[perk.sourceCharacterId]?.prestige || 0 : 0;
  const override = save.perkOverrides[perk.id] || {};
  const unlockReasons = [];
  if (Math.min(3, Math.max(0, sourcePrestige)) > 0) unlockReasons.push('Prestige');
  if ((override.shrineTier || 0) > 0) unlockReasons.push('Shrine');
  if ((override.legacyTier || 0) > 0) unlockReasons.push('Legacy');
  if ((override.manualTier || 0) > 0) unlockReasons.push('Other account unlock');

  return {
    candidate: primaryCategory !== null,
    primaryCategory,
    reasons,
    unlockReasons,
    retained: primaryCategory === 'retained',
    isHistorical: Boolean(perk.historicalAvailability?.manualOwnership),
    effectiveTier: inventoryTier(save, characterId, perk.id),
    recordedTier: recordedTier(save, characterId, perk.id),
    hasRecordedRecord: recorded,
    automaticMinimum: automaticTier(save, characterId, perk),
  };
}

export function characterInventoryCandidatePool(save, characterId, { allRole = false } = {}) {
  const character = characterById[characterId];
  if (!character) return [];
  return rolePerks(character.role)
    .map(perk => ({ perk, ...characterInventoryCandidateInfo(save, characterId, perk) }))
    .filter(row => row.candidate || allRole)
    .sort((a, b) => perkName(save, a.perk).localeCompare(perkName(save, b.perk)) || a.perk.id.localeCompare(b.perk.id));
}

export function filterCharacterInventoryCandidates(save, characterId, candidates, state = {}) {
  const category = CHARACTER_INVENTORY_CATEGORIES.includes(state.category) ? state.category : 'all';
  const search = typeof state.search === 'string' ? state.search.toLowerCase().replace(/[’']/g, '') : '';
  return candidates
    .filter(row => category === 'all' || row.primaryCategory === category)
    .filter(row => !state.onlyUnrecorded || row.effectiveTier === 0)
    .filter(row => !search || perkSearchText(row.perk).toLowerCase().includes(search))
    .sort((a, b) => {
      const left = state.sort === 'source' ? a.perk.sourceCharacterName || 'General'
        : state.sort === 'tier' ? a.effectiveTier : perkName(save, a.perk);
      const right = state.sort === 'source' ? b.perk.sourceCharacterName || 'General'
        : state.sort === 'tier' ? b.effectiveTier : perkName(save, b.perk);
      const order = state.sort === 'tier' ? right - left : String(left).localeCompare(String(right));
      return order || perkName(save, a.perk).localeCompare(perkName(save, b.perk)) || a.perk.id.localeCompare(b.perk.id);
    });
}

export function characterNormalInventory(save, characterId) {
  const character = characterById[characterId];
  if (!character) return [];
  const effective = effectivePerkInventory(save, characterId);
  return rolePerks(character.role)
    .filter(perk => (effective[perk.id] || 0) > 0)
    .map(perk => ({ perk, ...characterInventoryCandidateInfo(save, characterId, perk) }))
    .sort((a, b) => perkName(save, a.perk).localeCompare(perkName(save, b.perk)) || a.perk.id.localeCompare(b.perk.id));
}

export function setCharacterPersonalTier(save, characterId, perkId, tier) {
  const perk = (rolePerks(characterById[characterId]?.role || '')).find(candidate => candidate.id === perkId);
  if (!perk) throw new Error('Select a same-role perk.');
  if (tier !== null && (!Number.isSafeInteger(tier) || tier < 1 || tier > 3)) throw new Error('Personal tier must be Not recorded or Tier I–III.');
  if (tier !== null && tier < automaticTier(save, characterId, perk)) throw new Error('Personal tier cannot be below the automatic minimum.');
  correctPersonalPerkTier(save, characterId, perkId, tier);
}

export function createCharacterInventorySession(route) {
  return {
    route: updateRouteKey(route),
    search: '',
    category: 'all',
    onlyUnrecorded: false,
    sort: 'name',
    selectedPerkId: null,
    quickPerkId: null,
    changedPerkIds: new Set(),
    failedSelection: null,
    correctionDraft: null,
  };
}

export function syncCharacterInventorySession(session, route) {
  const nextRoute = updateRouteKey(route);
  return session.route === nextRoute ? session : createCharacterInventorySession(route);
}

export function markCharacterInventoryChanged(session, perkId) {
  if (!perkId) return session;
  return { ...session, changedPerkIds: new Set([...session.changedPerkIds, perkId]) };
}
