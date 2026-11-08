import { characterById, perkById, perkName, catalogInfo } from '../data/catalog.js';
import { inventoryEntityById, killerPowerByCharacterId } from '../data/inventory-catalog.js';
import { rolePerks, globalTier, automaticTier, inventoryTier, unlockSource, ownedUnlockSource, bloodwebNextTier, isAvailable } from './model.js';

const sorted = object => Object.fromEntries(Object.entries(object ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const pick = (object, keys) => Object.fromEntries(keys.filter(key => object?.[key] !== undefined).map(key => [key, structuredClone(object[key])]));
const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const formats = { json: 'application/json', md: 'text/markdown', txt: 'text/plain', csv: 'text/csv' };
export const characterExportMime = format => {
  if (!Object.hasOwn(formats, format)) throw new Error('Unsupported character export format.');
  return formats[format] + ';charset=utf-8';
};

// Explicit projections keep unrelated records and arbitrary imported extensions out.
// Account-derived minima remain separate from the user's personal perk records.
export function characterExportSnapshot(save, characterId, exportedAt = new Date().toISOString()) {
  const character = Object.hasOwn(characterById, characterId) ? characterById[characterId] : null;
  if (!character || !save.characters?.[characterId]) throw new Error('Unknown character or unavailable recorded progress.');
  if (!Number.isFinite(Date.parse(exportedAt))) throw new Error('Invalid export timestamp.');
  const progress = save.characters[characterId];
  const personalPerks = sorted(progress.perks);
  const relevantPerks = rolePerks(character.role).filter(perk => character.nativePerkIds.includes(perk.id)
    || isAvailable(save, perk) || Object.hasOwn(personalPerks, perk.id));
  const perkIds = [...new Set([...relevantPerks.map(perk => perk.id), ...Object.keys(personalPerks)])].sort();
  const applicableInventory = Object.values(inventoryEntityById).filter(entity =>
    entity.role === character.role && (character.role === 'survivor' || entity.characterId === characterId)).sort(compareId);
  const planning = {};
  for (const [name, field] of [['prestige', 'prestigeQueues'], ['playing', 'playingQueues'], ['upNext', 'upNext']]) {
    const lane = save.planning?.[field]?.[character.role] ?? [];
    const index = lane.findIndex(entry => entry.characterId === characterId);
    planning[name] = index < 0 ? null : { position: index + 1, ...pick(lane[index], ['targetPrestige', 'intent']) };
  }
  const power = killerPowerByCharacterId[characterId];
  return {
    exportType: 'ledger-character',
    exportSchemaVersion: 1,
    exportedAt,
    notice: 'Character information only. Not a full-account save and not importable through account restore. Null means not recorded or unavailable. Quantities omitted from recorded inventory display as zero in the tracker.',
    character: { id: character.id, name: character.name, role: character.role },
    recorded: {
      owned: progress.owned ?? null,
      favorite: progress.favorite ?? null,
      prestige: progress.prestige ?? null,
      bloodwebLevel: progress.bloodwebLevel ?? null,
      setupComplete: progress.setupComplete ?? null,
      notes: progress.notes ?? null,
      updatedAt: progress.updatedAt ?? null,
      perks: personalPerks,
      inventory: { items: sorted(progress.inventory?.items), addons: sorted(progress.inventory?.addons) },
      planning,
    },
    accountRules: {
      accountRulesVersion: save.accountRulesVersion ?? null,
      inventoryPolicy: save.inventoryPolicy ?? null,
      explanation: 'Account unlock tiers are shared rules, not personal Bloodweb progress. General availability alone grants no owned tier. Native perks have a Tier I minimum. Lock status is derived from character ownership; equipment/loadouts are not modeled.',
      perkUnlocks: relevantPerks.map(perk => ({ id: perk.id, tier: globalTier(save, perk), source: unlockSource(save, perk) })).sort(compareId),
    },
    reference: {
      catalog: pick(catalogInfo, ['patch', 'date']),
      nativePerkIds: [...character.nativePerkIds].sort(),
      perks: perkIds.map(id => {
        const perk = Object.hasOwn(perkById, id) ? perkById[id] : null;
        return perk ? { id, name: perkName(save, perk), canonicalName: perk.name, description: perk.description,
          summary: perk.summary, general: perk.general, sourceCharacterName: perk.sourceCharacterName,
          ...pick(perk, ['historicalAvailability']) } : { id, name: null, description: null };
      }),
      power: character.role === 'killer' && power ? pick(power, ['powerName', 'shortSummary', 'fullExplanation', 'components', 'mechanics',
        'resources', 'survivorInteractions', 'powerStates', 'addonRelevantMechanics', 'complexRules']) : null,
      inventory: applicableInventory.map(entity => ({ id: entity.id, name: entity.name, kind: entity.kind, map: entity.map,
        rarity: entity.rarity ?? null, description: entity.effect ?? entity.description ?? null,
        ...pick(entity, ['familyId', 'itemTypeId', 'compatibleItemIds', 'status', 'event', 'notes', 'needsVerification']) })),
    },
    derived: {
      locked: typeof progress.owned === 'boolean' ? !progress.owned : null,
      perks: relevantPerks.map(perk => ({ id: perk.id, native: character.nativePerkIds.includes(perk.id),
        available: isAvailable(save, perk) || character.nativePerkIds.includes(perk.id),
        automaticMinimum: automaticTier(save, characterId, perk), effectiveTier: inventoryTier(save, characterId, perk.id),
        ownedSource: ownedUnlockSource(save, characterId, perk), nextBloodwebTier: bloodwebNextTier(save, characterId, perk) })).sort(compareId),
    },
  };
}

const display = value => value === null || value === undefined ? 'Not recorded / unavailable' : String(value);
const label = key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('.', ' / ').replace(/^./, c => c.toUpperCase());
function fields(value, prefix = '') {
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length ? entries.flatMap(([key, child]) => fields(child, prefix ? prefix + '.' + key : key)) : [[prefix, 'None']];
  }
  return [[prefix, value]];
}

// Every human-readable format consumes the same sections, including CSV's long-form rows.
function reportSections(snapshot) {
  const { character, recorded, reference, derived, accountRules } = snapshot;
  const perkNames = Object.fromEntries(reference.perks.map(row => [row.id, row.name ?? 'Unknown perk']));
  const inventoryNames = Object.fromEntries(reference.inventory.map(row => [row.id, row.name]));
  const section = (title, columns, rows) => ({ title, columns, rows });
  const fieldSection = (title, value) => section(title, ['Field', 'Value'], fields(value).map(([key, value]) => [label(key), value]));
  return [
    fieldSection('Character summary', { ...character, locked: derived.locked, exportedAt: snapshot.exportedAt, exportSchemaVersion: snapshot.exportSchemaVersion }),
    fieldSection('Recorded progression and notes', pick(recorded, ['owned', 'favorite', 'prestige', 'bloodwebLevel', 'setupComplete', 'notes', 'updatedAt'])),
    section('Recorded personal perk tiers', ['ID', 'Name', 'Recorded tier'], Object.entries(recorded.perks).map(([id, tier]) => [id, perkNames[id], tier])),
    section('Recorded inventory quantities', ['ID', 'Name', 'Map', 'Recorded quantity'], ['items', 'addons'].flatMap(map =>
      Object.entries(recorded.inventory[map]).map(([id, quantity]) => [id, inventoryNames[id] ?? 'Unknown inventory record', map, quantity]))),
    fieldSection('Character planning references', recorded.planning),
    fieldSection('Account-wide rules', pick(accountRules, ['accountRulesVersion', 'inventoryPolicy', 'explanation'])),
    section('Account-wide perk unlocks', ['ID', 'Name', 'Tier', 'Source'], accountRules.perkUnlocks.map(row => [row.id, perkNames[row.id], row.tier, row.source])),
    section('Derived perk display', ['ID', 'Name', 'Native', 'Available', 'Automatic minimum', 'Effective tier', 'Owned source', 'Next Bloodweb tier'],
      derived.perks.map(row => [row.id, perkNames[row.id], row.native, row.available, row.automaticMinimum, row.effectiveTier, row.ownedSource, row.nextBloodwebTier])),
    fieldSection('Catalog context', { ...reference.catalog, nativePerkIds: reference.nativePerkIds }),
    section('Perk reference descriptions', ['ID', 'Name', 'Field', 'Value'], reference.perks.flatMap(row =>
      fields(pick(row, ['canonicalName', 'general', 'sourceCharacterName', 'description', 'summary', 'historicalAvailability']))
        .map(([key, value]) => [row.id, row.name, label(key), value]))),
    ...(reference.power ? [fieldSection('Killer power reference', reference.power)] : []),
    section(character.role === 'killer' ? 'Killer add-on reference' : 'Survivor item and add-on reference', ['ID', 'Name', 'Field', 'Value'],
      reference.inventory.flatMap(row => fields(pick(row, ['kind', 'map', 'rarity', 'description', 'familyId', 'itemTypeId', 'compatibleItemIds', 'status', 'event', 'notes', 'needsVerification']))
        .map(([key, value]) => [row.id, row.name, label(key), value]))),
  ];
}

function markdown(value) {
  return display(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!~>-])/g, '\\$1').replaceAll('|', '&#124;').replace(/\r\n|\r|\n/g, '<br>');
}
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // Quote all cells, and neutralize formulas even after whitespace/control/BOM prefixes.
  if (/^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function formatCharacterExport(snapshot, format) {
  characterExportMime(format);
  if (format === 'json') return JSON.stringify(snapshot, null, 2) + '\n';
  const sections = reportSections(snapshot);
  if (format === 'md') return '# ' + markdown(snapshot.character.name) + ' — Character export\n\n' + markdown(snapshot.notice) + '\n\n'
    + sections.map(({ title, columns, rows }) => '## ' + title + '\n\n' + (rows.length
      ? '| ' + columns.join(' | ') + ' |\n| ' + columns.map(() => '---').join(' | ') + ' |\n'
        + rows.map(row => '| ' + row.map(markdown).join(' | ') + ' |').join('\n') : 'None recorded.') + '\n').join('\n');
  if (format === 'txt') return snapshot.character.name + ' — Character export\n\n' + snapshot.notice + '\n\n'
    + sections.map(({ title, columns, rows }) => title.toUpperCase() + '\n' + (rows.length
      ? rows.map(row => row.map((value, index) => '  ' + columns[index] + ': ' + display(value).replace(/\r\n|\r|\n/g, '\n    ')).join('\n')).join('\n\n')
      : '  None recorded.') + '\n').join('\n');
  const records = [['category', 'record_id', 'record_name', 'field', 'value'], ['Export', snapshot.character.id, snapshot.character.name, 'Notice', snapshot.notice]];
  for (const { title, columns, rows } of sections) {
    if (!rows.length) records.push([title, '', '', 'Records', 'None recorded']);
    for (const row of rows) {
      const identified = columns[0] === 'ID';
      if (columns.at(-2) === 'Field') records.push([title, identified ? row[0] : '', identified ? row[1] : '', row.at(-2), row.at(-1)]);
      else for (let index = identified ? 2 : 0; index < columns.length; index++) records.push([title, identified ? row[0] : '', identified ? row[1] : '', columns[index], row[index]]);
    }
  }
  return records.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function characterExportFilename(snapshot, format) {
  characterExportMime(format);
  const id = String(snapshot.character.id).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'character';
  return `${id}-character-${new Date(snapshot.exportedAt).toISOString().slice(0, 10)}.${format}`;
}
