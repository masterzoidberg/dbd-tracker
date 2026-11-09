import { characterById, perkById, perkName, perkTierValuesById } from '../data/catalog.js';
import { inventoryEntityById } from '../data/inventory-catalog.js';

const formats = { json: 'application/json', md: 'text/markdown', txt: 'text/plain', csv: 'text/csv' };
export const characterExportMime = format => {
  if (!Object.hasOwn(formats, format)) throw new Error('Unsupported character export format.');
  return formats[format] + ';charset=utf-8';
};
const pick = (object, keys) => Object.fromEntries(keys.filter(key => object?.[key] !== undefined && object[key] !== null).map(key => [key, object[key]]));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const byName = (a, b) => compare(a.name, b.name) || compare(a.id, b.id);

// Project only this character's records. Catalogs supply names, never progress
// or additional entries. No account unlock/effective-tier calculations belong here.
export function characterExportSnapshot(save, characterId, exportedAt = new Date().toISOString()) {
  const character = Object.hasOwn(characterById, characterId) ? characterById[characterId] : null;
  if (!character || !save.characters?.[characterId]) throw new Error('Unknown character or unavailable recorded progress.');
  if (!Number.isFinite(Date.parse(exportedAt))) throw new Error('Invalid export timestamp.');
  const progress = save.characters[characterId];
  const perks = Object.entries(progress.perks ?? {}).filter(([, tier]) => tier > 0).map(([id, tier]) => {
    const perk = Object.hasOwn(perkById, id) ? perkById[id] : null;
    return { id, name: perk ? perkName(save, perk) : id, tier };
  }).sort(byName);
  const inventory = {};
  for (const map of character.role === 'survivor' ? ['items', 'addons'] : ['addons']) {
    inventory[map] = Object.entries(progress.inventory?.[map] ?? {}).filter(([, quantity]) => quantity > 0)
      .filter(([id]) => {
        const entity = Object.hasOwn(inventoryEntityById, id) ? inventoryEntityById[id] : null;
        return !entity || (entity.role === character.role && entity.map === map
          && (character.role === 'survivor' || entity.characterId === characterId));
      })
      .map(([id, quantity]) => ({ id, name: Object.hasOwn(inventoryEntityById, id) ? inventoryEntityById[id].name : id, quantity })).sort(byName);
  }
  const planning = {};
  for (const [name, field, keys] of [['prestige', 'prestigeQueues', ['targetPrestige']], ['playing', 'playingQueues', []], ['upNext', 'upNext', ['intent']]]) {
    const lane = save.planning?.[field]?.[character.role] ?? [];
    const index = lane.findIndex(entry => entry.characterId === characterId);
    if (index >= 0) planning[name] = { position: index + 1, ...pick(lane[index], keys) };
  }
  return {
    exportType: 'ledger-character',
    exportSchemaVersion: 2,
    exportedAt,
    character: { id: character.id, name: character.name, role: character.role },
    progression: pick(progress, ['owned', 'favorite', 'prestige', 'bloodwebLevel', 'setupComplete']),
    perks,
    inventory,
    ...(typeof progress.notes === 'string' && progress.notes.trim() ? { notes: progress.notes } : {}),
    ...(Object.keys(planning).length ? { planning } : {}),
  };
}

const roleName = role => role === 'killer' ? 'Killer' : 'Survivor';
const humanValue = value => typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);
function summaryFields(snapshot) {
  const labels = { owned: 'Owned', favorite: 'Favorite', prestige: 'Prestige', bloodwebLevel: 'Bloodweb Level', setupComplete: 'Setup Complete' };
  return [['Role', roleName(snapshot.character.role)], ...Object.entries(snapshot.progression).map(([key, value]) => [labels[key], humanValue(value)]), ['Exported At', snapshot.exportedAt]];
}
function planningFields(snapshot) {
  const rows = [], planning = snapshot.planning ?? {};
  if (planning.prestige) {
    if (planning.prestige.targetPrestige !== undefined) rows.push(['Prestige target', planning.prestige.targetPrestige]);
    rows.push(['Prestige queue position', planning.prestige.position]);
  }
  if (planning.playing) rows.push(['Playing queue position', planning.playing.position]);
  if (planning.upNext) {
    if (planning.upNext.intent) rows.push(['Up Next intent', planning.upNext.intent]);
    rows.push(['Up Next position', planning.upNext.position]);
  }
  return rows;
}
function inventorySections(snapshot) {
  return [['items', 'Item Inventory', 'Item'], ['addons', snapshot.character.role === 'killer' ? 'Add-on Inventory' : 'Item Add-on Inventory', 'Add-on']]
    .filter(([map]) => snapshot.inventory[map]?.length);
}
function markdown(value) {
  return String(value).replace(/[\\`*_\[\]<>|]/g, '\\$&')
    .replace(/&(?=(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);)/gi, '\\&').replace(/\r\n|\r|\n/g, '<br>');
}
function markdownNotes(notes) {
  // A fence longer than any run in the note preserves its literal content,
  // including newlines/HTML/headings, without allowing it to escape the section.
  let length = 3;
  for (const match of notes.matchAll(/`+/g)) length = Math.max(length, match[0].length + 1);
  const fence = '`'.repeat(length);
  return fence + '\n' + notes + (notes.endsWith('\n') ? '' : '\n') + fence;
}
function readable(value = '') {
  return String(value).replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[0-9a-f]+);/gi, entity => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity.slice(2, -1);
    const number = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
  });
}
function perkDescription(id, tier) {
  const description = Object.hasOwn(perkById, id) ? perkById[id].description : '';
  const values = Object.hasOwn(perkTierValuesById, id) ? perkTierValuesById[id] : [];
  // Only a sequence corroborated by the same numeric catalog field at all
  // three tiers is selectable. Conflicting/unknown sequences remain verbatim.
  const selected = description.replace(/(?<![\d./])\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?){2,}(?![\d./])/g, sequence => {
    const numbers = sequence.split('/').map(Number);
    const verified = numbers.length === 3 && Object.keys(values[0] ?? {}).some(key =>
      numbers.every((number, index) => typeof values[index]?.[key] === 'number' && values[index][key] === number));
    return verified && [1, 2, 3].includes(tier) ? String(numbers[tier - 1]) : sequence;
  });
  return readable(selected);
}
function humanSummary(snapshot, format) {
  const md = format === 'md';
  const heading = (level, text) => (md ? '#'.repeat(level) + ' ' : '') + text;
  const name = value => md ? markdown(readable(value)) : readable(value);
  // Description sentences become short paragraphs without changing mechanics.
  const description = value => value.replace(/(?<=[.!?]) +(?=[A-Z])/g, '\n\n');
  const sections = [heading(1, name(snapshot.character.name)),
    [['prestige', 'Prestige'], ['bloodwebLevel', 'Bloodweb']]
      .filter(([key]) => snapshot.progression[key] !== undefined)
      .map(([key, label]) => label + ': ' + snapshot.progression[key]).join('\n')];
  if (snapshot.perks.length) {
    sections.push(heading(2, 'Perks'));
    for (const perk of snapshot.perks) sections.push([
      heading(3, name(perk.name) + ' | Tier ' + perk.tier),
      description(perkDescription(perk.id, perk.tier)),
    ].filter(Boolean).join('\n\n'));
  }
  for (const [map, title, category] of [['items', 'Items', 'Item'], ['addons', 'Add-ons', 'Add-On']]) {
    if (!snapshot.inventory[map]?.length) continue;
    sections.push(heading(2, title));
    for (const entry of snapshot.inventory[map]) {
      const entity = Object.hasOwn(inventoryEntityById, entry.id) ? inventoryEntityById[entry.id] : null;
      const rarity = entity?.rarity?.replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
      sections.push([heading(3, name(entry.name) + ' | ' + [rarity, category].filter(Boolean).join(' ')),
        'Quantity: ' + entry.quantity, description(readable(entity?.effect))].filter(Boolean).join('\n\n'));
    }
  }
  if (snapshot.notes?.trim()) sections.push(heading(2, 'Notes') + '\n\n' + (md ? markdownNotes(snapshot.notes) : snapshot.notes));
  return sections.filter(Boolean).join('\n\n') + '\n';
}
function csvCell(value) {
  let text = String(value);
  if (/^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function formatCharacterExport(snapshot, format) {
  characterExportMime(format);
  if (format === 'json') return JSON.stringify(snapshot, null, 2) + '\n';
  if (format === 'md' || format === 'txt') return humanSummary(snapshot, format);
  const summary = summaryFields(snapshot), planning = planningFields(snapshot), inventories = inventorySections(snapshot);
  const rows = [['Section', 'Name', 'Value', 'Tier', 'Quantity', 'ID'], ['Summary', 'Character', snapshot.character.name, '', '', snapshot.character.id],
    ...summary.map(([key, value]) => ['Summary', key, value, '', '', '']),
    ...snapshot.perks.map(row => ['Perks', row.name, '', row.tier, '', row.id])];
  for (const [map] of inventories) rows.push(...snapshot.inventory[map].map(row => [map === 'items' ? 'Items' : 'Add-ons', row.name, '', '', row.quantity, row.id]));
  if (snapshot.notes !== undefined) rows.push(['Notes', 'Notes', snapshot.notes, '', '', '']);
  rows.push(...planning.map(([key, value]) => ['Planning', key, value, '', '', '']));
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function characterExportFilename(snapshot, format) {
  characterExportMime(format);
  const id = String(snapshot.character.id).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'character';
  return `${id}-character-${new Date(snapshot.exportedAt).toISOString().slice(0, 10)}.${format}`;
}
