import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hostedSaveV3Fixture } from './fixtures/hosted-save.js';

let createNeonRepository;
try {
  ({ createNeonRepository } = await import('../src/hosted-proof/repository.js'));
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

let migrationSql;
try {
  migrationSql = readFileSync(new URL('../db/migrations/001-hosted-proof.sql', import.meta.url), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function createSqlStub(responses) {
  const calls = [];
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}${part}` : part), '');
    calls.push({ query, values });
    return responses.shift() ?? [];
  };
  return { sql, calls };
}

function repository(sql) {
  assert.equal(typeof createNeonRepository, 'function', 'createNeonRepository must be implemented');
  return createNeonRepository(sql);
}

function rowRevisionParameter(call) {
  const match = call.query.match(/WHERE\s+ledger_state\.revision\s*=\s*\$(\d+)/i);
  assert.ok(match, 'upsert must compare the stored revision to a parameter');
  return call.values[Number(match[1]) - 1];
}

test('repository maps state and backup rows into the API contract', async () => {
  const data = hostedSaveV3Fixture();
  const timestamp = new Date('2026-10-29T12:00:00.000Z');
  const id = '00000000-0000-4000-8000-000000000001';
  const { sql, calls } = createSqlStub([
    [{ revision: '7', data, updated_at: timestamp }],
    [{ id, source_revision: '7', data, created_at: timestamp }],
  ]);
  const repo = repository(sql);

  assert.deepEqual(await repo.readCurrent(), {
    revision: 7,
    data,
    updatedAt: '2026-10-29T12:00:00.000Z',
  });
  assert.deepEqual(await repo.readBackup(id), {
    id,
    sourceRevision: 7,
    data,
    createdAt: '2026-10-29T12:00:00.000Z',
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0].query, /FROM\s+ledger_state/i);
  assert.match(calls[1].query, /FROM\s+ledger_backups/i);
  assert.deepEqual(calls[1].values, [id], 'backup identifiers must be parameterized');
});

test('compare-and-swap uses one parameterized upsert and returns null when no row matches', async () => {
  const data = hostedSaveV3Fixture();
  const { sql, calls } = createSqlStub([
    [{ revision: '5', data, updated_at: '2026-10-29T12:00:00.000Z' }],
    [],
  ]);
  const repo = repository(sql);

  const saved = await repo.compareAndSwapState(4, data);
  assert.deepEqual(saved, { revision: 5, data, updatedAt: '2026-10-29T12:00:00.000Z' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /INSERT\s+INTO\s+ledger_state/i);
  assert.match(calls[0].query, /ON\s+CONFLICT\s*\(\s*singleton\s*\)\s+DO\s+UPDATE/i);
  assert.equal(rowRevisionParameter(calls[0]), 4);
  assert.ok(calls[0].values.some(value => value === JSON.stringify(data)), 'save JSON must be a bound parameter');

  assert.equal(await repo.compareAndSwapState(9, data), null);
  assert.equal(calls.length, 2);
  assert.equal(rowRevisionParameter(calls[1]), 9);
});

test('backup creation uses one INSERT SELECT from the singleton state row', async () => {
  const data = hostedSaveV3Fixture();
  const id = '00000000-0000-4000-8000-000000000002';
  const { sql, calls } = createSqlStub([[
    { id, source_revision: '3', data, created_at: '2026-10-29T12:00:00.000Z' },
  ]]);
  const repo = repository(sql);

  assert.deepEqual(await repo.createBackup(), {
    id,
    sourceRevision: 3,
    data,
    createdAt: '2026-10-29T12:00:00.000Z',
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /INSERT\s+INTO\s+ledger_backups/i);
  assert.match(calls[0].query, /SELECT\s+revision\s*,\s*data\s+FROM\s+ledger_state/i);
  assert.match(calls[0].query, /WHERE\s+singleton\s*=\s*TRUE/i);
});

test('invalid backup IDs return no row without issuing a database query', async () => {
  const { sql, calls } = createSqlStub([]);
  const repo = repository(sql);
  assert.equal(await repo.readBackup('not-a-uuid'), null);
  assert.equal(calls.length, 0);
});

test('migration creates idempotent tables and an enabled trigger rejecting backup updates and deletes', () => {
  assert.ok(migrationSql, 'hosted proof migration must exist');
  assert.match(migrationSql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+ledger_state/i);
  assert.match(migrationSql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+ledger_backups/i);
  assert.match(migrationSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+reject_ledger_backup_mutation/i);
  assert.match(migrationSql, /BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+ledger_backups/i);
  assert.match(migrationSql, /ENABLE\s+ALWAYS\s+TRIGGER\s+ledger_backups_immutable/i);
  assert.match(migrationSql, /RAISE\s+EXCEPTION/i);
});
