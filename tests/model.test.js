import test from 'node:test';
import assert from 'node:assert/strict';
import { characters, characterById, perks, perkById, perkName, perkSearchText, halloweenNames, hellraiserNames } from '../data/catalog.js';
import { freshSave, globalTier, isAvailable, parseSave, validateSave, exportSave, setGlobalPerkUnlocked, syncGlobalInventories, completeCharacterSetup, applyAccountRules, inventoryTier, automaticTier, recordedTier, bloodwebEligible, bloodwebNextTier, ownedUnlockSource, unlockSource } from '../src/model.js';
import { TrackerStorage, SAVE_KEY, BACKUP_KEY } from '../src/storage.js';
import { characterSetupView } from '../src/character-setup.js';
import { correctPersonalPerkTier } from '../src/model.js';
import * as model from '../src/model.js';
test('character setup workspace host exposes task exit instead of modal close', () => {
  const save = freshSave();
  const html = characterSetupView(save, { id: 'meg-thomas', step: 'bloodweb', bloodwebLevel: 1, perks: {}, search: '' }, { workspace: true });
  assert.ok(html.includes('data-character-setup'));
  assert.ok(html.includes('character-setup-exit'));
  assert.equal(html.includes('data-action="close"'), false);
});
import { schemaV1Fixture, oldV1VersionBoundary } from './fixtures/schema-v1.js';
import { schemaV2Fixture } from './fixtures/schema-v2.js';

function completeV2Fixture() {
  return schemaV2Fixture();
}

test('fresh saves use one empty schema-v3 planning state and no legacy queue projection', () => {
  const save = freshSave();
  assert.equal(save.schemaVersion, 3);
  assert.deepEqual(save.planning, {
    prestigeQueues: { survivor: [], killer: [] },
    playingQueues: { survivor: [], killer: [] },
    upNext: { survivor: [], killer: [] },
    unresolved: [],
  });
  assert.equal(Object.hasOwn(save, 'prestigeQueue'), false);
  assert.equal(validateSave(save).migrationRequired, false);
});

test('v2 migration splits known goals by role and preserves the unknown source record and rank', () => {
  const input = schemaV2Fixture();
  input.prestigeQueue = [
    { characterId: 'meg-thomas', targetPrestige: 9 },
    { characterId: 'the-trapper', targetPrestige: 3 },
    { characterId: 'dwight-fairfield', targetPrestige: 6 },
    { characterId: 'future-goal-only', targetPrestige: Number.MAX_SAFE_INTEGER, note: 'future metadata' },
    { characterId: 'bill-overbeck', targetPrestige: 12 },
  ];
  input.characters['meg-thomas'].owned = true;
  input.characters['meg-thomas'].prestige = 9;
  input.characters['the-trapper'].owned = false;
  const original = structuredClone(input);

  const result = validateSave(input);

  assert.equal(result.sourceSchemaVersion, 2);
  assert.equal(result.migrationRequired, true);
  assert.equal(result.save.schemaVersion, 3);
  assert.deepEqual(result.save.planning.prestigeQueues.survivor, [
    { characterId: 'meg-thomas', targetPrestige: 9 },
    { characterId: 'dwight-fairfield', targetPrestige: 6 },
    { characterId: 'bill-overbeck', targetPrestige: 12 },
  ]);
  assert.deepEqual(result.save.planning.prestigeQueues.killer, [
    { characterId: 'the-trapper', targetPrestige: 3 },
  ]);
  assert.deepEqual(result.save.planning.unresolved, [{
    queue: 'prestige', role: null, rank: 3,
    record: { characterId: 'future-goal-only', targetPrestige: Number.MAX_SAFE_INTEGER, note: 'future metadata' },
  }]);
  assert.deepEqual(result.save.planning.playingQueues, { survivor: [], killer: [] });
  assert.deepEqual(result.save.planning.upNext, { survivor: [], killer: [] });
  assert.equal(result.save.planning.prestigeQueues.survivor[0].targetPrestige, 9,
    'completed goals remain stored instead of being removed');
  assert.equal(result.save.planning.prestigeQueues.killer[0].targetPrestige, 3,
    'unowned goals remain stored instead of being removed');
  assert.equal(Object.hasOwn(result.save, 'prestigeQueue'), false);
  assert.deepEqual(input, original);
});

test('v3 accepts direct explicit pins and rejects malformed declared planning state', () => {
  const input = schemaV2Fixture();
  delete input.prestigeQueue;
  input.schemaVersion = 3;
  input.planning = {
    prestigeQueues: { survivor: [], killer: [] },
    playingQueues: { survivor: [], killer: [] },
    upNext: { survivor: [{ characterId: 'meg-thomas', intent: 'play' }], killer: [] },
    unresolved: [],
  };
  const parsed = validateSave(input);
  assert.deepEqual(parsed.save.planning.upNext.survivor, input.planning.upNext.survivor);
  assert.deepEqual(parsed.save.planning.playingQueues.survivor, []);
  assert.equal(parsed.migrationRequired, false);
  assert.throws(() => validateSave({ ...input, prestigeQueue: [] }), /legacy|prestigeQueue|planning/i);

  for (const mutate of [
    value => { delete value.planning; },
    value => { value.planning.upNext.survivor[0].intent = 'favorite'; },
    value => { value.planning.prestigeQueues.survivor.push({ characterId: 'the-trapper', targetPrestige: 4 }); },
    value => { value.planning.playingQueues.survivor.push({ characterId: 'meg-thomas' }, { characterId: 'meg-thomas' }); },
    value => { value.planning.upNext.survivor = Array.from({ length: 6 }, (_, index) => ({ characterId: ['meg-thomas', 'dwight-fairfield', 'jake-park', 'claudette-morel', 'nea-karlsson', 'bill-overbeck'][index], intent: 'play' })); },
  ]) {
    const invalid = structuredClone(input);
    mutate(invalid);
    assert.throws(() => validateSave(invalid), /planning|queue|pin|intent|role/i);
  }
});

test('schema v3 preserves unknown planning records with source role/rank through export and re-import', () => {
  const save = freshSave();
  save.planning.playingQueues.survivor = [{ characterId: 'future-survivor', futureField: { keep: true } }];
  save.planning.upNext.killer = [{ characterId: 'future-killer', intent: 'play', note: 'kept' }];
  save.planning.unresolved.push({ queue: 'unknown', role: null, rank: 7, record: { futureQueue: [1, 2] } });
  const canonical = validateSave(save).save;
  const imported = parseSave(exportSave(canonical));
  assert.deepEqual(imported.save, canonical);
  assert.deepEqual(imported.save.planning.playingQueues.survivor, []);
  assert.deepEqual(imported.save.planning.upNext.killer, []);
  assert.deepEqual(imported.save.planning.unresolved.slice(-2), [
    { queue: 'playing', role: 'survivor', rank: 0, record: save.planning.playingQueues.survivor[0] },
    { queue: 'upNext', role: 'killer', rank: 0, record: save.planning.upNext.killer[0] },
  ]);
  assert.equal(imported.migrationRequired, false);
});

test('complete v2 validation preserves quantities historical zero and queue without mutating input', () => {
  const input = completeV2Fixture();
  input.characters['meg-thomas'].perks.camaraderie = 0;
  input.characters['meg-thomas'].inventory.items = {
    'survivor-item-test-future': 12, 'survivor-item-test-zero': 0,
  };
  input.prestigeQueue = [{ characterId: 'future-goal-only', targetPrestige: 1 }];
  input.characters['future-record'] = { ...input.characters['meg-thomas'], inventory: { items: {}, addons: {} } };
  const before = structuredClone(input);
  const { save, warnings } = model.validateCompleteV2(input);
  assert.equal(save.schemaVersion, 2);
  assert.deepEqual(save.characters['meg-thomas'].inventory.items, { 'survivor-item-test-future': 12 });
  assert.equal(save.characters['meg-thomas'].perks.camaraderie, 0);
  assert.deepEqual(save.prestigeQueue, input.prestigeQueue);
  assert.equal(Object.hasOwn(save.characters, 'future-goal-only'), false);
  assert.ok(save.characters['future-record']);
  assert.ok(warnings.some(w => w.includes('survivor-item-test-future')));
  assert.deepEqual(input, before);
});

test('complete v2 requires queue and inventory maps on supplied records', () => {
  for (const mutate of [
    s => { delete s.prestigeQueue; },
    s => { delete s.characters['meg-thomas'].inventory; },
    s => { delete s.characters['meg-thomas'].inventory.items; },
    s => { s.characters['meg-thomas'].inventory.addons = []; },
    s => { s.characters['meg-thomas'].inventory.items['survivor-item-test-future'] = '2'; },
    s => { s.characters['meg-thomas'].inventory.addons['killer-addon-test-future'] = 2; },
  ]) {
    const input = completeV2Fixture();
    mutate(input);
    assert.throws(() => model.validateCompleteV2(input), /queue|inventory|quantity|role/i);
  }
});

test('complete v2 omitted catalog characters get fresh inventory defaults', () => {
  const input = completeV2Fixture();
  delete input.characters['meg-thomas'];
  const { save } = model.validateCompleteV2(input);
  assert.deepEqual(save.characters['meg-thomas'].inventory, { items: {}, addons: {} });
  assert.equal(save.characters['meg-thomas'].updatedAt, null);
});

test('complete v2 known catalog quantities reject wrong map role and Killer owner', () => {
  const id = 'killer-addon-the-doctor-test-only';
  const inventoryCatalog = { [id]: { id, kind: 'killer-addon', role: 'killer', map: 'addons', characterId: 'the-doctor' } };
  const input = completeV2Fixture();
  input.characters['the-trapper'].inventory.addons[id] = 2;
  assert.throws(() => model.validateCompleteV2(input, { inventoryCatalog }), /owner/);
  input.characters['the-trapper'].inventory.addons = {};
  input.characters['the-doctor'].inventory.items[id] = 0;
  assert.throws(() => model.validateCompleteV2(input, { inventoryCatalog }), /map/);
});

test('real Killer Add-on saves preserve schema v2 quantity and reject a known wrong owner', () => {
  const id='killer-addon-trapper-bear-oil', input=completeV2Fixture();
  input.characters['the-trapper'].inventory.addons[id]=4;
  const {save,warnings}=model.validateCompleteV2(input);
  assert.equal(save.schemaVersion,2);
  assert.deepEqual(save.characters['the-trapper'].inventory.addons,{[id]:4});
  assert.equal(warnings.some(w=>w.includes(id)),false);
  assert.equal(parseSave(exportSave(save)).save.characters['the-trapper'].inventory.addons[id],4);
  input.characters['the-doctor'].inventory.addons[id]=4;
  assert.throws(()=>model.validateCompleteV2(input),/owner/);
});

test('complete v2 validator rejects other versions while runtime version is schema v3', () => {
  assert.equal(model.SCHEMA_VERSION, 3);
  assert.throws(() => model.validateCompleteV2(schemaV1Fixture()), /schema/i);
  const input = completeV2Fixture();
  input.schemaVersion = 3;
  assert.throws(() => model.validateCompleteV2(input), /schema/i);
});

test('v1 migrates structurally with explicit metadata and unchanged supported state', () => {
  const input = schemaV1Fixture();
  Object.assign(input.characters['meg-thomas'], { owned: true, prestige: 8, bloodwebLevel: 43,
    favorite: true, notes: 'Keep this', setupComplete: true, updatedAt: 'Oct 1 2026 12:30:00 GMT-0400',
    perks: { camaraderie: 0, 'future-perk': 2 } });
  input.characters['future-character'] = structuredClone(input.characters['meg-thomas']);
  input.perkOverrides.kindred = { shrineTier: 1, manualTier: 2, legacyTier: 3 };
  const before = structuredClone(input);
  const result = parseSave(JSON.stringify(input));
  assert.equal(result.sourceSchemaVersion, 1);
  assert.equal(result.migrationRequired, true);
  assert.deepEqual(result.predecessor, before);
  assert.equal(result.save.schemaVersion, 3);
  assert.deepEqual(result.save.planning, {
    prestigeQueues: { survivor: [], killer: [] },
    playingQueues: { survivor: [], killer: [] },
    upNext: { survivor: [], killer: [] },
    unresolved: [],
  });
  for (const [id, progress] of Object.entries(result.save.characters)) {
    const { inventory, ...existing } = progress;
    assert.deepEqual(inventory, { items: {}, addons: {} });
    assert.deepEqual(existing, before.characters[id]);
  }
  assert.equal(result.save.updatedAt, before.updatedAt);
  assert.deepEqual(result.save.perkOverrides, before.perkOverrides);
  assert.deepEqual(input, before);
  assert.throws(() => oldV1VersionBoundary(result.save), /Unsupported/);
});

test('parse and normal save remain separate from account normalization after migration', () => {
  const input = schemaV1Fixture();
  delete input.accountRulesVersion;
  input.settings.halloweenNames = 'generic';
  input.perkOverrides.kindred = { shrineTier: 2 };
  const parsed = validateSave(input);
  assert.equal(parsed.save.accountRulesVersion, undefined);
  assert.equal(parsed.save.settings.halloweenNames, 'generic');
  assert.deepEqual(parsed.save.perkOverrides.kindred, { shrineTier: 2 });
  const current = validateSave(parsed.save);
  assert.equal(current.sourceSchemaVersion, 3);
  assert.equal(current.migrationRequired, false);
  assert.equal(current.predecessor, null);
  assert.deepEqual(current.save, parsed.save);
  assert.equal(Object.hasOwn(current.save, 'migrationRequired'), false);
});

test('personal corrections lower or remove records while preserving automatic tiers and other characters', () => {
  const save = freshSave();
  save.characters['meg-thomas'].perks.kindred = 3;
  save.characters['dwight-fairfield'].perks.kindred = 2;
  correctPersonalPerkTier(save, 'meg-thomas', 'kindred', 1);
  assert.equal(inventoryTier(save, 'meg-thomas', 'kindred'), 1);
  correctPersonalPerkTier(save, 'meg-thomas', 'kindred', null);
  assert.equal(Object.hasOwn(save.characters['meg-thomas'].perks, 'kindred'), false);
  assert.equal(inventoryTier(save, 'meg-thomas', 'kindred'), 0);
  assert.equal(save.characters['dwight-fairfield'].perks.kindred, 2);
  save.characters['meg-thomas'].perks['sprint-burst'] = 3;
  correctPersonalPerkTier(save, 'meg-thomas', 'sprint-burst', null);
  assert.equal(inventoryTier(save, 'meg-thomas', 'sprint-burst'), 1);
  save.perkOverrides.kindred = { shrineTier: 2 };
  correctPersonalPerkTier(save, 'meg-thomas', 'kindred', 1);
  assert.equal(inventoryTier(save, 'meg-thomas', 'kindred'), 2);
  assert.equal(save.perkOverrides.kindred.shrineTier, 2);
  save.characters['meg-thomas'].perks['borrowed-time'] = 3;
  correctPersonalPerkTier(save, 'meg-thomas', 'borrowed-time', 1);
  correctPersonalPerkTier(save, 'meg-thomas', 'borrowed-time', null);
  assert.equal(Object.hasOwn(parseSave(exportSave(save)).save.characters['meg-thomas'].perks, 'borrowed-time'), false);
  for (const tier of [0, -1, 4, 1.5, '2']) assert.throws(() => correctPersonalPerkTier(save, 'meg-thomas', 'kindred', tier));
  assert.throws(() => correctPersonalPerkTier(save, 'meg-thomas', 'surge', 1));
});

test('account unlock sources edit independently, preserve Prestige and Legacy, and validate through the existing save shape', () => {
  const save = freshSave();
  const perk = perkById.overcharge;
  save.characters['the-doctor'].prestige = 2;
  save.perkOverrides[perk.id] = { shrineTier: 1, legacyTier: 3, manualTier: 2 };

  assert.equal(globalTier(save, perk), 3);
  save.perkOverrides[perk.id].shrineTier = 0;
  assert.equal(globalTier(save, perk), 3);
  save.perkOverrides[perk.id].manualTier = 0;
  assert.equal(globalTier(save, perk), 3);
  save.perkOverrides[perk.id].legacyTier = 0;
  assert.equal(globalTier(save, perk), 2, 'Prestige remains after account unlock sources are cleared');
  save.characters['the-doctor'].prestige = 0;
  assert.equal(globalTier(save, perk), 0);

  const roundTrip = parseSave(exportSave(save)).save;
  assert.deepEqual(roundTrip.perkOverrides[perk.id], { shrineTier: 0, legacyTier: 0, manualTier: 0 });
  assert.equal(inventoryTier(roundTrip, 'meg-thomas', perk.id), 0, 'Survivor inventory cannot inherit a Killer perk');
  assert.equal(inventoryTier(roundTrip, 'the-doctor', 'bond'), 0, 'Killer inventory cannot inherit a Survivor perk');
});

const windows = perkById['windows-of-opportunity'];
test('setup global selections preserve automatic unlocks and higher manual tiers without filling inventories', () => {
  const save = freshSave();
  setGlobalPerkUnlocked(save, windows, true);
  assert.equal(globalTier(save, windows), 1);
  save.perkOverrides[windows.id].manualTier = 3;
  setGlobalPerkUnlocked(save, windows, true);
  assert.equal(globalTier(save, windows), 3);
  setGlobalPerkUnlocked(save, windows, false);
  assert.equal(globalTier(save, windows), 0);
  save.characters['kate-denson'].prestige = 1;
  setGlobalPerkUnlocked(save, windows, false);
  assert.equal(globalTier(save, windows), 1);
  setGlobalPerkUnlocked(save, perkById.kindred, false);
  assert.equal(isAvailable(save, perkById.kindred), true);
  assert.equal(save.perkOverrides.kindred, undefined);
  for (const c of Object.values(save.characters)) assert.deepEqual(c.perks, {});
});
test('setup completion persists in exports and old saves with progress skip first-run setup', () => {
  const save = freshSave();
  assert.equal(save.setupComplete, false);
  save.setupComplete = true;
  assert.equal(parseSave(exportSave(save)).save.setupComplete, true);
  delete save.setupComplete;
  assert.equal(validateSave(save).save.setupComplete, false);
  save.characters['the-artist'].prestige = 1;
  assert.equal(validateSave(save).save.setupComplete, true);
  save.setupComplete = false;
  assert.equal(validateSave(save).save.setupComplete, false);
  save.setupComplete = 'yes';
  assert.throws(() => validateSave(save), /Setup completion/);
});
const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
test('catalog IDs are unique and native relationships resolve to the correct role', () => {
  assert.equal(new Set(characters.map(c => c.id)).size, characters.length);
  assert.equal(new Set(perks.map(p => p.id)).size, perks.length);
  for (const c of characters) {
    assert.equal(c.nativePerkIds.length, 3);
    for (const id of c.nativePerkIds) {
      assert.equal(perkById[id].sourceCharacterId, c.id);
      assert.equal(perkById[id].role, c.role);
    }
  }
});
test('JSON catalog includes all supplied perks and preserves IDs for existing saves', () => {
  assert.equal(perks.filter(p => p.role === 'survivor').length, 176);
  assert.equal(perks.filter(p => p.role === 'killer').length, 145);
  assert.equal(characters.filter(c => c.role === 'survivor').length, 54);
  assert.equal(characters.filter(c => c.role === 'killer').length, 44);
  assert.equal(characterById['bill-overbeck'].name, 'William "Bill" Overbeck');
  assert.equal(characterById['yun-jin-lee'].name, 'Lee Yun-Jin');
  assert.equal(characterById['aestri-yazar'].name, 'Aestri Yazar & Baermar Uraz');
  assert.equal(perkById['bardic-inspiration'].sourceCharacterName, 'Aestri Yazar & Baermar Uraz');
  assert.equal(perkById['borrowed-time'].sourceCharacterName, 'William "Bill" Overbeck');
  assert.equal(perkById['fast-track'].sourceCharacterName, 'Lee Yun-Jin');
  assert.equal(perkById['barbecue-chilli'].name, 'Barbecue & Chilli');
  assert.equal(perkById['monitor-abuse'].name, 'Monitor & Abuse');
  assert.equal(perkById['sole-survivor'].name, 'Down to the Last');
  assert.equal(perkById['object-of-obsession'].name, 'Bound by Obsession');
  assert.equal(perkById['decisive-strike'].name, 'Will to Live');
  assert.equal(perkById['decisive-strike'].general, true);
  const save = freshSave();
  save.characters['bill-overbeck'].prestige = 3;
  save.characters['yun-jin-lee'].owned = true;
  save.characters['laurie-strode'].perks['decisive-strike'] = 3;
  save.characters['the-cannibal'].perks['barbecue-chilli'] = 2;
  const imported = parseSave(exportSave(save));
  assert.deepEqual(imported.warnings, []);
  assert.deepEqual(imported.save, save);
  assert.equal(globalTier(imported.save, perkById['borrowed-time']), 3);
  const legacyIds = ['bill-overbeck', 'yun-jin-lee', 'laurie-strode', 'the-cannibal'];
  const historical = { ...save, characters: Object.fromEntries(legacyIds.map(id => [id, save.characters[id]])) };
  const expanded = parseSave(exportSave(historical));
  assert.deepEqual(expanded.warnings, []);
  assert.equal(Object.keys(expanded.save.characters).length, 98);
  for (const id of legacyIds) assert.deepEqual(expanded.save.characters[id], historical.characters[id]);
  assert.equal(expanded.save.characters['the-krasue'].prestige, 0);
});
test('prestige 0, 1, 2, 3, 12 grants global 0, 1, 2, 3, 3 without changing inventories', () => {
  const save = freshSave();
  for (const [prestige, expected] of [[0,0],[1,1],[2,2],[3,3],[12,3]]) {
    save.characters['kate-denson'].prestige = prestige;
    assert.equal(globalTier(save, windows), expected);
    assert.deepEqual(save.characters['meg-thomas'].perks, {});
  }
});
test('Shrine and prestige use maximum; locked sources retain derived unlocks', () => {
  const save = freshSave();
  save.characters['kate-denson'].prestige = 1;
  save.perkOverrides[windows.id] = { shrineTier: 3 };
  assert.equal(globalTier(save, windows), 3);
  save.characters['kate-denson'].prestige = 3;
  save.perkOverrides[windows.id].shrineTier = 1;
  assert.equal(globalTier(save, windows), 3);
  assert.equal(save.characters['kate-denson'].owned, false);
});
test('general availability does not grant a personal inventory unlock', () => {
  const save = freshSave(), kindred = perkById.kindred;
  assert.equal(isAvailable(save, kindred), true);
  assert.equal(globalTier(save, kindred), 0);
  assert.equal(save.characters['meg-thomas'].perks.kindred, undefined);
});
test('export/import round trip retains all progression, notes, overrides, and timestamps', () => {
  const save = freshSave();
  Object.assign(save.characters['kate-denson'], { prestige: 1234, bloodwebLevel: 50, owned: true, favorite: true, notes: '★ café <script>', updatedAt: new Date().toISOString(), perks: { [windows.id]: 3 } });
  save.perkOverrides[windows.id] = { shrineTier: 2 };
  assert.deepEqual(parseSave(exportSave(save)).save, save);
  save.characters['kate-denson'].owned = false;
  assert.deepEqual(parseSave(exportSave(save)).save.characters['kate-denson'].perks, { [windows.id]: 3 });
});
test('validation rejects malformed JSON, schema, structure, unsafe keys, invalid ranges and roles', () => {
  assert.throws(() => parseSave('{'), /valid JSON/);
  assert.throws(() => parseSave('{}'), /DBD Tracker export/);
  assert.throws(() => validateSave({ schemaVersion: 4 }), /Unsupported schema/);
  for (const value of [null, [], 'wrong']) { const save = freshSave(); save.characters = value; assert.throws(() => validateSave(save)); }
  for (const [field, bad] of [['prestige',-1], ['prestige',1.5], ['bloodwebLevel',0], ['bloodwebLevel',51], ['owned','yes'], ['favorite',1], ['notes',{}], ['updatedAt','nonsense']]) {
    const save = freshSave(); save.characters['kate-denson'][field] = bad; assert.throws(() => validateSave(save));
  }
  for (const tier of [-1,4,1.5,'3']) {
    const save = freshSave(); save.characters['kate-denson'].perks[windows.id] = tier; assert.throws(() => validateSave(save));
    save.characters['kate-denson'].perks = {}; save.perkOverrides[windows.id] = { shrineTier: tier }; assert.throws(() => validateSave(save));
  }
  const save = freshSave(); save.characters['kate-denson'].perks.agitation = 1; assert.throws(() => validateSave(save), /wrong role/);
  assert.throws(() => parseSave('{"schemaVersion":1,"updatedAt":"2026-10-05T00:00:00Z","characters":{"__proto__":{}},"perkOverrides":{}}'), /Invalid character/);
});
test('unknown character, inventory, and Shrine IDs are reported and preserved across exports', () => {
  const save = freshSave();
  save.characters['future-character'] = { ...save.characters['kate-denson'], perks: { 'future-perk': 2 } };
  save.characters['kate-denson'].perks['unknown-perk'] = 3;
  save.perkOverrides['future-perk'] = { shrineTier: 1 };
  const imported = parseSave(exportSave(save));
  assert.equal(imported.warnings.length, 4);
  assert.deepEqual(imported.save, save);
  assert.deepEqual(parseSave(exportSave(imported.save)).save, save);
});
test('new catalog records get defaults when reading a partial historical save', () => {
  const save = freshSave(); delete save.characters['kate-denson'];
  assert.equal(validateSave(save).save.characters['kate-denson'].bloodwebLevel, 1);
});
test('backup before replacement, five-snapshot limit, restore, delete and reset preservation', () => {
  const store = new TrackerStorage(memoryStorage(), () => {});
  let save = freshSave(); save.characters['kate-denson'].prestige = 12; store.save(save);
  const reset = store.replace(save, freshSave(), 'Before reset');
  assert.equal(store.load().save.characters['kate-denson'].prestige, 0);
  assert.equal(Object.keys(reset.characters).length, characters.length);
  assert.equal(characterById['kate-denson'].nativePerkIds.length, 3);
  save = store.replace(reset, store.backups()[0].save, 'Before restore');
  assert.equal(save.characters['kate-denson'].prestige, 12);
  for (let n=0;n<6;n++) store.backup(save, 'Before import');
  assert.equal(store.backups().length, 5);
  const first = store.backups()[0]; store.deleteBackup(first.id);
  assert.equal(store.backups().length, 4);
});
test('invalid import and backup write failures leave existing save untouched', () => {
  const memory = memoryStorage(), store = new TrackerStorage(memory, () => {}), save = freshSave();
  store.save(save);
  assert.throws(() => store.replace(save, { schemaVersion: 8 }, 'import'));
  assert.equal(store.backups().length, 0);
  const failing = new TrackerStorage({ getItem: key => memory.getItem(key), setItem: (key,value) => { if(key===BACKUP_KEY) throw Error('Quota exceeded'); memory.setItem(key,value); } }, () => {});
  assert.throws(() => failing.replace(save, freshSave(), 'reset'), /Quota exceeded/);
  assert.deepEqual(JSON.parse(memory.getItem(SAVE_KEY)), save);
});
test('unreadable persisted data is not silently reset', () => {
  const memory = memoryStorage(), store = new TrackerStorage(memory, () => {});
  memory.setItem(SAVE_KEY, '{broken');
  assert.throws(() => store.load(), /valid JSON/);
  assert.equal(memory.getItem(SAVE_KEY), '{broken');
});

test('global availability and alias synchronization never fill character inventories', () => {
  const save = freshSave();
  save.characters['kate-denson'].prestige = 2;
  save.characters['meg-thomas'].perks[windows.id] = 3;
  save.perkOverrides.agitation = { shrineTier: 3 };
  syncGlobalInventories(save);
  for (const c of characters) {
    if (c.role === 'survivor') {
      assert.equal(save.characters[c.id].perks[windows.id], c.id === 'meg-thomas' ? 3 : undefined);
      assert.equal(save.characters[c.id].perks.kindred, undefined);
      assert.equal(save.characters[c.id].perks.agitation, undefined);
    } else {
      assert.equal(save.characters[c.id].perks.agitation, undefined);
      assert.equal(save.characters[c.id].perks.kindred, undefined);
    }
  }
  const before = structuredClone(save);
  syncGlobalInventories(save);
  assert.deepEqual(save, before);
  save.characters['kate-denson'].prestige = 0;
  syncGlobalInventories(save);
  assert.equal(save.characters['jake-park'].perks[windows.id], undefined);
});
test('Halloween aliases merge higher inventory and global tiers and preserve native Prestige', () => {
  const save = freshSave();
  save.characters['the-trapper'].perks['save-the-best-for-last'] = 2;
  save.characters['the-trapper'].perks['keep-them-waiting'] = 3;
  save.perkOverrides['see-how-they-run'] = { shrineTier: 2 };
  save.characters['laurie-strode'].prestige = 3;
  const parsed = parseSave(exportSave(save));
  assert.deepEqual(parsed.warnings, []);
  syncGlobalInventories(parsed.save);
  assert.equal(parsed.save.characters['the-trapper'].perks['save-the-best-for-last'], 3);
  assert.equal(parsed.save.characters['the-trapper'].perks['keep-them-waiting'], undefined);
  assert.equal(globalTier(parsed.save, perkById['play-with-your-food']), 2);
  assert.equal(globalTier(parsed.save, perkById['decisive-strike']), 3);
  assert.deepEqual(parsed.save.characters['meg-thomas'].perks, {});
  assert.equal(perks.filter(p => p.id === 'save-the-best-for-last').length, 1);
});
test('Halloween settings round trip and searches include both variants', () => {
  const save = freshSave();
  save.settings.halloweenNames = 'generic';
  for (const [id, names] of Object.entries(halloweenNames)) {
    assert.equal(perkName(save, perkById[id]), names[1]);
    for (const name of names) assert.ok(perkSearchText(perkById[id]).includes(name));
  }
  save.settings.halloweenNames = 'original';
  assert.deepEqual(parseSave(exportSave(save)).save, save);
  for (const [id, names] of Object.entries(halloweenNames)) assert.equal(perkName(save, perkById[id]), names[0]);
  delete save.settings;
  assert.equal(validateSave(save).save.settings.halloweenNames, 'original');
  save.settings = { halloweenNames: 'invalid' };
  assert.throws(() => validateSave(save), /Halloween names/);
});
test('failed migration backup leaves the original save intact', () => {
  const memory = memoryStorage(), save = freshSave();
  delete save.accountRulesVersion;
  memory.setItem(SAVE_KEY, JSON.stringify(save));
  const store = new TrackerStorage({ getItem: key => memory.getItem(key), setItem: (key, value) => { if (key === BACKUP_KEY) throw Error('Quota exceeded'); memory.setItem(key, value); } }, () => {});
  assert.throws(() => store.load(), /Quota exceeded/);
  assert.equal(memory.getItem(SAVE_KEY), JSON.stringify(save));
});
test('Hellraiser names default to originals, can be changed independently and aliases retain progression', () => {
  const save = freshSave();
  for (const [id, names] of Object.entries(hellraiserNames)) {
    assert.equal(perkName(save, perkById[id]), names[0]);
    for (const name of names) assert.ok(perkSearchText(perkById[id]).includes(name.replace(/[’']/g, '')));
  }
  save.settings.hellraiserNames = 'generic';
  save.settings.halloweenNames = 'original';
  assert.equal(perkName(save, perkById.deadlock), 'No Holds Barred');
  assert.equal(perkName(save, perkById['sole-survivor']), 'Sole Survivor');
  assert.deepEqual(parseSave(exportSave(save)).save, save);
  save.characters['the-trapper'].perks['no-holds-barred'] = 3;
  save.perkOverrides['hex-fortunes-fool'] = { shrineTier: 2 };
  syncGlobalInventories(save);
  assert.equal(save.characters['the-trapper'].perks.deadlock, 3);
  assert.equal(save.characters['the-trapper'].perks['no-holds-barred'], undefined);
  assert.equal(globalTier(save, perkById['hex-plaything']), 2);
  assert.equal(save.characters['the-wraith'].perks['hex-plaything'], undefined);
  save.settings.hellraiserNames = 'invalid';
  assert.throws(() => validateSave(save), /Hellraiser names/);
});

test('character setup saves only explicit Bloodweb selections and persists completion per character', () => {
  const save = freshSave();
  save.characters['meg-thomas'].owned = true;
  save.characters['meg-thomas'].perks.kindred = 1;
  save.characters['meg-thomas'].perks['future-perk'] = 2;
  completeCharacterSetup(save, 'meg-thomas', 37, { bond: 1, adrenaline: 3 });
  assert.deepEqual(save.characters['meg-thomas'].perks, { 'future-perk': 2, kindred: 1, bond: 1, adrenaline: 3 });
  assert.equal(save.characters['meg-thomas'].bloodwebLevel, 37);
  assert.equal(save.characters['meg-thomas'].setupComplete, true);
  assert.equal(save.characters['jake-park'].setupComplete, false);
  assert.equal(parseSave(exportSave(save)).save.characters['meg-thomas'].setupComplete, true);
  assert.throws(() => completeCharacterSetup(save, 'meg-thomas', 51, {}), /Bloodweb/);
  assert.throws(() => completeCharacterSetup(save, 'meg-thomas', 1, { agitation: 1 }), /same-role/);
  assert.throws(() => completeCharacterSetup(save, 'meg-thomas', 1, { bond: 0 }), /tier/);
  assert.throws(() => completeCharacterSetup(save, 'jake-park', 1, {}), /owned/);
  const legacy = structuredClone(save);
  delete legacy.characters['meg-thomas'].setupComplete;
  assert.equal(validateSave(legacy).save.characters['meg-thomas'].setupComplete, false);
  legacy.characters['meg-thomas'].setupComplete = 'yes';
  assert.throws(() => validateSave(legacy), /character setup completion/);
});
test('import and restore retain explicit inventories without generating global unlocks', () => {
  const store = new TrackerStorage(memoryStorage(), () => {}), save = freshSave();
  save.characters['kate-denson'].prestige = 3;
  save.characters['meg-thomas'].perks.kindred = 2;
  const imported = structuredClone(save); delete imported.inventoryPolicy;
  const replaced = store.replace(freshSave(), imported, 'Before JSON import');
  assert.deepEqual(replaced.characters['meg-thomas'].perks, { kindred: 2 });
  assert.deepEqual(replaced.characters['jake-park'].perks, {});
  assert.deepEqual(store.load().save, replaced);
});
test('special setup unlocks stay personal and survive filtering, saving and reloading', () => {
  const save = freshSave();
  save.characters['claudette-morel'].owned = true;
  const draft = { id: 'claudette-morel', step: 'perks', perks: {}, search: 'Iron Will' };
  assert.ok(characterSetupView(save, draft).includes('No matching perks.'));
  draft.specialUnlocks = true;
  let view = characterSetupView(save, draft);
  assert.ok(view.includes('data-character-setup-perk="iron-will"'));
  assert.equal(view.includes(' checked'), false);
  assert.equal(view.includes('data-character-setup-perk="agitation"'), false);
  draft.perks['iron-will'] = 2;
  draft.specialUnlocks = false;
  view = characterSetupView(save, draft);
  assert.ok(view.includes('data-character-setup-perk="iron-will"'));
  assert.ok(view.includes('value="2" selected'));
  completeCharacterSetup(save, draft.id, 20, draft.perks);
  const loaded = parseSave(exportSave(save)).save;
  assert.equal(inventoryTier(loaded, draft.id, 'iron-will'), 2);
  assert.equal(globalTier(loaded, perkById['iron-will']), 0);
  assert.equal(inventoryTier(loaded, 'meg-thomas', 'iron-will'), 0);
  assert.equal(loaded.characters['bill-overbeck'].prestige, 0);
  assert.ok(characterSetupView(loaded, { ...draft, perks: {} }).includes('data-character-setup-perk="iron-will"'));
});

test('character setup offers general, Prestige, Shrine and native perks only, without preselecting them', () => {
  const save = freshSave();
  save.characters['kate-denson'].prestige = 1;
  save.perkOverrides.bond = { shrineTier: 1 };
  const offered = id => [...characterSetupView(save, { id, step: 'perks', perks: {}, search: '' }).matchAll(/data-character-setup-perk="([^"]+)"/g)].map(match => match[1]);
  const survivor = offered('meg-thomas');
  for (const id of ['kindred', 'windows-of-opportunity', 'bond', ...characterById['meg-thomas'].nativePerkIds]) assert.ok(survivor.includes(id), id);
  assert.equal(survivor.includes('iron-will'), false);
  assert.equal(survivor.includes('agitation'), false);
  const killer = offered('the-trapper');
  for (const id of characterById['the-trapper'].nativePerkIds) assert.ok(killer.includes(id), id);
  assert.equal(killer.includes('thanatophobia'), false);
  assert.equal(killer.includes('kindred'), false);
  const html = characterSetupView(save, { id: 'meg-thomas', step: 'perks', perks: {}, search: 'Iron Will' });
  assert.ok(html.includes('No matching perks.'));
  assert.equal(html.includes(' checked'), false);
});

test('every character owns its three native perks at P0 without recorded Bloodweb tiers', () => {
  const save = freshSave();
  for (const c of characters) for (const id of c.nativePerkIds) {
    assert.equal(inventoryTier(save, c.id, id), 1);
    assert.equal(ownedUnlockSource(save, c.id, perkById[id]), 'Character');
    assert.equal(bloodwebNextTier(save, c.id, perkById[id]), 2);
    assert.equal(recordedTier(save, c.id, id), 0);
  }
});
test('Prestige and account tiers derive role-specific minimums without writing personal records', () => {
  const save = freshSave();
  for (const prestige of [1, 2, 3, 12]) {
    save.characters['meg-thomas'].prestige = prestige;
    for (const c of characters) {
      assert.equal(inventoryTier(save, c.id, 'sprint-burst'), c.role === 'survivor' ? Math.min(prestige, 3) : 0);
      assert.deepEqual(save.characters[c.id].perks, {});
    }
  }
  save.characters['meg-thomas'].prestige = 1;
  save.characters['ace-visconti'].perks['sprint-burst'] = 2;
  assert.equal(inventoryTier(save, 'ace-visconti', 'sprint-burst'), 2);
  assert.equal(globalTier(save, perkById['sprint-burst']), 1);
  assert.equal(ownedUnlockSource(save, 'ace-visconti', perkById['sprint-burst']), 'Bloodweb');
  assert.equal(bloodwebNextTier(save, 'ace-visconti', perkById['sprint-burst']), 3);
});
test('general perks are eligible but unowned until personally acquired', () => {
  const save = freshSave();
  for (const id of ['deja-vu', 'kindred', 'resilience', 'dark-sense', 'hope', 'lightweight', 'premonition', 'spine-chill', 'well-make-it']) {
    const perk = perkById[id];
    assert.ok(perk, id);
    assert.equal(globalTier(save, perk), 0);
    assert.equal(unlockSource(save, perk), 'General');
    assert.equal(inventoryTier(save, 'ace-visconti', id), 0);
    assert.equal(bloodwebEligible(save, 'ace-visconti', perk), true);
    assert.equal(bloodwebNextTier(save, 'ace-visconti', perk), 1);
  }
  save.characters['ace-visconti'].perks.kindred = 2;
  assert.equal(inventoryTier(save, 'ace-visconti', 'kindred'), 2);
  assert.equal(inventoryTier(save, 'meg-thomas', 'kindred'), 0);
});
test('Legacy, Shrine and Prestige tiers use the maximum and preserve higher Bloodweb acquisitions', () => {
  const save = freshSave(), perk = perkById['calm-spirit'];
  save.characters['jake-park'].prestige = 1;
  save.perkOverrides[perk.id] = { shrineTier: 0, legacyTier: 2 };
  assert.equal(globalTier(save, perk), 2);
  assert.equal(unlockSource(save, perk), 'Legacy');
  assert.equal(inventoryTier(save, 'ace-visconti', perk.id), 2);
  assert.equal(bloodwebNextTier(save, 'ace-visconti', perk), 3);
  save.characters['ace-visconti'].perks[perk.id] = 3;
  assert.equal(inventoryTier(save, 'ace-visconti', perk.id), 3);
  assert.equal(bloodwebNextTier(save, 'ace-visconti', perk), null);
  save.perkOverrides[perk.id].shrineTier = 3;
  assert.equal(globalTier(save, perk), 3);
  assert.equal(unlockSource(save, perk), 'Shrine');
  assert.equal(inventoryTier(save, 'meg-thomas', perk.id), 3);
  assert.equal(inventoryTier(save, 'the-trapper', perk.id), 0);
  assert.deepEqual(parseSave(exportSave(save)).save, save);
});
test('Bloodweb eligibility retains historical acquisitions while locked foreign perks stay ineligible', () => {
  const save = freshSave(), perk = perkById['iron-will'];
  assert.equal(bloodwebEligible(save, 'ace-visconti', perk), false);
  assert.equal(bloodwebNextTier(save, 'ace-visconti', perk), null);
  save.characters['ace-visconti'].perks[perk.id] = 1;
  assert.equal(bloodwebEligible(save, 'ace-visconti', perk), true);
  assert.equal(bloodwebNextTier(save, 'ace-visconti', perk), 2);
  assert.equal(bloodwebEligible(save, 'the-trapper', perk), false);
});
test('new account rules migration backs up once, seeds Legacy unlocks and never modifies personal tiers', () => {
  const memory = memoryStorage(), store = new TrackerStorage(memory, () => {}), save = freshSave();
  delete save.accountRulesVersion;
  delete save.inventoryPolicy;
  save.settings.halloweenNames = 'generic';
  save.characters['ace-visconti'].perks = { kindred: 3, bond: 3, 'calm-spirit': 1 };
  save.perkOverrides[windows.id] = { shrineTier: 2 };
  store.save(save);
  const loaded = store.load().save;
  assert.deepEqual(loaded.characters, save.characters);
  assert.equal(loaded.perkOverrides[windows.id].shrineTier, 0);
  assert.equal(loaded.perkOverrides[windows.id].manualTier, 2);
  assert.equal(unlockSource(loaded, windows), 'Unspecified');
  for (const id of ['bond', 'prove-thyself', 'leader', 'empathy', 'botany-knowledge', 'self-care', 'technician']) {
    assert.equal(loaded.perkOverrides[id].legacyTier, 1);
    assert.equal(unlockSource(loaded, perkById[id]), 'Legacy');
  }
  assert.equal(loaded.perkOverrides['calm-spirit'].legacyTier, 2);
  assert.equal(inventoryTier(loaded, 'ace-visconti', 'calm-spirit'), 2);
  assert.equal(loaded.settings.halloweenNames, 'original');
  assert.equal(store.backups().length, 1);
  assert.deepEqual(store.backups()[0].save.characters, save.characters);
  loaded.perkOverrides['calm-spirit'].legacyTier = 3;
  store.save(loaded);
  assert.equal(store.load().save.perkOverrides['calm-spirit'].legacyTier, 3);
  assert.equal(store.backups().length, 1);
});
test('setup merges upgrades without replacing old records or allowing downgrades', () => {
  const save = freshSave();
  save.characters['ace-visconti'].owned = true;
  save.characters['ace-visconti'].perks = { kindred: 3, bond: 2, 'future-perk': 3 };
  completeCharacterSetup(save, 'ace-visconti', 10, { bond: 1, resilience: 1 });
  assert.deepEqual(save.characters['ace-visconti'].perks, { kindred: 3, bond: 2, 'future-perk': 3, resilience: 1 });
  completeCharacterSetup(save, 'ace-visconti', 11, {});
  assert.equal(save.characters['ace-visconti'].perks.kindred, 3);
  assert.equal(inventoryTier(save, 'ace-visconti', 'ace-in-the-hole'), 1);
});
test('owned licensed sources use original names and generic IDs merge tiered unlocks', () => {
  const save = freshSave();
  save.settings.halloweenNames = 'generic';
  save.settings.hellraiserNames = 'generic';
  for (const id of ['laurie-strode', 'the-shape', 'the-cenobite']) save.characters[id].owned = true;
  for (const [id, names] of Object.entries({ ...halloweenNames, ...hellraiserNames })) assert.equal(perkName(save, perkById[id]), names[0]);
  save.perkOverrides['will-to-live'] = { shrineTier: 1, legacyTier: 2 };
  save.perkOverrides['decisive-strike'] = { shrineTier: 3 };
  save.characters['ace-visconti'].perks['will-to-live'] = 2;
  const parsed = parseSave(exportSave(save));
  assert.deepEqual(parsed.warnings, []);
  syncGlobalInventories(parsed.save);
  assert.deepEqual(parsed.save.perkOverrides['decisive-strike'], { shrineTier: 3, legacyTier: 2 });
  assert.equal(parsed.save.characters['ace-visconti'].perks['decisive-strike'], 2);
});
test('Legacy and unspecified tiers reject malformed values and persist through validation', () => {
  for (const field of ['legacyTier', 'manualTier']) for (const value of [-1, 4, 1.5, '2']) {
    const save = freshSave();
    save.perkOverrides.bond = { shrineTier: 0, [field]: value };
    assert.throws(() => validateSave(save), /Invalid/);
  }
});
