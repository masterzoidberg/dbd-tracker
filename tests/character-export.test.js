import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { freshSave, validateSave } from '../src/model.js';
import { characterById } from '../data/catalog.js';
import { inventoryEntityById } from '../data/inventory-catalog.js';
import { characterExportSnapshot, formatCharacterExport, characterExportFilename } from '../src/character-export.js';

const time = '2026-11-07T12:34:56.000Z';
const addon = Object.values(inventoryEntityById).find(row => row.characterId === 'the-artist');
const item = Object.values(inventoryEntityById).find(row => row.map === 'items');

test('Killer snapshot separates recorded progress, account rules, references and derived state', () => {
  const save = freshSave(), progress = save.characters['the-artist'];
  Object.assign(progress, { owned: true, favorite: true, prestige: 7, bloodwebLevel: 38, notes: 'Crow practice', updatedAt: time });
  progress.perks['grim-embrace'] = 2;
  progress.perks['unknown-perk'] = 0;
  progress.inventory.addons[addon.id] = 12;
  progress.inventory.addons['killer-addon-unknown'] = 3;
  save.planning.prestigeQueues.killer.push({ characterId: 'the-artist', targetPrestige: 9 });
  save.planning.playingQueues.killer.push({ characterId: 'the-artist' });
  save.planning.upNext.killer.push({ characterId: 'the-artist', intent: 'prestige' });
  const snapshot = characterExportSnapshot(save, 'the-artist', time);
  assert.equal(snapshot.exportType, 'ledger-character');
  assert.equal(snapshot.exportSchemaVersion, 1);
  assert.equal(snapshot.exportedAt, time);
  assert.deepEqual(snapshot.character, { id: 'the-artist', name: 'The Artist', role: 'killer' });
  assert.equal(snapshot.recorded.prestige, 7);
  assert.equal(snapshot.recorded.bloodwebLevel, 38);
  assert.equal(snapshot.recorded.notes, 'Crow practice');
  assert.equal(snapshot.recorded.perks['grim-embrace'], 2);
  assert.equal(snapshot.recorded.perks['unknown-perk'], 0);
  assert.equal(snapshot.recorded.inventory.addons[addon.id], 12);
  assert.equal(snapshot.derived.locked, false);
  assert.equal(snapshot.derived.perks.find(row => row.id === 'grim-embrace').effectiveTier, 3);
  assert.equal(snapshot.accountRules.perkUnlocks.find(row => row.id === 'grim-embrace').tier, 3);
  assert.equal(snapshot.reference.power.powerName, 'Birds of Torment');
  assert.ok(snapshot.reference.power.mechanics.length);
  assert.equal(snapshot.reference.inventory.find(row => row.id === addon.id).rarity, addon.rarity);
  assert.deepEqual(snapshot.recorded.planning.prestige, { position: 1, targetPrestige: 9 });
  assert.deepEqual(snapshot.recorded.planning.playing, { position: 1 });
  assert.deepEqual(snapshot.recorded.planning.upNext, { position: 1, intent: 'prestige' });
  assert.throws(() => validateSave(snapshot), /DBD Tracker export/);
});

test('Survivor export contains applicable item and add-on context and personal quantities', () => {
  const save = freshSave();
  save.characters['meg-thomas'].inventory.items[item.id] = 4;
  save.characters['meg-thomas'].inventory.addons['survivor-addon-unknown'] = 2;
  const snapshot = characterExportSnapshot(save, 'meg-thomas', time);
  assert.equal(snapshot.reference.power, null);
  assert.equal(snapshot.recorded.inventory.items[item.id], 4);
  assert.ok(snapshot.reference.inventory.some(row => row.kind === 'survivor-addon'));
  assert.equal(snapshot.reference.inventory.find(row => row.id === item.id).description, item.effect);
  assert.ok(snapshot.reference.perks.some(row => row.id === 'sprint-burst'));
  assert.equal(snapshot.derived.locked, true);
});

test('only selected character fields and relevant account rules leave the snapshot; source stays untouched', () => {
  const save = freshSave();
  save.characters['the-trapper'].notes = 'UNRELATED_PRIVATE_NOTE';
  save.auth = { token: 'SECRET_AUTH_TOKEN' };
  save.characters['the-artist'].session = 'SECRET_SESSION';
  save.planning.upNext.killer.push({ characterId: 'the-trapper', intent: 'play', notes: 'UNRELATED_QUEUE' });
  save.planning.playingQueues.killer.push({ characterId: 'the-artist', token: 'SECRET_QUEUE_TOKEN' });
  const before = JSON.stringify(save);
  const snapshot = characterExportSnapshot(save, 'the-artist', time);
  for (const format of ['json', 'md', 'txt', 'csv']) {
    assert.doesNotMatch(formatCharacterExport(snapshot, format), /UNRELATED_PRIVATE_NOTE|SECRET_|UNRELATED_QUEUE/);
  }
  snapshot.recorded.inventory.addons.test = 9;
  assert.equal(JSON.stringify(save), before);
});

test('default and missing optional fields preserve zero, false, null and absence of personal perk records', () => {
  const save = freshSave();
  delete save.characters['meg-thomas'].notes;
  delete save.characters['meg-thomas'].updatedAt;
  const snapshot = characterExportSnapshot(save, 'meg-thomas', time);
  assert.equal(snapshot.recorded.owned, false);
  assert.equal(snapshot.recorded.prestige, 0);
  assert.equal(snapshot.recorded.bloodwebLevel, 1);
  assert.equal(snapshot.recorded.notes, null);
  assert.equal(snapshot.recorded.updatedAt, null);
  assert.deepEqual(snapshot.recorded.inventory, { items: {}, addons: {} });
  assert.deepEqual(snapshot.recorded.perks, {});
  assert.equal(snapshot.derived.perks.find(row => row.id === 'sprint-burst').effectiveTier, 1);
  assert.equal(snapshot.recorded.planning.prestige, null);
  assert.throws(() => characterExportSnapshot(save, 'not-a-character', time), /Unknown character/);
});

test('JSON and every report format retain notes, quantities and reference context without nesting JSON in CSV', () => {
  const save = freshSave();
  save.characters['the-artist'].notes = 'Line one\nLine two';
  save.characters['the-artist'].inventory.addons[addon.id] = 17;
  const snapshot = characterExportSnapshot(save, 'the-artist', time);
  assert.deepEqual(JSON.parse(formatCharacterExport(snapshot, 'json')), snapshot);
  for (const format of ['md', 'txt', 'csv']) {
    const text = formatCharacterExport(snapshot, format);
    assert.match(text, /The Artist/);
    assert.match(text, /Birds of Torment/);
    assert.match(text, /Line one/);
    assert.match(text, /17/);
  }
  assert.match(formatCharacterExport(snapshot, 'md'), /^# The Artist/);
  assert.match(formatCharacterExport(snapshot, 'txt'), /^The Artist/);
  assert.doesNotMatch(formatCharacterExport(snapshot, 'txt'), /<br>|^## |^\|/m);
  assert.match(formatCharacterExport(snapshot, 'csv'), /^"category","record_id","record_name","field","value"\r\n/);
  assert.doesNotMatch(formatCharacterExport(snapshot, 'csv'), /\{"/);
  assert.throws(() => formatCharacterExport(snapshot, 'html'), /Unsupported/);
});

test('Markdown escapes literal user text including HTML, tables, links, headings, and line breaks', () => {
  const save = freshSave();
  save.characters['meg-thomas'].notes = '# title | [link](https://example.invalid)\n<script>alert(1)</script> `code` *bold* &copy;';
  const output = formatCharacterExport(characterExportSnapshot(save, 'meg-thomas', time), 'md');
  assert.match(output, /\\# title \\?&#124;/);
  assert.match(output, /\\\[link\\\]/);
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, /&amp;copy;/);
  assert.match(output, /\\`code\\`/);
  assert.doesNotMatch(output, /<script>|\n<script>|\n# title/);
});

test('CSV quotes commas, quotes and multiline text and neutralizes spreadsheet formulas', () => {
  for (const note of ['=HYPERLINK("evil","name")', '+SUM(1,2)', '-1+2', '@SUM(1)', '\t=1+1', ' \r\n=1+1', '\uFEFF=1+1']) {
    const save = freshSave(); save.characters['the-artist'].notes = note;
    const output = formatCharacterExport(characterExportSnapshot(save, 'the-artist', time), 'csv');
    assert.ok(output.includes('"\'' + note.replaceAll('"', '""') + '"'), note);
  }
  const save = freshSave(); save.characters['the-artist'].notes = 'Crows, "many"\nnext line';
  assert.ok(formatCharacterExport(characterExportSnapshot(save, 'the-artist', time), 'csv').includes('"Crows, ""many""\nnext line"'));
});

test('all collection ordering and filenames are deterministic and safe', () => {
  const save = freshSave();
  const a = save.characters['the-artist'];
  a.perks = { 'unknown-z': 0, 'grim-embrace': 1, 'unknown-a': 2 };
  a.inventory.addons = { 'killer-addon-unknown-z': 0, [addon.id]: 3, 'killer-addon-unknown-a': 2 };
  const first = characterExportSnapshot(save, 'the-artist', time);
  a.perks = Object.fromEntries(Object.entries(a.perks).reverse());
  a.inventory.addons = Object.fromEntries(Object.entries(a.inventory.addons).reverse());
  for (const format of ['json', 'md', 'txt', 'csv']) {
    assert.equal(formatCharacterExport(first, format), formatCharacterExport(characterExportSnapshot(save, 'the-artist', time), format));
    assert.equal(characterExportFilename(first, format), `the-artist-character-2026-11-07.${format}`);
  }
  const unsafe = { ...first, character: { ...first.character, id: '../../CON:<bad>|"' } };
  assert.match(characterExportFilename(unsafe, 'json'), /^[a-z0-9-]+-character-2026-11-07\.json$/);
  assert.equal(first.recorded.inventory.addons['killer-addon-unknown-z'], 0);
});

test('browser export dependency graph contains no server modules, auth calls or secret configuration', async () => {
  const result = await build({ entryPoints: ['src/app.js'], bundle: true, write: false, metafile: true, minify: true,
    define: { __LEDGER_GOOGLE_CONFIG__: '{}' } });
  assert.ok(Object.keys(result.metafile.inputs).every(path => !/node_modules|src\/auth\//.test(path)));
  assert.doesNotMatch(result.outputFiles[0].text, /DATABASE_URL|BETTER_AUTH_SECRET|MAILTRAP_|postgres(?:ql)?:\/\/|\/api\/(?:auth|ledger)\//);
});
