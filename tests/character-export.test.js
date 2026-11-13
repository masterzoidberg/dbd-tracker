import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { freshSave, validateSave } from '../src/model.js';
import { perks } from '../data/catalog.js';
import { inventoryEntityById } from '../data/inventory-catalog.js';
import { characterExportSnapshot, formatCharacterExport, characterExportFilename } from '../src/character-export.js';
import { dredgeExportFixture, characterExportTime as time } from './fixtures/character-export.js';

const formats = ['json', 'md', 'txt', 'csv'];
const item = Object.values(inventoryEntityById).find(row => row.map === 'items');
const survivorAddon = Object.values(inventoryEntityById).find(row => row.role === 'survivor' && row.map === 'addons');
const snapshot = save => characterExportSnapshot(save, 'the-dredge', time);

function csvRecords(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  assert.equal(quoted, false);
  assert.deepEqual(row, []);
  return rows;
}

test('Dredge schema v2 includes only recorded progress, positive personal tiers/quantities and populated planning', () => {
  const save = dredgeExportFixture();
  save.characters['the-dredge'].perks['hex-no-one-escapes-death'] = 0;
  save.characters['the-dredge'].inventory.addons['killer-addon-dredge-broken-doll'] = 0;
  const data = snapshot(save);
  assert.deepEqual(Object.keys(data), ['exportType', 'exportSchemaVersion', 'exportedAt', 'character', 'progression', 'perks', 'inventory', 'notes', 'planning']);
  assert.equal(data.exportType, 'ledger-character');
  assert.equal(data.exportSchemaVersion, 2);
  assert.equal(data.exportedAt, time);
  assert.deepEqual(data.character, { id: 'the-dredge', name: 'The Dredge', role: 'killer' });
  assert.deepEqual(data.progression, { owned: true, favorite: true, prestige: 1, bloodwebLevel: 33, setupComplete: true });
  assert.deepEqual(data.perks, [
    { id: 'bamboozle', name: 'Bamboozle', tier: 3 },
    { id: 'dark-devotion', name: 'Dark Devotion', tier: 2 },
    { id: 'darkness-revealed', name: 'Darkness Revealed', tier: 3 },
    { id: 'monitor-abuse', name: 'Monitor & Abuse', tier: 1 },
  ]);
  assert.deepEqual(data.inventory, { addons: [
    { id: 'killer-addon-dredge-caffeine-tablets', name: 'Caffeine Tablets', quantity: 46 },
    { id: 'killer-addon-dredge-followers-cowl', name: "Follower's Cowl", quantity: 31 },
    { id: 'killer-addon-dredge-mortar-and-pestle', name: 'Mortar and Pestle', quantity: 35 },
  ] });
  assert.equal(data.notes, save.characters['the-dredge'].notes);
  assert.deepEqual(data.planning, { prestige: { position: 1, targetPrestige: 2 }, playing: { position: 1 }, upNext: { position: 1, intent: 'prestige' } });
  assert.throws(() => validateSave(data), /DBD Tracker export/);
});

test('Survivor items and add-ons stay distinct and unknown positive records survive without catalog payloads', () => {
  const save = freshSave(), progress = save.characters['meg-thomas'];
  progress.inventory.items[item.id] = 4;
  progress.inventory.addons[survivorAddon.id] = 5;
  progress.inventory.addons['survivor-addon-unknown'] = 2;
  progress.perks['unknown-perk'] = 1;
  const data = characterExportSnapshot(save, 'meg-thomas', time);
  assert.deepEqual(data.inventory.items, [{ id: item.id, name: item.name, quantity: 4 }]);
  assert.equal(data.inventory.addons.length, 2);
  assert.ok(data.inventory.addons.some(row => row.id === survivorAddon.id && row.name === survivorAddon.name && row.quantity === 5));
  assert.ok(data.inventory.addons.some(row => row.id === 'survivor-addon-unknown' && row.quantity === 2 && row.name));
  assert.equal(data.perks.length, 1);
  assert.equal(data.perks[0].id, 'unknown-perk');
  for (const format of formats) {
    const text = formatCharacterExport(data, format);
    assert.ok(text.includes(item.name));
    assert.ok(text.includes(survivorAddon.name));
    assert.doesNotMatch(text, /automaticMinimum|effectiveTier|reference|accountRules/);
  }
});

test('large personal inventories export every recorded perk and add-on, not just representative examples', () => {
  const save = dredgeExportFixture(), progress = save.characters['the-dredge'];
  const recordedPerks = perks.filter(perk => perk.role === 'killer');
  recordedPerks.forEach((perk, index) => { progress.perks[perk.id] = index % 3 + 1; });
  const addons = Object.values(inventoryEntityById).filter(row => row.characterId === 'the-dredge');
  addons.forEach((addon, index) => { progress.inventory.addons[addon.id] = index + 1; });
  const data = snapshot(save);
  assert.equal(data.perks.length, recordedPerks.length);
  assert.equal(data.inventory.addons.length, addons.length);
  for (const row of data.perks) assert.equal(row.tier, progress.perks[row.id]);
  for (const row of data.inventory.addons) assert.equal(row.quantity, progress.inventory.addons[row.id]);
  const rows = csvRecords(formatCharacterExport(data, 'csv'));
  assert.equal(rows.filter(row => row[0] === 'Perks').length, recordedPerks.length);
  assert.equal(rows.filter(row => row[0] === 'Add-ons').length, addons.length);
});

test('empty/unowned exports retain false/zero progression, omit empty sections and do not infer native perks', () => {
  const save = freshSave();
  delete save.characters['meg-thomas'].notes;
  delete save.characters['meg-thomas'].updatedAt;
  const data = characterExportSnapshot(save, 'meg-thomas', time);
  assert.deepEqual(data.progression, { owned: false, favorite: false, prestige: 0, bloodwebLevel: 1, setupComplete: false });
  assert.deepEqual(data.perks, []);
  assert.deepEqual(data.inventory, { items: [], addons: [] });
  assert.ok(!Object.hasOwn(data, 'notes') && !Object.hasOwn(data, 'planning'));
  for (const format of ['md', 'txt', 'csv']) assert.doesNotMatch(formatCharacterExport(data, format), /Recorded Perks|RECORDED PERKS|## Notes|NOTES|Planning|Not recorded|unavailable|sprint-burst|None recorded/);
  assert.throws(() => characterExportSnapshot(save, 'not-a-character', time), /Unknown character/);
});

test('every format excludes account rules, derived calculations, reference data and unrelated/private records', () => {
  const save = dredgeExportFixture();
  save.characters['the-trapper'].notes = 'UNRELATED_PRIVATE_NOTE';
  save.auth = { token: 'SECRET_AUTH_TOKEN' };
  save.characters['the-dredge'].session = 'SECRET_SESSION';
  save.planning.upNext.killer.push({ characterId: 'the-trapper', intent: 'play', notes: 'UNRELATED_QUEUE' });
  save.planning.playingQueues.killer[0].token = 'SECRET_QUEUE_TOKEN';
  const before = JSON.stringify(save), data = snapshot(save);
  const forbidden = /accountRules|reference|derived|automaticMinimum|effectiveTier|nextBloodwebTier|inventoryPolicy|accountRulesVersion|nativePerkIds|description|"summary"\s*:|sourceCharacter|powerName|mechanics|rarity|compatib|UNRELATED_|SECRET_|Nightfall|Prestige\/Shrine/i;
  for (const format of ['json', 'csv']) assert.doesNotMatch(formatCharacterExport(data, format), forbidden);
  for (const format of ['md', 'txt']) assert.doesNotMatch(formatCharacterExport(data, format), /accountRules|effectiveTier|UNRELATED_|SECRET_|## Planning/);
  data.inventory.addons[0].quantity = 999;
  data.planning.prestige.targetPrestige = 999;
  assert.equal(JSON.stringify(save), before);
});

test('all formats contain the same personal entries; human summaries consolidate descriptions and CSV retains rows', () => {
  const data = snapshot(dredgeExportFixture());
  assert.deepEqual(JSON.parse(formatCharacterExport(data, 'json')), data);
  const md = formatCharacterExport(data, 'md'), txt = formatCharacterExport(data, 'txt');
  assert.match(md, /### Dark Devotion \| Tier 2/);
  assert.match(md, /### Monitor & Abuse \| Tier 1/);
  assert.match(txt, /Dark Devotion \| Tier 2/);
  assert.match(txt, /Monitor & Abuse \| Tier 1/);
  assert.match(md, /### Caffeine Tablets \| Common Add-On\n\nQuantity: 46/);
  assert.match(txt, /Caffeine Tablets \| Common Add-On\n\nQuantity: 46/);
  assert.doesNotMatch(txt, /Recorded tier:|ID:|Name:|Value:|<br>|^## |^\|/m);
  const [header, ...rows] = csvRecords(formatCharacterExport(data, 'csv'));
  assert.deepEqual(header, ['Section', 'Name', 'Value', 'Tier', 'Quantity', 'ID']);
  assert.equal(rows.filter(row => row[0] === 'Perks').length, data.perks.length);
  assert.equal(rows.filter(row => row[0] === 'Add-ons').length, data.inventory.addons.length);
  assert.ok(rows.length < 30);
  for (const perk of data.perks) {
    assert.ok(md.includes(perk.name) && txt.includes(perk.name));
    assert.deepEqual(rows.find(row => row[5] === perk.id), ['Perks', perk.name, '', String(perk.tier), '', perk.id]);
  }
  for (const entry of data.inventory.addons) assert.deepEqual(rows.find(row => row[5] === entry.id), ['Add-ons', entry.name, '', '', String(entry.quantity), entry.id]);
  assert.ok(rows.some(row => row[0] === 'Notes' && row[2] === data.notes));
  assert.ok(md.includes(data.notes) && txt.includes(data.notes));
  for (const text of [md, txt]) {
    for (const value of ['Prestige: 1', 'Bloodweb: 33']) assert.ok(text.includes(value), value);
    assert.doesNotMatch(text, /Setup Complete|Owned:|Favorite:|Exported At|## Planning/);
  }
  assert.throws(() => formatCharacterExport(data, 'html'), /Unsupported/);
});

test('Markdown preserves ordinary punctuation/ampersands and contains literal multiline notes safely', () => {
  const save = dredgeExportFixture();
  const notes = '# title | [link](https://example.invalid)\n<script>alert(1)</script> `code` *bold* &copy;\n```\n## forged heading\n```';
  save.characters['the-dredge'].notes = notes;
  const output = formatCharacterExport(snapshot(save), 'md');
  assert.ok(output.includes(notes), 'Notes are preserved verbatim inside a longer literal fence');
  assert.ok(output.includes('````\n' + notes + '\n````'));
  assert.match(output, /Monitor & Abuse/);
  assert.doesNotMatch(output, /&amp;|the\\-dredge|10\\\./);
  const data = snapshot(save);
  data.perks = [{ id: 'test', name: 'A | [B] <script> & C 10.1-2', tier: 1 }];
  const escaped = formatCharacterExport(data, 'md');
  assert.ok(escaped.includes('A \\| \\[B\\] \\<script\\> & C 10.1-2'));
});

test('CSV round-trips quotes, commas and multiline notes while neutralizing formulas', () => {
  for (const note of ['=HYPERLINK("evil","name")', '+SUM(1,2)', '-1+2', '@SUM(1)', '\t=1+1', ' \r\n=1+1', '\uFEFF=1+1', 'Crows, "many"\nnext line']) {
    const save = dredgeExportFixture(); save.characters['the-dredge'].notes = note;
    const rows = csvRecords(formatCharacterExport(snapshot(save), 'csv'));
    const cell = rows.find(row => row[0] === 'Notes')[2];
    assert.equal(cell, note.startsWith('Crows') ? note : "'" + note);
    assert.ok(rows.every(row => row.length === 6));
  }
});

test('only populated planning/notes fields are emitted; zero quantities and whitespace-only notes disappear', () => {
  const save = freshSave();
  save.characters['the-dredge'].notes = ' \n\t';
  save.characters['the-dredge'].inventory.addons['killer-addon-dredge-caffeine-tablets'] = 0;
  save.planning.playingQueues.killer.push({ characterId: 'the-trapper' }, { characterId: 'the-dredge' });
  const data = snapshot(save);
  assert.deepEqual(data.planning, { playing: { position: 2 } });
  assert.deepEqual(data.inventory.addons, []);
  assert.ok(!Object.hasOwn(data, 'notes'));
  for (const format of formats) assert.doesNotMatch(formatCharacterExport(data, format), /null|unavailable|Not recorded|caffeine|targetPrestige|upNext/);
});

test('all entry ordering and safe filenames remain deterministic', () => {
  const save = dredgeExportFixture(), first = snapshot(save), progress = save.characters['the-dredge'];
  progress.perks = Object.fromEntries(Object.entries(progress.perks).reverse());
  progress.inventory.addons = Object.fromEntries(Object.entries(progress.inventory.addons).reverse());
  for (const format of formats) {
    assert.equal(formatCharacterExport(first, format), formatCharacterExport(snapshot(save), format));
    assert.equal(characterExportFilename(first, format), `the-dredge-character-2026-11-08.${format}`);
  }
  const unsafe = { ...first, character: { ...first.character, id: '../../CON:<bad>|"' } };
  assert.match(characterExportFilename(unsafe, 'json'), /^[a-z0-9-]+-character-2026-11-08\.json$/);
});

test('export module uses no account-calculation or server dependencies; browser bundle excludes secrets/APIs', async () => {
  const exporter = await build({ entryPoints: ['src/character-export.js'], bundle: true, write: false, metafile: true });
  assert.ok(Object.keys(exporter.metafile.inputs).every(path => !/src\/model.js|node_modules|src\/auth\//.test(path)));
  const browser = await build({ entryPoints: ['src/app.js'], bundle: true, write: false, metafile: true, minify: true,
    define: { __LEDGER_GOOGLE_CONFIG__: '{}', __LEDGER_ACCOUNT_ENABLED__: 'false' } });
  assert.ok(Object.keys(browser.metafile.inputs).every(path => !/node_modules|src\/auth\//.test(path)));
  assert.doesNotMatch(browser.outputFiles[0].text, /DATABASE_URL|BETTER_AUTH_SECRET|MAILTRAP_|postgres(?:ql)?:\/\/|\/api\/(?:auth|ledger)\//);
});
