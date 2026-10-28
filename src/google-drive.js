// Optional transport only: this module never reads or writes Ledger storage.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com';
const TAG = 'the-ledger-v1';

export function googleDriveConfig(env = {}) {
  return { clientId: env.LEDGER_GOOGLE_CLIENT_ID || '' };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(false), 15000);
    function finish(ok) {
      clearTimeout(timer); script.onload = script.onerror = null;
      if (ok) resolve(); else { script.remove(); reject(Error('Google libraries could not load. Check your connection and reload to retry.')); }
    }
    script.src = src; script.async = true;
    script.onload = () => finish(true); script.onerror = () => finish(false);
    document.head.append(script);
  });
}
async function loadLibraries() {
  await loadScript('https://accounts.google.com/gsi/client');
  return { oauth: globalThis.google.accounts.oauth2 };
}

export function createGoogleDrive(config = {}, dependencies = {}) {
  const environment = dependencies.environment || (() => ({ protocol: globalThis.location?.protocol, origin: globalThis.location?.origin, online: globalThis.navigator?.onLine !== false }));
  const now = dependencies.now || Date.now;
  // Only api() constructs network URLs, under the fixed Google REST origin.
  const request = dependencies.fetch || globalThis.fetch.bind(globalThis);
  const load = dependencies.loadLibraries || loadLibraries;
  let libraries, preparation, accessToken = '', expiresAt = 0;
  const configured = /^[\w.-]+\.apps\.googleusercontent\.com$/.test(config.clientId || '');
  function status() {
    if (accessToken && now() >= expiresAt) accessToken = '';
    const env = environment();
    const reason = !configured ? 'Google Drive is not configured for this build.'
      : !['https:', 'http:'].includes(env.protocol) ? 'Google Drive requires an online HTTP or HTTPS site. Local JSON tools remain available.'
        : !env.online ? 'Google Drive is offline. Local JSON tools remain available.' : '';
    return { available: !reason, reason, connected: !!accessToken, ready: !!libraries };
  }
  function requireAvailable() { const state = status(); if (!state.available) throw Error(state.reason); }
  function clearSession() { accessToken = ''; expiresAt = 0; }
  async function prepare() {
    requireAvailable();
    // A failed load stays failed until reload; never loop on unavailable Google scripts.
    preparation ||= load().then(result => { libraries = result; });
    await preparation;
  }
  async function connect() {
    requireAvailable();
    if (!libraries) await prepare();
    if (status().connected) return;
    await new Promise((resolve, reject) => {
      const failed = () => { clearSession(); reject(Error('Google authorization did not complete. Try Connect Google Drive again.')); };
      const client = libraries.oauth.initTokenClient({
        client_id: config.clientId, scope: DRIVE_SCOPE, include_granted_scopes: false,
        callback: response => {
          if (response.error || !response.access_token || !libraries.oauth.hasGrantedAllScopes(response, DRIVE_SCOPE)) { failed(); return; }
          const lifetime = Number(response.expires_in);
          if (!Number.isFinite(lifetime) || lifetime <= 0) { failed(); return; }
          accessToken = response.access_token; expiresAt = now() + lifetime * 1000;
          resolve();
        }, error_callback: failed,
      });
      client.requestAccessToken({ prompt: 'select_account' });
    });
  }
  async function disconnect() {
    const token = accessToken; clearSession();
    if (token && libraries) {
      // Local disconnect succeeds even if Google's revocation endpoint is unavailable.
      try { libraries.oauth.revoke(token, () => {}); } catch { /* no token retained */ }
    }
  }
  async function api(path, options = {}) {
    requireAvailable();
    if (!status().connected) throw Error('Google session expired. Connect Google Drive again.');
    let response;
    try {
      response = await request(API + path, { ...options, headers: { ...options.headers, Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(30000) });
    } catch { throw Error('Google Drive request failed. Check your connection and retry.'); }
    if (response.status === 401) { clearSession(); throw Error('Google session expired. Connect Google Drive again.'); }
    if (!response.ok) throw Error('Google Drive request failed (HTTP ' + response.status + '). Check permissions and retry.');
    return response;
  }
  async function findBackupEntry(name, mimeType, parent, create = false) {
    // Private appProperties prevent name collisions with user-created files.
    const q = `trashed = false and name = '${name}' and mimeType = '${mimeType}' and appProperties has { key='ledgerBackup' and value='${TAG}' }`
      + (parent ? ` and '${parent}' in parents` : '');
    const query = new URLSearchParams({ q, fields: 'files(id),nextPageToken', pageSize: '100', orderBy: 'createdTime' });
    let pageToken;
    do {
      const result = await (await api('/drive/v3/files?' + query)).json();
      if (result.files?.[0]?.id) return result.files[0].id;
      pageToken = result.nextPageToken;
      if (pageToken) query.set('pageToken', pageToken);
    } while (pageToken);
    if (!create) return null;
    const metadata = { name, mimeType, appProperties: { ledgerBackup: TAG }, ...(parent ? { parents: [parent] } : {}) };
    const created = await (await api('/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) })).json();
    if (!created.id) throw Error('Google Drive did not return a backup file ID.');
    return created.id;
  }
  async function exportJson(bytes) {
    await connect();
    const folder = await findBackupEntry('The Ledger Backups', 'application/vnd.google-apps.folder', null, true);
    const file = await findBackupEntry('latest.json', 'application/json', folder, true);
    await api('/upload/drive/v3/files/' + encodeURIComponent(file) + '?uploadType=media', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: bytes,
    });
    return { fileId: file, exportedAt: new Date(now()).toISOString() };
  }
  async function importJson() {
    await connect();
    const missing = () => Error('No Ledger backup was found in Google Drive. Export a backup from The Ledger first.');
    const folder = await findBackupEntry('The Ledger Backups', 'application/vnd.google-apps.folder');
    if (!folder) throw missing();
    const file = await findBackupEntry('latest.json', 'application/json', folder);
    if (!file) throw missing();
    return (await api('/drive/v3/files/' + encodeURIComponent(file) + '?alt=media')).text();
  }
  return { status, prepare, connect, disconnect, exportJson, importJson };
}
