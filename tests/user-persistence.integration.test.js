import test from 'node:test';
import assert from 'node:assert/strict';

let verifyAuthenticatedPersistence;
let runVerifierCli;
try {
  ({ verifyAuthenticatedPersistence, runVerifierCli } = await import('../scripts/verify-authenticated-persistence.mjs'));
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

const previewUrl = 'https://dbd-tracker-580wl1mmr-nick-queens-projects.vercel.app';

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function jsonResponse(status, body, cookies = []) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      getSetCookie() { return cookies; },
      get(name) { return name.toLowerCase() === 'set-cookie' ? cookies.join(', ') : null; },
    },
    async json() { return clone(body); },
  };
}

function createSyntheticPreview({ preview = true } = {}) {
  const usersByEmail = new Map();
  const usersById = new Map();
  const sessions = new Map();
  const requests = [];
  let nextUserId = 1;
  let nextSessionId = 1;
  let nextBackupId = 1;

  function sessionFor(cookie) {
    const token = typeof cookie === 'string'
      ? cookie.split(';').map(part => part.trim()).find(part => /session_token=/.test(part))
      : null;
    return token ? sessions.get(token.split('=').slice(1).join('=')) : null;
  }

  async function fetchImpl(input, options = {}) {
    const url = new URL(input);
    const headers = options.headers ?? {};
    const cookie = headers.Cookie ?? headers.cookie;
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    requests.push({ path: url.pathname, method: options.method ?? 'GET', headers: clone(headers), body: clone(body) });

    if (!preview) return jsonResponse(404, { error: 'Not found.' });
    if (url.pathname === '/api/auth/get-session' && options.method !== 'POST') {
      const session = sessionFor(cookie);
      if (!session) return jsonResponse(200, null);
      return jsonResponse(200, { user: { id: session.user.id, email: session.user.email }, session: { id: session.sessionId } });
    }
    if (url.pathname === '/api/auth/sign-up/email' && options.method === 'POST') {
      if (!body.email?.endsWith('@example.invalid') || usersByEmail.has(body.email) || !body.name || !body.password) {
        return jsonResponse(400, { error: 'Invalid synthetic signup.' });
      }
      const user = { id: `synthetic-user-${nextUserId++}`, email: body.email, password: body.password };
      const account = { user, state: null, backups: new Map() };
      usersByEmail.set(user.email, account);
      usersById.set(user.id, account);
      return jsonResponse(200, { user: { id: user.id, email: user.email } });
    }
    if (url.pathname === '/api/auth/sign-in/email' && options.method === 'POST') {
      const account = usersByEmail.get(body.email);
      if (!account || account.user.password !== body.password) return jsonResponse(401, { error: 'Invalid credentials.' });
      const token = `synthetic-session-${nextSessionId++}`;
      const sessionId = `synthetic-session-id-${nextSessionId++}`;
      sessions.set(token, { user: account.user, sessionId });
      return jsonResponse(200, { user: { id: account.user.id, email: account.user.email } }, [`__Secure-better-auth.session_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`]);
    }

    const session = sessionFor(cookie);
    if (!session) return jsonResponse(401, { error: 'Authentication required.' });
    const account = usersById.get(session.user.id);
    if (url.pathname === '/api/ledger/state' && options.method === 'PUT') {
      if (Object.hasOwn(body ?? {}, 'userId') || Object.keys(body ?? {}).length !== 2) return jsonResponse(400, { error: 'Invalid request.' });
      const revision = account.state?.revision ?? 0;
      if (revision !== body.expectedRevision) return jsonResponse(409, { error: 'Revision conflict.' });
      account.state = { revision: revision + 1, data: clone(body.data), updatedAt: '2026-11-02T12:00:00.000Z' };
      return jsonResponse(200, clone(account.state));
    }
    if (url.pathname === '/api/ledger/state' && options.method === 'GET') {
      if (url.searchParams.has('userId') || url.searchParams.has('ownerId')) return jsonResponse(400, { error: 'Invalid request.' });
      return account.state ? jsonResponse(200, clone(account.state)) : jsonResponse(404, { error: 'State not found.' });
    }
    if (url.pathname === '/api/ledger/backups' && options.method === 'POST') {
      if (!account.state) return jsonResponse(404, { error: 'State not found.' });
      const id = `00000000-0000-4000-8000-${String(nextBackupId++).padStart(12, '0')}`;
      const backup = { id, sourceRevision: account.state.revision, data: clone(account.state.data), createdAt: '2026-11-02T12:00:00.000Z' };
      account.backups.set(id, backup);
      return jsonResponse(201, clone(backup));
    }
    if (url.pathname.startsWith('/api/ledger/backups/') && options.method === 'GET') {
      const backup = account.backups.get(url.pathname.split('/').at(-1));
      return backup ? jsonResponse(200, clone(backup)) : jsonResponse(404, { error: 'Backup not found.' });
    }
    if (url.pathname.startsWith('/api/ledger/backups/')) return jsonResponse(405, { error: 'Method not allowed.' });
    return jsonResponse(404, { error: 'Not found.' });
  }

  return { fetchImpl, requests, usersByEmail, usersById };
}

function requireVerifier() {
  assert.equal(typeof verifyAuthenticatedPersistence, 'function', 'verifyAuthenticatedPersistence must be implemented');
  assert.equal(typeof runVerifierCli, 'function', 'runVerifierCli must be implemented');
}

test('missing or invalid Preview URL is rejected before any request', async () => {
  requireVerifier();
  let requests = 0;
  const fetchImpl = async () => { requests += 1; return jsonResponse(200, null); };

  await assert.rejects(verifyAuthenticatedPersistence(undefined, { fetchImpl }), /explicit Preview URL/i);
  await assert.rejects(verifyAuthenticatedPersistence('http://preview.example.test', { fetchImpl }), /explicit Preview URL/i);
  await assert.rejects(verifyAuthenticatedPersistence(`${previewUrl}/path`, { fetchImpl }), /explicit Preview URL/i);
  assert.equal(requests, 0);
});

test('CLI accepts only an explicit URL and does not accept accounts or credentials', async () => {
  requireVerifier();
  let requests = 0;
  const fetchImpl = async () => { requests += 1; return jsonResponse(200, null); };

  await assert.rejects(runVerifierCli([], { fetchImpl }), /--url/i);
  await assert.rejects(runVerifierCli(['--url', previewUrl, '--email', 'person@example.com'], { fetchImpl }), /--url/i);
  assert.equal(requests, 0);
});

test('CLI forwards the local Vercel trusted-source token on every Preview request', async () => {
  requireVerifier();
  const previousToken = process.env.VERCEL_OIDC_TOKEN;
  const token = 'synthetic-trusted-source-token';
  process.env.VERCEL_OIDC_TOKEN = token;
  const hosted = createSyntheticPreview();

  try {
    const result = await runVerifierCli(['--url', previewUrl], { fetchImpl: hosted.fetchImpl });
    assert.equal(hosted.requests.length > 0, true);
    assert.ok(hosted.requests.every(request => request.headers['x-vercel-trusted-oidc-idp-token'] === token));
    assert.equal(JSON.stringify(result).includes(token), false);
  } finally {
    if (previousToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = previousToken;
  }
});

test('CLI does not send the trusted-source token to a different Vercel project', async () => {
  requireVerifier();
  const previousToken = process.env.VERCEL_OIDC_TOKEN;
  process.env.VERCEL_OIDC_TOKEN = 'synthetic-trusted-source-token';
  let requests = 0;
  const fetchImpl = async () => { requests += 1; return jsonResponse(200, null); };

  try {
    await assert.rejects(
      runVerifierCli(['--url', 'https://dbd-tracker-attacker-nick-queens-projects.vercel.app'], { fetchImpl }),
      /dbd-tracker Preview host/i,
    );
    assert.equal(requests, 0);
  } finally {
    if (previousToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = previousToken;
  }
});

test('a Production deployment is rejected before synthetic account creation', async () => {
  requireVerifier();
  const hosted = createSyntheticPreview({ preview: false });

  await assert.rejects(
    verifyAuthenticatedPersistence(previewUrl, { fetchImpl: hosted.fetchImpl }),
    /Preview deployment/i,
  );

  assert.equal(hosted.requests.length, 1);
  assert.equal(hosted.requests[0].path, '/api/auth/get-session');
  assert.equal(hosted.usersByEmail.size, 0);
});

test('verifier creates only synthetic users and proves independent state, backups, conflicts, and concurrent CAS', async () => {
  requireVerifier();
  const hosted = createSyntheticPreview();

  const result = await verifyAuthenticatedPersistence(previewUrl, { fetchImpl: hosted.fetchImpl });

  assert.equal(hosted.usersByEmail.size, 2);
  const passwords = [];
  const revisions = [];
  for (const [email, account] of hosted.usersByEmail) {
    assert.match(email, /^ledger-proof-[0-9a-f-]+@example\.invalid$/i);
    assert.equal(account.user.password.length >= 32, true);
    passwords.push(account.user.password);
    revisions.push(account.state.revision);
    assert.match(account.state.data.characters['meg-thomas'].notes, /^Synthetic/);
  }
  assert.notEqual(passwords[0], passwords[1]);
  assert.deepEqual(revisions.sort(), [1, 3]);
  assert.equal(result.independentUsers, true);
  assert.equal(result.unauthenticatedAccessRejected, true);
  assert.equal(result.foreignStateReadsContained, true);
  assert.equal(result.foreignStateWritesRejected, true);
  assert.equal(result.foreignBackupHidden, true);
  assert.equal(result.backupMutationRejected, true);
  assert.equal(result.staleWriteConflict, true);
  assert.equal(result.concurrentWinners, 1);
  assert.equal(typeof result.backupId, 'string');
  assert.equal(Object.hasOwn(result, 'userId'), false);
  assert.equal(Object.hasOwn(result, 'email'), false);
  assert.equal(Object.hasOwn(result, 'password'), false);
  assert.ok(hosted.requests.some(request => request.path === '/api/auth/sign-up/email'));
  assert.ok(hosted.requests.some(request => request.path === '/api/auth/sign-in/email'));
  assert.ok(hosted.requests.some(request => request.path === '/api/ledger/state' && request.method === 'GET' && !request.headers.cookie));
  assert.ok(hosted.requests.some(request => request.path === '/api/ledger/backups' && request.method === 'POST' && !request.headers.cookie));
  assert.equal(hosted.requests.filter(request => request.path === '/api/ledger/state' && request.method === 'PUT' && request.body?.userId).length, 2);
  assert.ok(hosted.requests.some(request => request.path.startsWith('/api/ledger/backups/') && request.method === 'DELETE'));
  assert.ok(hosted.requests.filter(request => request.path === '/api/ledger/state' && request.method === 'PUT' && !request.body?.userId)
    .every(request => Object.keys(request.body).sort().join(',') === 'data,expectedRevision'));
  assert.ok(hosted.requests.filter(request => ['PUT', 'POST'].includes(request.method) && request.headers.cookie)
    .every(request => request.headers.origin === previewUrl));
  assert.ok(hosted.requests.filter(request => request.path === '/api/auth/sign-up/email')
    .every(request => request.body.name === 'Ledger synthetic proof' && request.body.email.endsWith('@example.invalid')));
});
