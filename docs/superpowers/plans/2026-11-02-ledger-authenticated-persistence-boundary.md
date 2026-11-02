# Ledger Authenticated Persistence Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Preview-only authenticated per-user persistence API proof while leaving the Ledger UI and localStorage authoritative.

**Architecture:** Better Auth handles same-origin email/password sessions in root Vercel Node Functions. New per-user JSONB APIs derive owner identity from the server session and run against Neon through a restricted SQL role with forced RLS, atomic revision compare-and-swap, and database-enforced immutable backups. Existing `/api/proof/*` and browser code stay unchanged.

**Tech Stack:** Node.js 22, Better Auth 1.7.15, `pg` 8.23.1, `@vercel/functions` 3.6.1, Neon Postgres, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-02-ledger-authenticated-persistence-boundary-design.md`

## Global Constraints

- Schema v3 is canonical; reuse `src/model.js` `validateSave` and preserve v1/v2-to-v3 migration behavior.
- Add auth and user-data functions only under root `/api/auth` and `/api/ledger`; keep the old `/api/proof` functions isolated and unchanged.
- Every new route returns 404 unless `VERCEL_ENV === 'preview'`; Vercel SSO stays enabled.
- Use only Neon branch `codex/ledger-authenticated-boundary` and synthetic accounts/documents.
- Scope sensitive `DATABASE_URL` and `BETTER_AUTH_SECRET` only to Preview + Git branch `codex/ledger-authenticated-boundary`; Production and Development remain without them.
- Use a restricted PostgreSQL runtime role with no `BYPASSRLS`; do not use the Neon admin/project-owner role for app requests.
- Server session identity is the only row owner source; ignore no spoofed owner IDs—reject them.
- All user-data queries execute under transaction-local RLS identity. State writes use atomic CAS; stale writes return 409 without mutation.
- Backup rows are immutable by database trigger; no backup mutation API is added.
- No UI sync, real save import, production credentials, account deletion feature, production deployment, or promotion.
- Do not change `src/app.js`, `src/storage.js`, `src/model.js`, release scripts/gates, GitHub Pages, direct-file behavior, import/export, or localStorage persistence.
- Do not use a Vercel automation bypass or public deployment share link. If protected Preview requests require either, stop hosted HTTP verification and report the user-only action.

## Review Focus

- Missing session or production/development execution must not construct Better Auth or a database client; test the 404/401 path before any lazy factory call.
- Spoofed `userId`, unknown backup IDs, and another user’s backup IDs must never expose data; test identical 404 behavior and no client-selected owner.
- Missing, cross-site, or mismatched Origin on PUT/POST must fail before mutation; test the request guard.
- A stale or concurrent same-user revision must return 409 without mutation while another user’s revision remains independent; test both identity scopes.
- SQL run under the restricted role without matching transaction-local identity must read/write no user rows, and backup UPDATE/DELETE must fail; verify with isolated Neon integration SQL.

---

## File Map

- Create `src/auth/config.js` for Better Auth configuration and `src/auth/runtime.js` for lazy Preview-only database and handler construction.
- Create `api/auth/[...all].js` as the Better Auth Node handler with request-body parsing disabled and early Preview gating.
- Create `db/migrations/002-authenticated-persistence.sql` for Better Auth tables, per-user JSONB tables, restricted role grants/RLS policies, and immutable backup trigger.
- Create `src/user-persistence/repository.js` for transaction-scoped owner context, per-user CAS, and owner-scoped backup SQL.
- Create `src/user-persistence/handlers.js` for identity enforcement, CSRF/origin checks, validation, status codes, and thin route logic.
- Create `api/ledger/state.js`, `api/ledger/backups.js`, and `api/ledger/backups/[id].js` as thin Vercel functions.
- Create `tests/auth.test.js`, `tests/user-persistence.test.js`, and `tests/user-persistence-repository.test.js` for deterministic unit/adapter coverage.
- Create `scripts/verify-authenticated-persistence.mjs` and `tests/user-persistence.integration.test.js` for explicit synthetic two-user integration assertions; they accept no save-file input and no user ID from request payloads.
- Modify `package.json` and `package-lock.json` for `better-auth`, `pg`, and `@vercel/functions`; do not add a browser auth client or UI dependency.

---

### Task 1: Add Preview-only Better Auth server and synthetic session tests

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/auth/config.js`, `src/auth/runtime.js`, `api/auth/[...all].js`
- Test: `tests/auth.test.js`

**Interfaces:**
- `createAuthRuntime({ env, createPool, createAuth })` lazily returns a Better Auth instance only after `env.VERCEL_ENV === 'preview'` and required Preview environment values exist.
- `resolveSession(req)` returns `{ userId, sessionId }` from Better Auth’s verified session or `null`; it never reads request-body identity.
- `authRoute(req, res)` returns 404 outside Preview before loading runtime and delegates supported requests to Better Auth’s Node handler.

- [ ] **Step 1: Write failing auth boundary tests** for non-Preview 404 before `createPool`, missing Preview secrets fail with a generic error, valid session identity is returned, missing/expired session returns null, and the Better Auth cookie/security config uses same-origin allowlisted deployment hosts.
- [ ] **Step 2: Run `node --test tests/auth.test.js`** and confirm the tests fail before implementation.
- [ ] **Step 3: Add the pinned compatible server dependencies** `better-auth@^1.7.15`, `pg@^8.23.1`, and exact `@vercel/functions@3.6.1`; keep React, Next.js, and client auth packages absent. Run `npm audit` and resolve transitive advisories without force-upgrading.
- [ ] **Step 4: Implement lazy Preview auth runtime** with email/password enabled for synthetic Preview users, Better Auth’s secure HTTP-only SameSite=Lax cookies and CSRF protections, and exact `VERCEL_URL` host validation. Do not configure email delivery or enable account deletion.
- [ ] **Step 5: Implement `/api/auth/[...all]`** with early Preview guard, dynamic runtime import, Node handler adapter, and Vercel body parsing disabled.
- [ ] **Step 6: Run the focused auth tests** and confirm no module or database client is constructed outside Preview.
- [ ] **Step 7: Commit** `feat: add preview-only authentication boundary`.

### Task 2: Create per-user Neon schema, restricted role, RLS, CAS, and backups

**Files:**
- Create: `db/migrations/002-authenticated-persistence.sql`
- Create: `src/user-persistence/repository.js`
- Test: `tests/user-persistence-repository.test.js`

**Interfaces:**
- `createUserPersistenceRepository(pool).withUser(userId, callback)` opens a transaction, sets transaction-local `app.user_id`, and invokes `callback(userRepository)` before committing or rolling back.
- The callback receives `readState()`, `compareAndSwapState(expectedRevision, canonicalData)`, `createBackup()`, and `readBackup(backupId)`; these methods accept no owner ID and operate only within that transaction context.
- `compareAndSwapState` uses one parameterized upsert and returns the stored row or `null` on conflict.

- [ ] **Step 1: Write failing adapter and migration tests** asserting one transaction-local identity per operation, one conditional upsert, user-scoped backup reads, forced RLS on both user tables, a `NOBYPASSRLS` runtime group with only required grants, and a trigger rejecting backup UPDATE/DELETE.
- [ ] **Step 2: Run `node --test tests/user-persistence-repository.test.js`** and confirm the missing repository/migration fails.
- [ ] **Step 3: Generate the Better Auth PostgreSQL schema from the checked-in auth config** and include its tables in the checked-in migration; do not run schema generation or migration automatically at function startup.
- [ ] **Step 4: Add `ledger_user_state` and `ledger_user_backups`** with text user foreign keys, JSONB documents, positive bigint revisions, owner indexes/constraints, forced RLS policies keyed to the transaction-local user ID, and the immutable backup trigger.
- [ ] **Step 5: Add the `ledger_runtime` NOLOGIN group role** and grant only Better Auth table CRUD plus user-state/backups operations needed by the app; keep the deploy login role separate and without `BYPASSRLS`.
- [ ] **Step 6: Implement the Postgres repository** using `pg` transaction APIs, parameterized SQL, and a global Vercel pool registered with `attachDatabasePool`.
- [ ] **Step 7: Run repository tests** and confirm transaction context is reset on commit and rollback; run migration assertions.
- [ ] **Step 8: Commit** `feat: add isolated per-user persistence schema`.

### Task 3: Add authenticated state and backup routes with CSRF and owner isolation

**Files:**
- Create: `src/user-persistence/handlers.js`
- Create: `api/ledger/state.js`, `api/ledger/backups.js`, `api/ledger/backups/[id].js`
- Test: `tests/user-persistence.test.js`

**Interfaces:**
- `createUserPersistenceHandlers({ env, resolveSession, getRepository, validateSave })` returns `state`, `backups`, and `backup` request handlers.
- The identity for every call is obtained once from `resolveSession(req)`; no `userId` parameter comes from the client.
- The state write body is exactly `{ expectedRevision, data }`; a `userId` field is rejected.

- [ ] **Step 1: Write failing handler tests** for preview gating, 401 without a session, origin rejection on PUT/POST, v3 round-trip, v2 migration through `validateSave`, owner spoof rejection, cross-user state/backup isolation, stale-write 409 non-mutation, and concurrent same-user writers with exactly one winner.
- [ ] **Step 2: Run `node --test tests/user-persistence.test.js`** and confirm failures before handler implementation.
- [ ] **Step 3: Implement handlers** with 404 outside Preview, 401 for missing sessions, 400 for invalid documents/revisions, 409 for CAS conflict, indistinguishable 404 for missing/foreign backups, generic 500s, and same-origin enforcement for writes.
- [ ] **Step 4: Implement thin Vercel routes** that use the shared auth/session runtime and lazy Neon pool. Do not import from `src/app.js` or `src/storage.js`.
- [ ] **Step 5: Run focused authenticated-persistence tests** and the existing hosted-proof tests; confirm `/api/proof/*` behavior is unchanged.
- [ ] **Step 6: Commit** `feat: add authenticated per-user ledger APIs`.

### Task 4: Provision isolated Preview and verify two-user database isolation

**Files:**
- Create: `scripts/verify-authenticated-persistence.mjs`
- Test: `tests/user-persistence.integration.test.js` and deterministic verifier tests.
- No edits to existing Vercel project protection or Production/Development variable scopes.

**Interfaces:**
- `verifyAuthenticatedPersistence(baseUrl, { fetchImpl })` generates two synthetic identities in process memory and deterministic v3 saves; `baseUrl` must be an explicit Preview URL.
- The verifier creates separate synthetic auth sessions, proves independent state/revisions and owner-only backups, proves a foreign backup ID returns 404, proves stale-write non-mutation, and checks one winner for concurrent writes.
- No credentials, save file paths, bypass secret, or user IDs are accepted from CLI arguments or written to logs.

- [ ] **Step 1: Add failing verifier tests** for missing Preview URL, no requests before URL validation, non-Preview deployment rejection, synthetic-only account creation, and all cross-user assertions.
- [ ] **Step 2: Run the focused verifier tests** and confirm expected initial failures.
- [ ] **Step 3: Implement the verifier** with random synthetic email/passwords held only in process memory and never printed; include cleanup that deletes only its own synthetic state where permitted without attempting to mutate immutable backups.
- [ ] **Step 4: Recheck Vercel Production Branch `main`, SSO, and environment scopes read-only.** Verify the old proof URL remains scoped only to its existing branch.
- [ ] **Step 5: Create Neon branch `codex/ledger-authenticated-boundary` from Neon `main`, apply the checked-in migration, create `ledger_preview` as a LOGIN role with no `BYPASSRLS` and grant it membership in `ledger_runtime`, then configure only Preview + this Git branch with sensitive `DATABASE_URL` and `BETTER_AUTH_SECRET`.** Do not commit, display, or store secret values locally.
- [ ] **Step 6: Verify before pushing/deploying** that Production and Development still have no `DATABASE_URL` or `BETTER_AUTH_SECRET`, and only the new Preview branch has the new variables.
- [ ] **Step 7: Push the feature branch and create a fresh Preview deployment.** Before any app request, verify `target=preview`, branch/head commit, SSO enabled, and expected build output. Stop if deployment target is not Preview.
- [ ] **Step 8: Run the deployed verifier only through an existing authenticated session path that does not create a bypass or public share link.** If that access path is unavailable, do not weaken protection; finish SQL and local tests and record the precise user-only HTTP acceptance needed.
- [ ] **Step 9: Run direct Neon SQL checks** using the restricted role and two synthetic users to prove RLS hides/blocks cross-user state and backup access, and verify backup UPDATE/DELETE fail. Confirm the original backup proof tables/data were untouched.
- [ ] **Step 10: Commit** `test: verify authenticated user isolation`.

### Task 5: Run final gates and review the deployment boundary

**Files:**
- No modifications to `scripts/release.mjs`, `scripts/verification.json`, `src/app.js`, `src/storage.js`, or `src/model.js`.

- [ ] **Step 1: Run focused tests:** `node --test tests/auth.test.js tests/user-persistence.test.js tests/user-persistence-repository.test.js tests/user-persistence.integration.test.js tests/hosted-proof.test.js tests/hosted-proof-repository.test.js`.
- [ ] **Step 2: Run the full suite:** `npm test`; confirm all tests pass, with no silent skip of required synthetic isolation checks.
- [ ] **Step 3: Run `npm run build`** and verify `dist/app.js` contains no `DATABASE_URL`, `BETTER_AUTH_SECRET`, `@neondatabase`, `better-auth`, or `pg` references.
- [ ] **Step 4: Run `npm run release`** and confirm its existing status/result without editing any release gate.
- [ ] **Step 5: Run `git diff --check` and review the final diff** for changed-file scope, generated-only outputs, no accidental env files, no schema/localStorage/UI changes, and no credentials.
- [ ] **Step 6: Recheck Vercel/Neon metadata read-only** for Preview target only, SSO on, branch Production setting `main`, no Production/Development auth or database secrets, and no alias/promotion changes.
- [ ] **Step 7: Report** the design decision, branch/worktree, files/tests, hosted resource names, deployment evidence, exact gate results, any protected HTTP acceptance limitation, and remaining production prerequisites. Do not merge or begin real-data migration.

---

## Plan self-review

- **Spec coverage:** Identity/session, API authorization, forced RLS, ownership, CAS, immutable backups, account deletion boundary, offline/local-first compatibility, migration deferral, Preview-only deployment, rollback, and tests are assigned to Tasks 1–5.
- **Step scan:** Every task has failing tests before implementation, exact files and interfaces, focused verification, and a commit boundary. Cloud steps happen only after local source checks and stop if scope or target safety fails.
- **Type consistency:** `resolveSession` returns `{ userId, sessionId } | null`; handlers consume that exact shape. Repository methods always use a transaction-scoped `userId`; only handler identity resolution supplies it.
- **Review Focus coverage:** Each failure mode is pinned to Tasks 1–4 tests or direct SQL verification.
- **Proportion:** Five tasks group auth setup, database ownership, API contract, deployment verification, and final gates; no task is split into cosmetic substeps.
