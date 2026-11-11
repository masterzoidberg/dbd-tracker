import { createCloudSave } from './cloud-save.js';

const RECOVERY_KEY = 'dbdTrackerCloudRecovery';

export function mountAccount({ document, storage, getSave, replaceSave, assertWriter }) {
  if (!['https:', 'http:'].includes(document.location.protocol)) return null;
  const entry = document.createElement('button');
  entry.type = 'button'; entry.className = 'export-button'; entry.textContent = 'Account · Sign in';
  entry.setAttribute('aria-haspopup', 'dialog');
  document.querySelector('.topbar > div').append(entry);
  const dialog = document.createElement('dialog');
  dialog.id = 'ledger-account'; dialog.setAttribute('aria-labelledby', 'ledger-account-title');
  dialog.innerHTML = `<h2 id="ledger-account-title">Personal cloud save</h2>
    <p id="ledger-account-identity"></p>
    <p id="ledger-account-status" role="status" aria-live="polite"></p>
    <form id="ledger-account-form">
      <label for="ledger-account-email">Email</label><input id="ledger-account-email" type="email" autocomplete="username" required>
      <label for="ledger-account-password">Password</label><input id="ledger-account-password" type="password" autocomplete="current-password" required>
      <button type="submit" class="primary">Sign in</button>
      <p class="muted">This is a private account. Password recovery uses the local administrative setup; no email is sent.</p>
    </form>
    <div id="ledger-cloud-actions" hidden>
      <p id="ledger-cloud-dates"></p>
      <div id="ledger-cloud-choice" hidden><p>Your current save will be preserved before either choice.</p>
        <button type="button" id="ledger-use-local">Use this device’s save</button>
        <button type="button" id="ledger-use-cloud">Use cloud save</button>
      </div>
      <button type="button" id="ledger-cloud-refresh">Refresh / retry</button>
      <button type="button" id="ledger-account-signout">Sign out</button>
    </div>
    <div id="ledger-preserved"></div>
    <p class="muted">JSON export and import remain available in Data &amp; backups.</p>
    <button type="button" id="ledger-account-close">Close</button>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let user = null, authBusy = false, authMessage = '', timer;
  const recovery = () => JSON.parse(storage.getItem(RECOVERY_KEY) || '[]');
  const cloud = createCloudSave({ storage, getSave, replaceSave, onChange: render,
    preserve(data, reason) {
      assertWriter();
      const copies = recovery();
      if (!copies.some(copy => JSON.stringify(copy.data) === JSON.stringify(data))) {
        storage.setItem(RECOVERY_KEY, JSON.stringify([...copies, { data, reason, createdAt: new Date().toISOString() }]));
      }
    },
  });
  function render() {
    const state = cloud.state;
    const busy = authBusy || state.busy;
    entry.textContent = user ? `Account · ${({ saved: 'Saved', pending: 'Saving…', conflict: 'Conflict', error: 'Needs attention', unlinked: 'Choose save' })[state.status] || 'Local'}` : 'Account · Sign in';
    $('#ledger-account-identity').textContent = user ? `Signed in as ${user.email}` : 'Sign in to use the same save on your devices.';
    $('#ledger-account-status').textContent = authMessage || state.message;
    $('#ledger-account-form').hidden = Boolean(user);
    $('#ledger-cloud-actions').hidden = !user;
    $('#ledger-cloud-choice').hidden = !['unlinked', 'conflict'].includes(state.status);
    for (const button of dialog.querySelectorAll('button:not(#ledger-account-close)')) button.disabled = busy;
    $('#ledger-use-cloud').disabled = busy || !state.remote;
    try {
      $('#ledger-cloud-dates').textContent = state.remote
        ? `Cloud save: ${new Date(state.remote.data.updatedAt).toLocaleString()}. Device save: ${new Date(getSave().updatedAt).toLocaleString()}.`
        : 'No cloud save found.';
    } catch { $('#ledger-cloud-dates').textContent = 'Local save is not available for syncing in this window.'; }
    const preserved = $('#ledger-preserved'); preserved.replaceChildren();
    try {
      for (const [index, copy] of recovery().entries()) {
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = `Download preserved copy: ${copy.reason} (${new Date(copy.createdAt).toLocaleString()})`;
        button.addEventListener('click', () => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(copy.data, null, 2)], { type: 'application/json' }));
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ledger-preserved-${index + 1}.json`; anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        preserved.append(button);
      }
    } catch { preserved.textContent = 'Preserved copies could not be read. Existing data has not been changed.'; }
  }
  async function request(path, body) {
    const response = await fetch(`/api/auth/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw Error(path === 'sign-in/email' && [400, 401, 403].includes(response.status)
      ? 'Sign-in failed. Check your email and password.' : response.status === 429 ? 'Too many attempts. Wait a minute and retry.' : 'Account unavailable. Your local save is preserved.');
    return response.json();
  }
  async function run(action) {
    if (authBusy) return;
    authBusy = true; authMessage = ''; render();
    try { await action(); } catch (error) { authMessage = error.message; }
    finally { authBusy = false; render(); }
  }
  async function recognize() {
    const session = await request('get-session');
    user = session?.user?.id ? session.user : null;
    if (user) await cloud.connect(user.id); else await cloud.disconnect();
  }
  entry.addEventListener('click', () => { render(); dialog.showModal(); });
  dialog.addEventListener('close', () => { $('#ledger-account-password').value = ''; entry.focus(); });
  $('#ledger-account-close').addEventListener('click', () => dialog.close());
  $('#ledger-account-form').addEventListener('submit', event => {
    event.preventDefault();
    const email = $('#ledger-account-email').value.trim(), password = $('#ledger-account-password').value;
    $('#ledger-account-password').value = '';
    void run(async () => { await request('sign-in/email', { email, password }); await recognize(); });
  });
  $('#ledger-account-signout').addEventListener('click', () => void run(async () => {
    await cloud.disconnect(); await request('sign-out', {}); user = null;
  }));
  $('#ledger-cloud-refresh').addEventListener('click', () => void run(recognize));
  $('#ledger-use-local').addEventListener('click', () => void cloud.choose('local'));
  $('#ledger-use-cloud').addEventListener('click', () => void cloud.choose('cloud'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && user) void run(recognize); });
  document.defaultView.addEventListener('online', () => { if (user) void run(recognize); });
  void run(recognize);
  return { changed() {
    if (!user) return;
    clearTimeout(timer);
    if (cloud.state.status !== 'conflict') { cloud.state.message = 'Changes saved locally; cloud save pending.'; cloud.state.status = 'pending'; render(); }
    timer = setTimeout(() => void cloud.sync(), 500);
  } };
}
