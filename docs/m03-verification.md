# M03 — Single-editor protection

Status: COMPLETE; AUTOMATED CHECKS PASS; USER ACCEPTED on 2026-10-07.

The user confirmed “all good and approved” after the remaining Chrome/Edge
offline application checklist and Edge file-scope probe were identified. These
manual checks are recorded as user-reported passes, not automated evidence.
Exact manual browser builds were not supplied. The staged bundle hash below was
rechecked before updating `release/verification.json` to USER_ACCEPTED.

## Evidence

- Baseline: 148/148 Node tests before implementation (preserved baseline at
  `C:/Users/nicol/AppData/Local/Temp/dbd-m03-baseline`).
- Final: 153/153 Node tests, no skips. Command: `npm test`.
- Before production changes, `node --test tests/editor.test.js` failed all four
  tests: writes were not guarded, missing capability allowed writes, read-only
  load persisted migration, and the editor helper did not exist.
- Before production changes, `node tests/browser/editor.mjs` failed because
  the second window reported Saved locally rather than Read-only.
- `npm run release`: PASS, including the existing staged Edge suite and the
  integrated M03 regression. Edge 154.0.4258.62.
- `node tests/browser/smoke.mjs --chrome`: PASS, including all existing staged
  regressions and M03. Chrome 154.0.8037.98.
- `node tests/browser/editor.mjs --chrome`: targeted M03 PASS.
- Staged bundle SHA-256:
  `3af8c9016c153f284a80b69beb09939393a6d785395a9aa0e26b6d6dffff179b`.
- Chrome's full runtime scope probe is user-reported PASS (“Chrome and yes”).
  The remaining Edge scope checklist is now user-approved. See `m03-runtime-probe.md`.
- Prior accepted M04B runtime and verification are preserved in the baseline.
  The M03 release is USER_ACCEPTED.

## Contract and caller audit

Native exclusive `dbdTracker-editor` Web Lock is held for the document lifetime.
Denied windows retry only on an explicit action. Missing/rejected API fails
closed. Ownership is in memory; there is no writer key, revision, lease, heartbeat,
stale-byte comparison, lock stealing or unlocked fallback.

Every `TrackerStorage` mutation asserts a live writer before preparation/write.
Successful save still validates, serializes, writes, and returns canonical state.
Read-only load normalizes without writes or a new timestamp and reports an
in-memory `migrationPending` flag. The UI labels that preview as unsaved.

| Path | Audit result |
| --- | --- |
| Startup load | Native acquisition precedes migration backups/save |
| Storage-event load | Noneditor uses write-free load; refresh stays read-only |
| Commit and progression/account edits | Guard before mutator; canonical successful result adopted |
| Character setup | Guard before preparatory snapshot and final commit |
| Import/restore/reset | Guard before confirmation/preparation and replacement |
| Recovery import/restore | Guard before exact raw preservation and validated replacement |
| Backup add/delete | Both storage methods guarded |
| Export/original/backups reads | Remain pure reads; corrupt-current export rules preserved |
| Enable editing retry | Reloads latest save; closes forms and discards setup/import drafts before rendering editing controls |

All four durable write sites remain in `src/storage.js`. No bypass was found.
Schema, current/backup/recovery keys, migration policy and snapshot limits are unchanged.

## Tests

New Node tests cover all mutating methods with a denied/live capability, missing
capability, write-free legacy normalization, lifetime lock acquisition and API
failure, and commit refusal before mutator/adoption. Existing storage/model/
historical/recovery fixtures explicitly inject an allowed test writer.

The real browser regression covers a second and third denied window, dispatched
progression/import/restore/delete events, ordinary export availability, storage
refresh, retry from latest bytes, discarded mounted forms, simultaneous legacy
startup with one migration snapshot, denied raw recovery, separate profiles,
renderer crash release, missing/rejected API, and notice/retry at 500/700/900px.

## Acceptance criteria

| Approved criterion | Result |
| --- | --- |
| Exactly one revised editor for every supported shared storage domain | PASS: automated Edge/Chrome localhost; offline app user-approved |
| Noneditor current/backup/recovery bytes never change | PASS: boundary and localhost browser tests; offline app user-approved |
| Retry after release starts from latest bytes | PASS: localhost browser tests; offline app user-approved |
| File lock/storage matrix passes | PASS: Chrome probe and remaining Edge checklist user-reported |
| No schema/revision/lease additions | PASS |

## Manual checklist — user-approved on 2026-10-07

Close all old tracker windows before using the new stage. Use a disposable profile
or export real progress first. Repeat in Chrome and Edge, offline:

1. Open `G:/Projects/dbd-tracker/release/runtime/index.html` in A and duplicate it
   in B and C in the same profile. Exactly one window must edit; the others show
   Read-only and Enable editing. Search/filter/navigation/details still work.
2. In A edit Meg's Bloodweb/favorite. B must read those values, refuse Trapper
   edits, import, restore and backup deletion, and still export valid progress.
3. Background A and suspend/resume. B/C must remain read-only; no takeover.
4. Close A. B must remain read-only until Enable editing is clicked. On retry,
   verify Meg's latest values before editing Trapper. Reload and verify persistence.
5. Repeat with a corrupt synthetic current save: B can export original text,
   but cannot import/restore until it owns editing. Check notice/retry at
   500/700/900px. Use disposable storage for this destructive fixture.
6. Complete the Edge scope checklist in `m03-runtime-probe.md`, including different
   file paths, file versus localhost and crash release. Chrome probe confirmation
   already supplied does not need to be repeated.

## Scope and diff review

Production changes are limited to a small native lock helper, storage assertions/
read-only load, app initialization/retry/control guards, one notice, and its CSS.
No domain/model/catalog/artwork/filter implementation, dependency, plan, release
script, migration policy or recovery design changed. Release files were regenerated
through the existing workflow. Hash comparison confirms catalog, manifest, images,
plans, scripts and package files match the baseline.

Deferred observations: none requiring additional M03 work. No later milestone
has been started.
