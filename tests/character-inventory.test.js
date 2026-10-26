import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characterById, perkById } from '../data/catalog.js';
import {
  freshSave, inventoryTier, automaticTier, recordedTier, globalTier, parseSave,
  setHistoricalPerkTier,
} from '../src/model.js';
import {
  CHARACTER_INVENTORY_CATEGORIES,
  CHARACTER_CARD_SIZES,
  DEFAULT_CHARACTER_CARD_SIZE,
  normalizeCharacterCardSize,
  characterInventoryCandidateInfo,
  characterInventoryCandidatePool,
  filterCharacterInventoryCandidates,
  characterNormalInventory,
  setCharacterPersonalTier,
  createCharacterInventorySession,
  syncCharacterInventorySession,
  markCharacterInventoryChanged,
  parseCharacterInventoryRoute,
} from '../src/character-inventory.js';

const perk = id => perkById[id];
const ids = rows => rows.map(row => row.perk.id);
const entry = (save, characterId, id) => characterInventoryCandidateInfo(save, characterId, perk(id));

test('candidate pool uses the relevant union once and applies Personal, General, Unlocked precedence', () => {
  const save = freshSave();
  save.perkOverrides['overcharge'] = { shrineTier: 1 };
  save.characters['the-wraith'].prestige = 1;
  save.characters['the-doctor'].perks['shadowborn'] = 2;

  const rows = characterInventoryCandidatePool(save, 'the-doctor');
  const rowIds = ids(rows);

  assert.equal(new Set(rowIds).size, rowIds.length);
  assert.deepEqual(CHARACTER_INVENTORY_CATEGORIES, ['all', 'personal', 'general', 'unlocked', 'retained']);
  assert.equal(entry(save, 'the-doctor', 'monitor-abuse').primaryCategory, 'personal');
  assert.equal(entry(save, 'the-doctor', 'overcharge').primaryCategory, 'personal');
  assert.ok(entry(save, 'the-doctor', 'overcharge').unlockReasons.includes('Shrine'));
  assert.equal(entry(save, 'the-doctor', 'bitter-murmur').primaryCategory, 'general');
  assert.equal(entry(save, 'the-doctor', 'shadowborn').primaryCategory, 'unlocked');
  assert.ok(rowIds.includes('shadowborn'));
});

test('approved Doctor and Cenobite fixture audits keep exact category counts', () => {
  const save = parseSave(readFileSync(new URL('./fixtures/character-inventory-audit.json', import.meta.url), 'utf8')).save;
  const expected = {
    'the-doctor': { total: 24, personal: 3, general: 19, unlocked: 2, retained: 0 },
    'the-cenobite': { total: 22, personal: 3, general: 16, unlocked: 3, retained: 0 },
  };
  for (const [characterId, counts] of Object.entries(expected)) {
    const rows = characterInventoryCandidatePool(save, characterId);
    assert.equal(rows.length, counts.total, characterId);
    for (const category of ['personal', 'general', 'unlocked', 'retained']) {
      assert.equal(rows.filter(row => row.primaryCategory === category).length, counts[category], `${characterId} ${category}`);
    }
  }
});

test('native perks remain Personal when the catalog also marks them General', () => {
  const save = freshSave();

  for (const id of characterById['the-cenobite'].nativePerkIds) {
    const info = entry(save, 'the-cenobite', id);
    assert.equal(perk(id).general, true);
    assert.equal(info.primaryCategory, 'personal');
    assert.ok(info.reasons.includes('personal'));
    assert.ok(info.reasons.includes('general'));
  }
});

test('Survivor candidates stay role-scoped, preserve Kate native perks, and protect account floors', () => {
  const save = freshSave();
  save.characters['kate-denson'].prestige = 1;
  save.characters['the-doctor'].prestige = 3;
  save.characters['kate-denson'].perks['dark-sense'] = 2;
  save.perkOverrides['boil-over'] = { shrineTier: 1 };

  const rows = characterInventoryCandidatePool(save, 'kate-denson');
  const personal = rows.filter(row => row.primaryCategory === 'personal');
  const general = rows.filter(row => row.primaryCategory === 'general');
  const rowIds = ids(rows);

  assert.equal(new Set(rowIds).size, rowIds.length);
  assert.equal(rows.every(row => row.perk.role === 'survivor'), true);
  assert.equal(rowIds.includes('monitor-abuse'), false);
  assert.deepEqual(personal.map(row => row.perk.id).sort(), characterById['kate-denson'].nativePerkIds.sort());
  assert.equal(personal.length, 3);
  assert.ok(general.some(row => row.perk.id === 'dark-sense'));

  const nativeShrine = entry(save, 'kate-denson', 'boil-over');
  assert.equal(nativeShrine.primaryCategory, 'personal');
  assert.equal(rows.filter(row => row.perk.id === 'boil-over').length, 1);
  assert.ok(nativeShrine.unlockReasons.includes('Prestige'));
  assert.ok(nativeShrine.unlockReasons.includes('Shrine'));

  const inventory = characterNormalInventory(save, 'kate-denson');
  assert.ok(ids(inventory).includes('dark-sense'));
  assert.ok(characterById['kate-denson'].nativePerkIds.every(id => ids(inventory).includes(id)));

  save.characters['claudette-morel'].prestige = 2;
  assert.equal(automaticTier(save, 'kate-denson', perk('self-care')), 2);
  assert.throws(() => setCharacterPersonalTier(save, 'kate-denson', 'self-care', 1), /automatic minimum/i);
  setCharacterPersonalTier(save, 'kate-denson', 'self-care', 3);
  setCharacterPersonalTier(save, 'kate-denson', 'self-care', null);
  assert.equal(recordedTier(save, 'kate-denson', 'self-care'), 0);
  assert.equal(inventoryTier(save, 'kate-denson', 'self-care'), 2);
});

test('General candidates include source-less perks and acquired General records', () => {
  const save = freshSave();
  save.characters['the-doctor'].perks['bitter-murmur'] = 2;

  const info = entry(save, 'the-doctor', 'bitter-murmur');
  assert.equal(perk('bitter-murmur').sourceCharacterId, null);
  assert.equal(info.primaryCategory, 'general');
  assert.ok(info.reasons.includes('general'));
  assert.ok(info.reasons.includes('tracked'));
  assert.equal(info.effectiveTier, 2);
});

test('source ownership alone is not an account unlock, while recorded Prestige is', () => {
  const save = freshSave();
  save.characters['the-wraith'].owned = true;
  assert.equal(globalTier(save, perk('shadowborn')), 0);
  assert.equal(entry(save, 'the-doctor', 'shadowborn').candidate, false);

  save.characters['the-wraith'].owned = false;
  save.characters['the-wraith'].prestige = 1;
  assert.equal(globalTier(save, perk('shadowborn')), 1);
  const info = entry(save, 'the-doctor', 'shadowborn');
  assert.equal(info.primaryCategory, 'unlocked');
  assert.ok(info.unlockReasons.includes('Prestige'));
});

test('P2/P3, Shrine II/III, Legacy, and manual account unlocks expose provenance and effective floors', () => {
  const save = freshSave();
  save.characters['the-wraith'].prestige = 2;
  save.perkOverrides['hex-ruin'] = { shrineTier: 3 };
  save.perkOverrides['deadlock'] = { legacyTier: 2 };
  save.perkOverrides['unrelenting'] = { manualTier: 1 };

  assert.equal(automaticTier(save, 'the-doctor', perk('shadowborn')), 2);
  assert.equal(entry(save, 'the-doctor', 'shadowborn').effectiveTier, 2);
  assert.ok(entry(save, 'the-doctor', 'hex-ruin').unlockReasons.includes('Shrine'));
  assert.ok(entry(save, 'the-doctor', 'deadlock').unlockReasons.includes('Legacy'));
  assert.ok(entry(save, 'the-doctor', 'unrelenting').unlockReasons.includes('Other account unlock'));
});

test('tracked historical/manual copies remain in All as retained exceptions', () => {
  const save = freshSave();
  setHistoricalPerkTier(save, 'meg-thomas', 'camaraderie', 2);

  const info = entry(save, 'meg-thomas', 'camaraderie');
  assert.equal(info.candidate, true);
  assert.equal(info.primaryCategory, 'retained');
  assert.equal(info.retained, true);
  assert.ok(info.isHistorical);
  assert.equal(info.effectiveTier, 2);
  assert.ok(ids(characterInventoryCandidatePool(save, 'meg-thomas')).includes('camaraderie'));
});

test('historical explicit zero remains a recorded Browse candidate without creating an effective tier', () => {
  const save = freshSave();
  save.characters['meg-thomas'].perks['camaraderie'] = 0;
  assert.equal(entry(save, 'meg-thomas', 'camaraderie').candidate, true);
  assert.equal(entry(save, 'meg-thomas', 'camaraderie').primaryCategory, 'retained');
  assert.equal(entry(save, 'meg-thomas', 'camaraderie').effectiveTier, 0);
  assert.equal(Object.hasOwn(save.characters['meg-thomas'].perks, 'camaraderie'), true);
  assert.equal(characterInventoryCandidatePool(save, 'meg-thomas').some(row => row.perk.id === 'camaraderie'), true);
});

test('canonical licensed aliases appear once through their canonical catalog ID', () => {
  const save = freshSave();
  const rows = characterInventoryCandidatePool(save, 'laurie-strode');
  const decisive = rows.filter(row => row.perk.id === 'decisive-strike');
  assert.equal(decisive.length, 1);
  assert.equal(decisive[0].primaryCategory, 'personal');
  assert.equal(rows.some(row => row.perk.id === 'will-to-live'), false);
  assert.deepEqual(filterCharacterInventoryCandidates(save, 'laurie-strode', rows, { search: 'Will to Live' }).map(row => row.perk.id), ['decisive-strike']);
});

test('all-role browsing adds same-role acquisitions while preserving the normal candidate pool', () => {
  const save = freshSave();
  const candidates = characterInventoryCandidatePool(save, 'the-doctor');
  const expanded = characterInventoryCandidatePool(save, 'the-doctor', { allRole: true });
  assert.equal(candidates.some(row => row.perk.id === 'lightborn'), false);
  assert.equal(expanded.some(row => row.perk.id === 'lightborn'), true);
  assert.equal(expanded.every(row => row.perk.role === 'killer'), true);
  assert.ok(expanded.length > candidates.length);
});

test('Only unrecorded filters effective tier zero inside the candidate pool and sorts by display name', () => {
  const save = freshSave();
  save.characters['the-doctor'].perks['bitter-murmur'] = 1;
  const candidates = characterInventoryCandidatePool(save, 'the-doctor');
  const visible = filterCharacterInventoryCandidates(save, 'the-doctor', candidates, { onlyUnrecorded: true });

  assert.ok(visible.length > 0);
  assert.equal(visible.some(row => row.perk.id === 'bitter-murmur'), false);
  assert.equal(visible.some(row => row.primaryCategory === 'personal'), false);
  assert.deepEqual(visible.map(row => row.perk.name), [...visible].map(row => row.perk.name).sort((a, b) => a.localeCompare(b)));
  assert.equal(filterCharacterInventoryCandidates(save, 'the-doctor', candidates, { category: 'personal' }).every(row => row.primaryCategory === 'personal'), true);
});

test('browse sorting supports source and effective tier without changing recorded records', () => {
  const save = freshSave();
  save.characters['the-wraith'].prestige = 2;
  save.characters['the-doctor'].perks.shadowborn = 1;
  const candidates = characterInventoryCandidatePool(save, 'the-doctor');
  const before = structuredClone(save.characters['the-doctor'].perks);
  const bySource = filterCharacterInventoryCandidates(save, 'the-doctor', candidates, { sort: 'source' });
  assert.deepEqual(bySource.map(row => row.perk.sourceCharacterName), [...bySource].map(row => row.perk.sourceCharacterName)
    .sort((a, b) => a.localeCompare(b)));
  const byTier = filterCharacterInventoryCandidates(save, 'the-doctor', candidates, { sort: 'tier' });
  assert.deepEqual(byTier.map(row => row.effectiveTier), [...byTier].map(row => row.effectiveTier).sort((a, b) => b - a));
  assert.deepEqual(save.characters['the-doctor'].perks, before, 'Browse sorting is read-only');
});

test('explicit historical zero remains a candidate and differs from an absent record', () => {
  const save = freshSave();
  save.characters['meg-thomas'].perks.camaraderie = 0;
  const rows = characterInventoryCandidatePool(save, 'meg-thomas');
  const zero = rows.find(row => row.perk.id === 'camaraderie');
  assert.ok(zero, 'An explicit historical zero remains inspectable in Browse');
  assert.equal(zero.primaryCategory, 'retained');
  assert.equal(Object.hasOwn(save.characters['meg-thomas'].perks, 'camaraderie'), true);
  assert.equal(rows.some(row => row.perk.id === 'unbreakable'), false, 'An absent out-of-scope historical perk remains absent');
});

test('normal character inventory contains only effective tracked perks', () => {
  const save = freshSave();
  save.characters['the-doctor'].perks['shadowborn'] = 2;
  const inventory = characterNormalInventory(save, 'the-doctor');

  assert.deepEqual(ids(inventory).sort(), ['monitor-abuse', 'overcharge', 'overwhelming-presence', 'shadowborn'].sort());
  assert.equal(inventory.some(row => row.effectiveTier === 0), false);
});

test('direct personal tier selection clears records without lowering automatic minimums', () => {
  const save = freshSave();
  save.characters['the-wraith'].prestige = 2;
  save.characters['the-doctor'].perks['shadowborn'] = 3;

  setCharacterPersonalTier(save, 'the-doctor', 'shadowborn', null);
  assert.equal(recordedTier(save, 'the-doctor', 'shadowborn'), 0);
  assert.equal(inventoryTier(save, 'the-doctor', 'shadowborn'), 2);
  assert.throws(() => setCharacterPersonalTier(save, 'the-doctor', 'shadowborn', 1), /automatic minimum/i);
  setCharacterPersonalTier(save, 'the-doctor', 'shadowborn', 2);
  assert.equal(recordedTier(save, 'the-doctor', 'shadowborn'), 2);
});

test('existing historical downgrade protection remains in force', () => {
  const save = freshSave();
  setHistoricalPerkTier(save, 'meg-thomas', 'camaraderie', 3);
  assert.throws(() => setHistoricalPerkTier(save, 'meg-thomas', 'camaraderie', 1), /downgraded/i);
  assert.equal(inventoryTier(save, 'meg-thomas', 'camaraderie'), 3);
});

test('character inventory change markers persist only within the active Update route', () => {
  let session = createCharacterInventorySession('#experiment/the-doctor/update');
  session = markCharacterInventoryChanged(session, 'overcharge');
  session.quickPerkId = 'overcharge';
  assert.deepEqual([...session.changedPerkIds], ['overcharge']);

  const sameRoute = syncCharacterInventorySession(session, '#experiment/the-doctor/update');
  assert.equal(sameRoute, session);
  assert.deepEqual([...sameRoute.changedPerkIds], ['overcharge']);

  const normal = syncCharacterInventorySession(session, '#experiment/the-doctor');
  assert.notEqual(normal, session);
  assert.equal(normal.quickPerkId, null);
  assert.deepEqual([...normal.changedPerkIds], []);
  const nextCharacter = syncCharacterInventorySession(session, '#experiment/the-cenobite/update');
  assert.equal(nextCharacter.quickPerkId, null);
  assert.deepEqual([...nextCharacter.changedPerkIds], []);
});

test('character inventory route parser distinguishes normal inventory and Update routes', () => {
  assert.deepEqual(parseCharacterInventoryRoute('#experiment/the-doctor'), { characterId: 'the-doctor', mode: 'inventory', source: 'experiment', canonicalRoute: '#character/the-doctor/perks' });
  assert.deepEqual(parseCharacterInventoryRoute('#experiment/the-doctor/update'), { characterId: 'the-doctor', mode: 'update', source: 'experiment', canonicalRoute: '#character/the-doctor/perks/update' });
  assert.deepEqual(parseCharacterInventoryRoute('experiment/the-doctor/update'), { characterId: 'the-doctor', mode: 'update', source: 'experiment', canonicalRoute: '#character/the-doctor/perks/update' });
  assert.deepEqual(parseCharacterInventoryRoute('#manage/the-doctor'), { characterId: 'the-doctor', mode: 'inventory', source: 'canonical', canonicalRoute: '#character/the-doctor/perks' });
  assert.equal(parseCharacterInventoryRoute('#experiment/unknown'), null);
  assert.equal(parseCharacterInventoryRoute('#experiment/the-doctor/update/extra'), null);
});

test('production route parser reserves canonical update and legacy subroutes before broad manage handling', async () => {
  const inventoryModule = await import('../src/character-inventory.js');
  assert.equal(typeof inventoryModule.parseCharacterInventoryRoute, 'function');
  const parse = inventoryModule.parseCharacterInventoryRoute;
  assert.deepEqual(parse('#manage/kate-denson'), { characterId: 'kate-denson', mode: 'inventory', source: 'canonical', canonicalRoute: '#character/kate-denson/perks' });
  assert.deepEqual(parse('manage/kate-denson/update'), { characterId: 'kate-denson', mode: 'update', source: 'canonical', canonicalRoute: '#character/kate-denson/perks/update' });
  assert.deepEqual(parse('#manage/the-doctor/legacy'), { characterId: 'the-doctor', mode: 'legacy', source: 'canonical', canonicalRoute: '#character/the-doctor/perks/legacy' });
  assert.deepEqual(parse('#experiment/the-doctor'), { characterId: 'the-doctor', mode: 'inventory', source: 'experiment', canonicalRoute: '#character/the-doctor/perks' });
  assert.deepEqual(parse('#experiment/the-doctor/update'), { characterId: 'the-doctor', mode: 'update', source: 'experiment', canonicalRoute: '#character/the-doctor/perks/update' });
  for (const route of ['#manage/the-doctor/update/extra', '#manage/the-doctor/legacy/extra', '#experiment/the-doctor/extra', '#experiment/the-doctor/update/extra', '#manage/constructor', '#manage/unknown', '#', null, undefined]) {
    assert.equal(parse(route), null, route);
  }
});

test('character card-size preference has three values and defaults invalid input to Medium', () => {
  assert.deepEqual(CHARACTER_CARD_SIZES, ['small', 'medium', 'large']);
  assert.equal(DEFAULT_CHARACTER_CARD_SIZE, 'medium');
  assert.equal(normalizeCharacterCardSize('small'), 'small');
  assert.equal(normalizeCharacterCardSize('medium'), 'medium');
  assert.equal(normalizeCharacterCardSize('large'), 'large');
  for (const value of [undefined, null, '', 'x-large', 2, {}]) assert.equal(normalizeCharacterCardSize(value), 'medium');
});

test('character card design exposes explicit tier tokens and state classes', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /--perk-tier-none/);
  assert.match(styles, /--perk-tier-1/);
  assert.match(styles, /--perk-tier-2/);
  assert.match(styles, /--perk-tier-3/);
  assert.match(styles, /\.perk-card/);
  assert.match(styles, /\.perk-card-unrecorded/);
  assert.match(styles, /\.changed-this-update/);
  assert.match(styles, /--character-inventory-field-1:linear-gradient\(180deg,#3e8630/);
  assert.match(styles, /--character-inventory-field-2:linear-gradient\(180deg,#335682/);
  assert.match(styles, /--character-inventory-field-3:linear-gradient\(180deg,#6b337d/);
  assert.match(styles, /--character-inventory-field-none:linear-gradient\(180deg,#3b3f43/);
});

test('Update uses saved session wording and shares validated tier controls without pending actions', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /changes saved this session/);
  assert.match(source, /Saved automatically/);
  assert.doesNotMatch(source, /changes this update|Confirm Changes/);
  assert.match(source, /setCharacterPersonalTier\(next, intent\.characterId, intent\.perkId, intent\.tier\)/);
  assert.match(source, /commit\(applySelection, intent\.characterId\)/);
  const controls = source.slice(source.indexOf('function characterInventoryTierButtons'), source.indexOf('function characterInventoryEditor'));
  assert.doesNotMatch(controls, />Save<|>Confirm</);
  assert.match(controls, /!row\.isHistorical/);
  assert.match(controls, /characterInventoryTierButtons\(row, characterId\)/);
});

test('production renderer uses one neutral character-inventory implementation and scoped card preference', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/character-inventory\.js'/);
  assert.match(source, /characterInventoryCandidatePool/);
  assert.match(source, /characterInventoryCardSizeStorageKey/);
  assert.match(source, /legacyCharacterCardSizeStorageKey/);
  assert.doesNotMatch(source, /character-inventory-experiment\.js/);
  assert.doesNotMatch(source, /experimentalCandidatePool|experimentalNormalInventory/);
  assert.match(source, /function characterInventory\(/);
  assert.match(source, /function characterInventoryUpdate\(/);
  assert.match(source, /function legacyManager\(/);
});
