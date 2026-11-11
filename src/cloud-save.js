import { validateSave } from './model.js';

const LINK_KEY = 'dbdTrackerCloudLink';
const serialize = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

export function createCloudSave({ storage, getSave, replaceSave, preserve, fetch = globalThis.fetch, onChange = () => {} }) {
  const state = { status: 'signed-out', message: 'Saved on this device.', remote: null, busy: false };
  let userId = null, link = null, queue = Promise.resolve();
  const publish = (status, message) => { Object.assign(state, { status, message }); onChange(state); };
  function run(action) {
    queue = queue.then(async () => {
      state.busy = true; onChange(state);
      try { await action(); }
      catch (error) { publish('error', error.message || 'Cloud save unavailable. Your local save is preserved.'); }
      finally { state.busy = false; onChange(state); }
    });
    return queue;
  }
  async function request(method = 'GET', body) {
    const response = await fetch('/api/ledger/state', {
      method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: serialize(body) } : {}),
    });
    if (response.status === 404 && method === 'GET') return null;
    if (response.status === 409) return { conflict: true };
    if (!response.ok) throw Error(response.status === 401 ? 'Sign in again to resume cloud saves. Local changes are preserved.' : 'Cloud save unavailable. Local changes are preserved; retry when connected.');
    const result = await response.json();
    if (!Number.isSafeInteger(result?.revision) || result.revision < 1) throw Error('Cloud response was invalid. Local data is unchanged.');
    return { ...result, data: validateSave(result.data).save };
  }
  function remember(remote) {
    const next = { userId, revision: remote.revision, base: remote.data };
    storage.setItem(LINK_KEY, serialize(next));
    link = next; state.remote = remote;
    publish('saved', 'Saved to your account.');
  }
  function conflict(remote) {
    preserve(getSave(), 'Local version before cloud conflict');
    if (remote) preserve(remote.data, `Cloud version ${remote.revision} before conflict`);
    state.remote = remote;
    publish('conflict', 'This device and the cloud have different changes. Both copies are preserved. Choose which to use.');
  }
  async function upload(expectedRevision) {
    const data = getSave();
    const result = await request('PUT', { expectedRevision, data });
    if (result.conflict) return conflict(await request());
    remember(result);
    // A local edit may have arrived while the request was in flight.
    if (serialize(getSave()) !== serialize(data)) await synchronize();
  }
  async function synchronize() {
    if (!userId) return;
    publish('pending', 'Checking cloud save…');
    const remote = await request();
    state.remote = remote;
    if (!link) return publish('unlinked', 'Choose this device’s save or the cloud save to connect.');
    if (!remote) return conflict(null);
    const local = serialize(getSave());
    if (local === serialize(remote.data)) return remember(remote);
    if (remote.revision === link.revision) return upload(link.revision);
    if (local === serialize(link.base)) {
      await replaceSave(remote.data);
      return remember(remote);
    }
    return conflict(remote);
  }
  return {
    state,
    connect: id => run(async () => {
      if (typeof id !== 'string' || !id) throw Error('Sign in before connecting a save.');
      userId = id; link = null;
      const raw = storage.getItem(LINK_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.userId === id && Number.isSafeInteger(stored.revision) && stored.revision > 0) {
          link = { ...stored, base: validateSave(stored.base).save };
        }
      }
      await synchronize();
    }),
    disconnect: () => run(async () => {
      userId = null; link = null; state.remote = null;
      publish('signed-out', 'Signed out. Your local save is preserved.');
    }),
    sync: () => run(synchronize),
    choose: choice => run(async () => {
      if (!userId || !['local', 'cloud'].includes(choice)) throw Error('Sign in and choose a save.');
      if (!['unlinked', 'conflict'].includes(state.status)) throw Error('Refresh cloud status before choosing a save.');
      const remote = state.remote;
      preserve(getSave(), 'Before connecting or resolving cloud save');
      if (remote) preserve(remote.data, `Cloud version ${remote.revision} before choosing a save`);
      if (choice === 'cloud') {
        if (!remote) throw Error('No cloud save exists yet.');
        await replaceSave(remote.data);
        remember(remote);
        await synchronize();
      } else {
        // Persist a fresh device save too, so reloads retain the exact linked baseline.
        await replaceSave(getSave());
        await upload(remote?.revision ?? 0);
      }
    }),
  };
}
