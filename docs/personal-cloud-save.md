# Personal cloud save

Scope: one owner, cross-device saves, offline local edits, explicit conflict resolution and JSON recovery. No registration, email delivery, verification, emailed password resets, custom domain, or cloud-backup management UI.

## Behavior

- Sign in through Account. First connection explicitly chooses the device or cloud copy.
- Both copies are preserved before replacement; download preserved copies from Account. Existing JSON export/import and local snapshots remain in Data & backups.
- Local changes upload after a short delay. Opening the app, returning to its tab, reconnecting, or choosing Refresh / retry checks for cloud changes.
- Cloud writes use the existing revision check. Concurrent edits require a choice; no automatic merging or last-write-wins overwrite.
- Pending edits and read-only tabs block cloud replacement. Offline edits survive reload through the saved link baseline.
- Exported JSON is the independent backup. Preserved copies are browser-local and are not a substitute for downloading backups.

## Administrative account setup / recovery

Public registration is disabled in Better Auth. Provisioning is a local command, never a hosted API. It refuses to create an account in a nonempty user table. Recovery requires the sole existing owner's email, retains that user's ID and data, and revokes their sessions.

Use an ignored private environment file containing an administrative `DATABASE_URL`, then run in an interactive terminal:

```powershell
node --env-file=.env.personal-admin scripts/personal-account.mjs create
# If you later forget the password:
node --env-file=.env.personal-admin scripts/personal-account.mjs recover
```

The command displays the database hostname, asks for the action and email, and reads the password twice without echoing it. Do not pass passwords in arguments or chat. Store the owner password in your password manager. Administrative database credentials belong only on your machine; the deployed app uses a restricted login inheriting `ledger_runtime`.

## Deployment

Use existing migrations 002 and 003 for auth, persistence, rate limits and access restrictions. Do not enable Neon-managed Auth or introduce another auth provider. Existing Mailtrap code and historical migration tables are not used by this flow; they are retained to avoid unrelated cleanup.

The browser Account entry is included only in configured Vercel Preview/Production builds with `DATABASE_URL` and `BETTER_AUTH_SECRET`; ordinary static builds stay local-only. Auth and save endpoints support those hosted environments; other environments return 404. Production accepts its exact stable Vercel production domain as well as the deployment host. Keep Vercel SSO protection enabled.

Preview acceptance uses a dedicated synthetic owner on Neon branch `codex/personal-cloud-save`. Production must use its own database credentials and session secret, and an administratively provisioned real owner. No Preview saves or credentials should be copied to Production.

## Verification

- `npm test`: auth provider, sign-up rejection, throttling, provisioning/recovery, persistence boundaries, offline/reload, conflicts, imports, races and backup failure.
- `node tests/browser/personal-cloud.mjs`: two isolated device contexts, actual UI edit synchronization, read-only tab, mobile layout and keyboard close using simulated APIs.
- `npm run build`: default local-only artifact.
- Live protected Preview and real-device Production acceptance are separate checks; mocked browser tests do not establish either.

The earlier Mailtrap blocker in `personal-preview-baseline.md` belongs to the superseded email-based design.

## Acceptance recorded 2026-11-11

- 506 Node tests passed after enabling Production support.
- Full existing Edge browser regression passed, including JSON export/import/restore and local-only behavior.
- Two-context browser cloud tests passed with simulated APIs.
- Live protected Preview `dpl_AQuPH5UYF6FY93eSoyHX2nsh47tk`, commit `4f3c4d6`, passed real sign-in without email, cross-device UI edit synchronization, registration rejection, revision conflict rejection, secure HttpOnly session cookie and sign-out access revocation.
- Preview uses Neon `br-nameless-wave-b8qvltb8`; Production uses `br-red-violet-b864mmsn`. Both have migrations 002/003 and separate restricted `ledger_personal_runtime` passwords. Production has independent session signing credentials.
- Real owner password entry and actual second-device acceptance remain user steps. The local `.env.personal-admin` file is ignored and must never be committed or uploaded.
- Production deployed from `79195c9` as `dpl_42x65jHSckaZieip9DNKV5htzKLj` at `https://dbd-tracker-opal.vercel.app`. The user created the sole real owner locally. Stable-domain checks passed: account UI available, anonymous session null, anonymous save access 401, registration and email reset 404. Vercel SSO remains enabled.
- Production log review found only the PostgreSQL driver's SSL-mode deprecation warning, not application failures. Real-device save linking remains pending user acceptance.
