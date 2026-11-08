import { characterById, perkById, perkName } from '../data/catalog.js';
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
const romanTier = tier => ['0', 'I', 'II', 'III'][tier];
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
function markdownTable(columns, rows) {
  return '| ' + columns.join(' | ') + ' |\n| ' + columns.map(() => '---').join(' | ') + ' |\n'
    + rows.map(row => '| ' + row.map(markdown).join(' | ') + ' |').join('\n');
}
function textRows(rows) {
  const width = Math.max(...rows.map(([name]) => name.length));
  return rows.map(([name, value]) => name.padEnd(width + 2) + value).join('\n');
}
function csvCell(value) {
  let text = String(value);
  if (/^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function formatCharacterExport(snapshot, format) {
  characterExportMime(format);
  if (format === 'json') return JSON.stringify(snapshot, null, 2) + '\n';
  const summary = summaryFields(snapshot), planning = planningFields(snapshot), inventories = inventorySections(snapshot);
  if (format === 'md') {
    const sections = ['# ' + markdown(snapshot.character.name), summary.map(([key, value]) => '- **' + key + ':** ' + markdown(value)).join('\n')];
    if (snapshot.perks.length) sections.push('## Recorded Perks\n\n' + markdownTable(['Perk', 'Tier'], snapshot.perks.map(row => [row.name, romanTier(row.tier)])));
    for (const [map, title, noun] of inventories) sections.push('## ' + title + '\n\n' + markdownTable([noun, 'Quantity'], snapshot.inventory[map].map(row => [row.name, row.quantity])));
    if (snapshot.notes !== undefined) sections.push('## Notes\n\n' + markdownNotes(snapshot.notes));
    if (planning.length) sections.push('## Planning\n\n' + planning.map(([key, value]) => '- ' + key + ': ' + markdown(value)).join('\n'));
    return sections.join('\n\n') + '\n';
  }
  if (format === 'txt') {
    const sections = [snapshot.character.name, summary.map(([key, value]) => key + ': ' + value).join('\n')];
    if (snapshot.perks.length) sections.push('RECORDED PERKS\n' + textRows(snapshot.perks.map(row => [row.name, romanTier(row.tier)])));
    for (const [map, title] of inventories) sections.push(title.toUpperCase() + '\n' + textRows(snapshot.inventory[map].map(row => [row.name, row.quantity])));
    if (snapshot.notes !== undefined) sections.push('NOTES\n' + snapshot.notes);
    if (planning.length) sections.push('PLANNING\n' + planning.map(([key, value]) => key + ': ' + value).join('\n'));
    return sections.join('\n\n') + '\n';
  }
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
