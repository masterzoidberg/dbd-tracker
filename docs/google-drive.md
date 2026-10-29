# Optional Google Drive backups

Google Drive is an optional transport for the same portable Ledger JSON used by
local Export JSON. The browser remains the authoritative save. Drive import is
explicit and sends downloaded bytes through the existing validation, migration,
replacement preview, confirmation, writer guard, and backup/recovery pipeline.
Canceling restore changes nothing.

## Choose and remember a backup folder

Connect Google Drive, then choose a destination when you first select **Backup
now** or **Restore from Drive**. The official Google Picker opens only at that
point and is configured to select folders, not arbitrary files. Picker is loaded
on demand; opening the Dashboard or visiting Data & backups does not load Picker.

The selected folder is the backup location. The Ledger remembers its folder ID
and display name in a separate local browser preference; the preference is not
part of Ledger saves, exports, snapshots, or schema migrations. The rolling
`latest.json` file is created directly inside the selected folder. The Ledger
does not create an extra wrapper folder.

Later backups reuse the remembered folder and update the same app-managed
`latest.json`. A private `appProperties` marker distinguishes it from unrelated
files with the same name. **Change folder** changes only the local destination;
it does not move or delete the old Drive backup. The next backup uses the new
folder. Restore looks only for the app-managed backup in the currently selected
folder.

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
Picker's `https://apis.google.com/js/api.js` loads only after the user starts
choosing a folder. No Google request occurs on normal startup, the Dashboard, or
unrelated routes. Picker does not broaden OAuth beyond `drive.file`.

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
2. Click **Backup now**, select a folder, and verify `latest.json` appears
   directly inside it.
3. Change synthetic progress and back up again. Confirm Picker does not reopen
   and the same app-managed file is updated.
4. Change folder. Confirm the old backup remains untouched and the next backup
   appears in the new folder.
5. Restore from Drive, inspect the existing replacement preview, and cancel to
   confirm local data is unchanged. Repeat and confirm only when ready.
6. Disconnect and confirm local data, local JSON tools, and Drive files remain.

Official references:
[Google Picker web integration](https://developers.google.com/workspace/drive/picker/guides/web-picker),
[folder selection in DocsView](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setselectfolderenabled),
[Picker App ID](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setappid),
[GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model),
[Drive file queries](https://developers.google.com/workspace/drive/api/guides/search-files),
[Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
