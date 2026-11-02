# Ledger Authenticated Persistence Boundary — Design

**Status:** Selected for a Preview-only synthetic proof. This design does not authorize production authentication, real account data, or UI synchronization.

## Intent

Add a real server-validated identity boundary and a per-user hosted persistence API proof before any real Ledger save can be stored remotely. The existing app remains local-first: this milestone does not connect its UI to the new API.

## Current architecture

The app is vanilla JavaScript built with esbuild and deployed as a static Vercel project with root Node Functions. Schema v3 is canonical; `validateSave` retains v1/v2 migration to v3. The browser uses `TrackerStorage` over localStorage and supports import/export, GitHub Pages, and direct-file use. `/api/proof/*` is a Preview-only synthetic singleton proof using `@neondatabase/serverless`; it remains unchanged and separate from the new account boundary.

The Vercel project currently has SSO enabled. Its only `DATABASE_URL` is sensitive and scoped to Preview + `feat/vercel-neon-foundation`; Production has no database variable. The Neon project `dbd-tracker` has `main` and `feat/vercel-neon-foundation` branches; Neon Auth is not enabled. The new proof will use a separate child branch of `main` and a new Preview-only branch-scoped URL.

## Approaches considered

1. **Authentication only.** This reduces immediate code but leaves account ownership and per-user revision/backup authorization unproven. It is too small to validate the security boundary required before remote personal saves.
2. **Better Auth on same-origin Vercel Node Functions plus per-user JSONB APIs — selected.** It fits the existing static app and Node Function architecture, keeps cookies same-origin, validates identity on the server, and proves Neon ownership without changing the browser app. It adds a supported auth dependency but no framework or third-party account service.
3. **Neon Managed Auth with a custom bearer-token backend.** Neon publishes a React/Hono example, but its current Managed Better Auth roadmap marks standalone frontend/backend architectures as coming soon and says the supported framework list does not include vanilla JS + Vercel Functions. The custom JWT example is a lower-level integration, not evidence that this project shape is supported. Revisit only if Neon’s documented support changes.
4. **Add a client sync or opt-in remote-save UI now.** This would add local/remote conflict, offline, and migration decisions before the API identity boundary has been validated. Defer it.

## Goals

- Provide server-side email/password identity for synthetic Preview test accounts using Better Auth.
- Provide authenticated per-user state and backup APIs, with no client-supplied owner IDs.
- Enforce owner isolation in both the API and Postgres RLS using a restricted runtime role that does not have `BYPASSRLS`.
- Preserve per-user atomic compare-and-swap revisions and immutable backups.
- Keep all new auth and data routes Preview-only, protected by existing Vercel SSO, with secrets scoped only to Preview + `codex/ledger-authenticated-boundary`.
- Use only synthetic accounts and deterministic synthetic schema-v3 documents.

## Non-goals and anti-goals

- No real Ledger data, user signup launch, production authentication, production `DATABASE_URL`, or production promotion.
- No login UI, Ledger UI integration, client remote-save client, automatic sync, local-to-cloud migration, or change to localStorage authority.
- No change to `src/storage.js`, `src/app.js`, `src/model.js`, schema-v3 behavior, v1/v2 migration, import/export, direct-file support, GitHub Pages, or release gates.
- No Neon Managed Auth provisioning, framework rewrite, custom password/session implementation, or admin database URL in Vercel.
- No account deletion endpoint in this proof. Deletion policy must be settled before real user data is accepted because immutable backups conflict with hard deletion unless an explicit erasure mechanism is designed.

## Threat and security boundaries

- Better Auth is the only identity authority. Data handlers obtain the owner ID from a verified Better Auth session; they never trust an owner ID in the URL or request body.
- The `/api/auth/*` and new `/api/ledger/*` handlers return 404 unless `VERCEL_ENV === 'preview'`, before constructing database clients. No production or development auth/data environment variables are configured.
- Keep Vercel Authentication / SSO enabled. Preview test accounts are synthetic and are created only while the Preview deployment is SSO-protected. There is no signup UI. Email verification and production signup policy remain production-launch prerequisites, not claims this proof satisfies.
- Better Auth uses server-side email/password authentication with its HTTP-only, Secure, SameSite=Lax session cookie behavior, built-in CSRF/Origin checks, and an allowlist limited to the current Vercel deployment host. State-changing Ledger API routes also require same-origin requests.
- `BETTER_AUTH_SECRET` and the restricted-role `DATABASE_URL` exist only as sensitive Preview variables scoped to this branch. Neither is bundled, logged, checked in, or copied to a local `.env` file.
- The runtime DB login is created as a normal SQL role with `NOBYPASSRLS`; it is not a Neon Console/API-created admin role. It receives only the grants needed for Better Auth tables and user-owned tables. Migrations use Neon’s admin connection outside the app runtime.
- State and backup tables use `ENABLE ROW LEVEL SECURITY` plus `FORCE ROW LEVEL SECURITY`. Each data operation starts a transaction, sets a transaction-local authenticated user ID, and executes parameterized SQL. Policies require the row owner to match that value. The client cannot set it.
- Hosted backups remain immutable at the database boundary. Reads are owner-scoped. No update/delete endpoint is provided.

## Identity and account lifecycle

Use Better Auth email/password on the Node runtime. The auth handler is mounted at `/api/auth/[...all]`; it is dynamically loaded only after the Preview guard. The project does not add React, Next.js, or an auth UI. Better Auth manages hashed passwords, sessions, and verification records in Postgres.

The SSO-protected Preview may create synthetic accounts without a configured email provider so automated proof accounts can be exercised. This is not a production signup policy. Before production auth, configure verified email delivery, signup abuse/rate controls, recovery, account linking policy, and an account deletion/backup retention policy. Account deletion is disabled in this milestone; Neon test branch reset/removal is operational cleanup, not an end-user account-deletion design.

## Data ownership and persistence API

Keep auth identity tables separate from `ledger_state` and `ledger_backups`; do not change the existing `/api/proof/*` contract or tables. Add user-keyed JSONB tables:

- `ledger_user_state`: one row per Better Auth user, canonical v3 JSONB, positive `BIGINT` revision, update timestamp.
- `ledger_user_backups`: immutable UUID snapshots with owner ID, source revision, JSONB document, and creation timestamp.

New API surface:

- `GET /api/ledger/state`: current caller’s state; 404 if absent.
- `PUT /api/ledger/state`: `{ expectedRevision, data }`; expected revision zero creates revision one, matching values increment atomically, stale writes return 409 without mutation. Validate through existing `validateSave` and store its canonical v3 output.
- `POST /api/ledger/backups`: snapshot the caller’s current row atomically.
- `GET /api/ledger/backups/:id`: return only a backup owned by the current caller; another user’s ID returns the same 404 as an unknown ID.

There is no `userId` input. Revisions and backups are per user. No automatic retry, merge, or last-writer-wins path is added. The documented JavaScript safe-integer edge remains deferred; Postgres range mapping must reject values the API cannot safely represent.

## Compatibility, migration, and conflict handling

The real Ledger UI remains on localStorage. Direct-file and GitHub Pages continue to work offline and never call authenticated endpoints. Import/export remains the only save-transfer mechanism in this milestone. No local save is read by server code or sent to Neon.

The API reuses `validateSave`, preserving schema v3 as canonical and v1/v2-to-v3 migration behavior. No personal data migration occurs. A future UI milestone must be explicit opt-in, preserve a recoverable local copy, present revision conflicts instead of merging silently, and define export/restore behavior before syncing.

## Backup deletion and recovery boundary

Database triggers reject direct backup UPDATE and DELETE. This means hard account deletion cannot simply cascade while preserving the existing immutability guarantee. Since all users and saves in this milestone are synthetic, do not build deletion semantics prematurely. Before production data, choose and implement a reviewed policy such as a narrowly privileged erase operation or cryptographic erasure; prove that policy independently without weakening ordinary backup immutability.

Rollback is code rollback/removal of the new Preview-only endpoints and environment variables. The original proof routes, local app, and Production deployment remain unaffected. Synthetic test state stays in the dedicated Neon branch; deleting that branch is a separate cleanup decision and is not automatic.

## Deployment and environment strategy

- Work on the isolated worktree and branch `codex/ledger-authenticated-boundary`; never implement on `main`.
- Create/use Neon branch `codex/ledger-authenticated-boundary` from Neon `main`, not from the old hosted-proof branch. Apply checked-in auth and per-user schema migrations there, create a restricted runtime SQL login, and use synthetic rows only.
- Keep the Vercel project’s Production Branch `main`, SSO protection, and Production/Development environment scopes unchanged. Configure sensitive `DATABASE_URL` and `BETTER_AUTH_SECRET` only for Preview + `codex/ledger-authenticated-boundary`.
- Push only after local verification. Verify target is Preview and branch/commit are correct before any application request or hosted mutation. Stop if Vercel classifies the branch as Production or requires broader environment scope.
- Do not use an automation bypass or public share link. If protected Preview HTTP verification cannot be performed without one, finish local and database-level checks and report the exact user-only verification needed.

## Test strategy and acceptance criteria

- Unit tests prove Preview gating happens before auth/database construction, missing/invalid sessions fail closed, client-supplied owner IDs are rejected, CSRF/origin violations fail, validation reuses v3 and v1/v2 behavior, CAS is atomic per user, and cross-user state/backup reads are indistinguishable from missing data.
- Repository tests verify every query executes with a transaction-local owner context, correct RLS table grants, per-user CAS semantics, owner-scoped backup reads, and no mutation routes.
- A dedicated synthetic two-user integration check proves row isolation with the restricted Neon login, including no cross-user read/write, stale-write non-mutation, and immutable backups. No real save fixture is accepted by the verifier.
- Build output must contain neither auth/database code nor `DATABASE_URL`, `BETTER_AUTH_SECRET`, or Neon driver references. Existing tests, build, release, direct-file and browser checks remain unchanged and pass.
- SSO stays enabled; Production and Development contain no new auth/database credentials; the deployment is Preview-only and unpromoted.

## Authoritative references consulted

- Neon Managed Better Auth roadmap: https://neon.com/docs/auth/roadmap
- Neon custom backend JWT guide: https://neon.com/guides/react-neon-auth-hono
- Neon restricted-role RLS guidance: https://neon.com/docs/guides/rls-query-execution and https://neon.com/docs/manage/roles
- Better Auth PostgreSQL adapter: https://better-auth.com/docs/adapters/postgresql
- Better Auth Node handler and security: https://better-auth.com/docs/integrations/express and https://better-auth.com/docs/1.6/reference/security
- Better Auth dynamic Vercel base URL and deletion behavior: https://better-auth.com/docs/guides/dynamic-base-url and https://better-auth.com/docs/concepts/users-accounts
