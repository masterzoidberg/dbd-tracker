import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSave } from '../src/model.js';
import { schemaV2Fixture } from './fixtures/schema-v2.js';
import { hostedSaveV3Fixture } from './fixtures/hosted-save.js';

let createProofHandlers;
try {
  ({ createProofHandlers } = await import('../src/hosted-proof/handlers.js'));
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

const fixedDbTime = '2026-10-29T12:01:00.000Z';

function clone(value) {
  return value === null ? null : structuredClone(value);
}

function createRepository() {
  let current = null;
  let nextBackup = 1;
  const backups = new Map();
  let writes = 0;

  return {
    async readCurrent() {
      return clone(current);
    },
    async compareAndSwapState(expectedRevision, data) {
      const actualRevision = current?.revision ?? 0;
      if (actualRevision !== expectedRevision) return null;
      current = {
        revision: actualRevision + 1,
        data: clone(data),
        updatedAt: fixedDbTime,
      };
      writes += 1;
      return clone(current);
    },
    async createBackup() {
      if (!current) return null;
      const backup = {
        id: `synthetic-backup-${nextBackup++}`,
        sourceRevision: current.revision,
        data: clone(current.data),
        createdAt: fixedDbTime,
      };
      backups.set(backup.id, backup);
      return clone(backup);
    },
    async readBackup(id) {
      return clone(backups.get(id) ?? null);
    },
    snapshot() {
      return clone(current);
    },
    get writes() {
      return writes;
    },
  };
}

function createHarness({ env = { VERCEL_ENV: 'preview' }, repository = createRepository(), getRepository } = {}) {
  let constructions = 0;
  const handlers = createProofHandlers && createProofHandlers({
    env,
    validateSave,
    getRepository: getRepository ?? (() => {
      constructions += 1;
      return repository;
    }),
  });
  return {
    handlers,
    repository,
    get constructions() { return constructions; },
  };
}

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invoke(handler, { method, body, query } = {}) {
  const res = response();
  await handler({ method, body, query }, res);
  return res;
}

function requireHandlers(harness) {
  assert.equal(typeof createProofHandlers, 'function', 'createProofHandlers must be implemented');
  assert.ok(harness.handlers, 'proof handlers must be constructed');
  return harness.handlers;
}

test('the schema-v3 fixture is fresh, deterministic, and valid', () => {
  const first = hostedSaveV3Fixture();
  const second = hostedSaveV3Fixture();
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second);
  assert.equal(first.schemaVersion, 3);
  assert.equal(first.updatedAt, '2026-10-29T12:00:00.000Z');
  assert.equal(validateSave(first).save.schemaVersion, 3);
});

test('v3 state writes round-trip through the state endpoint', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  const save = hostedSaveV3Fixture();

  const written = await invoke(handlers.state, {
    method: 'PUT',
    body: { expectedRevision: 0, data: save },
  });
  const read = await invoke(handlers.state, { method: 'GET' });

  assert.equal(written.statusCode, 200);
  assert.deepEqual(written.body, { revision: 1, data: save, updatedAt: fixedDbTime });
  assert.equal(read.statusCode, 200);
  assert.deepEqual(read.body, written.body);
});

test('v2 state writes are migrated and stored as canonical schema v3', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  const legacy = schemaV2Fixture();

  const written = await invoke(handlers.state, {
    method: 'PUT',
    body: { expectedRevision: 0, data: legacy },
  });

  assert.equal(written.statusCode, 200);
  assert.equal(written.body.data.schemaVersion, 3);
  assert.equal(Object.hasOwn(written.body.data, 'prestigeQueue'), false);
  assert.deepEqual(written.body.data.planning.prestigeQueues, { survivor: [], killer: [] });
  assert.equal(harness.repository.snapshot().data.schemaVersion, 3);
});

test('expected revision zero creates revision one and a matching revision one write creates revision two', async () => {
  const handlers = requireHandlers(createHarness());
  const first = await invoke(handlers.state, {
    method: 'PUT', body: { expectedRevision: 0, data: hostedSaveV3Fixture() },
  });
  const secondSave = hostedSaveV3Fixture();
  secondSave.characters['meg-thomas'].notes = 'synthetic revision two';
  const second = await invoke(handlers.state, {
    method: 'PUT', body: { expectedRevision: 1, data: secondSave },
  });

  assert.equal(first.body.revision, 1);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.revision, 2);
  assert.equal(second.body.data.characters['meg-thomas'].notes, 'synthetic revision two');
});

test('stale expected revision returns 409 and preserves the current document', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  const initial = hostedSaveV3Fixture();
  await invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 0, data: initial } });
  const before = harness.repository.snapshot();
  const stale = hostedSaveV3Fixture();
  stale.characters['meg-thomas'].notes = 'must not persist';

  const result = await invoke(handlers.state, {
    method: 'PUT', body: { expectedRevision: 0, data: stale },
  });

  assert.equal(result.statusCode, 409);
  assert.deepEqual(harness.repository.snapshot(), before);
});

test('a backup remains an exact snapshot after a later state revision', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  const original = hostedSaveV3Fixture();
  await invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 0, data: original } });
  const created = await invoke(handlers.backups, { method: 'POST' });
  const later = hostedSaveV3Fixture();
  later.characters['meg-thomas'].notes = 'synthetic later state';
  await invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 1, data: later } });
  const readBack = await invoke(handlers.backup, {
    method: 'GET', query: { id: created.body.id },
  });

  assert.equal(created.statusCode, 201);
  assert.deepEqual(readBack.body, created.body);
  assert.deepEqual(readBack.body, {
    id: 'synthetic-backup-1',
    sourceRevision: 1,
    data: original,
    createdAt: fixedDbTime,
  });
});

test('malformed JSON, unsupported schemas, and invalid v3 fields return 400 before writes', async t => {
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
        method: 'PUT', body: { expectedRevision: 0, data },
      });
      assert.equal(result.statusCode, 400);
      assert.equal(harness.repository.writes, 0);
    });
  }
});

test('missing, negative, fractional, and unsafe expected revisions return 400 without writes', async t => {
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
      const result = await invoke(handlers.state, { method: 'PUT', body });
      assert.equal(result.statusCode, 400);
      assert.equal(harness.repository.writes, 0);
    });
  }
});

test('proof routes reject non-preview requests before repository construction', async () => {
  const harness = createHarness({ env: { VERCEL_ENV: 'production' } });
  const handlers = requireHandlers(harness);

  const result = await invoke(handlers.state, { method: 'GET' });

  assert.equal(result.statusCode, 404);
  assert.equal(harness.constructions, 0);
});

test('concurrent writers using one revision produce one success and one conflict', async () => {
  const harness = createHarness();
  const handlers = requireHandlers(harness);
  await invoke(handlers.state, {
    method: 'PUT', body: { expectedRevision: 0, data: hostedSaveV3Fixture() },
  });
  const first = hostedSaveV3Fixture();
  first.characters['meg-thomas'].notes = 'writer A';
  const second = hostedSaveV3Fixture();
  second.characters['meg-thomas'].notes = 'writer B';

  const results = await Promise.all([
    invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 1, data: first } }),
    invoke(handlers.state, { method: 'PUT', body: { expectedRevision: 1, data: second } }),
  ]);
  const successes = results.filter(result => result.statusCode === 200);
  const conflicts = results.filter(result => result.statusCode === 409);

  assert.equal(successes.length, 1);
  assert.equal(conflicts.length, 1);
  assert.equal(harness.repository.snapshot().revision, 2);
  assert.deepEqual(harness.repository.snapshot().data, successes[0].body.data);
  assert.ok(['writer A', 'writer B'].includes(harness.repository.snapshot().data.characters['meg-thomas'].notes));
});

test('unsupported methods return 405 and absent state or backups return 404', async () => {
  const handlers = requireHandlers(createHarness());
  assert.equal((await invoke(handlers.state, { method: 'POST' })).statusCode, 405);
  assert.equal((await invoke(handlers.state, { method: 'GET' })).statusCode, 404);
  assert.equal((await invoke(handlers.backups, { method: 'POST' })).statusCode, 404);
  assert.equal((await invoke(handlers.backup, { method: 'GET', query: { id: 'missing' } })).statusCode, 404);
});

test('database errors return generic 500 responses without exposing details', async () => {
  const harness = createHarness({
    getRepository() {
      throw new Error('postgres://synthetic-secret@db.invalid/ledger');
    },
  });
  const handlers = requireHandlers(harness);
  const result = await invoke(handlers.state, { method: 'GET' });

  assert.equal(result.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(result.body), /synthetic-secret|postgres:\/\//);
});
