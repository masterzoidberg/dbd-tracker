import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSave } from '../src/model.js';
import { schemaV1Fixture } from './fixtures/schema-v1.js';
import { schemaV2Fixture } from './fixtures/schema-v2.js';
import { hostedSaveV3Fixture } from './fixtures/hosted-save.js';

let createUserPersistenceHandlers;
try {
  ({ createUserPersistenceHandlers } = await import('../src/user-persistence/handlers.js'));
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

const ledgerRoutes = {};
for (const [name, path] of [
  ['state', '../api/ledger/state.js'],
  ['backups', '../api/ledger/backups.js'],
  ['backup', '../api/ledger/backups/[id].js'],
]) {
  try {
    ledgerRoutes[name] = (await import(path)).default;
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }
}

const previewEnv = {
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'dbd-tracker-git-codex-ledger-authenticated-boundary.vercel.app',
};
const previewOrigin = `https://${previewEnv.VERCEL_URL}`;
const sessions = new Map([
  ['better-auth.session_token=session-a', { userId: 'synthetic-user-a', sessionId: 'session-a' }],
  ['better-auth.session_token=session-b', { userId: 'synthetic-user-b', sessionId: 'session-b' }],
]);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function createMemoryRepository() {
  const users = new Map();
  let nextBackupId = 1;
  let writes = 0;

  function userData(userId) {
    let data = users.get(userId);
    if (!data) {
      data = { state: null, backups: new Map() };
      users.set(userId, data);
    }
    return data;
  }

  return {
    async withUser(userId, callback) {
      const owner = userData(userId);
      return callback({
        async readState() {
          return clone(owner.state);
        },
        async compareAndSwapState(expectedRevision, data) {
          const revision = owner.state?.revision ?? 0;
          if (revision !== expectedRevision) return null;
          owner.state = { revision: revision + 1, data: clone(data), updatedAt: '2026-11-02T12:00:00.000Z' };
          writes += 1;
          return clone(owner.state);
        },
        async createBackup() {
          if (!owner.state) return null;
          const id = `00000000-0000-4000-8000-${String(nextBackupId++).padStart(12, '0')}`;
          const backup = {
            id,
            sourceRevision: owner.state.revision,
            data: clone(owner.state.data),
            createdAt: '2026-11-02T12:00:00.000Z',
          };
          owner.backups.set(id, backup);
          return clone(backup);
        },
        async listBackups() {
          return [...owner.backups.values()].reverse().map(({ id, sourceRevision, createdAt }) => ({ id, sourceRevision, createdAt }));
        },
        async readBackup(id) {
          return clone(owner.backups.get(id) ?? null);
        },
      });
    },
    snapshot(userId) {
      return clone(users.get(userId)?.state ?? null);
    },
    get writes() { return writes; },
  };
}

function createHarness({
  env = previewEnv,
  repository = createMemoryRepository(),
  resolveSession = async req => sessions.get(req.headers?.cookie) ?? null,
  getRepository,
} = {}) {
  let repositoryLookups = 0;
  const handlers = typeof createUserPersistenceHandlers === 'function'
    ? createUserPersistenceHandlers({
      env,
      validateSave,
      resolveSession,
      getRepository: getRepository ?? (() => {
        repositoryLookups += 1;
        return repository;
      }),
    })
    : null;
  return {
    handlers,
    repository,
    get repositoryLookups() { return repositoryLookups; },
  };
}

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invoke(handler, { method, body, query, headers = {} } = {}) {
  const res = response();
  await handler({ method, body, query, headers }, res);
  return res;
}

function requireHandlers(harness) {
  assert.equal(typeof createUserPersistenceHandlers, 'function', 'createUserPersistenceHandlers must be implemented');
  assert.ok(harness.handlers, 'user persistence handlers must be constructed');
  return harness.handlers;
}

function sameOriginHeaders(cookie = 'better-auth.session_token=session-a') {
  return { cookie, origin: previewOrigin, host: previewEnv.VERCEL_URL };
}

test('non-hosted requests return 404 before resolving a session or constructing the repository', async () => {
  let sessionLookups = 0;
  const harness = createHarness({
    env: { VERCEL_ENV: 'development' },
    resolveSession: async () => { sessionLookups += 1; return null; },
  });
  const handlers = requireHandlers(harness);

  const result = await invoke(handlers.state, { method: 'GET' });

  assert.equal(result.statusCode, 404);
  assert.deepEqual(result.body, { error: 'Not found.' });
  assert.equal(sessionLookups, 0);
  assert.equal(harness.repositoryLookups, 0);
});

test('Production state still requires an authenticated session', async () => {
  const harness = createHarness({ env: { ...previewEnv, VERCEL_ENV: 'production' } });
  const result = await invoke(requireHandlers(harness).state, { method: 'GET', headers: {} });
  assert.equal(result.statusCode, 401);
});

test('Production writes accept the stable production origin but reject unrelated origins', async () => {
  const harness = createHarness({ env: { ...previewEnv, VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'dbd-tracker-opal.vercel.app' } });
  const handlers = requireHandlers(harness);
  for (const [origin, expected] of [['https://dbd-tracker-opal.vercel.app', 401], ['https://attacker.invalid', 403]]) {
    const result = await invoke(handlers.backups, { method: 'POST', headers: { origin } });
    assert.equal(result.statusCode, expected);
  }
});

test('missing or expired sessions return 401 without constructing the user repository', async t => {
  for (const [name, cookie] of [['missing', undefined], ['expired', 'better-auth.session_token=expired']]) {
    await t.test(name, async () => {
      const harness = createHarness();
      const handlers = requireHandlers(harness);
      const headers = cookie === undefined
        ? { origin: previewOrigin, host: previewEnv.VERCEL_URL }
        : sameOriginHeaders(cookie);

      const result = await invoke(handlers.state, { method: 'GET', headers });

      assert.equal(result.statusCode, 401);
      assert.deepEqual(result.body, { error: 'Authentication required.' });
      assert.equal(harness.repositoryLookups, 0);
    });
  }
});

test('each authenticated request resolves its server session exactly once', async () => {
  let sessionLookups = 0;
  const harness = createHarness({
    resolveSession: async () => {
      sessionLookups += 1;
      return { userId: 'synthetic-user-a', sessionId: 'session-a' };
    },
  });
  const handlers = requireHandlers(harness);

  await invoke(handlers.state, { method: 'GET', headers: sameOriginHeaders() });

  assert.equal(sessionLookups, 1);
});

test('PUT state and POST backup require an exact same-origin Origin before session or repository access', async t => {
  const cases = [
    ['state without Origin', 'PUT', undefined],
    ['state from another origin', 'PUT', 'https://attacker.example'],
    ['backup without Origin', 'POST', undefined],
    ['backup from another origin', 'POST', 'https://attacker.example'],
  ];

  for (const [name, method, origin] of cases) {
    await t.test(name, async () => {
      let sessionLookups = 0;
      const harness = createHarness({
        resolveSession: async () => { sessionLookups += 1; return sessions.get('better-auth.session_token=session-a'); },
      });
      const handlers = requireHandlers(harness);
      const headers = { cookie: 'better-auth.session_token=session-a', host: previewEnv.VERCEL_URL };
      if (origin !== undefined) headers.origin = origin;

      const result = await invoke(method === 'PUT' ? handlers.state : handlers.backups, {
        method,
        body: method === 'PUT' ? { expectedRevision: 0, data: hostedSaveV3Fixture() } : undefined,
        headers,
      });

      assert.equal(result.statusCode, 403);
      assert.deepEqual(result.body, { error: 'Same-origin request required.' });
      assert.equal(sessionLookups, 0);
      assert.equal(harness.repositoryLookups, 0);
      assert.equal(harness.repository.writes, 0);
    });
  }
});

test('schema v3 writes round-trip and schema v1/v2 inputs are stored as canonical v3', async t => {
  const cases = [
    ['v3', hostedSaveV3Fixture()],
    ['v2', schemaV2Fixture()],
    ['v1', schemaV1Fixture()],
  ];

  for (const [name, data] of cases) {
    await t.test(name, async () => {
      const harness = createHarness();
      const handlers = requireHandlers(harness);
      const written = await invoke(handlers.state, {
        method: 'PUT',
        body: { expectedRevision: 0, data },
        headers: sameOriginHeaders(),
      });
      const read = await invoke(handlers.state, { method: 'GET', headers: sameOriginHeaders() });

      assert.equal(written.statusCode, 200);
      assert.equal(written.body.revision, 1);
      assert.equal(written.body.data.schemaVersion, 3);
      assert.deepEqual(read.body, written.body);
      assert.deepEqual(written.body.data, validateSave(data).save);
    });
  }
});

test('missing, negative, fractional, and unsafe expected revisions return 400 without repository access', async t => {
  const cases = [
    ['missing', undefined],
    ['negative', -1],
    ['fractional', 1.5],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
  ];
  for (const [name, expectedRevision] of cases) {
    await t.test(name, async () => {
      const harness = createHarness();
      const handlers = requireHandlers(harness);
      const body = { data: hostedSaveV3Fixture() };
      if (expectedRevision !== undefined) body.expectedRevision = expectedRevision;

      const result = await invoke(handlers.state, { method: 'PUT', body, headers: sameOriginHeaders() });

      assert.equal(result.statusCode, 400);
      assert.equal(harness.repositoryLookups, 0);
    });
  }
});

test('state writes reject client-supplied owner IDs and extra request fields before mutation', async t => {
  for (const body of [
    { expectedRevision: 0, data: hostedSaveV3Fixture(), userId: 'synthetic-user-b' },
    { expectedRevision: 0, data: hostedSaveV3Fixture(), ownerId: 'synthetic-user-b' },
  ]) {
    await t.test(Object.keys(body).at(-1), async () => {
      const harness = createHarness();
      const handlers = requireHandlers(harness);
      const result = await invoke(handlers.state, { method: 'PUT', body, headers: sameOriginHeaders() });

      assert.equal(result.statusCode, 400);
      assert.equal(harness.repository.writes, 0);
      assert.equal(harness.repositoryLookups, 0);
    });
  }
});

test('authenticated users have independent state and backups; a foreign backup is indistinguishable from missing', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  const stateA = hostedSaveV3Fixture();
  stateA.characters['meg-thomas'].notes = 'synthetic account A';
  const stateB = hostedSaveV3Fixture();
  stateB.characters['meg-thomas'].notes = 'synthetic account B';

  const writeA = await invoke(handlers.state, {
    method: 'PUT', body: { expectedRevision: 0, data: stateA }, headers: sameOriginHeaders(),
  });
  const stateBeforeBWrite = await invoke(handlers.state, {
    method: 'GET', headers: sameOriginHeaders('better-auth.session_token=session-b'),
  });
  const writeB = await invoke(handlers.state, {
    method: 'PUT', body: { expectedRevision: 0, data: stateB },
    headers: sameOriginHeaders('better-auth.session_token=session-b'),
  });
  const backupA = await invoke(handlers.backups, { method: 'POST', headers: sameOriginHeaders() });
  const listA = await invoke(handlers.backups, { method: 'GET', headers: sameOriginHeaders() });
  const listB = await invoke(handlers.backups, { method: 'GET', headers: sameOriginHeaders('better-auth.session_token=session-b') });
  const foreignRead = await invoke(handlers.backup, {
    method: 'GET', query: { id: backupA.body.id },
    headers: sameOriginHeaders('better-auth.session_token=session-b'),
  });
  const missingRead = await invoke(handlers.backup, {
    method: 'GET', query: { id: '00000000-0000-4000-8000-999999999999' }, headers: sameOriginHeaders(),
  });

  assert.equal(writeA.body.revision, 1);
  assert.equal(stateBeforeBWrite.statusCode, 404);
  assert.equal(writeB.body.revision, 1);
  assert.notDeepEqual(harness.repository.snapshot('synthetic-user-a'), harness.repository.snapshot('synthetic-user-b'));
  assert.equal(backupA.statusCode, 201);
  assert.deepEqual(listA.body, [{ id: backupA.body.id, sourceRevision: 1, createdAt: backupA.body.createdAt }]);
  assert.deepEqual(listB.body, []);
  assert.equal(foreignRead.statusCode, 404);
  assert.deepEqual(foreignRead.body, missingRead.body);
});

test('state reads reject client-supplied owner query parameters', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  const data = hostedSaveV3Fixture();
  data.characters['meg-thomas'].notes = 'belongs to account A';

  await invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 0, data }, headers: sameOriginHeaders() });
  for (const field of ['userId', 'ownerId']) {
    const read = await invoke(handlers.state, {
      method: 'GET', query: { [field]: 'synthetic-user-b' }, headers: sameOriginHeaders(),
    });

    assert.equal(read.statusCode, 400);
    assert.deepEqual(read.body, { error: 'Invalid request.' });
  }
});

test('backup listing rejects client-supplied owner query parameters', async () => {
  const harness = createHarness();
  const result = await invoke(requireHandlers(harness).backups, {
    method: 'GET', query: { ownerId: 'synthetic-user-b' }, headers: sameOriginHeaders(),
  });
  assert.equal(result.statusCode, 400);
  assert.equal(harness.repositoryLookups, 0);
});

test('stale same-user revisions return 409 without changing the stored document', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  const original = hostedSaveV3Fixture();
  await invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 0, data: original }, headers: sameOriginHeaders() });
  const before = harness.repository.snapshot('synthetic-user-a');
  const stale = hostedSaveV3Fixture();
  stale.characters['meg-thomas'].notes = 'must not persist';

  const result = await invoke(handlers.state, {
    method: 'PUT', body: { expectedRevision: 0, data: stale }, headers: sameOriginHeaders(),
  });

  assert.equal(result.statusCode, 409);
  assert.deepEqual(harness.repository.snapshot('synthetic-user-a'), before);
});

test('concurrent writes with the same user revision produce exactly one winner', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  await invoke(handlers.state, {
    method: 'PUT', body: { expectedRevision: 0, data: hostedSaveV3Fixture() }, headers: sameOriginHeaders(),
  });
  const first = hostedSaveV3Fixture();
  first.characters['meg-thomas'].notes = 'synthetic writer A';
  const second = hostedSaveV3Fixture();
  second.characters['meg-thomas'].notes = 'synthetic writer B';

  const results = await Promise.all([
    invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 1, data: first }, headers: sameOriginHeaders() }),
    invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 1, data: second }, headers: sameOriginHeaders() }),
  ]);

  assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 409]);
  assert.equal(harness.repository.snapshot('synthetic-user-a').revision, 2);
});

test('malformed, unsupported, and invalid save documents return 400 without constructing the repository', async t => {
  const cases = [
    ['malformed JSON', '{broken'],
    ['unsupported schema', { ...hostedSaveV3Fixture(), schemaVersion: 4 }],
    ['invalid v3 field', { ...hostedSaveV3Fixture(), planning: { invalid: true } }],
  ];
  for (const [name, data] of cases) {
    await t.test(name, async () => {
      const harness = createHarness();
      const handlers = requireHandlers(harness);
      const result = await invoke(handlers.state, {
        method: 'PUT', body: { expectedRevision: 0, data }, headers: sameOriginHeaders(),
      });
      assert.equal(result.statusCode, 400);
      assert.equal(harness.repositoryLookups, 0);
    });
  }
});

test('backup creation rejects client-supplied ownership fields', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);

  const result = await invoke(handlers.backups, {
    method: 'POST', body: { userId: 'synthetic-user-b' }, headers: sameOriginHeaders(),
  });

  assert.equal(result.statusCode, 400);
  assert.equal(harness.repositoryLookups, 0);
});

test('repository failures return a generic 500 without exposing internal details', async () => {
  const harness = createHarness({
    getRepository() { throw new Error('postgresql://synthetic-secret@db.invalid'); },
  });
  const handlers = requireHandlers(harness);

  const result = await invoke(handlers.state, { method: 'GET', headers: sameOriginHeaders() });

  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { error: 'Internal server error.' });
  assert.doesNotMatch(JSON.stringify(result.body), /synthetic-secret|db\.invalid/);
});

test('a request without an auth cookie returns 401 without constructing the auth database runtime', async () => {
  const keys = ['VERCEL_ENV', 'VERCEL_URL', 'DATABASE_URL', 'BETTER_AUTH_SECRET'];
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  process.env.VERCEL_ENV = 'preview';
  for (const key of keys.slice(1)) delete process.env[key];
  try {
    const result = await invoke(ledgerRoutes.state, { method: 'GET' });
    assert.equal(result.statusCode, 401);
    assert.deepEqual(result.body, { error: 'Authentication required.' });
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('root ledger API route modules exist and return 404 outside hosted environments before auth runtime construction', async () => {
  for (const name of ['state', 'backups', 'backup']) {
    assert.equal(typeof ledgerRoutes[name], 'function', `${name} route must be deployed as a root API Function`);
  }

  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'development';
  try {
    assert.equal((await invoke(ledgerRoutes.state, { method: 'GET' })).statusCode, 404);
    assert.equal((await invoke(ledgerRoutes.backups, { method: 'POST' })).statusCode, 404);
    assert.equal((await invoke(ledgerRoutes.backup, { method: 'GET', query: { id: 'bad' } })).statusCode, 404);
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});
