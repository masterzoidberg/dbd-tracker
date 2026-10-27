import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { freshSave, freshProgress, parseSave, syncGlobalInventories } from '../src/model.js';
import { TrackerStorage, SAVE_KEY, BACKUP_KEY } from '../src/storage.js';
import { schemaV1Fixture } from './fixtures/schema-v1.js';
import { schemaV2Fixture } from './fixtures/schema-v2.js';

test('schema-v3 planning and quantities survive save export backup restore and replacement defaults', () => {
  const memory = memoryStorage(), store = new TrackerStorage(memory, () => {}), input = freshSave();
  input.planning.unresolved = [{ queue: 'prestige', role: null, rank: 0,
    record: { characterId: 'future-goal-only', targetPrestige: 9 } }];
  input.planning.prestigeQueues.survivor = [{ characterId: 'meg-thomas', targetPrestige: 1 }];
  input.characters['meg-thomas'].inventory.items['survivor-item-test-future'] = 8;
  input.characters['meg-thomas'].inventory.addons['survivor-addon-test-future'] = 5;
  input.characters['the-doctor'].inventory.addons['killer-addon-test-future'] = 7;
  input.characters['meg-thomas'].perks.camaraderie = 0;
  const saved = store.save(input);
  assert.deepEqual(store.load().save, saved);
  store.backup(saved, 'Fixture');
  assert.deepEqual(store.backups()[0].save, saved);
  const emptied = store.replace(saved, schemaV1Fixture(), 'Before v1 import');
  assert.deepEqual(emptied.planning, freshSave().planning);
  for (const progress of Object.values(emptied.characters)) assert.deepEqual(progress.inventory, { items: {}, addons: {} });
  assert.deepEqual(store.backups()[0].save, saved);
  const restored = store.replace(emptied, store.backups()[0].save, 'Before restore');
  assert.deepEqual(restored.planning, input.planning);
  assert.deepEqual(restored.characters['meg-thomas'].inventory, input.characters['meg-thomas'].inventory);
  assert.equal(restored.characters['the-doctor'].inventory.addons['killer-addon-test-future'], 7);
  assert.equal(restored.characters['meg-thomas'].perks.camaraderie, 0);
  const reset = store.replace(restored, freshSave(), 'Before reset');
  assert.deepEqual(reset.planning, freshSave().planning);
  assert.deepEqual(reset.characters['meg-thomas'].inventory, { items: {}, addons: {} });
});

test('raw v1 signals read-only migration and writable backup retains the v1 predecessor', () => {
  const memory = memoryStorage(), writes = [];
  const storage = { getItem: key => memory.getItem(key), setItem: (key, value) => { writes.push([key, value]); memory.setItem(key, value); } };
  const store = new TrackerStorage(storage, () => {});
  const input = schemaV1Fixture();
  input.characters['meg-thomas'].updatedAt = '2026-10-01T16:30:00Z';
  const bytes = JSON.stringify(input);
  memory.setItem(SAVE_KEY, bytes);
  const readOnly = store.load({ persistMigration: false });
  assert.equal(readOnly.migrationPending, true);
  assert.equal(readOnly.sourceSchemaVersion, 1);
  assert.equal(readOnly.save.schemaVersion, 3);
  assert.equal(memory.getItem(SAVE_KEY), bytes);
  assert.equal(memory.getItem(BACKUP_KEY), null);
  assert.deepEqual(writes, []);
  const writable = store.load();
  assert.equal(writable.migrationPending, false);
  assert.equal(writable.save.schemaVersion, 3);
  assert.equal(writable.save.updatedAt, input.updatedAt);
  assert.equal(writable.save.characters['meg-thomas'].updatedAt, input.characters['meg-thomas'].updatedAt);
  assert.deepEqual(store.backups()[0].save, input);
  assert.equal(store.backups().length, 1);
  assert.deepEqual(writes.map(([key]) => key), [BACKUP_KEY, SAVE_KEY]);
  const writesAfterMigration = writes.length;
  store.load();
  assert.equal(writes.length, writesAfterMigration);
  assert.equal(store.backups().length, 1);
});

test('raw v2 planning migration is read-only until writer backup then persists exactly once', () => {
  const memory = memoryStorage(), writes = [], store = new TrackerStorage({
    getItem: key => memory.getItem(key),
    setItem: (key, value) => { writes.push([key, value]); memory.setItem(key, value); },
  }, () => {});
  const input = schemaV2Fixture();
  input.prestigeQueue = [{ characterId: 'meg-thomas', targetPrestige: 6 },
    { characterId: 'future-goal-only', targetPrestige: 9, note: 'preserve' }];
  input.characters['meg-thomas'].owned = true;
  const original = JSON.stringify(input);
  memory.setItem(SAVE_KEY, original);

  const preview = store.load({ persistMigration: false });
  assert.equal(preview.sourceSchemaVersion, 2);
  assert.equal(preview.save.schemaVersion, 3);
  assert.equal(preview.migrationPending, true);
  assert.equal(memory.getItem(SAVE_KEY), original);
  assert.deepEqual(writes, []);

  const migrated = store.load();
  assert.deepEqual(migrated.save.planning.prestigeQueues.survivor, [{ characterId: 'meg-thomas', targetPrestige: 6 }]);
  assert.deepEqual(migrated.save.planning.unresolved, [{ queue: 'prestige', role: null, rank: 1,
    record: input.prestigeQueue[1] }]);
  assert.deepEqual(store.backups()[0].save, input);
  assert.match(store.backups()[0].reason, /schema v2 to v3/i);
  assert.deepEqual(writes.map(([key]) => key), [BACKUP_KEY, SAVE_KEY]);
  store.load();
  assert.equal(writes.length, 2);
});

test('structural migration backup and save failures leave valid original bytes intact', () => {
  for (const failKey of [BACKUP_KEY, SAVE_KEY]) {
    const memory = memoryStorage(), input = schemaV1Fixture();
    const original = JSON.stringify(input);
    memory.setItem(SAVE_KEY, original);
    const store = new TrackerStorage({
      getItem: key => memory.getItem(key),
      setItem: (key, value) => { if (key === failKey) throw new Error('Migration write failed'); memory.setItem(key, value); },
    }, () => {});
    assert.throws(() => store.load(), /Migration write failed/);
    assert.equal(memory.getItem(SAVE_KEY), original);
    assert.deepEqual(input, schemaV1Fixture());
  }
});

const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('real Killer Add-on quantities survive storage backup and restore while wrong-owner saves reject', () => {
  const id='killer-addon-trapper-bear-oil', store=new TrackerStorage(memoryStorage(),()=>{}), input=freshSave();
  input.characters['the-trapper'].inventory.addons[id]=6;
  const saved=store.save(input);
  assert.equal(store.load().save.characters['the-trapper'].inventory.addons[id],6);
  store.backup(saved,'Real Killer stock');
  const reset=store.save(freshSave());
  const restored=store.replace(reset,store.backups()[0].save,'Before real stock restore');
  assert.equal(restored.schemaVersion,3);
  assert.equal(restored.characters['the-trapper'].inventory.addons[id],6);
  const invalid=structuredClone(restored);
  invalid.characters['the-doctor'].inventory.addons[id]=6;
  assert.throws(()=>store.save(invalid),/owner/);
  assert.deepEqual(store.load().save,restored);
});

const invalidCandidates = [
  ['sparse Prestige Queue', s => { s.planning.prestigeQueues.survivor = new Array(1); }, /planning|queue/i],
  ['Bloodweb 0', s => { s.characters['meg-thomas'].bloodwebLevel = 0; }, /Bloodweb/],
  ['Bloodweb 51', s => { s.characters['meg-thomas'].bloodwebLevel = 51; }, /Bloodweb/],
  ['negative Prestige', s => { s.characters['meg-thomas'].prestige = -1; }, /Prestige/],
  ['fractional Prestige', s => { s.characters['meg-thomas'].prestige = 1.5; }, /Prestige/],
  ['tier 4', s => { s.characters['meg-thomas'].perks.kindred = 4; }, /perk tier/],
  ['wrong-role perk', s => { s.characters['meg-thomas'].perks.jolt = 2; }, /wrong role/],
  ['null character', s => { s.characters['meg-thomas'] = null; }, /character record/],
  ['array inventory', s => { s.characters['meg-thomas'].perks = []; }, /perk inventory/],
  ['invalid policy', s => { s.inventoryPolicy = 'invalid'; }, /inventory policy/],
  ['invalid settings', s => { s.settings.halloweenNames = 'invalid'; }, /Halloween names/],
  ['invalid override', s => { s.perkOverrides.kindred = { shrineTier: 4 }; }, /Shrine tier/],
  ['invalid setup completion', s => { s.setupComplete = 'yes'; }, /Setup completion/],
  ['invalid account correction', s => { s.accountCorrectionApplied = 'yes'; }, /Account correction/],
  ['invalid account rules', s => { s.accountRulesVersion = 2; }, /account rules/],
];

for (const [name, mutate, error] of invalidCandidates) {
  test(`save rejects ${name} before writing and preserves the loadable predecessor`, () => {
    const memory = memoryStorage(), store = new TrackerStorage(memory, () => {}), previous = freshSave();
    memory.setItem(SAVE_KEY, JSON.stringify(previous));
    const bytes = memory.getItem(SAVE_KEY), candidate = structuredClone(previous);
    mutate(candidate);
    let writes = 0;
    store.storage = { ...memory, setItem: (key, value) => { writes++; memory.setItem(key, value); } };
    assert.throws(() => store.save(candidate), error);
    assert.equal(writes, 0);
    assert.equal(memory.getItem(SAVE_KEY), bytes);
    assert.deepEqual(store.load().save, previous);
  });
}

test('save returns canonical defaults and progression, preserves unknown IDs and does not mutate input', () => {
  const memory = memoryStorage(), store = new TrackerStorage(memory, () => {});
  const candidate = { schemaVersion: 1, accountRulesVersion: 1, updatedAt: new Date().toISOString(), characters: {
    'meg-thomas': { ...freshProgress(), owned: true, prestige: 12, bloodwebLevel: 50, favorite: true, perks: { kindred: 3, camaraderie: 0, 'future-perk': 2 } },
    'future-character': { ...freshProgress(), perks: { 'future-perk': 1 } },
  }, perkOverrides: { 'future-perk': { shrineTier: 2, manualTier: 3 } }, exportedAt: 'import metadata', extra: true };
  delete candidate.characters['meg-thomas'].setupComplete;
  const before = structuredClone(candidate);
  const persisted = store.save(candidate);
  assert.deepEqual(parseSave(memory.getItem(SAVE_KEY)).save, persisted);
  assert.deepEqual(store.load().save, persisted);
  assert.notStrictEqual(persisted, candidate);
  assert.deepEqual(candidate, before);
  assert.equal(persisted.setupComplete, true);
  assert.equal(persisted.characters['meg-thomas'].setupComplete, false);
  assert.equal(persisted.characters['meg-thomas'].prestige, 12);
  assert.equal(persisted.characters['meg-thomas'].bloodwebLevel, 50);
  assert.deepEqual(persisted.characters['meg-thomas'].perks, { kindred: 3, camaraderie: 0, 'future-perk': 2 });
  assert.equal(Object.hasOwn(persisted.characters['meg-thomas'].perks, 'babysitter'), false);
  assert.deepEqual(persisted.characters['future-character'], before.characters['future-character']);
  assert.deepEqual(persisted.perkOverrides, before.perkOverrides);
  assert.deepEqual(persisted.settings, { halloweenNames: 'original', hellraiserNames: 'original' });
  assert.equal(Object.hasOwn(persisted, 'extra'), false);
  assert.equal(Object.hasOwn(persisted, 'exportedAt'), false);
});

test('normal save validates legacy data without applying account migration', () => {
  const memory = memoryStorage(), store = new TrackerStorage(memory, () => {}), candidate = freshSave();
  delete candidate.accountRulesVersion;
  candidate.perkOverrides.kindred = { shrineTier: 2 };
  const persisted = store.save(candidate);
  assert.deepEqual(persisted, parseSave(memory.getItem(SAVE_KEY)).save);
  assert.equal(persisted.accountRulesVersion, undefined);
  assert.deepEqual(persisted.perkOverrides, { kindred: { shrineTier: 2 } });
});

test('load migration and replacement expose the successful canonical save result', () => {
  class ObservedStorage extends TrackerStorage {
    save(candidate) { this.persisted = super.save(candidate); return this.persisted; }
  }
  const memory = memoryStorage(), store = new ObservedStorage(memory, () => {}), legacy = freshSave();
  delete legacy.accountRulesVersion;
  legacy.characters['meg-thomas'].perks = { 'second-wind': 1, renewal: 3, babysitter: 0 };
  memory.setItem(SAVE_KEY, JSON.stringify(legacy));
  const loaded = store.load().save;
  assert.strictEqual(loaded, store.persisted);
  assert.deepEqual(loaded, parseSave(memory.getItem(SAVE_KEY)).save);
  assert.equal(loaded.characters['meg-thomas'].perks.renewal, undefined);
  assert.equal(loaded.characters['meg-thomas'].perks['second-wind'], 3);
  assert.equal(loaded.characters['meg-thomas'].perks.babysitter, 0);
  const replacement = store.replace(loaded, legacy, 'Before test replacement');
  assert.strictEqual(replacement, store.persisted);
  assert.deepEqual(replacement, store.load().save);
});

test('failed current writes preserve bytes during save, migration and replacement; retry succeeds', () => {
  const memory = memoryStorage(), previous = freshSave();
  let fail = true;
  const store = new TrackerStorage({ ...memory, setItem: (key, value) => {
    if (key === SAVE_KEY && fail) throw new Error('Quota exceeded');
    memory.setItem(key, value);
  } }, () => {});
  memory.setItem(SAVE_KEY, JSON.stringify(previous));
  const bytes = memory.getItem(SAVE_KEY), candidate = structuredClone(previous);
  candidate.characters['meg-thomas'].bloodwebLevel = 25;
  assert.throws(() => store.save(candidate), /Quota/);
  assert.throws(() => store.replace(previous, candidate, 'Before failed replacement'), /Quota/);
  assert.equal(memory.getItem(SAVE_KEY), bytes);
  assert.deepEqual(store.load().save, previous);
  assert.equal(store.backups().length, 1);
  assert.ok(memory.getItem(BACKUP_KEY));
  const legacy = structuredClone(previous);
  delete legacy.accountRulesVersion;
  memory.setItem(SAVE_KEY, JSON.stringify(legacy));
  const legacyBytes = memory.getItem(SAVE_KEY);
  assert.throws(() => store.load(), /Quota/);
  assert.equal(memory.getItem(SAVE_KEY), legacyBytes);
  fail = false;
  assert.deepEqual(store.save(candidate), store.load().save);
});

// Exercise the actual commit function without adding an application export or a DOM dependency.
const appSource = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const commitSource = appSource.slice(appSource.indexOf('function commit('), appSource.indexOf('\nfunction badge('));
function appHarness() {
  const memory = memoryStorage(), store = new TrackerStorage(memory, () => {}), previous = freshSave();
  memory.setItem(SAVE_KEY, JSON.stringify(previous));
  const status = { textContent: '' };
  const context = vm.createContext({ save: previous, storageBlocked: false, store, structuredClone,
    syncGlobalInventories, Date, $: () => status, render: () => {},
    message: text => { context.errorMessage = text; },
  });
  vm.runInContext(commitSource, context);
  return { memory, store, previous, status, context };
}

test('commit adopts persisted defaults and consolidated aliases instead of the candidate', () => {
  const { memory, context, status } = appHarness();
  assert.equal(context.commit(next => {
    next.characters['meg-thomas'].perks = { renewal: 1, 'second-wind': 3, camaraderie: 0 };
    next.perkOverrides = { renewal: { shrineTier: 3, manualTier: 2 }, 'second-wind': { shrineTier: 1, legacyTier: 1 } };
    delete next.settings;
    next.extra = true;
  }), true);
  assert.deepEqual(context.save, parseSave(memory.getItem(SAVE_KEY)).save);
  assert.equal(context.save.characters['meg-thomas'].perks['second-wind'], 3);
  assert.equal(context.save.characters['meg-thomas'].perks.camaraderie, 0);
  assert.deepEqual(context.save.perkOverrides, { 'second-wind': { shrineTier: 3, legacyTier: 1, manualTier: 2 } });
  assert.equal(context.save.extra, undefined);
  assert.equal(status.textContent, 'Saved locally');
});

test('read-only commit rejects before applying the mutator and cannot adopt the candidate', () => {
  const { memory, store, previous, context } = appHarness();
  const bytes = memory.getItem(SAVE_KEY);
  store.assertWriter = () => { throw Error('Read-only: editor required'); };
  let applied = false;
  assert.equal(context.commit(next => { applied = true; next.characters['meg-thomas'].favorite = true; }), false);
  assert.equal(applied, false);
  assert.strictEqual(context.save, previous);
  assert.equal(memory.getItem(SAVE_KEY), bytes);
  assert.match(context.errorMessage, /Read-only/);
});

test('commit rejects invalid data, mutator errors, malformed inventories and write failures without adoption', () => {
  const { memory, store, previous, context, status } = appHarness();
  const bytes = memory.getItem(SAVE_KEY);
  for (const mutator of [
    next => { next.characters['meg-thomas'].bloodwebLevel = 51; },
    () => { throw new Error('Invalid edit'); },
    next => { next.characters['meg-thomas'] = null; },
  ]) {
    assert.equal(context.commit(mutator, 'meg-thomas'), false);
    assert.strictEqual(context.save, previous);
    assert.equal(memory.getItem(SAVE_KEY), bytes);
    assert.equal(status.textContent, 'Save failed');
    assert.match(context.errorMessage, /edit was not applied/i);
  }
  store.storage = { ...memory, setItem: () => { throw new Error('Storage access denied'); } };
  assert.equal(context.commit(next => { next.characters['meg-thomas'].favorite = true; }), false);
  assert.strictEqual(context.save, previous);
  assert.equal(memory.getItem(SAVE_KEY), bytes);
  store.storage = memory;
  assert.equal(context.commit(next => { next.characters['meg-thomas'].favorite = true; }), true);
  assert.deepEqual(context.save, store.load().save);
  assert.equal(context.save.characters['meg-thomas'].favorite, true);
});

test('serialization failure prevents a current write and application adoption', t => {
  const { memory, previous, context, status } = appHarness();
  const bytes = memory.getItem(SAVE_KEY);
  let writes = 0;
  context.store.storage = { ...memory, setItem: (key, value) => { writes++; memory.setItem(key, value); } };
  const stringify = t.mock.method(JSON, 'stringify', () => { throw new Error('Serialization failed'); });
  assert.equal(context.commit(next => { next.characters['meg-thomas'].favorite = true; }), false);
  stringify.mock.restore();
  assert.equal(writes, 0);
  assert.strictEqual(context.save, previous);
  assert.equal(memory.getItem(SAVE_KEY), bytes);
  assert.deepEqual(context.store.load().save, previous);
  assert.equal(status.textContent, 'Save failed');
  assert.match(context.errorMessage, /edit was not applied/i);
});
