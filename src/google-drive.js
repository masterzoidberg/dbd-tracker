// Optional transport and local destination preference only; Ledger data stays in TrackerStorage.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TAG = 'the-ledger-v1';
const DESTINATION_KEY = 'dbdTrackerDriveFolder';
const RECENT_DESTINATIONS_KEY = 'dbdTrackerDriveRecentFolders';
const MAX_RECENT_DESTINATIONS = 3;
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
  const pickerTimeoutMs = Number.isFinite(dependencies.pickerTimeoutMs) && dependencies.pickerTimeoutMs > 0 ? dependencies.pickerTimeoutMs : 120000;
  const preferenceStorage = dependencies.storage || {
    getItem: key => globalThis.localStorage?.getItem(key) ?? null,
    setItem: (key, value) => {
      if (!globalThis.localStorage) throw Error('Local storage is unavailable. The backup folder could not be remembered.');
      globalThis.localStorage.setItem(key, value);
    },
  };
  let libraries, preparation, pickerLibrary, pickerPreparation, accessToken = '', expiresAt = 0, pickerOpening = false, selectionTrace = null;
  const configured = /^[\w.-]+\.apps\.googleusercontent\.com$/.test(config.clientId || '');
  const pickerConfigured = /^AIza[A-Za-z0-9_-]{35}$/.test(config.apiKey || '') && /^\d{1,20}$/.test(config.appId || '');

  function destination() {
    try {
      const value = JSON.parse(preferenceStorage.getItem(DESTINATION_KEY) || 'null');
      if (typeof value?.id !== 'string' || !value.id.trim() || typeof value?.name !== 'string' || !value.name.trim()) return null;
      const isRoot = value.isRoot === true || value.id === 'root';
      return { id: value.id, name: isRoot ? 'My Drive' : value.name, ...(isRoot ? { isRoot: true } : {}) };
    } catch { return null; }
  }
  function recentDestinations() {
    try {
      const values = JSON.parse(preferenceStorage.getItem(RECENT_DESTINATIONS_KEY) || '[]');
      if (!Array.isArray(values)) return [];
      const unique = new Map();
      for (const value of values) {
        if (typeof value?.id !== 'string' || !value.id.trim() || typeof value?.name !== 'string' || !value.name.trim()) continue;
        const isRoot = value.isRoot === true || value.id === 'root';
        const item = { id: value.id, name: isRoot ? 'My Drive' : value.name, ...(isRoot ? { isRoot: true } : {}) };
        if (!unique.has(item.id)) unique.set(item.id, item);
      }
      return [...unique.values()].slice(0, MAX_RECENT_DESTINATIONS);
    } catch { return []; }
  }
  function rememberDestination(folder, trace = null) {
    if (typeof folder?.id !== 'string' || !folder.id.trim() || typeof folder?.name !== 'string' || !folder.name.trim()) {
      throw Error('Google Picker did not return a usable folder. Choose a folder again.');
    }
    const isRoot = folder.isRoot === true || folder.id === 'root';
    const selected = { id: folder.id, name: isRoot ? 'My Drive' : folder.name, ...(isRoot ? { isRoot: true } : {}) };
    try {
      preferenceStorage.setItem(DESTINATION_KEY, JSON.stringify(selected));
      if (trace) trace.destinationWriteSucceeded = true;
    } catch (error) {
      if (!trace) throw error;
      trace.destinationWriteSucceeded = false;
      trace.outcomeCategory = 'destination-storage-failed';
      throw codedError('The backup location could not be remembered in this browser.', 'destination-storage-failed');
    }
    const recent = [selected, ...recentDestinations().filter(item => item.id !== selected.id)].slice(0, MAX_RECENT_DESTINATIONS);
    try {
      preferenceStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(recent));
      if (trace) trace.recentLocationsWriteSucceeded = true;
    } catch (error) {
      if (!trace) throw error;
      trace.recentLocationsWriteSucceeded = false;
      trace.destinationRecognized = destination()?.id === selected.id;
      trace.finalPanelDestination = trace.destinationRecognized ? 'selected' : 'not-selected';
      trace.outcomeCategory = 'recent-storage-failed';
      throw codedError('The backup location was saved, but recent locations could not be updated.', 'recent-storage-failed');
    }
    if (trace) {
      trace.destinationRecognized = destination()?.id === selected.id;
      trace.finalPanelDestination = trace.destinationRecognized ? 'selected' : 'not-selected';
      if (!trace.destinationRecognized) {
        trace.outcomeCategory = 'destination-storage-failed';
        throw codedError('The backup location could not be remembered in this browser.', 'destination-storage-failed');
      }
      trace.outcomeCategory = 'success';
    }
    return selected;
  }

  function diagnosticMimeType(value) {
    return typeof value === 'string' ? value.slice(0, 100) : null;
  }

  function createSelectionTrace() {
    return {
      pickerOpened: false, callbackFired: false, callbackAction: 'not-received', documentCount: null,
      selectedIdPresent: null, selectedNamePresent: null, selectedMimeType: null, folderMimeAccepted: null,
      filesGetAttempted: false, filesGetStatus: null, responseIdPresent: null, responseMimeType: null,
      responseTrashed: null, folderResponseAccepted: null, destinationWriteSucceeded: null,
      recentLocationsWriteSucceeded: null, destinationRecognized: false, finalPanelDestination: 'not-selected',
      outcomeCategory: 'in-progress',
    };
  }

  function selectionDiagnostics(finalPanelDestination) {
    if (!selectionTrace) return null;
    const result = { ...selectionTrace };
    if (finalPanelDestination === 'selected' || finalPanelDestination === 'not-selected') result.finalPanelDestination = finalPanelDestination;
    return result;
  }

  function selectionDiagnosticText(finalPanelDestination) {
    const trace = selectionDiagnostics(finalPanelDestination);
    return trace ? JSON.stringify(trace, null, 2) : '';
  }

  function removeRecentDestination(id) {
    preferenceStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(recentDestinations().filter(item => item.id !== id)));
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

  async function readFolder(id, fallbackName = '', trace = null) {
    let data;
    let response;
    try {
      if (trace) trace.filesGetAttempted = true;
      response = await api('/drive/v3/files/' + encodeURIComponent(id) + '?fields=id,name,mimeType,trashed');
      if (trace) trace.filesGetStatus = response.status;
    } catch (error) {
      if (trace) {
        trace.filesGetStatus = Number.isInteger(error.status) ? error.status : 'no-http-response';
        trace.outcomeCategory = error.status === 403 || error.status === 404 ? 'folder-verification-failed' : 'google-drive-request-failed';
        trace.folderResponseAccepted = false;
      }
      if (error.status === 403 || error.status === 404) throw codedError('The saved Google Drive backup location is unavailable. Choose a folder again.', 'destination-unavailable');
      throw error;
    }
    try { data = await response.json(); }
    catch (error) {
      if (trace) {
        trace.responseIdPresent = false;
        trace.responseMimeType = null;
        trace.responseTrashed = null;
        trace.folderResponseAccepted = false;
        trace.outcomeCategory = 'google-drive-request-failed';
      }
      throw error;
    }
    if (trace) {
      trace.responseIdPresent = !!data?.id;
      trace.responseMimeType = diagnosticMimeType(data?.mimeType);
      trace.responseTrashed = typeof data?.trashed === 'boolean' ? data.trashed : null;
      trace.folderResponseAccepted = !!data?.id && !data.trashed && data.mimeType === FOLDER_MIME;
    }
    if (!data.id || data.trashed || data.mimeType !== FOLDER_MIME) {
      if (trace) trace.outcomeCategory = 'folder-verification-failed';
      throw codedError('The saved Google Drive backup location is unavailable. Choose a folder again.', 'destination-unavailable');
    }
    return { id: data.id, name: id === 'root' ? 'My Drive' : typeof data.name === 'string' && data.name.trim() ? data.name : fallbackName };
  }

  async function validateDestination() {
    const current = destination();
    if (!current) throw codedError('Choose a Google Drive folder for this Ledger backup first.', 'destination-missing');
    const checked = await readFolder(current.isRoot || current.id === 'root' ? 'root' : current.id, current.name);
    if ((current.isRoot && current.id !== 'root' && checked.id !== current.id)) {
      throw codedError('The saved Google Drive backup location is unavailable. Choose a folder again.', 'destination-unavailable');
    }
    const selected = current.isRoot || current.id === 'root' ? { ...checked, name: 'My Drive', isRoot: true } : checked;
    if (checked.id !== current.id || selected.name !== current.name) rememberDestination(selected);
    return selected;
  }

  async function selectFolder() {
    if (pickerOpening) throw Error('Google Drive folder chooser is already open.');
    pickerOpening = true;
    selectionTrace = createSelectionTrace();
    let candidateId = '';
    try {
      requireAvailable();
      if (!pickerConfigured) throw Error('Google Drive folder picker is not configured for this build. Local JSON tools remain available.');
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
        let timer, settled = false, instance;
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          callback(value);
        };
        try {
          const view = new picker.DocsView(picker.ViewId.FOLDERS)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true)
            .setMimeTypes(FOLDER_MIME)
            .setMode(picker.DocsViewMode.LIST);
          instance = new picker.PickerBuilder()
            .setAppId(config.appId)
            .setDeveloperKey(config.apiKey)
            .setOAuthToken(accessToken)
            .setTitle('Choose backup folder')
            .setMaxItems(1)
            .setSelectableMimeTypes(FOLDER_MIME)
            .enableFeature(picker.Feature.NAV_HIDDEN)
            .addView(view)
            .setCallback(data => {
              if (settled) return;
              selectionTrace.callbackFired = true;
              const action = data?.action;
              selectionTrace.callbackAction = ['PICKED', 'CANCEL', 'ERROR', 'picked', 'cancel', 'error'].includes(action) ? action : 'other';
              const docs = Array.isArray(data?.docs) ? data.docs : [];
              selectionTrace.documentCount = docs.length;
              if (action === picker.Action.CANCEL) {
                selectionTrace.outcomeCategory = 'picker-canceled';
                finish(resolve, null);
                return;
              }
              if (action !== picker.Action.PICKED) {
                selectionTrace.outcomeCategory = 'picker-action-unexpected';
                finish(reject, codedError('Google Drive folder chooser did not complete. Retry folder selection.', 'picker-action-unexpected'));
                return;
              }
              const selected = docs[0];
              selectionTrace.selectedIdPresent = !!selected?.id;
              selectionTrace.selectedNamePresent = !!selected?.name;
              selectionTrace.selectedMimeType = diagnosticMimeType(selected?.mimeType);
              selectionTrace.folderMimeAccepted = selected?.mimeType === FOLDER_MIME;
              if (!selected?.id || !selectionTrace.folderMimeAccepted) {
                selectionTrace.outcomeCategory = 'picker-folder-invalid';
                finish(reject, codedError('Google Picker did not return a folder. Choose a folder again.', 'picker-folder-invalid'));
                return;
              }
              finish(resolve, { id: selected.id, name: selected.name || 'Selected folder' });
            })
            .build();
          timer = setTimeout(() => {
            if (settled) return;
            selectionTrace.outcomeCategory = 'picker-timeout';
            settled = true;
            clearTimeout(timer);
            try { instance?.setVisible(false); } catch { /* timeout is already reported */ }
            reject(codedError('Google Picker did not respond. Try choosing a folder again.', 'picker-timeout'));
          }, pickerTimeoutMs);
          instance.setVisible(true);
          selectionTrace.pickerOpened = true;
        } catch {
          selectionTrace.outcomeCategory = 'picker-open-failed';
          finish(reject, codedError('Google Drive folder chooser could not open. Retry folder selection.', 'picker-open-failed'));
        }
      });
      if (!folder) return null;
      candidateId = folder.id;
      const verified = await readFolder(folder.id, folder.name, selectionTrace);
      return rememberDestination(verified, selectionTrace);
    } catch (error) {
      if (selectionTrace.outcomeCategory === 'in-progress') {
        selectionTrace.outcomeCategory = error.code === 'picker-timeout' ? 'picker-timeout'
          : error.code === 'picker-action-unexpected' ? 'picker-action-unexpected'
            : error.code === 'picker-folder-invalid' ? 'picker-folder-invalid'
              : 'google-drive-request-failed';
      }
      throw error;
    } finally {
      if (candidateId) selectionTrace.destinationRecognized = destination()?.id === candidateId;
      selectionTrace.finalPanelDestination = destination() ? 'selected' : 'not-selected';
      pickerOpening = false;
    }
  }

  async function useMyDrive() {
    await connect();
    const root = await readFolder('root', 'My Drive');
    return rememberDestination({ ...root, name: 'My Drive', isRoot: true });
  }

  async function useRecentDestination(id) {
    const recent = recentDestinations().find(item => item.id === id);
    if (!recent) throw Error('That recent Google Drive location is no longer available. Choose a folder again.');
    await connect();
    let verified;
    try {
      const isRoot = recent.isRoot || recent.id === 'root';
      verified = await readFolder(isRoot ? 'root' : recent.id, recent.name);
      if (isRoot && recent.id !== 'root' && verified.id !== recent.id) {
        throw codedError('The saved Google Drive backup location is unavailable. Choose a folder again.', 'destination-unavailable');
      }
      if (isRoot) verified = { ...verified, name: 'My Drive', isRoot: true };
    }
    catch (error) {
      if (error.code === 'destination-unavailable') {
        removeRecentDestination(recent.id);
        throw codedError('That recent Google Drive location is unavailable. Choose another folder.', 'destination-unavailable');
      }
      throw error;
    }
    return rememberDestination(verified);
  }

  async function findBackupEntry(parent, create = false) {
    // Private appProperties prevent name collisions with user-created files.
    const parentQuery = String(parent).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `trashed = false and name = 'latest.json' and mimeType = 'application/json' and appProperties has { key='ledgerBackup' and value='${TAG}' } and '${parentQuery}' in parents`;
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

  return { status, prepare, connect, disconnect, destination, recentDestinations, selectFolder, selectionDiagnostics, selectionDiagnosticText, useMyDrive, useRecentDestination, exportJson, importJson };
}
