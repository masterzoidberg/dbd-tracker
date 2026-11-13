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
  dialog.innerHTML = `<header class="ledger-account-header">
      <div><span class="ledger-account-eyebrow">YOUR ACCOUNT</span><h2 id="ledger-account-title">Cloud save</h2>
        <p id="ledger-account-identity"></p></div>
      <button type="button" id="ledger-account-close" aria-label="Close account dialog">×</button>
    </header>
    <div class="ledger-account-body">
    <div class="ledger-account-state" data-status="signed-out"><span class="ledger-account-state-icon" aria-hidden="true">✓</span>
      <div><strong id="ledger-account-status-title">Saved on this device</strong>
        <p id="ledger-account-status" role="status" aria-live="polite"></p></div></div>
    <form id="ledger-account-form">
      <label for="ledger-account-email">Email</label><input id="ledger-account-email" type="email" autocomplete="username" required>
      <label for="ledger-account-password">Password</label><input id="ledger-account-password" type="password" autocomplete="current-password" required>
      <button type="submit" class="primary">Sign in</button>
      <p class="muted">This is a private account. Password recovery uses the local administrative setup; no email is sent.</p>
    </form>
    <div id="ledger-cloud-actions" hidden>
      <p id="ledger-cloud-choice" hidden>Your current save will be preserved before either choice.</p>
      <div class="ledger-account-versions"><div><span>THIS DEVICE</span><strong id="ledger-device-date">—</strong>
        <button type="button" id="ledger-use-local" hidden>Use this device’s save</button></div>
        <div><span>CLOUD SAVE</span><strong id="ledger-cloud-date">No cloud save yet</strong>
        <button type="button" id="ledger-use-cloud" hidden>Use cloud save</button></div></div>
      <div class="ledger-account-actions"><button type="button" id="ledger-cloud-refresh">Refresh save</button>
        <button type="button" id="ledger-account-signout">Sign out</button></div>
      <section id="ledger-save-points" hidden><div class="ledger-save-points-heading"><h3>Cloud save points</h3>
        <button type="button" id="ledger-point-create">Create save point</button></div>
        <p id="ledger-point-message" role="status"></p><div id="ledger-point-list"></div></section>
    </div>
    <details id="ledger-recovery" hidden><summary id="ledger-recovery-label">Preserved copies</summary><div id="ledger-preserved"></div></details>
    </div><footer class="ledger-account-footer">JSON export and import are available in Data &amp; backups.</footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let user = null, authBusy = false, authMessage = '', timer, points = [], pointsMessage = '';
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
    const stateTitle = { saved: 'Everything is in sync', pending: 'Saving changes', conflict: 'Choose a save to keep',
      error: 'Cloud save needs attention', unlinked: 'Choose your starting save', 'signed-out': 'Saved on this device' };
    $('#ledger-account-status-title').textContent = stateTitle[state.status] || 'Cloud save';
    $('.ledger-account-state').dataset.status = state.status;
    $('.ledger-account-state-icon').textContent = ['conflict', 'error'].includes(state.status) ? '!' : state.status === 'pending' ? '…' : state.status === 'unlinked' ? '↗' : '✓';
    $('#ledger-account-status').textContent = authMessage || state.message;
    $('#ledger-account-form').hidden = Boolean(user);
    $('#ledger-cloud-actions').hidden = !user;
    $('#ledger-save-points').hidden = !user;
    const choosing = ['unlinked', 'conflict'].includes(state.status);
    $('#ledger-cloud-choice').hidden = !choosing;
    $('#ledger-use-local').hidden = !choosing;
    $('#ledger-use-cloud').hidden = !choosing;
    for (const button of dialog.querySelectorAll('button:not(#ledger-account-close)')) button.disabled = busy;
    $('#ledger-use-cloud').disabled = busy || !state.remote;
    $('#ledger-point-create').disabled = busy || state.status !== 'saved';
    $('#ledger-point-message').textContent = pointsMessage || (points.length ? '' : 'No cloud save points yet.');
    const pointList = $('#ledger-point-list'); pointList.replaceChildren();
    for (const point of points) {
      const row = document.createElement('div'); row.className = 'ledger-save-point';
      const date = document.createElement('strong'); date.textContent = new Date(point.createdAt).toLocaleString();
      const download = document.createElement('button'); download.type = 'button'; download.textContent = 'Download';
      download.setAttribute('aria-label', `Download save point from ${date.textContent}`);
      download.disabled = busy;
      download.addEventListener('click', () => void run(async () => {
        const snapshot = await backupRequest(`/api/ledger/backups/${encodeURIComponent(point.id)}`);
        const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot.data, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a'); anchor.href = url;
        anchor.download = `ledger-cloud-save-${point.createdAt.slice(0, 10)}.json`; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }));
      const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = 'Restore';
      restore.setAttribute('aria-label', `Restore save point from ${date.textContent}`);
      restore.disabled = busy || state.status !== 'saved';
      restore.addEventListener('click', () => void run(async () => {
        if (!document.defaultView.confirm(`Restore the cloud save point from ${date.textContent}? Your current cloud save will become a new save point first.`)) return;
        await cloud.sync();
        if (cloud.state.status !== 'saved') throw Error('Resolve the cloud save status before restoring a save point.');
        const snapshot = await backupRequest(`/api/ledger/backups/${encodeURIComponent(point.id)}`);
        await backupRequest('/api/ledger/backups', 'POST');
        await replaceSave(snapshot.data);
        await cloud.sync();
        await loadPoints();
        if (cloud.state.status === 'saved') pointsMessage = 'Save point restored to this device and your account.';
      }));
      row.append(date, download, restore); pointList.append(row);
    }
    try {
      $('#ledger-cloud-date').textContent = state.remote ? new Date(state.remote.data.updatedAt).toLocaleString() : 'No cloud save yet';
      $('#ledger-device-date').textContent = new Date(getSave().updatedAt).toLocaleString();
    } catch { $('#ledger-device-date').textContent = 'Unavailable in this window'; }
    const preserved = $('#ledger-preserved'); preserved.replaceChildren();
    try {
      const copies = recovery();
      $('#ledger-recovery').hidden = copies.length === 0;
      $('#ledger-recovery-label').textContent = `Preserved copies (${copies.length})`;
      for (const [index, copy] of copies.entries()) {
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = `Download copy ${index + 1}`;
        button.setAttribute('aria-label', `Download preserved copy ${index + 1}: ${copy.reason}`);
        button.addEventListener('click', () => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(copy.data, null, 2)], { type: 'application/json' }));
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ledger-preserved-${index + 1}.json`; anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        const row = document.createElement('div'); row.className = 'ledger-recovery-row';
        const detail = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = copy.reason;
        const time = document.createElement('small'); time.textContent = new Date(copy.createdAt).toLocaleString();
        detail.append(title, time); row.append(detail, button); preserved.append(row);
      }
    } catch { $('#ledger-recovery').hidden = false; preserved.textContent = 'Preserved copies could not be read. Existing data has not been changed.'; }
  }
  async function request(path, body) {
    const response = await fetch(`/api/auth/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw Error(path === 'sign-in/email' && [400, 401, 403].includes(response.status)
      ? 'Sign-in failed. Check your email and password.' : response.status === 429 ? 'Too many attempts. Wait a minute and retry.' : 'Account unavailable. Your local save is preserved.');
    return response.json();
  }
  async function backupRequest(path, method = 'GET') {
    const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Cloud save points are unavailable. Your saves have not been deleted.');
    return response.json();
  }
  async function loadPoints() {
    try {
      const list = await backupRequest('/api/ledger/backups');
      if (!Array.isArray(list)) throw Error('Invalid save point list.');
      points = list;
      pointsMessage = '';
    } catch { pointsMessage = 'Could not load cloud save points. Try Refresh save.'; }
    render();
  }
  async function run(action) {
    if (authBusy) return;
    authBusy = true; authMessage = ''; render();
    try { await action(); } catch (error) { authMessage = error.message; }
    finally { authBusy = false; render(); }
  }
  async function recognize() {
    const session = await request('get-session');
    const previousUserId = user?.id;
    user = session?.user?.id ? session.user : null;
    if (user) {
      if (user.id !== previousUserId) { points = []; pointsMessage = ''; }
      await cloud.connect(user.id); await loadPoints();
    }
    else { points = []; pointsMessage = ''; await cloud.disconnect(); }
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
    await cloud.disconnect(); await request('sign-out', {}); user = null; points = []; pointsMessage = '';
  }));
  $('#ledger-cloud-refresh').addEventListener('click', () => void run(recognize));
  $('#ledger-point-create').addEventListener('click', () => void run(async () => {
    await cloud.sync();
    if (cloud.state.status !== 'saved') throw Error('Resolve the cloud save status before creating a save point.');
    await backupRequest('/api/ledger/backups', 'POST');
    await loadPoints();
    pointsMessage = 'Cloud save point created.';
  }));
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
