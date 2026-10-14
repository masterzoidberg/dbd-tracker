import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave } from '../src/model.js';
import { TrackerStorage, SAVE_KEY, BACKUP_KEY } from '../src/storage.js';
import { schemaV1Fixture } from './fixtures/schema-v1.js';

test('read-only complete v2 structural migration does not write backup or current save', () => {
  const raw = JSON.stringify(schemaV1Fixture()), data = new Map([[SAVE_KEY, raw]]);
  const writes = [];
  const store = new TrackerStorage({
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { writes.push(key); data.set(key, value); },
  }, () => { throw new Error('Read-only'); });
  const result = store.load({ persistMigration: false });
  assert.equal(result.save.schemaVersion, 2);
  assert.equal(result.migrationPending, true);
  assert.deepEqual(writes, []);
  assert.equal(data.get(SAVE_KEY), raw);
  assert.throws(() => store.load(), /Read-only/);
  assert.deepEqual(writes, []);
});

function fixture(guard) {
  const legacy = freshSave();
  delete legacy.accountRulesVersion;
  const data = new Map([[SAVE_KEY, JSON.stringify(legacy)], [BACKUP_KEY, '[]']]);
  const writes = [];
  const adapter = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes.push(key); data.set(key, value); } };
  return { data, writes, legacy, store: new TrackerStorage(adapter, guard) };
}

test('every persistence mutation requires a live writer, before any preparation or writes', () => {
  let allowed = false;
  const { store, data, writes } = fixture(() => { if (!allowed) throw Error('Read-only: editor required'); });
  const before = [...data];
  const valid = freshSave();
  for (const mutate of [() => store.save(valid), () => store.backup(valid, 'Test'),
    () => store.replace(valid, valid, 'Test'), () => store.replace(valid, valid, 'Recovery', { recover: true }),
    () => store.deleteBackup('test'), () => store.load()]) {
    assert.throws(mutate, /Read-only/);
    assert.deepEqual([...data], before);
    assert.deepEqual(writes, []);
  }
  allowed = true;
  store.save(valid);
  allowed = false;
  assert.throws(() => store.save(valid), /Read-only/, 'Guard must be live, not captured at construction');
});

test('missing writer capability fails closed while pure reads remain usable', () => {
  const { store, data } = fixture();
  assert.throws(() => store.save(freshSave()), /Read-only|writer|editing/i);
  assert.equal(store.original(), data.get(SAVE_KEY));
  assert.deepEqual(store.backups(), []);
});

test('read-only legacy normalization preserves all bytes and timestamp without migration snapshots', () => {
  const { store, data, writes, legacy } = fixture(() => { throw Error('Read-only'); });
  const before = [...data];
  const loaded = store.load({ persistMigration: false });
  assert.equal(loaded.migrationPending, true);
  assert.equal(loaded.save.accountRulesVersion, 1);
  assert.equal(loaded.save.updatedAt, legacy.updatedAt);
  assert.deepEqual([...data], before);
  assert.deepEqual(writes, []);
});

test('acquisition is exclusive, lifetime-held, explicit-retry only, and fail-closed on unavailable API', async () => {
  const { EditorGuard } = await import('../src/editor.js');
  let held = false;
  const locks = { async request(name, options, callback) {
    assert.equal(name, 'dbdTracker-editor');
    assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
    if (held) return callback(null);
    held = true;
    try { return await callback({ name }); } finally { held = false; }
  } };
  const a = new EditorGuard(locks), b = new EditorGuard(locks);
  assert.throws(() => a.assertWriter(), /Read-only/);
  assert.deepEqual(await Promise.all([a.acquire(), b.acquire()]), [true, false]);
  a.assertWriter();
  assert.equal(await a.acquire(), true, 'Repeated acquisition must retain existing ownership');
  assert.throws(() => b.assertWriter(), /Read-only/);
  assert.equal(held, true, 'Acquisition must return without releasing the lifetime lock');
  for (const manager of [undefined, { request: () => { throw Error('Denied API'); } }, { request: () => Promise.reject(Error('Denied API')) }]) {
    const unavailable = new EditorGuard(manager);
    assert.equal(await unavailable.acquire(), false);
    assert.equal(unavailable.state, 'unavailable');
    assert.throws(() => unavailable.assertWriter(), /Read-only/);
  }
});
