// Optional transport and local destination preference only; Ledger data stays in TrackerStorage.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TAG = 'the-ledger-v1';
const DESTINATION_KEY = 'dbdTrackerDriveFolder';
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';
const PICKER_SCRIPT = 'https://apis.google.com/js/api.js';

export function googleDriveConfig(env = {}) {
  return {
    clientId: String(env.LEDGER_GOOGLE_CLIENT_ID || '').trim(),
    apiKey: String(env.LEDGER_GOOGLE_API_KEY || '').trim(),
    appId: String(env.LEDGER_GOOGLE_APP_ID || '').trim(),
  };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(false), 15000);
    function finish(ok) {
      clearTimeout(timer); script.onload = script.onerror = null;
      if (ok) resolve(); else { script.remove(); reject(Error('Google libraries could not load. Check your connection and retry.')); }
    }
    script.src = src; script.async = true;
    script.onload = () => finish(true); script.onerror = () => finish(false);
    document.head.append(script);
  });
}

async function loadLibraries() {
  await loadScript(GIS_SCRIPT);
  return { oauth: globalThis.google.accounts.oauth2 };
}

async function loadPickerLibraries() {
  await loadScript(PICKER_SCRIPT);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Google Picker could not initialize. Retry folder selection.')), 15000);
    const done = () => { clearTimeout(timer); resolve(); };
    try {
      globalThis.gapi.load('picker', {
        callback: done,
        onerror: () => { clearTimeout(timer); reject(Error('Google Picker could not initialize. Retry folder selection.')); },
        ontimeout: () => { clearTimeout(timer); reject(Error('Google Picker timed out. Retry folder selection.')); },
        timeout: 10000,
      });
    } catch {
      clearTimeout(timer); reject(Error('Google Picker could not initialize. Retry folder selection.'));
    }
  });
  const picker = globalThis.google?.picker;
  if (!picker?.PickerBuilder || !picker?.DocsView) throw Error('Google Picker could not initialize. Retry folder selection.');
  return picker;
}

function codedError(message, code) {
  const error = Error(message);
  error.code = code;
  return error;
}

export function createGoogleDrive(config = {}, dependencies = {}) {
  const environment = dependencies.environment || (() => ({ protocol: globalThis.location?.protocol, origin: globalThis.location?.origin, online: globalThis.navigator?.onLine !== false }));
  const now = dependencies.now || Date.now;
  // Only api() constructs REST URLs, under the fixed Google API origin.
  const request = dependencies.fetch || globalThis.fetch.bind(globalThis);
  const load = dependencies.loadLibraries || loadLibraries;
  const loadPicker = dependencies.loadPicker || loadPickerLibraries;
  const preferenceStorage = dependencies.storage || {
    getItem: key => globalThis.localStorage?.getItem(key) ?? null,
    setItem: (key, value) => {
      if (!globalThis.localStorage) throw Error('Local storage is unavailable. The backup folder could not be remembered.');
      globalThis.localStorage.setItem(key, value);
    },
  };
  let libraries, preparation, pickerLibrary, pickerPreparation, accessToken = '', expiresAt = 0, pickerOpening = false;
  const configured = /^[\w.-]+\.apps\.googleusercontent\.com$/.test(config.clientId || '');
  const pickerConfigured = /^AIza[A-Za-z0-9_-]{35}$/.test(config.apiKey || '') && /^\d{1,20}$/.test(config.appId || '');

  function destination() {
    try {
      const value = JSON.parse(preferenceStorage.getItem(DESTINATION_KEY) || 'null');
      if (typeof value?.id !== 'string' || !value.id.trim() || typeof value?.name !== 'string' || !value.name.trim()) return null;
      return { id: value.id, name: value.name };
    } catch { return null; }
  }
  function rememberDestination(folder) {
    if (typeof folder?.id !== 'string' || !folder.id.trim() || typeof folder?.name !== 'string' || !folder.name.trim()) {
      throw Error('Google Picker did not return a usable folder. Choose a folder again.');
    }
    const selected = { id: folder.id, name: folder.name };
    preferenceStorage.setItem(DESTINATION_KEY, JSON.stringify(selected));
    return selected;
  }

  function status() {
    if (accessToken && now() >= expiresAt) clearSession();
    const env = environment();
    const reason = !configured ? 'Google Drive is not configured for this build.'
      : !['https:', 'http:'].includes(env.protocol) ? 'Google Drive requires an online HTTP or HTTPS site. Local JSON tools remain available.'
        : !env.online ? 'Google Drive is offline. Local JSON tools remain available.' : '';
    const pickerReason = reason || (!pickerConfigured ? 'Google Drive folder selection is not configured for this build.' : '');
    return { available: !reason, reason, connected: !!accessToken, ready: !!libraries,
      pickerAvailable: !pickerReason, pickerReason, pickerReady: !!pickerLibrary };
  }
  function requireAvailable() {
    const state = status();
    if (!state.available) throw Error(state.reason);
  }
  function clearSession() { accessToken = ''; expiresAt = 0; }

  async function prepare() {
    requireAvailable();
    // A failed GIS load stays failed until reload; do not retry it in the background.
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
    if (!status().connected) throw codedError('Google session expired. Connect Google Drive again.', 'auth-expired');
    let response;
    try {
      response = await request(API + path, { ...options, headers: { ...options.headers, Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(30000) });
    } catch { throw Error('Google Drive request failed. Check your connection and retry.'); }
    if (response.status === 401) {
      clearSession();
      throw codedError('Google session expired. Connect Google Drive again.', 'auth-expired');
    }
    if (!response.ok) {
      const error = codedError('Google Drive request failed (HTTP ' + response.status + '). Check permissions and retry.', 'drive-request-failed');
      error.status = response.status;
      throw error;
    }
    return response;
  }

  async function readFolder(id, fallbackName = '') {
    let data;
    try {
      data = await (await api('/drive/v3/files/' + encodeURIComponent(id) + '?fields=id,name,mimeType,trashed')).json();
    } catch (error) {
      if (error.status === 403 || error.status === 404) throw codedError('The saved Google Drive backup location is unavailable. Choose a folder again.', 'destination-unavailable');
      throw error;
    }
    if (!data.id || data.trashed || data.mimeType !== FOLDER_MIME) {
      throw codedError('The saved Google Drive backup location is unavailable. Choose a folder again.', 'destination-unavailable');
    }
    return { id: data.id, name: typeof data.name === 'string' && data.name.trim() ? data.name : fallbackName };
  }

  async function validateDestination() {
    const current = destination();
    if (!current) throw codedError('Choose a Google Drive folder for this Ledger backup first.', 'destination-missing');
    const checked = await readFolder(current.id, current.name);
    if (checked.name !== current.name) rememberDestination(checked);
    return checked;
  }

  async function selectFolder() {
    requireAvailable();
    if (!pickerConfigured) throw Error('Google Drive folder picker is not configured for this build. Local JSON tools remain available.');
    if (pickerOpening) throw Error('Google Drive folder chooser is already open.');
    pickerOpening = true;
    try {
      await connect();
      if (!pickerLibrary) {
        pickerPreparation ||= loadPicker().then(result => { pickerLibrary = result; }).catch(error => {
          pickerPreparation = null;
          throw error;
        });
        await pickerPreparation;
      }
      const picker = pickerLibrary;
      const folder = await new Promise((resolve, reject) => {
        try {
          const view = new picker.DocsView(picker.ViewId.FOLDERS)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true)
            .setMimeTypes(FOLDER_MIME);
          const instance = new picker.PickerBuilder()
            .setAppId(config.appId)
            .setDeveloperKey(config.apiKey)
            .setOAuthToken(accessToken)
            .addView(view)
            .setCallback(data => {
              if (data.action === picker.Action.CANCEL) { resolve(null); return; }
              if (data.action !== picker.Action.PICKED) { reject(Error('Google Drive folder chooser did not complete. Retry folder selection.')); return; }
              const selected = data.docs?.[0];
              if (!selected?.id || (selected.mimeType && selected.mimeType !== FOLDER_MIME)) {
                reject(Error('Google Picker did not return a folder. Choose a folder again.')); return;
              }
              resolve({ id: selected.id, name: selected.name || 'Selected folder' });
            })
            .build();
          instance.setVisible(true);
        } catch { reject(Error('Google Drive folder chooser could not open. Retry folder selection.')); }
      });
      if (!folder) return null;
      const verified = await readFolder(folder.id, folder.name);
      return rememberDestination(verified);
    } finally { pickerOpening = false; }
  }

  async function findBackupEntry(parent, create = false) {
    // Private appProperties prevent name collisions with user-created files.
    const q = `trashed = false and name = 'latest.json' and mimeType = 'application/json' and appProperties has { key='ledgerBackup' and value='${TAG}' } and '${parent}' in parents`;
    const query = new URLSearchParams({ q, fields: 'files(id),nextPageToken', pageSize: '100', orderBy: 'createdTime' });
    let pageToken;
    do {
      const result = await (await api('/drive/v3/files?' + query)).json();
      if (result.files?.[0]?.id) return result.files[0].id;
      pageToken = result.nextPageToken;
      if (pageToken) query.set('pageToken', pageToken);
    } while (pageToken);
    if (!create) return null;
    const metadata = { name: 'latest.json', mimeType: 'application/json', appProperties: { ledgerBackup: TAG }, parents: [parent] };
    const created = await (await api('/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) })).json();
    if (!created.id) throw Error('Google Drive did not return a backup file ID.');
    return created.id;
  }

  async function exportJson(bytes) {
    await connect();
    const folder = await validateDestination();
    const file = await findBackupEntry(folder.id, true);
    await api('/upload/drive/v3/files/' + encodeURIComponent(file) + '?uploadType=media', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: bytes,
    });
    return { fileId: file, exportedAt: new Date(now()).toISOString() };
  }

  async function importJson() {
    await connect();
    const folder = await validateDestination();
    const file = await findBackupEntry(folder.id);
    if (!file) throw Error('No Ledger backup was found in the selected Google Drive folder. Choose a folder containing latest.json or back up to it first.');
    return (await api('/drive/v3/files/' + encodeURIComponent(file) + '?alt=media')).text();
  }

  return { status, prepare, connect, disconnect, destination, selectFolder, exportJson, importJson };
}
