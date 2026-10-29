# Optional Google Drive backups — V1

Drive transports the same portable JSON as local Export JSON. Browser-local saves
stay authoritative. V1 manages `The Ledger Backups/latest.json`; explicit import
restores that app-managed file through the existing parser, migrations, preview,
confirmation, writer guard, and backup/recovery protections. It never restores
automatically. Use local Import JSON for other portable files.

## Public configuration

The only build value is **`LEDGER_GOOGLE_CLIENT_ID`**, the public OAuth 2.0
**Web application** Client ID. The existing esbuild script reads native
`process.env`; no dotenv/dependency is added. Set it as a repository Actions
variable for Pages, or in the shell before `npm start`, `npm run build`, or
`npm run release`. In PowerShell:
`$env:LEDGER_GOOGLE_CLIENT_ID='your-web-client-id.apps.googleusercontent.com'`.

Absent/invalid configuration shows an unconfigured state and leaves local tools
available. Client IDs ship publicly in the bundle. V1 requires no Google Picker,
browser API key, project-number/App-ID setting, client secret, backend exchange,
or refresh token. Automated tests use a synthetic ID only in an isolated mock
bundle; production defaults to unconfigured.

In the Google Cloud project associated with the Web client:

1. Enable **Google Drive API**.
2. Configure Auth Platform branding, audience/consent and test users if in testing.
   Request only `https://www.googleapis.com/auth/drive.file`.
3. Authorize JavaScript origins `https://masterzoidberg.github.io`,
   `http://localhost:5173`, and `http://127.0.0.1:5173` as needed for the existing
   development server. Origins contain no `/dbd-tracker/` path.
4. Supply the public Web Client ID through the build variable. No server redirect
   URI or client secret is used.

## Runtime and data safety

Only Google Identity Services (`https://accounts.google.com/gsi/client`) loads,
lazily from configured online Data & backups. No Google request occurs during
normal startup or on unrelated routes. OAuth requires explicit Connect/action.
A failed library load requires reload instead of repeated background attempts.
Offline and `file://` use keep local saving, import/export and recovery working;
Drive shows unavailable.

Access tokens remain in the provider closure, expire, and disappear on reload or
Disconnect. No token enters localStorage, IndexedDB, exports, backups, logs, or
REST URLs. Expired/rejected authorization can be reacquired through explicit
Connect/action. Disconnect clears memory and attempts GIS revocation; it does
not delete local data or Drive files or sign out Google globally.

REST calls use Authorization headers under fixed
`https://www.googleapis.com/drive/v3/` and `/upload/drive/v3/` paths. Provider
response bodies are not rendered/logged; UI errors use text. No existing CSP
was present or weakened. Catalogs/artwork remain local. The release static
fetch/import guard remains; browser tests allow only the exact optional GIS SDK
URL on Data and reject other external runtime requests.

Both actions find non-trashed entries carrying the private
`appProperties.ledgerBackup` marker. Names alone never permit overwriting or
importing unrelated files. Returned stable IDs address each upload/download.
Queries rediscover IDs each time, avoiding stale preferences after deletion or
account changes. Provider IDs are never stored in portable JSON or preferences.

First export locates/creates the app folder/current file and uploads the complete
canonical payload. Repeat exports update it. Last-export status reflects only a
confirmed upload during this page session. Import only looks up/downloads the
app backup; missing entries produce an explanation without creating files.
Downloaded bytes remain untrusted until the existing importer validates them.
Preview cancellation preserves data/Continue. Backup or writer failure blocks
replacement; Continue clears only after successful replacement.

Drive list/create is not atomic across windows/devices. Avoid simultaneous
initial exports: these can create duplicate app-marked folders/files. Sequential
actions select the oldest matching entries deterministically and repeat exports
update those IDs. No history, retention, merge, background upload, automatic
backup, cloud sync, service worker, or Phase 13/14 work is included.

## Verification and manual acceptance

`npm test` covers configuration, sessions, first/repeat uploads, app-managed
downloads, missing backups, failures and non-mutation. The existing smoke/release
entry point tests the actual Data page using deterministic GIS/REST stubs,
synthetic Ledger data and disposable contexts. It verifies canonical local/Drive
payload equality, schemas, invalid input, preview/cancel, storage/writer failures
and Continue behavior. Mocks do not establish real Google integration; automated
viewport/direct-file tests do not establish genuine manual zoom/keyboard checks.

After supplying the Client ID and confirming Cloud settings:

1. Use a disposable profile, synthetic progress and a safe Google test account.
   Connect and confirm only `drive.file` consent.
2. Export and inspect `The Ledger Backups/latest.json`. Compare with local export.
   Change synthetic progress and export again; confirm the same ID updates and
   unrelated same-name files remain untouched.
3. Import from Drive and cancel preview; verify unchanged data/Continue. Repeat
   and confirm; verify the previous local backup and persistence after reload.
   Test missing backup/download failure. No file chooser should open.
4. Disconnect/reconnect and test expiry. Verify data/files remain, and local JSON
   tools work offline and in the direct-file release.
5. After required acceptance, publish through Pages, compare the deployed bundle
   hash with the accepted release, and repeat the real Google flow synthetically.

For `origin_mismatch`, check the exact JavaScript origin and Web client type.
For denied consent, check audience/test users. For API/permission failures,
enable Drive API and reconnect. No broader scope is required for app-created
backups. A manually uploaded JSON might be inaccessible under `drive.file`;
use local Import JSON, then Export to Drive to establish the app-managed backup.

Official contracts checked:
[GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model),
[Drive file queries](https://developers.google.com/workspace/drive/api/guides/search-files),
[Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
