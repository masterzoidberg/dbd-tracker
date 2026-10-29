# Ledger Hosted Persistence Proof — Design

**Status:** Proposed for review. Implementation, cloud resource creation, and deployment are gated on approval of this document.

## Intent

Build an isolated Vercel Preview proof that stores a whole Ledger JSON document in Neon Postgres JSONB, protects writes with optimistic revisions, and preserves immutable snapshots. This is an architecture experiment; the current Ledger UI and local-first persistence remain unchanged.

## Repository findings

- The requested baseline is origin/main at 807f8ce on 2026-10-29. The application is vanilla JavaScript built with esbuild; Node tests and a guarded release script are already present.
- The current canonical save is schema v3. The existing validator accepts schema v1 and v2 and migrates them to v3. Existing tests cover the v2-to-v3 migration. The proof will use v3 as canonical and reuse this validator without changing the existing migration or localStorage code.
- The release artifact is an allowlisted GitHub Pages bundle. New API routes will not enter that artifact.
- The local Vercel CLI is not authenticated. The connected Vercel team is available but has no dbd-tracker project; the connected Neon organization is available but has no projects. The requested resources must be created after design approval.

## Approaches considered

1. **Root API routes — selected by the user.** Add namespaced Vercel Node.js functions at /api/proof and small persistence modules alongside the existing application. This follows the current package and build conventions with no frontend or framework changes. The Preview also serves the unchanged Ledger page; the proof endpoints remain isolated and reject requests outside Vercel Preview.
2. **A dedicated experiment directory as the Vercel project root.** This separates the preview more strongly, but requires a second project root and packaging/build setup. The user selected the root route approach.
3. **A new application or repository.** This would create an unnecessary platform boundary and conflicts with the request to work from the current repository without re-platforming.

## Goals and boundaries

- Store one complete, validated Ledger document as JSONB; do not split game data into relational tables.
- Create the first state at revision 1, update only when expectedRevision matches, and return HTTP 409 for stale writes without changing state.
- Create backup snapshots of the current revision and document. A later write must not change an earlier snapshot.
- Use deterministic synthetic fixtures only. Do not read, upload, or migrate user saves.
- Keep the proof endpoints under /api/proof and return 404 unless VERCEL_ENV is preview. No endpoint or environment setting will switch the production Ledger to remote persistence.
- Keep localStorage, import/export, recovery, schema migration, GitHub Pages, and release gates intact.
- Do not add an application framework or production authentication.

## Proposed architecture

The API uses Vercel Node.js Functions and the @neondatabase/serverless driver. Database access stays in server-side modules and reads a sensitive DATABASE_URL that exists only in the Preview environment for the feature branch. It is never bundled into browser code, committed, or copied into local environment files.

The write API passes received Ledger documents through the existing validateSave function and stores its canonical result. Schema v2 inputs therefore follow the existing v2-to-v3 migration path; schema v3 remains the stored canonical format. No edits to src/model.js or src/storage.js are planned.

### API surface

- GET /api/proof/state — return the current revision and document; return 404 when no state exists.
- PUT /api/proof/state — accept { expectedRevision, data }. expectedRevision 0 creates revision 1; a matching current revision increments by one. A mismatch returns 409 and leaves the row unchanged.
- POST /api/proof/backups — snapshot the current document and revision; return a generated backup ID and timestamp.
- GET /api/proof/backups/:id — return that exact snapshot; return 404 for an unknown ID.

Invalid documents and revision values return 400. Unsupported methods return 405. Database errors return a generic server error without exposing connection details. There is no merge, automatic retry, or last-writer-wins path.

### Database schema and concurrency

A checked-in SQL migration creates two tables:

- ledger_state: one row enforced by a singleton key; positive revision; data JSONB; updated_at timestamptz.
- ledger_backups: UUID ID; source revision; data JSONB; created_at timestamptz.

A single conditional PostgreSQL upsert implements initial creation and compare-and-swap updates atomically. If it returns no row, the handler responds 409. Backup creation uses one INSERT ... SELECT from the current-state row so the revision and document are captured together. The backup table has no update/delete API, and a database trigger rejects UPDATE and DELETE so snapshots remain immutable at the database boundary.

### Resources and deployment

After design approval:

- Create the Vercel project named dbd-tracker in the connected team and link it to the existing GitHub repository at the repository root. Link without deploying the default branch, then push only feat/vercel-neon-foundation to generate its Preview. Do not merge or promote it.
- Create the Neon project named dbd-tracker in the connected Neon organization, in aws-us-east-1. Create a dedicated Neon branch named feat-vercel-neon-foundation for this proof and use only synthetic data there.
- Apply the checked-in SQL migration to that Neon branch.
- Add its connection string to the Vercel Preview environment for feat/vercel-neon-foundation only. Leave Production and Development without DATABASE_URL. Do not assign a production alias or promote a deployment.

The repo root means the Preview serves the existing Ledger page unchanged alongside the proof API. The VERCEL_ENV guard and absence of a Production database URL keep the proof path inactive outside Preview.

## Verification design

Add deterministic Node tests for valid v3 round-tripping, existing v2-to-v3 migration behavior, revision 0 to 1 creation, matching update increments, concurrent same-revision writers (one succeeds and one conflicts), stale-write non-mutation, and immutable backups after later updates. Tests use a controlled repository adapter and do not require network or Neon credentials.

Add a synthetic-only HTTP verification script for the deployed Preview. Against a newly provisioned Neon branch it will create revision 1, read it, update to revision 2, prove a stale revision-1 write receives 409 and changes nothing, create/read a backup, update again, then prove the backup is unchanged. It must target the Preview URL explicitly and must not accept a Ledger export path or file as input.

Run the existing clean install, Node test suite, build, and release command unchanged. The current baseline passed npm ci, npm test (340/340), and npm run release (Node tests, build, and automated Edge smoke passed). The release report correctly remains AWAITING_MANUAL_ACCEPTANCE for the existing direct-file check.

## Non-goals and known limit

This proof does not add application login, client-side database access, UI integration, remote production persistence, production deployment, or real-data migration. The Preview API is a synthetic-data test surface, not a production account system; no production database URL will be configured.
