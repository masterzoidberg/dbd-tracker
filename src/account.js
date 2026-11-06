// Presentation state only. Cookie handling belongs to the browser; Ledger storage is never accessed.
export function createAccount({ fetch = globalThis.fetch, onChange = () => {}, timeout = 15000 } = {}) {
  const state = { email: null, pending: false, message: '' };
  async function request(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch('/api/auth/' + path, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        redirect: 'error', signal: controller.signal,
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = response.status === 429 ? 'Too many attempts. Wait a few minutes before trying again.'
          : data?.code === 'EMAIL_NOT_VERIFIED' ? 'Verify your email before signing in. Check your verification email.'
          : response.status === 401 && path === 'sign-in/email' ? 'Email or password is incorrect.'
          : 'Account service unavailable. Try again later; local tracking is still available.';
        throw new Error(message);
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  async function recognizeSession() {
    // Never retain the session token or the full user/session response.
    state.email = null;
    const data = await request('get-session');
    if (data === null || (data?.session && Date.parse(data.session.expiresAt) <= Date.now())) return;
    if (!data?.session || !Number.isFinite(Date.parse(data.session.expiresAt)) || typeof data?.user?.email !== 'string') throw new Error();
    state.email = data.user.email;
  }
  async function run(message, action) {
    if (state.pending) return;
    state.pending = true; state.message = message; onChange(state);
    try { await action(); }
    catch (error) {
      state.message = error.message?.startsWith('Account service') || /^(Too many attempts|Verify your email|Email or password)/.test(error.message)
        ? error.message : 'Account service unavailable. Try again later; local tracking is still available.';
    } finally { state.pending = false; onChange(state); }
  }
  return {
    state,
    refresh: () => run('Checking session…', async () => {
      await recognizeSession(); state.message = state.email ? 'Session recognized.' : 'No active session. You can keep tracking locally.';
    }),
    signIn: (email, password) => run('Signing in…', async () => {
      await request('sign-in/email', { email, password });
      await recognizeSession();
      state.message = state.email ? 'Signed in. Your Ledger remains stored locally.' : 'No active session. Sign-in could not be confirmed; try again.';
    }),
    signOut: () => run('Signing out…', async () => {
      const data = await request('sign-out', {});
      if (data?.success !== true) throw new Error();
      state.email = null; state.message = 'Signed out. Your local Ledger is unchanged.';
    }),
  };
}

export function mountAccount(document, location) {
  if (!['http:', 'https:'].includes(location.protocol)) return;
  const entry = document.createElement('button');
  entry.type = 'button'; entry.className = 'export-button'; entry.textContent = 'Ledger account (Preview)';
  entry.setAttribute('aria-haspopup', 'dialog');
  document.querySelector('.topbar > div').append(entry);
  const dialog = document.createElement('dialog');
  dialog.id = 'ledger-account'; dialog.setAttribute('aria-labelledby', 'ledger-account-title');
  dialog.innerHTML = `<h2 id="ledger-account-title">Ledger account · Preview</h2>
    <p>Optional sign-in for existing verified Preview accounts. This is separate from DBD progression setup.</p>
    <p>Your Ledger stays on this device. Signing in does not upload, link, or synchronize progress.</p>
    <p id="ledger-account-identity"></p>
    <p id="ledger-account-status" role="status" aria-live="polite" aria-atomic="true"></p>
    <form id="ledger-account-form">
      <label for="ledger-account-email">Email</label>
      <input id="ledger-account-email" name="email" type="email" autocomplete="username" required>
      <label for="ledger-account-password">Password</label>
      <input id="ledger-account-password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit" class="primary">Sign in</button>
    </form>
    <div class="dialog-actions"><button type="button" id="ledger-account-refresh">Refresh session</button>
      <button type="button" id="ledger-account-signout" hidden>Sign out</button>
      <button type="button" id="ledger-account-close">Close</button></div>`;
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  const form = find('form'), password = find('[name=password]'), signOut = find('#ledger-account-signout');
  const account = createAccount({ onChange(state) {
    const active = document.activeElement;
    form.hidden = Boolean(state.email); signOut.hidden = !state.email;
    find('#ledger-account-identity').textContent = state.email ? `Signed in as ${state.email}` : 'Not signed in.';
    find('#ledger-account-status').textContent = state.message;
    form.setAttribute('aria-busy', String(state.pending));
    dialog.querySelectorAll('input, button:not(#ledger-account-close)').forEach(control => { control.disabled = state.pending; });
    if (!state.pending && dialog.open && (active === document.body || active?.disabled || active?.closest('[hidden]'))) {
      (state.email ? signOut : find('[name=email]')).focus();
    }
  } });
  entry.addEventListener('click', () => {
    dialog.showModal(); find('#ledger-account-close').focus(); void account.refresh();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const secret = password.value; password.value = '';
    void account.signIn(find('[name=email]').value.trim(), secret);
  });
  find('#ledger-account-refresh').addEventListener('click', () => { void account.refresh(); });
  signOut.addEventListener('click', () => { void account.signOut(); });
  find('#ledger-account-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { password.value = ''; entry.focus(); });
}
