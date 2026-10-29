# Optional Google Drive backups

Google Drive is an optional transport for the same portable Ledger JSON used by
local Export JSON. The browser remains the authoritative save. Drive import is
explicit and sends downloaded bytes through the existing validation, migration,
replacement preview, confirmation, writer guard, and backup/recovery pipeline.
Canceling restore changes nothing.

## Choose and remember a backup folder

Connect Google Drive, then choose **Choose backup folder** or **Use My Drive**.
Choosing a location is separate from backing up: it does not upload Ledger data.
**Backup now** appears only after a destination is active, then writes there
without reopening Picker. **Restore from Drive** uses the same active location;
without one, restore is disabled and the page guides you to choose one first.

Google Picker is configured for folders only, with a single list view and the
title **Choose backup folder**. Google’s documented API can make folder rows
selectable, but does not expose a supported action for selecting the currently
open folder. Select the folder row from its parent and choose **Select**;
opening a folder only navigates into it. Picker is loaded only after an explicit
folder-selection action, not on Dashboard, startup, or simply visiting Data &
backups. The single-view Picker hides its view-navigation pane; folder
browsing remains in the main view.

**Use My Drive** selects the Drive root directly without Picker. Otherwise, the
selected folder is the backup location. The Ledger stores its folder ID and
display name in a browser-local preference and keeps at most three recent
locations. These preferences are nonportable: they are not part of Ledger saves,
exports, snapshots, or schema migrations, and they contain no OAuth tokens.
Selecting a recent location validates that it is still accessible before
activating it; unavailable entries are removed and never cause a fallback to
another folder. My Drive is remembered by the resolved root folder ID, so a
different Google account's root is not silently substituted after reconnect.

The rolling `latest.json` file is created directly inside the selected folder;
the Ledger does not create a wrapper folder. Later backups reuse the selected
folder and update the same app-managed file. A private `appProperties` marker
distinguishes it from unrelated files with the same name. **Change folder** only
changes the active local destination. It does not create a backup, or move or
delete the old Drive backup. Restore looks only for the app-managed backup in
the currently selected folder. Disconnect preserves the local destination and
recent-location preferences; the folder is validated when used after reconnect.

If a saved folder was deleted, trashed, or became inaccessible, the Ledger does
not fall back to Drive root. It reports that the location is unavailable and
offers **Choose folder**. Reconnecting validates access before using the saved
destination. Disconnect clears the in-memory OAuth session but keeps the local
folder preference and existing Drive files.

## Public build configuration

The Pages build reads these public values through the centralized
`googleDriveConfig` function:

- `LEDGER_GOOGLE_CLIENT_ID`: OAuth 2.0 Web Client ID.
- `LEDGER_GOOGLE_API_KEY`: restricted browser API key for Google Picker.
- `LEDGER_GOOGLE_APP_ID`: Google Cloud project number used by Picker.

For GitHub Pages, set them as repository Actions **variables** under **Settings
→ Secrets and variables → Actions → Variables**. Local builds may set the same
environment variables before `npm run build` or `npm run release`. If OAuth is
configured but either Picker value is missing or malformed, Drive can still
connect and use an already remembered destination. Folder selection is reported
unavailable; local JSON tools remain available.

The API key is intentionally delivered to the browser and is therefore visible
in the built bundle. Restrict it in Google Cloud by the production website and
any development websites you use, and allow only Google Picker API and Google
Drive API. Do not commit the key or put it in documentation or tests. It is not
a client secret. No client secret, backend, server exchange, refresh-token
storage, or token persistence is used.

In the Google Cloud project associated with the Web Client ID:

1. Enable Google Drive API and Google Picker API.
2. Set the OAuth consent screen and audience as needed. Request only
   `https://www.googleapis.com/auth/drive.file`.
3. Authorize JavaScript origins `https://masterzoidberg.github.io` and the
   localhost origins used for development (for example,
   `http://localhost:5173` and `http://127.0.0.1:5173`). Origins have no app path.
4. Restrict the browser API key to the intended websites and the Picker and Drive
   APIs. The Picker UI may also require `https://docs.google.com/*` as an allowed
   website referrer, as described in Google's Picker setup guide.

## Runtime and data safety

Google Identity Services loads on configured online Data & backups. Google
Picker's `https://apis.google.com/js/api.js` loads only after the user explicitly
chooses or changes a folder. No Google request occurs on normal startup, the
Dashboard, or unrelated routes. Picker does not broaden OAuth beyond `drive.file`.

OAuth access tokens remain in the provider's memory, expire, and disappear on
reload or Disconnect. They are never written to localStorage, IndexedDB, account
JSON, backups, URLs, or logs. Drive requests use Authorization headers and fixed
Google API origins. Response bodies are not rendered or logged.

Offline and direct-file (`file://`) use preserve browser-local saves, JSON
import/export, and recovery. Google Drive is unavailable in those contexts.
Missing Picker configuration does not disable local data tools.

Drive failures never change Ledger data. Backup uses the canonical export
payload. Restore validates downloaded bytes through the existing importer;
unknown valid records and planning data remain under the same rules as local
imports. The local backup and writer guard must both succeed before replacement,
and Continue is invalidated only after successful replacement.

Drive lookup and creation are not atomic across separate windows/devices.
Simultaneous first backups may race and create duplicate app-managed entries.
This feature adds no automatic backup, background upload, history, cloud sync,
conflict resolution, arbitrary file picker, or Phase 13/14 work.

## Verification and manual acceptance

Automated tests use deterministic OAuth, Picker, and Drive REST stubs; they do
not establish real Google acceptance. Browser coverage checks that Picker is
lazy, cancellation preserves the destination and Ledger, first backup uses the
selected folder, repeat backup reuses the same `latest.json`, changing folders
leaves the old backup in place, and restore uses the current destination.
Direct-file tests cover local tools with Drive unavailable. Automated viewport
checks do not replace genuine manual keyboard and 200% zoom acceptance.

After deployment, test with synthetic/non-critical progress:

1. Connect and confirm the requested access is limited to `drive.file`.
2. Choose **Choose backup folder**, select the folder row in Picker, and verify
   no backup starts until you press **Backup now**.
3. Confirm `latest.json` appears directly inside that folder. Change synthetic
   progress and back up again; Picker should stay closed and the same
   app-managed file should update.
4. Change folder. Confirm the old backup remains untouched and the next backup
   appears in the new folder. Try a recent location and **Use My Drive**.
5. Restore from the active location, inspect the existing replacement preview,
   and cancel to confirm local data is unchanged. Repeat and confirm only when
   ready.
6. Disconnect and confirm local data, local JSON tools, and Drive files remain.

Official references:
[Google Picker web integration](https://developers.google.com/workspace/drive/picker/guides/web-picker),
[folder selection in DocsView](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setselectfolderenabled),
[single-view navigation and Picker features](https://developers.google.com/workspace/drive/picker/reference/picker.feature),
[Picker App ID](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setappid),
[GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model),
[Drive file queries](https://developers.google.com/workspace/drive/api/guides/search-files),
[Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
