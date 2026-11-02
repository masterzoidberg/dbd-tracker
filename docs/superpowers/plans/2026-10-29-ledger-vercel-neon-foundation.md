# Ledger Hosted Persistence Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add and verify a Preview-only Vercel/Neon persistence proof for synthetic Ledger data using atomic revisions and immutable backups.

**Architecture:** Root Vercel Node.js functions expose only /api/proof endpoints. Handler logic is tested against an injected repository; a Neon adapter performs parameterized JSONB operations, with one conditional upsert for compare-and-swap. A checked-in Postgres migration makes backup rows immutable at the database boundary.

**Tech Stack:** Node.js 22, ESM, @neondatabase/serverless, Vercel Functions, Neon Postgres, node:test.

**Spec:** docs/superpowers/specs/2026-10-29-ledger-vercel-neon-foundation-design.md

## Global Constraints

- Schema v3 is canonical. Reuse src/model.js validateSave; preserve its v1/v2-to-v3 validation and migration paths.
- Add Vercel routes only under api/proof. Do not integrate remote persistence with the Ledger UI.
- The Preview serves the existing Ledger page unchanged alongside the API; no UI code may call the proof endpoints.
- Gate every proof route to Vercel Preview. DATABASE_URL must be sensitive and scoped only to Preview branch feat/vercel-neon-foundation.
- Use deterministic synthetic data only. Do not read, upload, or migrate real Ledger data.
- Do not modify src/storage.js, the existing localStorage persistence path, GitHub Pages deployment, direct-file behavior, or existing release gates.
- Keep DATABASE_URL and all database access server-side. Do not write secrets to source, browser bundles, logs, .env files, or completion output.
- Writes use a single atomic compare-and-swap statement. A stale expectedRevision returns 409 and does not mutate state; no merging or last-writer-wins.
- Enforce backup immutability in Postgres with the approved trigger migration. The API must provide no backup mutation route.
- Do not add application authentication or production account flows in this milestone.
- Include a concurrent same-revision writer test in which exactly one write succeeds and one returns 409.
- Create Vercel project dbd-tracker and Neon project dbd-tracker only after read-only preflight. Do not deploy or promote anything to production.
- If project creation, Neon branch isolation, or exact Preview-only branch environment scoping conflicts with the approved design, stop and report the constraint. Do not substitute a broader environment or silently rename/re-scope resources.
- Work only in the existing feat/vercel-neon-foundation worktree based on origin/main 807f8ce. Leave the original checkout and its untracked directories untouched.

## Review Focus

- Malformed JSON, unsupported schema, or invalid v3 fields must return 400 before any repository write; test: rejects malformed and unsupported documents without repository writes.
- Missing, negative, fractional, or unsafe expectedRevision must return 400; test: rejects invalid expected revisions.
- Non-Preview requests must return 404 before constructing or calling the Neon repository; test: proof routes reject non-preview environments before database access.
- Concurrent writes with one expected revision must have exactly one winner and preserve only that winner's document; test: concurrent same-revision writes produce one success and one conflict.
- Direct UPDATE and DELETE against ledger_backups must be rejected by Postgres and leave the snapshot readable unchanged; verify: backup mutation trigger rejects update and delete.

## File Map

- Create db/migrations/001-hosted-proof.sql for ledger_state, ledger_backups, and the immutable-backup trigger.
- Create src/hosted-proof/handlers.js for request validation, Preview gating, status codes, and injected repository calls.
- Create src/hosted-proof/repository.js for parameterized Neon queries and atomic persistence operations.
- Create src/hosted-proof/runtime.js for lazy server-only DATABASE_URL and Neon repository construction after the Preview gate.
- Create api/proof/state.js, api/proof/backups.js, and api/proof/backups/[id].js as thin Vercel function entry points.
- Create tests/fixtures/hosted-save.js for deterministic synthetic schema-v3 data.
- Create tests/hosted-proof.test.js and tests/hosted-proof-repository.test.js.
- Create scripts/verify-hosted-proof.mjs for the explicit Preview URL end-to-end flow.
- Modify package.json and package-lock.json only to add @neondatabase/serverless. Do not add a framework or .env configuration.

---

### Task 1: Define the HTTP contract and deterministic handler tests

**Files:**
- Create: tests/fixtures/hosted-save.js
- Create: tests/hosted-proof.test.js
- Create: src/hosted-proof/handlers.js

**Interfaces:**
- hostedSaveV3Fixture() returns a fresh deterministic valid schema-v3 save with a fixed updatedAt value.
- createProofHandlers({ getRepository, env, validateSave }) returns state(req, res), backups(req, res), and backup(req, res).
- The injected repository provides readCurrent(), compareAndSwapState(expectedRevision, data), createBackup(), and readBackup(id). A failed compare-and-swap returns null.

- [ ] Step 1: Write failing handler tests for v3 read/write round-trip; v2 fixture migration to stored schema v3 through validateSave; expectedRevision 0 creates revision 1; expectedRevision 1 updates to revision 2; stale expectedRevision returns 409 and preserves current data; and backup readback remains exact after a later revision.
- [ ] Step 2: Add failing boundary tests named in Review Focus for malformed/unsupported documents, invalid expected revisions, non-Preview access without repository construction, and concurrent expectedRevision writers with one 2xx response, one 409 response, and only the winner's document persisted.
- [ ] Step 3: Run the focused tests with node --test tests/hosted-proof.test.js; confirm they fail because the handlers are not implemented.
- [ ] Step 4: Implement createProofHandlers with injectable repository, environment, and validator dependencies. Validate through existing validateSave and persist only its canonical save. Return 404 outside Preview; use 400 for invalid input, 405 for unsupported methods, 409 for compare-and-swap conflicts, 404 for missing state/backup, and generic 500 errors without database details.
- [ ] Step 5: Run the focused tests; confirm all handler and concurrency tests pass.
- [ ] Step 6: Commit the fixture, tests, and handler module.

### Task 2: Add the Neon repository and database migration

**Files:**
- Modify: package.json
- Modify: package-lock.json
- Create: src/hosted-proof/repository.js
- Create: tests/hosted-proof-repository.test.js
- Create: db/migrations/001-hosted-proof.sql

**Interfaces:**
- createNeonRepository(sql) returns the four repository methods defined in Task 1.
- compareAndSwapState(expectedRevision, data) performs exactly one parameterized INSERT/ON CONFLICT statement and returns the stored row or null when the predicate matches no row.
- createBackup() inserts by selecting revision and data from the singleton row in one SQL statement.

- [ ] Step 1: Write failing adapter and migration tests. With a stub Neon tagged-query function, assert reads map database rows to the documented state/backup shape, compare-and-swap uses one statement with expectedRevision in the conflict predicate, and backup creation uses one INSERT ... SELECT. Also assert the migration declares an enabled trigger rejecting UPDATE and DELETE on ledger_backups.
- [ ] Step 2: Add @neondatabase/serverless as a production dependency with npm, updating only package.json and package-lock.json.
- [ ] Step 3: Implement the Neon repository using parameterized queries; serialize canonical save objects to JSONB, map database bigint revisions to safe integer values, and return null when a conditional write returns no row.
- [ ] Step 4: Write the idempotent SQL migration with a checked singleton ledger_state row (revision bigint, data JSONB, updated_at timestamptz), ledger_backups (UUID id, source_revision, data JSONB, created_at timestamptz), and a trigger that rejects UPDATE and DELETE on ledger_backups.
- [ ] Step 5: Run node --test tests/hosted-proof-repository.test.js; confirm all adapter tests pass and SQL statements remain single-statement atomic operations.
- [ ] Step 6: Commit the migration, repository, tests, and dependency files.

### Task 3: Wire root API routes and lazy Preview-only database access

**Files:**
- Create: src/hosted-proof/runtime.js
- Create: api/proof/state.js
- Create: api/proof/backups.js
- Create: api/proof/backups/[id].js
- Modify: tests/hosted-proof.test.js

**Interfaces:**
- runtime exports a lazy repository factory; it must not read or construct a Neon client until a handler has passed the VERCEL_ENV === 'preview' check.
- api/proof/state.js delegates GET and PUT to the state handler.
- api/proof/backups.js delegates POST to backup creation.
- api/proof/backups/[id].js delegates GET using Vercel's id route parameter.

- [ ] Step 1: Add any missing failing tests proving a production/development environment returns 404 before DATABASE_URL is read, missing Preview DATABASE_URL returns a generic 500, and the API route contract uses only the approved methods.
- [ ] Step 2: Run node --test tests/hosted-proof.test.js; confirm those cases fail before runtime and route wiring.
- [ ] Step 3: Implement lazy runtime construction and thin default-export Vercel handlers. Keep Neon imports and DATABASE_URL access server-side; do not import hosted-proof modules from src/app.js.
- [ ] Step 4: Run focused hosted-proof tests and npm test; confirm the new API behavior and all existing tests pass.
- [ ] Step 5: Build and inspect the browser bundle with npm run build and confirm it contains no DATABASE_URL or Neon driver code.
- [ ] Step 6: Commit the routes, runtime, and test updates.

### Task 4: Preflight and provision isolated Preview resources

**Files:**
- No repository files changed by resource provisioning.

- [ ] Step 1: Recheck resources and scope read-only using connected Vercel and Neon tooling. Confirm the target team/organization, project names, GitHub repository, Neon region, branch creation, and support for setting a sensitive DATABASE_URL on Preview branch feat/vercel-neon-foundation only. The local Vercel CLI is authenticated as nicolasqueen-4326 and may be used where appropriate; prefer connected Vercel tooling for provisioning/control when it provides the required functionality.
- [ ] Step 2: Stop before creating resources if Vercel cannot link without deploying the default branch, cannot restrict the variable to that Preview branch, or Neon cannot isolate the proof in its own branch. Report the exact limitation and wait for direction.
- [ ] Step 3: Create the Neon project named dbd-tracker in aws-us-east-1.
- [ ] Step 4: Create Neon branch feat/vercel-neon-foundation from the project's empty default branch.
- [ ] Step 5: Apply db/migrations/001-hosted-proof.sql to that Neon branch with connected Neon tooling. Verify both tables and the enabled mutation trigger exist and state is empty.
- [ ] Step 6: Create/link the Vercel project named dbd-tracker to masterzoidberg/dbd-tracker at the repository root with deploy=false. Do not create a default-branch deployment.
- [ ] Step 7: Retrieve the Neon branch connection string without printing it and create a sensitive Vercel DATABASE_URL targeted only to Preview and gitBranch feat/vercel-neon-foundation. Leave Production and Development targets unset.

### Task 5: Add deployed Preview verification and prove the database boundary

**Files:**
- Create: scripts/verify-hosted-proof.mjs
- Modify: tests/hosted-proof.test.js if an integration-script unit test is needed

**Interfaces:**
- verifyHostedProof(previewUrl, { fetchImpl }) uses only the synthetic v3 fixture and is testable with a stub fetch implementation.
- The CLI accepts an explicit --url PREVIEW_URL argument; it does not read a save file or database credential.

- [ ] Step 1: Write failing tests for the script's response checks using stub fetch responses; confirm a missing --url is rejected before any request and an endpoint response of 404 outside Preview cannot be treated as success.
- [ ] Step 2: Implement the verification flow with Node's built-in fetch: require an empty Neon branch; create revision 1 with expectedRevision 0; read semantically equal v3 data; update 1 to 2; reject stale revision 1 with 409 and verify no mutation; send two different writes concurrently with expectedRevision 2 and assert exactly one success/one 409; create/read a backup of the resulting revision; update once more; assert the backup ID, source revision, data, and createdAt remain unchanged.
- [ ] Step 3: Commit the verifier and its tests.
- [ ] Step 4: Deploy only the feature branch as Vercel Preview by pushing feat/vercel-neon-foundation after all local code checks pass. Do not merge, assign a production alias, or promote.
- [ ] Step 5: Run node scripts/verify-hosted-proof.mjs --url PREVIEW_URL against the deployed Preview; confirm every request reaches the real Neon branch.
- [ ] Step 6: Attempt direct SQL UPDATE on the created ledger_backups row through Neon tooling; confirm it is rejected by the trigger.
- [ ] Step 7: Attempt direct SQL DELETE on the created ledger_backups row through Neon tooling; confirm it is rejected by the trigger.
- [ ] Step 8: Read the backup again through GET /api/proof/backups/:id and confirm its stored snapshot is unchanged.

### Task 6: Run the existing gates and report completion

**Files:**
- No changes to existing release, Pages, or localStorage files.

- [ ] Step 1: Run a clean dependency install with npm ci.
- [ ] Step 2: Run the full Node suite with npm test; confirm all existing and new tests pass.
- [ ] Step 3: Run the existing build with npm run build; confirm it passes and no database code or credentials enter dist/app.js.
- [ ] Step 4: Run the existing release gate unchanged with npm run release; confirm its Node suite, build, staged asset checks, and automated browser smoke pass. Report the separate manual direct-file acceptance status exactly as the release report states it.
- [ ] Step 5: Review the final diff and deployment state; confirm no localStorage, UI, GitHub Pages, direct-file, or release-gate code changed; confirm no production deployment or promotion exists and no Production/Development DATABASE_URL is configured.
- [ ] Step 6: Report branch/worktree, architecture, changed files, Neon schema and branch, API paths, Preview URL, exact verification commands/results, acceptance status, assumptions/risks, and the recommended next milestone. Do not begin production integration.

