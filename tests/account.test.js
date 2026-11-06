import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccount } from '../src/account.js';

const session = { session: { id: 'session', expiresAt: '2099-01-01T00:00:00Z' }, user: { email: 'reader@example.invalid' } };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('sign-in recognizes cookie session and retains only presentation data', async () => {
  const calls = [];
  const account = createAccount({ fetch: async (url, options) => {
    calls.push([url, options]);
    return response(url.endsWith('get-session') ? session : { token: 'never-retained', user: session.user });
  } });
  await account.signIn('reader@example.invalid', 'password');
  assert.equal(account.state.email, session.user.email);
  assert.equal(account.state.pending, false);
  assert.match(account.state.message, /Signed in/);
  assert.equal(JSON.stringify(account.state).includes('never-retained'), false);
  assert.deepEqual(calls.map(([url]) => url), ['/api/auth/sign-in/email', '/api/auth/get-session']);
  assert.deepEqual(JSON.parse(calls[0][1].body), { email: session.user.email, password: 'password' });
  assert.ok(calls.every(([, options]) => options.credentials === 'same-origin' && options.cache === 'no-store'));
});

for (const [status, code, message] of [
  [401, 'INVALID_EMAIL_OR_PASSWORD', /Email or password/],
  [403, 'EMAIL_NOT_VERIFIED', /Verify your email/],
  [429, null, /Too many attempts/],
  [503, null, /unavailable/],
]) test(`sign-in safely presents ${status} without echoing server text`, async () => {
  const account = createAccount({ fetch: async () => response({ code, message: '<script>secret</script>' }, status) });
  await account.signIn('reader@example.invalid', 'password');
  assert.match(account.state.message, message);
  assert.equal(account.state.email, null);
  assert.equal(account.state.message.includes('secret'), false);
});

test('missing and expired sessions clear previously recognized identity', async () => {
  for (const body of [null, { ...session, session: { expiresAt: '2000-01-01' } }]) {
    let result = session;
    const account = createAccount({ fetch: async () => response(result) });
    await account.refresh();
    assert.equal(account.state.email, session.user.email);
    result = body;
    await account.refresh();
    assert.equal(account.state.email, null);
    assert.match(account.state.message, /No active session/);
  }
});

test('sign-out failure retains last identity but successful retry clears it', async () => {
  let fail = true;
  const account = createAccount({ fetch: async url => response(url.endsWith('get-session') ? session : fail ? {} : { success: true }, url.endsWith('sign-out') && fail ? 503 : 200) });
  await account.refresh();
  await account.signOut();
  assert.equal(account.state.email, session.user.email);
  assert.match(account.state.message, /unavailable/);
  fail = false;
  await account.signOut();
  assert.equal(account.state.email, null);
  assert.match(account.state.message, /Signed out/);
});

test('pending requests suppress repeated and competing actions', async () => {
  let finish, calls = 0;
  const account = createAccount({ fetch: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const first = account.refresh();
  assert.equal(account.state.pending, true);
  await account.refresh(); await account.signOut(); await account.signIn('a', 'b');
  assert.equal(calls, 1);
  finish(response(null));
  await first;
  assert.equal(account.state.pending, false);
});

test('offline, malformed responses and timeouts recover without throwing', async () => {
  for (const fetch of [async () => { throw new TypeError('offline'); }, async () => new Response('not JSON'),
    async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))]) {
    const account = createAccount({ fetch, timeout: 5 });
    await account.refresh();
    assert.equal(account.state.pending, false);
    assert.equal(account.state.email, null);
    assert.match(account.state.message, /unavailable/);
  }
});
