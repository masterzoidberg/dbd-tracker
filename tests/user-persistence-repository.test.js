import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let createUserPersistenceRepository;
try {
  ({ createUserPersistenceRepository } = await import('../src/user-persistence/repository.js'));
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

let migrationSql;
try {
  migrationSql = readFileSync(new URL('../db/migrations/002-authenticated-persistence.sql', import.meta.url), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const timestamp = '2026-11-02T12:00:00.000Z';
const userState = {
  revision: '4',
  data: { schemaVersion: 3, synthetic: true },
  updated_at: timestamp,
};
const userBackup = {
  id: '00000000-0000-4000-8000-000000000021',
  source_revision: '4',
  data: { schemaVersion: 3, synthetic: true },
  created_at: timestamp,
};

function createPoolHarness(responses = []) {
  const clients = [];
  return {
    clients,
    async connect() {
      const client = {
        calls: [],
        released: false,
        async query(text, values = []) {
          this.calls.push({ text, values });
          const response = responses.shift() ?? { rows: [] };
          if (response instanceof Error) throw response;
          return response;
        },
        release() { this.released = true; },
      };
      clients.push(client);
      return client;
    },
  };
}

function repository(pool) {
  assert.equal(typeof createUserPersistenceRepository, 'function', 'createUserPersistenceRepository must be implemented');
  return createUserPersistenceRepository(pool);
}

test('withUser keeps one transaction-local user identity through reads and commits before releasing the client', async () => {
  const pool = createPoolHarness([
    { rows: [] },
    { rows: [{ set_config: 'synthetic-user-a' }] },
    { rows: [userState] },
    { rows: [] },
  ]);
  const repo = repository(pool);

  const state = await repo.withUser('synthetic-user-a', user => user.readState());

  assert.deepEqual(state, {
    revision: 4,
    data: userState.data,
    updatedAt: timestamp,
  });
  const client = pool.clients[0];
  assert.equal(client.calls[0].text, 'BEGIN');
  assert.match(client.calls[1].text, /set_config\s*\(\s*'app\.user_id'\s*,\s*\$1\s*,\s*true\s*\)/i);
  assert.deepEqual(client.calls[1].values, ['synthetic-user-a']);
  assert.match(client.calls[2].text, /FROM\s+ledger_user_state/i);
  assert.match(client.calls[2].text, /WHERE\s+user_id\s*=\s*current_setting\s*\(\s*'app\.user_id'\s*,\s*true\s*\)/i);
  assert.equal(client.calls[3].text, 'COMMIT');
  assert.equal(client.released, true);
});

test('compareAndSwapState uses one parameterized conditional upsert for creation and stale-write rejection', async () => {
  const data = { schemaVersion: 3, synthetic: true };
  const pool = createPoolHarness([
    { rows: [] },
    { rows: [{ set_config: 'synthetic-user-a' }] },
    { rows: [userState] },
    { rows: [] },
    { rows: [] },
    { rows: [{ set_config: 'synthetic-user-a' }] },
    { rows: [] },
    { rows: [] },
  ]);
  const repo = repository(pool);

  const first = await repo.withUser('synthetic-user-a', user => user.compareAndSwapState(3, data));
  const stale = await repo.withUser('synthetic-user-a', user => user.compareAndSwapState(3, data));

  assert.deepEqual(first, { revision: 4, data: userState.data, updatedAt: timestamp });
  assert.equal(stale, null);
  for (const client of pool.clients) {
    const writeCalls = client.calls.filter(call => /INSERT\s+INTO\s+ledger_user_state/i.test(call.text));
    assert.equal(writeCalls.length, 1);
    assert.match(writeCalls[0].text, /ON\s+CONFLICT\s*\(\s*user_id\s*\)\s+DO\s+UPDATE/i);
    assert.match(writeCalls[0].text, /WHERE\s+\$1::bigint\s*=\s*0\s+OR\s+EXISTS\s*\(/i);
    assert.match(writeCalls[0].text, /FROM\s+ledger_user_state\s+AS\s+current_state[\s\S]+current_state\.user_id\s*=\s*current_setting\s*\(\s*'app\.user_id'[\s\S]+current_state\.revision\s*=\s*\$1::bigint/i);
    assert.match(writeCalls[0].text, /WHERE\s+ledger_user_state\.revision\s*=\s*\$\d+/i);
    assert.match(writeCalls[0].text, /ledger_user_state\.revision\s*<\s*9007199254740991/i);
    assert.ok(writeCalls[0].values.includes(3));
    assert.ok(writeCalls[0].values.includes(JSON.stringify(data)));
  }
});

test('backup creation snapshots only the current user state and backup reads include the transaction owner', async () => {
  const pool = createPoolHarness([
    { rows: [] },
    { rows: [{ set_config: 'synthetic-user-a' }] },
    { rows: [userBackup] },
    { rows: [{ id: userBackup.id, source_revision: '4', data: userBackup.data, created_at: timestamp }] },
    { rows: [] },
    { rows: [] },
  ]);
  const repo = repository(pool);

  const result = await repo.withUser('synthetic-user-a', async user => ({
    created: await user.createBackup(),
    read: await user.readBackup(userBackup.id),
  }));

  assert.deepEqual(result.created, {
    id: userBackup.id,
    sourceRevision: 4,
    data: userBackup.data,
    createdAt: timestamp,
  });
  assert.deepEqual(result.read, result.created);
  const calls = pool.clients[0].calls;
  assert.match(calls[2].text, /INSERT\s+INTO\s+ledger_user_backups[\s\S]+SELECT[\s\S]+FROM\s+ledger_user_state/i);
  assert.match(calls[2].text, /WHERE\s+user_id\s*=\s*current_setting\s*\(\s*'app\.user_id'\s*,\s*true\s*\)/i);
  assert.match(calls[3].text, /FROM\s+ledger_user_backups/i);
  assert.match(calls[3].text, /user_id\s*=\s*current_setting\s*\(\s*'app\.user_id'\s*,\s*true\s*\)/i);
  assert.deepEqual(calls[3].values, [userBackup.id]);
});

test('backup listing returns dated metadata for the current user without save data', async () => {
  const pool = createPoolHarness([
    { rows: [] },
    { rows: [{ set_config: 'synthetic-user-a' }] },
    { rows: [userBackup] },
    { rows: [] },
  ]);
  const list = await repository(pool).withUser('synthetic-user-a', user => user.listBackups());
  assert.deepEqual(list, [{ id: userBackup.id, sourceRevision: 4, createdAt: timestamp }]);
  const query = pool.clients[0].calls[2].text;
  assert.match(query, /FROM\s+ledger_user_backups/i);
  assert.match(query, /user_id\s*=\s*current_setting\s*\(\s*'app\.user_id'\s*,\s*true\s*\)/i);
  assert.match(query, /ORDER BY created_at DESC/i);
  assert.doesNotMatch(query, /SELECT[^;]*\bdata\b/i);
});

test('withUser rolls back and releases the connection when an operation fails', async () => {
  const pool = createPoolHarness([
    { rows: [] },
    { rows: [{ set_config: 'synthetic-user-a' }] },
    new Error('query failed'),
    { rows: [] },
  ]);
  const repo = repository(pool);

  await assert.rejects(
    repo.withUser('synthetic-user-a', user => user.readState()),
    /query failed/,
  );

  const client = pool.clients[0];
  assert.equal(client.calls.at(-1).text, 'ROLLBACK');
  assert.equal(client.released, true);
});

test('invalid backup identifiers return no row without querying the database', async () => {
  const pool = createPoolHarness([
    { rows: [] },
    { rows: [{ set_config: 'synthetic-user-a' }] },
    { rows: [] },
  ]);
  const repo = repository(pool);

  const backup = await repo.withUser('synthetic-user-a', user => user.readBackup('not-a-uuid'));

  assert.equal(backup, null);
  assert.equal(pool.clients[0].calls.length, 3);
  assert.equal(pool.clients[0].calls[2].text, 'COMMIT');
});

test('migration defines Better Auth PostgreSQL tables and owner-linked user persistence tables', () => {
  assert.ok(migrationSql, 'authenticated persistence migration must exist');
  for (const table of ['"user"', '"session"', '"account"', '"verification"']) {
    assert.match(migrationSql, new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table.replaceAll('"', '\\"')}`, 'i'));
  }
  assert.match(migrationSql, /"emailVerified"\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i);
  assert.match(migrationSql, /"createdAt"\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
  assert.match(migrationSql, /"userId"\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+"user"\s*\(\s*id\s*\)/i);
  assert.match(migrationSql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+ledger_user_state/i);
  assert.match(migrationSql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+ledger_user_backups/i);
  assert.match(migrationSql, /user_id\s+TEXT\s+PRIMARY\s+KEY[\s\S]+REFERENCES\s+"user"\s*\(\s*id\s*\)/i);
  assert.match(migrationSql, /revision\s+BIGINT\s+NOT\s+NULL\s+CHECK\s*\(\s*revision\s*>\s*0\s*\)/i);
  assert.match(migrationSql, /source_revision\s+BIGINT\s+NOT\s+NULL\s+CHECK\s*\(\s*source_revision\s*>\s*0\s*\)/i);
  assert.match(migrationSql, /data\s+JSONB\s+NOT\s+NULL/i);
  assert.match(migrationSql, /ON\s+ledger_user_backups\s*\(\s*user_id\s*,\s*created_at\s+DESC\s*\)/i);
});

test('migration forces owner RLS policies on both user tables and grants no backup mutation rights', () => {
  assert.ok(migrationSql, 'authenticated persistence migration must exist');
  for (const table of ['ledger_user_state', 'ledger_user_backups']) {
    assert.match(migrationSql, new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'));
    assert.match(migrationSql, new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'));
    assert.match(migrationSql, new RegExp(`CREATE\\s+POLICY\\s+${table}_owner\\s+ON\\s+${table}[\\s\\S]+?USING\\s*\\(\\s*user_id\\s*=\\s*NULLIF\\s*\\(\\s*current_setting\\s*\\(\\s*'app\\.user_id'`, 'i'));
    assert.match(migrationSql, new RegExp(`WITH\\s+CHECK\\s*\\(\\s*user_id\\s*=\\s*NULLIF\\s*\\(\\s*current_setting\\s*\\(\\s*'app\\.user_id'`, 'i'));
  }
  assert.match(migrationSql, /CREATE\s+ROLE\s+ledger_runtime\s+NOLOGIN\s+NOSUPERUSER\s+NOCREATEDB\s+NOCREATEROLE\s+NOREPLICATION\s+NOBYPASSRLS/i);
  assert.match(migrationSql, /GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+TABLE\s+"user"\s*,\s*"session"\s*,\s*"account"\s*,\s*"verification"\s+TO\s+ledger_runtime/i);
  assert.match(migrationSql, /GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s+ON\s+TABLE\s+ledger_user_state\s+TO\s+ledger_runtime/i);
  assert.match(migrationSql, /GRANT\s+SELECT\s*,\s*INSERT\s+ON\s+(?:TABLE\s+)?ledger_user_backups\s+TO\s+ledger_runtime/i);
  assert.doesNotMatch(migrationSql, /GRANT\s+ALL\b|ON\s+ALL\s+TABLES\b/i);
  assert.doesNotMatch(migrationSql, /GRANT\s+(?:SELECT\s*,\s*)?(?:INSERT\s*,\s*)?UPDATE\s*,?\s*DELETE\s+ON\s+ledger_user_backups/i);
});

test('migration makes user backups immutable to direct UPDATE and DELETE', () => {
  assert.ok(migrationSql, 'authenticated persistence migration must exist');
  assert.match(migrationSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+reject_ledger_user_backup_mutation/i);
  assert.match(migrationSql, /BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+ledger_user_backups/i);
  assert.match(migrationSql, /ENABLE\s+ALWAYS\s+TRIGGER\s+ledger_user_backups_immutable/i);
  assert.match(migrationSql, /RAISE\s+EXCEPTION\s+['"]ledger_user_backups rows are immutable['"]/i);
});
