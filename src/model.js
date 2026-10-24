import { characters, characterById, perks, perkById, perkAliases } from '../data/catalog.js';
import { inventoryEntityById } from '../data/inventory-catalog.js';
import { freshInventory, canonicalizeQuantityMaps } from './inventory-quantities.js';
import { validatePrestigeQueue } from './prestige-queue.js';

export const SCHEMA_VERSION = 2;
const freshLegacyProgress = () => ({ owned: false, prestige: 0, bloodwebLevel: 1, setupComplete: false, favorite: false, notes: '', perks: {}, updatedAt: null });
export const freshProgress = () => ({ ...freshLegacyProgress(), inventory: freshInventory() });
export const freshSave = () => ({ schemaVersion: SCHEMA_VERSION, prestigeQueue: [], accountRulesVersion: 1, inventoryPolicy: 'bloodweb', setupComplete: false, accountCorrectionApplied: true, settings: { halloweenNames: 'original', hellraiserNames: 'original' }, updatedAt: new Date().toISOString(), characters: Object.fromEntries(characters.map(c => [c.id, freshProgress()])), perkOverrides: {} });
export const prestigeTier = prestige => Math.min(3, Math.max(0, prestige));
export const globalTier = (save, perk) => Math.max(prestigeTier(save.characters[perk.sourceCharacterId]?.prestige || 0), save.perkOverrides[perk.id]?.shrineTier || 0, save.perkOverrides[perk.id]?.legacyTier || 0, save.perkOverrides[perk.id]?.manualTier || 0);
export const isAvailable = (save, perk) => perk.general || globalTier(save, perk) > 0;
export function setGlobalPerkUnlocked(save, perk, unlocked) {
  if (perk.general || prestigeTier(save.characters[perk.sourceCharacterId]?.prestige || 0) > 0) return;
  const override = save.perkOverrides[perk.id] ??= { shrineTier: 0 };
  override.manualTier = unlocked ? Math.max(1, override.manualTier || 0) : 0;
}
export const unlockSource = (save, perk) => {
  const prestige = prestigeTier(save.characters[perk.sourceCharacterId]?.prestige || 0);
  const shrine = save.perkOverrides[perk.id]?.shrineTier || 0;
  const legacy = save.perkOverrides[perk.id]?.legacyTier || 0;
  const manual = save.perkOverrides[perk.id]?.manualTier || 0;
  const tier = globalTier(save, perk);
  if (!tier) return perk.general ? 'General' : 'Locked';
  return [['Prestige', prestige], ['Legacy', legacy], ['Shrine', shrine], ['Unspecified', manual]].filter(([, value]) => value === tier).map(([name]) => name).join(' · ');
};
export const recordedTier = (save, characterId, perkId) => save.characters[characterId]?.perks[perkId] || 0;
export function automaticTier(save, characterId, perk) {
  const c = characterById[characterId];
  if (!c || c.role !== perk.role) return 0;
  return Math.max(c.nativePerkIds.includes(perk.id) ? 1 : 0, globalTier(save, perk));
}
export function inventoryTier(save, characterId, perkId) {
  const perk = perkById[perkId];
  return Math.max(recordedTier(save, characterId, perkId), perk ? automaticTier(save, characterId, perk) : 0);
}
export const bloodwebEligible = (save, characterId, perk) => characterById[characterId]?.role === perk.role && inventoryTier(save, characterId, perk.id) < 3 && (isAvailable(save, perk) || characterById[characterId].nativePerkIds.includes(perk.id) || (!perk.historicalAvailability?.manualOwnership && recordedTier(save, characterId, perk.id) > 0));
export const bloodwebNextTier = (save, characterId, perk) => bloodwebEligible(save, characterId, perk) && inventoryTier(save, characterId, perk.id) < 3 ? inventoryTier(save, characterId, perk.id) + 1 : null;
export function ownedUnlockSource(save, characterId, perk) {
  const tier = inventoryTier(save, characterId, perk.id);
  if (!tier) return perk.historicalAvailability?.manualOwnership && !Object.hasOwn(save.characters[characterId]?.perks || {}, perk.id) ? 'Not confirmed' : 'Not owned';
  if (recordedTier(save, characterId, perk.id) > automaticTier(save, characterId, perk)) return perk.historicalAvailability?.manualOwnership ? 'Character-specific ownership' : 'Bloodweb';
  if (characterById[characterId]?.nativePerkIds.includes(perk.id) && tier === 1) return 'Character';
  return unlockSource(save, perk);
}
export const roleCharacters = role => characters.filter(c => c.role === role);
export const rolePerks = role => perks.filter(p => p.role === role);
export function effectivePerkInventory(save, characterId) {
  const character = characterById[characterId];
  if (!character) return {};
  return Object.fromEntries(rolePerks(character.role)
    .map(perk => [perk.id, inventoryTier(save, characterId, perk.id)])
    .filter(([, tier]) => tier > 0));
}
export function perkInventorySummary(save, characterId) {
  const character = characterById[characterId];
  if (!character) return { tracked: 0, maxed: 0, upgradeable: 0 };
  const effective = effectivePerkInventory(save, characterId);
  const trackedPerks = rolePerks(character.role).filter(perk => (effective[perk.id] || 0) > 0);
  return {
    tracked: trackedPerks.length,
    maxed: trackedPerks.filter(perk => effective[perk.id] === 3).length,
    upgradeable: trackedPerks.filter(perk => bloodwebEligible(save, characterId, perk)).length,
  };
}
export function characterStats(save, id) {
  const relevant = rolePerks(characterById[id].role);
  return { owned: relevant.filter(p => inventoryTier(save, id, p.id) > 0).length, tier3: relevant.filter(p => inventoryTier(save, id, p.id) === 3).length, total: relevant.length };
}
export function perkStats(save, perk) {
  const owned = roleCharacters(perk.role).filter(c => save.characters[c.id].owned);
  const count = owned.filter(c => inventoryTier(save, c.id, perk.id) > 0).length;
  return { total: owned.length, owned: count, tier3: owned.filter(c => inventoryTier(save, c.id, perk.id) === 3).length, missing: owned.length - count };
}
export function syncGlobalInventories(save) {
  // Consolidate historical aliases without losing a higher recorded tier.
  for (const [alias, id] of Object.entries(perkAliases)) {
    if (save.perkOverrides[alias]) {
      const combined = save.perkOverrides[id] ??= { shrineTier: 0 };
      for (const field of ['shrineTier', 'legacyTier', 'manualTier']) {
        if (save.perkOverrides[alias][field] !== undefined) combined[field] = Math.max(combined[field] || 0, save.perkOverrides[alias][field]);
      }
      delete save.perkOverrides[alias];
    }
    for (const progress of Object.values(save.characters)) {
      if (alias in progress.perks) {
        progress.perks[id] = Math.max(progress.perks[id] || 0, progress.perks[alias]);
        delete progress.perks[alias];
      }
    }
  }
}
export function completeCharacterSetup(save, id, bloodwebLevel, inventory) {
  check(characterById[id] && save.characters[id]?.owned, 'Character setup requires an owned character.');
  check(integer(bloodwebLevel, 1, 50), 'Bloodweb level must be 1–50.');
  check(isObject(inventory), 'Invalid Bloodweb inventory.');
  for (const [perkId, tier] of Object.entries(inventory)) {
    check(perkById[perkId]?.role === characterById[id].role && integer(tier, perkById[perkId]?.historicalAvailability?.manualOwnership ? 0 : 1, 3), 'Select a same-role perk tier from I to III (or Not Owned for historical perks).');
  }
  const progress = save.characters[id];
  // Setup only adds/upgrades personal records; automatic minima remain derived.
  for (const [perkId, tier] of Object.entries(inventory)) progress.perks[perkId] = Math.max(progress.perks[perkId] || 0, tier);
  progress.bloodwebLevel = bloodwebLevel;
  progress.setupComplete = true;
}
export function setHistoricalPerkTier(save, characterId, perkId, tier) {
  const perk = perkById[perkId];
  check(perk?.historicalAvailability?.manualOwnership && characterById[characterId]?.role === perk.role && save.characters[characterId], 'Select a same-role historical perk.');
  check(integer(tier, 0, 3), 'Historical ownership must be Not Owned or Tier I–III.');
  check(tier >= recordedTier(save, characterId, perk.id), 'Existing personal tiers cannot be downgraded.');
  save.characters[characterId].perks[perk.id] = tier;
}
export function correctPersonalPerkTier(save, characterId, perkId, tier) {
  const perk = perkById[perkId];
  check(perk && characterById[characterId]?.role === perk.role && save.characters[characterId], 'Select a same-role perk.');
  check(tier === null || integer(tier, 1, 3), 'Personal tier must be None or Tier I–III.');
  if (tier === null) delete save.characters[characterId].perks[perk.id];
  else save.characters[characterId].perks[perk.id] = tier;
}
export function applyAccountRules(save) {
  if (save.accountRulesVersion === 1) return;
  // Older UI used the Shrine field for generic manual unlocks: provenance is unknown.
  for (const override of Object.values(save.perkOverrides)) {
    if (override.shrineTier) {
      override.manualTier = Math.max(override.manualTier || 0, override.shrineTier);
      override.shrineTier = 0;
    }
  }
  for (const id of ['bond', 'prove-thyself', 'leader', 'empathy', 'botany-knowledge', 'self-care', 'technician', 'calm-spirit']) {
    const override = save.perkOverrides[id] ??= { shrineTier: 0 };
    override.legacyTier = Math.max(override.legacyTier || 0, id === 'calm-spirit' ? 2 : 1);
  }
  save.settings.halloweenNames = 'original';
  save.settings.hellraiserNames = 'original';
  save.inventoryPolicy = 'bloodweb';
  save.accountRulesVersion = 1;
}
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = id => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id !== 'constructor' && id !== 'prototype';
const integer = (value, min, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const timestamp = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
function check(condition, message) { if (!condition) throw new Error(message); }
// Central migration boundary. Unsupported future versions are never guessed at.
export function migrateData(data) {
  return validateSave(data).save;
}
export function validateSave(input, options = {}) {
  check(isObject(input) && 'schemaVersion' in input, 'This does not appear to be a DBD Tracker export.');
  check(input.schemaVersion === 1 || input.schemaVersion === SCHEMA_VERSION,
    `Unsupported schema version: ${input.schemaVersion}. This tracker supports schema versions 1 and ${SCHEMA_VERSION}.`);
  const sourceSchemaVersion = input.schemaVersion;
  if (sourceSchemaVersion === 2) {
    return { ...validateCompleteV2(input, options), sourceSchemaVersion, migrationRequired: false, predecessor: null };
  }
  const legacy = validateBaseSave(input);
  const next = structuredClone(legacy.save);
  next.schemaVersion = 2;
  next.prestigeQueue = [];
  for (const progress of Object.values(next.characters)) progress.inventory = freshInventory();
  const result = validateCompleteV2(next, options);
  return { ...result, warnings: [...new Set([...legacy.warnings, ...result.warnings])],
    sourceSchemaVersion, migrationRequired: true, predecessor: legacy.save };
}
function validateBaseSave(data) {
  check(isObject(data.characters) && isObject(data.perkOverrides), 'The export must contain characters and perkOverrides objects.');
  check(timestamp(data.updatedAt), 'The save has an invalid updated timestamp.');
  check(data.setupComplete === undefined || typeof data.setupComplete === 'boolean', 'Setup completion must be true or false.');
  check(data.accountCorrectionApplied === undefined || typeof data.accountCorrectionApplied === 'boolean', 'Account correction must be true or false.');
  check(data.inventoryPolicy === undefined || data.inventoryPolicy === 'bloodweb', 'Invalid inventory policy.');
  check(data.accountRulesVersion === undefined || data.accountRulesVersion === 1, 'Invalid account rules version.');
  check(data.settings === undefined || (isObject(data.settings) && ['original', 'generic'].includes(data.settings.halloweenNames)), 'Halloween names must be original or generic.');
  check(data.settings?.hellraiserNames === undefined || ['original', 'generic'].includes(data.settings.hellraiserNames), 'Hellraiser names must be original or generic.');
  const save = { schemaVersion: data.schemaVersion, setupComplete: data.setupComplete ?? false, accountCorrectionApplied: data.accountCorrectionApplied ?? false, settings: { halloweenNames: data.settings?.halloweenNames ?? 'original', hellraiserNames: data.settings?.hellraiserNames ?? 'original' }, updatedAt: data.updatedAt, characters: {}, perkOverrides: {} };
  if (data.accountRulesVersion) save.accountRulesVersion = data.accountRulesVersion;
  if (data.inventoryPolicy) save.inventoryPolicy = data.inventoryPolicy;
  const warnings = new Set();
  for (const [id, progress] of Object.entries(data.characters)) {
    check(safeId(id) && isObject(progress), `Invalid character record: ${id}.`);
    check(typeof progress.owned === 'boolean' && typeof progress.favorite === 'boolean', `Owned and favorite must be true or false for ${id}.`);
    check(integer(progress.prestige, 0), `Prestige must be a non-negative integer for ${id}.`);
    check(integer(progress.bloodwebLevel, 1, 50), `Bloodweb level must be 1–50 for ${id}.`);
    check(progress.setupComplete === undefined || typeof progress.setupComplete === 'boolean', `Invalid character setup completion for ${id}.`);
    check(typeof progress.notes === 'string' && isObject(progress.perks), `Invalid notes or perk inventory for ${id}.`);
    check(progress.updatedAt === null || timestamp(progress.updatedAt), `Invalid update timestamp for ${id}.`);
    const inventory = {};
    if (!characterById[id]) warnings.add(`Unknown character preserved: ${id}`);
    for (const [perkId, tier] of Object.entries(progress.perks)) {
      check(safeId(perkId) && integer(tier, 0, 3), `Invalid perk tier for ${id} / ${perkId}; use integers 0–3.`);
      if (!perkById[perkId]) warnings.add(`Unknown perk preserved: ${perkId}`);
      if (characterById[id] && perkById[perkId]) check(characterById[id].role === perkById[perkId].role, `Perk ${perkId} belongs to the wrong role for ${id}.`);
      inventory[perkId] = tier;
    }
    save.characters[id] = { owned: progress.owned, prestige: progress.prestige, bloodwebLevel: progress.bloodwebLevel, setupComplete: progress.setupComplete ?? false, favorite: progress.favorite, notes: progress.notes, perks: inventory, updatedAt: progress.updatedAt };
  }
  for (const character of characters) save.characters[character.id] ??= freshLegacyProgress();
  for (const [id, override] of Object.entries(data.perkOverrides)) {
    check(safeId(id) && isObject(override) && integer(override.shrineTier, 0, 3), `Invalid Shrine tier for ${id}.`);
    if (!perkById[id]) warnings.add(`Unknown Shrine perk preserved: ${id}`);
    save.perkOverrides[id] = { shrineTier: override.shrineTier };
    for (const field of ['legacyTier', 'manualTier']) {
      if (override[field] !== undefined) {
        check(integer(override[field], 0, 3), `Invalid ${field} for ${id}.`);
        save.perkOverrides[id][field] = override[field];
      }
    }
  }
  if (data.setupComplete === undefined) save.setupComplete = Object.values(save.characters).some(c => c.owned || c.prestige > 0 || c.bloodwebLevel > 1 || c.favorite || c.notes || Object.values(c.perks).some(t => t > 0)) || Object.values(save.perkOverrides).some(p => p.shrineTier > 0);
  return { save, warnings: [...warnings] };
}
export function validateCompleteV2(input, { inventoryCatalog = inventoryEntityById } = {}) {
  check(isObject(input) && input.schemaVersion === 2, 'Complete schema v2 is required.');
  const { save, warnings } = validateBaseSave(input);
  save.schemaVersion = 2;
  save.prestigeQueue = validatePrestigeQueue(input.prestigeQueue);
  for (const [id, progress] of Object.entries(save.characters)) {
    if (Object.hasOwn(input.characters, id)) {
      const result = canonicalizeQuantityMaps(input.characters[id].inventory, id, inventoryCatalog);
      progress.inventory = result.inventory;
      warnings.push(...result.warnings);
    } else progress.inventory = freshInventory();
  }
  for (const entry of save.prestigeQueue) {
    if (!Object.hasOwn(characterById, entry.characterId)) warnings.push('Unknown queue character preserved: ' + entry.characterId);
  }
  return { save, warnings };
}
export function parseSave(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  return validateSave(data);
}
export function exportSave(save) {
  const exportCharacters = Object.fromEntries(Object.entries(save.characters).map(([id, progress]) => {
    if (!characterById[id]) return [id, progress];
    return [id, {
      ...progress,
      effectivePerks: effectivePerkInventory(save, id),
      perkInventorySummary: perkInventorySummary(save, id),
    }];
  }));
  return JSON.stringify({ ...save, characters: exportCharacters, exportedAt: new Date().toISOString() }, null, 2);
}
