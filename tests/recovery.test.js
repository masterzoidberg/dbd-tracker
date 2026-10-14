import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { freshSave, freshProgress, parseSave, exportSave, applyAccountRules, syncGlobalInventories } from '../src/model.js';
import { TrackerStorage, SAVE_KEY, BACKUP_KEY } from '../src/storage.js';

const raw = '  {"damaged": "<img src=x onerror=alert(1)>"\r\n';
function fixture(backups = null) {
  const data = new Map([[SAVE_KEY, raw]]);
  if (backups !== null) data.set(BACKUP_KEY, backups);
  const writes = [];
  const adapter = { getItem: key => data.get(key) ?? null, setItem: (key, value) => {
    writes.push([key, value]); data.set(key, value);
  } };
  return { data, writes, adapter, store: new TrackerStorage(adapter, () => {}) };
}
const recoveryEntries = data => [...data].filter(([key]) => key.startsWith('dbdTrackerRecovery-'));
function incoming() {
  const save = freshSave();
  save.characters['meg-thomas'].bloodwebLevel = 25;
  save.characters['meg-thomas'].perks = { camaraderie: 0, renewal: 2, 'future-perk': 3 };
  save.characters['future-character'] = { ...freshProgress(), perks: { 'future-perk': 0 } };
  save.perkOverrides['future-perk'] = { shrineTier: 2, manualTier: 3 };
  save.prestigeQueue = [{ characterId: 'future-goal-only', targetPrestige: 9 }];
  save.characters['meg-thomas'].inventory.items['survivor-item-test-future'] = 7;
  save.characters['the-doctor'].inventory.addons['killer-addon-test-future'] = 3;
  delete save.characters['meg-thomas'].setupComplete;
  return save;
}

test('recovery import preserves exact current bytes before writing canonical progress without a fallback snapshot', () => {
  const { data, writes, store } = fixture();
  assert.throws(() => store.load(), /JSON/);
  const candidate = incoming(), before = structuredClone(candidate);
  const saved = store.replace(freshSave(), candidate, 'Before JSON import', { recover: true });
  assert.deepEqual(candidate, before);
  assert.deepEqual(recoveryEntries(data).map(([, value]) => value), [raw]);
  assert.equal(writes.length, 2);
  assert.match(writes[0][0], /^dbdTrackerRecovery-/);
  assert.equal(writes[1][0], SAVE_KEY);
  assert.equal(data.has(BACKUP_KEY), false, 'Fallback memory is never snapshotted');
  assert.deepEqual(saved, parseSave(data.get(SAVE_KEY)).save);
  assert.deepEqual(store.load().save, saved);
  assert.deepEqual(saved.characters['meg-thomas'].perks, { camaraderie: 0, 'second-wind': 2, 'future-perk': 3 });
  assert.equal(Object.hasOwn(saved.characters['meg-thomas'].perks, 'babysitter'), false);
  assert.equal(saved.characters['meg-thomas'].setupComplete, false);
  assert.deepEqual(saved.characters['future-character'], candidate.characters['future-character']);
  assert.deepEqual(saved.perkOverrides['future-perk'], candidate.perkOverrides['future-perk']);
});

test('recovering from a known-good old backup retains migration policy and the backup collection verbatim', () => {
  const legacy = incoming(); delete legacy.accountRulesVersion;
  legacy.perkOverrides.kindred = { shrineTier: 2 };
  const backups = JSON.stringify([{ id: 'old-backup', reason: 'Old save', createdAt: legacy.updatedAt, save: legacy }]);
  const { data, store } = fixture(backups);
  const expected = structuredClone(legacy);
  applyAccountRules(expected); syncGlobalInventories(expected);
  expected.accountCorrectionApplied = true; expected.inventoryPolicy = 'bloodweb';
  const saved = store.replace(freshSave(), store.backups()[0].save, 'Before backup restore', { recover: true });
  assert.deepEqual(saved, parseSave(JSON.stringify(expected)).save);
  assert.deepEqual(saved, store.load().save);
  assert.equal(saved.perkOverrides.kindred.shrineTier, 0);
  assert.equal(saved.perkOverrides.kindred.manualTier, 2);
  assert.equal(saved.perkOverrides.bond.legacyTier, 1);
  assert.equal(data.get(BACKUP_KEY), backups);
  assert.deepEqual(recoveryEntries(data).map(([, value]) => value), [raw]);
});

test('invalid recovery candidates cannot create recovery entries or change current/backups', () => {
  for (const mutate of [s => { s.characters['meg-thomas'].bloodwebLevel = 51; }, s => { s.characters['meg-thomas'] = null; }]) {
    const { data, store, writes } = fixture('{broken backups');
    const next = incoming(); mutate(next);
    assert.throws(() => store.replace(freshSave(), next, 'Recovery', { recover: true }), /Bloodweb|character record/);
    assert.deepEqual([...data], [[SAVE_KEY, raw], [BACKUP_KEY, '{broken backups']]);
    assert.deepEqual(writes, []);
  }
});

test('recovery re-reads original bytes and uses unique keys for repeated attempts', () => {
  const { data, store } = fixture();
  assert.throws(() => store.load());
  data.set(SAVE_KEY, '\tlatest unreadable original\n');
  store.replace(freshSave(), incoming(), 'Recovery', { recover: true });
  data.set(SAVE_KEY, raw);
  store.replace(freshSave(), incoming(), 'Recovery again', { recover: true });
  assert.deepEqual(recoveryEntries(data).map(([, value]) => value), ['\tlatest unreadable original\n', raw]);
});

test('read denial, missing original and preservation failure abort recovery with current and backups untouched', () => {
  for (const failure of ['read', 'missing', 'preserve']) {
    const { data, store, adapter, writes } = fixture('{broken backups');
    if (failure === 'missing') data.delete(SAVE_KEY);
    store.storage = { ...adapter,
      getItem: key => { if (key === SAVE_KEY && failure === 'read') throw Error('Storage access denied'); return adapter.getItem(key); },
      setItem: (key, value) => { if (key.startsWith('dbdTrackerRecovery-') && failure === 'preserve') throw Error('Quota exceeded'); adapter.setItem(key, value); },
    };
    assert.throws(() => store.replace(freshSave(), incoming(), 'Recovery', { recover: true }), /denied|original|Quota/);
    assert.equal(data.get(SAVE_KEY), failure === 'missing' ? undefined : raw);
    assert.equal(data.get(BACKUP_KEY), '{broken backups');
    assert.deepEqual(writes, []);
  }
});

test('failed final write preserves original and backup bytes; recovery copy remains and retry succeeds', () => {
  const { data, store, adapter } = fixture('{broken backups');
  store.storage = { ...adapter, setItem: (key, value) => { if (key === SAVE_KEY) throw Error('Quota exceeded'); adapter.setItem(key, value); } };
  assert.throws(() => store.replace(freshSave(), incoming(), 'Recovery', { recover: true }), /Quota/);
  assert.equal(data.get(SAVE_KEY), raw);
  assert.equal(data.get(BACKUP_KEY), '{broken backups');
  assert.deepEqual(recoveryEntries(data).map(([, value]) => value), [raw]);
  store.storage = adapter;
  const saved = store.replace(freshSave(), incoming(), 'Recovery', { recover: true });
  assert.deepEqual(saved, store.load().save);
  assert.equal(recoveryEntries(data).length, 2);
});

test('corrupt backup collections obstruct ordinary operations but never obstruct raw-preserving import', () => {
  for (const backups of ['{broken backups', '{}', '[null]']) {
    const { data, store, writes } = fixture(backups);
    assert.throws(() => store.backups(), /backups.*(read|import)/i);
    assert.throws(() => store.backup(freshSave(), 'Snapshot'), /backups/i);
    assert.throws(() => store.replace(freshSave(), incoming(), 'Ordinary import'), /backups/i);
    assert.throws(() => store.deleteBackup('any'), /backups/i);
    assert.deepEqual(writes, []);
    assert.equal(data.get(SAVE_KEY), raw);
    assert.equal(data.get(BACKUP_KEY), backups);
    const saved = store.replace(freshSave(), incoming(), 'Recovery import', { recover: true });
    assert.deepEqual(saved, store.load().save);
    assert.equal(data.get(BACKUP_KEY), backups);
  }
});

test('original export reads exact bytes, including an empty original, and rejects absence/access denial', () => {
  const { data, store } = fixture();
  assert.equal(store.original(), raw);
  data.set(SAVE_KEY, ''); assert.equal(store.original(), '');
  data.delete(SAVE_KEY); assert.throws(() => store.original(), /original/i);
  store.storage.getItem = () => { throw Error('Access denied'); };
  assert.throws(() => store.original(), /denied/);
});

// Test actual adoption/export functions with synthetic storage, without exposing app internals.
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
function appHarness(store) {
  const context = vm.createContext({ save: freshSave(), initialized: true, storageBlocked: true, store, exportSave, parseSave, Date,
    $: () => ({ textContent: '' }),
    date: value => value, render: () => {}, confirmAction: async () => true,
    message: text => { context.lastMessage = text; },
    download: (content, filename) => { context.downloaded = { content, filename }; },
  });
  vm.runInContext(source.slice(source.indexOf('function exportFile('), source.indexOf('\nasync function reset(')), context);
  return context;
}

test('blocked ordinary export cannot download fallback memory; recovered export uses canonical progress', async () => {
  const { store } = fixture();
  const context = appHarness(store);
  context.exportFile();
  assert.equal(context.downloaded, undefined);
  assert.match(context.lastMessage, /original|unavailable|disabled/i);
  context.save = store.replace(context.save, incoming(), 'Recovery', { recover: true });
  context.storageBlocked = false;
  context.exportFile();
  assert.deepEqual(parseSave(context.downloaded.content).save, context.save);
});

test('restore can recover blocked current state and only adopts after successful final persistence', async () => {
  const next = incoming(), backups = JSON.stringify([{ id: 'good', reason: 'Good save', createdAt: next.updatedAt, save: next }]);
  const { data, store, adapter } = fixture(backups);
  const context = appHarness(store), fallback = context.save;
  store.storage = { ...adapter, setItem: (key, value) => { if (key === SAVE_KEY) throw Error('Final write denied'); adapter.setItem(key, value); } };
  await assert.rejects(context.restore('good'), /denied/);
  assert.strictEqual(context.save, fallback);
  assert.equal(context.storageBlocked, true);
  assert.equal(data.get(SAVE_KEY), raw);
  assert.equal(data.get(BACKUP_KEY), backups);
  store.storage = adapter;
  await context.restore('good');
  assert.deepEqual(context.save, store.load().save);
  assert.equal(context.storageBlocked, false);
  assert.match(context.lastMessage, /restored/i);
});
