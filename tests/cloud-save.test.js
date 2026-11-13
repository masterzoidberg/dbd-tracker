import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave } from '../src/model.js';
import { createCloudSave } from '../src/cloud-save.js';

function harness() {
  let local = freshSave(), remote = null, online = true, beforePut = () => {}, preserveFails = false, pointFails = false;
  const values = new Map(), backups = [], cloudPoints = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const options = { storage, getSave: () => structuredClone(local),
    replaceSave: data => { backups.push(structuredClone(local)); local = structuredClone(data); },
    preserve: (data, reason) => { if (preserveFails) throw Error('Storage full'); backups.push({ data: structuredClone(data), reason }); },
    fetch: async (url, options = {}) => {
      if (!online) throw Error('offline');
      if (url === '/api/ledger/backups' && options.method === 'POST') {
        if (!remote || pointFails) return Response.json({}, { status: 500 });
        const point = { sourceRevision: remote.revision, data: structuredClone(remote.data) };
        cloudPoints.push(point); return Response.json(point, { status: 201 });
      }
      if (options.method === 'PUT') {
        await beforePut();
        const body = JSON.parse(options.body);
        if (body.expectedRevision !== (remote?.revision ?? 0)) return Response.json({}, { status: 409 });
        remote = { revision: (remote?.revision ?? 0) + 1, data: body.data };
      }
      return remote ? Response.json(remote) : Response.json({}, { status: 404 });
    },
  };
  let cloud = createCloudSave(options);
  return { get cloud() { return cloud; }, values, backups, cloudPoints,
    get local() { return local; }, set local(value) { local = value; },
    get remote() { return remote; }, set remote(value) { remote = value; },
    set online(value) { online = value; },
    set beforePut(value) { beforePut = value; },
    set preserveFails(value) { preserveFails = value; },
    set pointFails(value) { pointFails = value; },
    reload() { cloud = createCloudSave(options); },
  };
}
const edited = (save, value) => ({ ...structuredClone(save), updatedAt: value });

test('first connection requires a choice and preserves local data before uploading', async () => {
  const h = harness();
  await h.cloud.connect('owner');
  assert.equal(h.remote, null);
  assert.equal(h.cloud.state.status, 'unlinked');
  await h.cloud.choose('local');
  assert.deepEqual(h.remote.data, h.local);
  assert.ok(h.backups.length > 0);
  assert.equal(h.cloud.state.status, 'saved');
});

test('choosing a device save preserves the existing cloud save point before overwriting it', async () => {
  const h = harness();
  const oldCloud = edited(freshSave(), '2026-11-11T17:00:00.000Z');
  const device = edited(freshSave(), '2026-11-11T18:00:00.000Z');
  h.remote = { revision: 1, data: oldCloud }; h.local = device;
  await h.cloud.connect('owner'); await h.cloud.choose('local');
  assert.deepEqual(h.cloudPoints, [{ sourceRevision: 1, data: oldCloud }]);
  assert.deepEqual(h.remote.data, device);
});

test('a failed cloud save point blocks replacing the existing cloud save', async () => {
  const h = harness();
  const oldCloud = edited(freshSave(), '2026-11-11T17:00:00.000Z');
  h.remote = { revision: 1, data: oldCloud };
  await h.cloud.connect('owner'); h.pointFails = true;
  await h.cloud.choose('local');
  assert.equal(h.cloud.state.status, 'error');
  assert.deepEqual(h.remote.data, oldCloud);
});

test('edits arriving during an upload are subsequently uploaded without being lost', async () => {
  const h = harness();
  await h.cloud.connect('owner'); await h.cloud.choose('local');
  h.local = edited(h.local, '2026-11-11T17:00:00.000Z');
  h.beforePut = () => { h.beforePut = () => {}; h.local = edited(h.local, '2026-11-11T18:00:00.000Z'); };
  await h.cloud.sync();
  assert.equal(h.remote.data.updatedAt, '2026-11-11T18:00:00.000Z');
  assert.equal(h.remote.revision, 3);
});

test('a revision race during an explicit choice preserves the newer cloud version', async () => {
  const h = harness();
  await h.cloud.connect('owner');
  h.beforePut = () => { h.beforePut = () => {}; h.remote = { revision: 1, data: edited(h.local, '2026-11-11T19:00:00.000Z') }; };
  await h.cloud.choose('local');
  assert.equal(h.cloud.state.status, 'conflict');
  assert.equal(h.remote.data.updatedAt, '2026-11-11T19:00:00.000Z');
});

test('a failed local backup prevents linking and overwriting cloud data', async () => {
  const h = harness();
  await h.cloud.connect('owner'); h.preserveFails = true;
  await h.cloud.choose('local');
  assert.equal(h.cloud.state.status, 'error'); assert.equal(h.remote, null);
});

test('offline edits survive reload and upload when the cloud revision is unchanged', async () => {
  const h = harness();
  await h.cloud.connect('owner'); await h.cloud.choose('local');
  h.online = false;
  h.local = edited(h.local, '2026-11-11T10:00:00.000Z');
  await h.cloud.sync();
  assert.equal(h.cloud.state.status, 'error');
  h.reload(); h.online = true;
  await h.cloud.connect('owner');
  assert.deepEqual(h.remote.data, h.local);
  assert.equal(h.remote.revision, 2);
});

test('new cloud revision loads only when local data has no unsynced edits', async () => {
  const h = harness();
  await h.cloud.connect('owner'); await h.cloud.choose('local');
  const before = h.local;
  h.remote = { revision: 2, data: edited(before, '2026-11-11T11:00:00.000Z') };
  await h.cloud.sync();
  assert.deepEqual(h.local, h.remote.data);
  assert.ok(h.backups.some(value => JSON.stringify(value) === JSON.stringify(before)));
});

test('concurrent edits preserve both copies and require an explicit choice, including after reload', async () => {
  const h = harness();
  await h.cloud.connect('owner'); await h.cloud.choose('local');
  h.local = edited(h.local, '2026-11-11T12:00:00.000Z');
  h.remote = { revision: 2, data: edited(h.local, '2026-11-11T13:00:00.000Z') };
  const local = structuredClone(h.local), remote = structuredClone(h.remote);
  await h.cloud.sync();
  assert.equal(h.cloud.state.status, 'conflict');
  assert.deepEqual(h.local, local); assert.deepEqual(h.remote, remote);
  assert.deepEqual(h.backups.find(value => value.data?.updatedAt === remote.data.updatedAt)?.data, remote.data);
  h.reload(); await h.cloud.connect('owner');
  assert.equal(h.cloud.state.status, 'conflict');
  await h.cloud.choose('local');
  assert.deepEqual(h.remote.data, local); assert.equal(h.remote.revision, 3);
});

test('imported local data cannot silently overwrite a newer cloud revision', async () => {
  const h = harness();
  await h.cloud.connect('owner'); await h.cloud.choose('local');
  h.local = edited(freshSave(), '2026-11-11T14:00:00.000Z');
  h.remote = { revision: 2, data: edited(h.remote.data, '2026-11-11T15:00:00.000Z') };
  await h.cloud.sync();
  assert.equal(h.cloud.state.status, 'conflict');
  await h.cloud.choose('cloud');
  assert.deepEqual(h.local, h.remote.data); assert.equal(h.remote.revision, 2);
});

test('a different account cannot inherit the linked save or upload automatically', async () => {
  const h = harness();
  await h.cloud.connect('owner'); await h.cloud.choose('local');
  h.local = edited(h.local, '2026-11-11T16:00:00.000Z');
  await h.cloud.connect('other');
  assert.equal(h.cloud.state.status, 'unlinked');
  assert.equal(h.remote.revision, 1);
});
