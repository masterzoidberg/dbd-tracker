# M04B — Recovery verification

Implementation and automated verification finished. The user approved the offline
recovery build on 2026-10-07; the exact bundle identity and approval are recorded in
`release/verification.json`. A manual browser version was not supplied. M03 has
not started.

## Contract and scope

`TrackerStorage.replace(current, next, reason, { recover: true })` validates the
incoming save, applies the existing personal-account rules, consolidates aliases,
and validates the result before preservation. It then reads the exact current
stored text, writes it verbatim to a unique `dbdTrackerRecovery-<UUID>` key, and
uses the M01 validated save boundary to write/return canonical progression.
The recovery branch never reads or writes the backup collection or snapshots
fallback memory. Read/preservation failure prevents the current write. Final
write failure preserves predecessor bytes where the adapter guarantees atomic
failed writes; the raw copy may remain. Application adoption/unblocking happens
only after successful persistence.

Ordinary replacements still require a normal backup first. The schema, all
persisted fields, five-snapshot limit, model and migration rules are unchanged.
Raw export uses readable stored text, `.txt`, and a plain-text MIME type; missing
or inaccessible original data produces an error without a download. Both ordinary
export buttons and the export handler reject blocked progress. Restore validates
the selected backup and can recover blocked current data through the same storage
path as import. Corrupt backup collections remain explicit obstructions and are
never repaired or silently replaced with an empty array.

No stale-base comparisons, revisions, locks, tab ownership, migration separation,
catalog changes, backup redesign, or unrelated cleanup were added.

## Baseline and regression evidence

- Initial `npm test`: 138 tests, 137 passing, 1 failing. The sole failure was the
  previous portrait audit expecting 11 WebPs and a 73×101 Zarina PNG. The supplied
  Zarina source had already changed to a 512×512 WebP with a `.png` filename.
  Source bytes were preserved. Only that test's current-tree expectations and
  the outdated README image counts/low-resolution note were corrected.
- Before production changes, `node --test tests/recovery.test.js`: 10 tests,
  9 failed. Existing invalid-candidate rejection already passed.
- Before production changes, `node tests/browser/recovery.mjs` failed because
  ordinary export remained enabled for corrupt current storage.
- Final source suite: 148 tests, 148 passing, zero skipped/failing.
- Targeted browser command during implementation:
  `node tests/browser/recovery.mjs .` — Edge localhost pass.
- Canonical gate: `npm run release` — tests, fresh input generation/build,
  allowlisted staging, required references/hashes, full staged Edge suite.
- Additional full staged browser gate: `npm run test:browser -- --chrome`.
- During verification, that standalone command exposed a circular import in the
  new recovery test module: its static import of the smoke runner deadlocked the
  runner's top-level await. The CLI import was moved inside the standalone guard,
  matching the existing browser modules. The final command was rerun after this
  correction; application code did not need to change for it.
- Syntax checks: `node --check src/app.js` and `node --check src/storage.js`.

New Node regressions in `tests/recovery.test.js` cover:

1. Exact preservation before canonical current write; no fallback snapshot;
   defaults, aliases, unknown IDs, historical zero/missing and input immutability.
2. Known-good old-backup recovery; unchanged migration and exact backup bytes.
3. Invalid replacement rejection before any storage mutation.
4. Re-reading the original and unique recovery entries on repeated attempts.
5. Read/access denial, absent original, preservation/quota failure.
6. Final write failure, harmless retained copy, and successful retry.
7. Corrupt backup obstruction for ordinary operations, with recovery import
   independent of that collection and leaving its bytes unchanged.
8. Exact original reads, including empty original; missing/access-denied errors.
9. Actual application export guard and canonical export after recovery.
10. Actual restore adoption/unblocking only after successful persistence.

`tests/browser/recovery.mjs` exercises the staged DOM, downloads, confirmation,
import and restore, invalid/cancelled inputs, corrupt backups, original export
access denial and import read/preservation/final-write failures. It verifies
canonical reload/export, unchanged predecessor/backups, disabled exports, no raw
HTML rendering, and Data controls at 500/700/900/1440 pixels. The canonical smoke
runner includes it alongside all existing shipped feature regressions.

## Acceptance audit

| Approved M04B criterion | Result |
|---|---|
| Corrupt-current import preserves original first, adopts canonical state, never snapshots fallback | PASS — Node and staged browser |
| Known-good backup recovery uses the same ordering; older backup migration unchanged | PASS — Node and staged browser |
| Invalid candidates/read/preservation failures cannot erase current | PASS — Node and staged browser |
| Failed final write leaves current and memory blocked/unchanged; preserved copy harmless | PASS — Node and staged browser |
| Corrupt backups obstruct dependent operations without reset; recovery import bypasses the collection | PASS — Node and staged browser |
| Ordinary export blocked; original export exact/readable; successful recovery reenables normal export | PASS — Node and staged browser |
| Aliases/history/unknown IDs/fields/migration stay compatible | PASS — existing suite plus focused recovery tests |
| Narrow Data controls and localhost release gate | PASS — staged browser |
| Offline/direct-file recovery acceptance for this build | USER APPROVED — 2026-10-07; manual browser version not supplied |

## Changes and caller audit

- `src/storage.js`: exact-original reader, understandable corrupt-backup errors,
  optional recovery branch within existing replacement method.
- `src/app.js`: import and restore share that branch; export guard and plain-text
  original download; blocked Data status and successful adoption messages.
- `tests/recovery.test.js`, `tests/browser/recovery.mjs`: new focused regressions.
- `tests/browser/smoke.mjs`: includes recovery in the recurring release gate.
- `tests/portraits.test.js`: current supplied Zarina audit expectations only.
- `README.md`, `docs/runtime-README.md`: recovery behavior/manual verification and
  the supplied Zarina input correction. This file records milestone evidence.
- Generated `data/asset-manifest.json`, `dist/app.js`, `images/portrait-runtime/zarina-kassir.webp`
  and `release/` output: canonical build/staging, including the supplied new portrait.

Inspected all current-save writers: `save()` remains the sole current-key write;
load migration and normal commit still adopt its canonical result. Import and
restore pass recovery mode only for blocked progress and clear the blocked flag
only after success. Reset retains its blocked-current refusal and ordinary backup
prerequisite. Setup backups/commits remain unchanged. The direct raw-recovery
write formerly in the import UI moved into storage; raw recovery keys remain
separate from validated progression and backup envelopes.

Protected model/filter/catalog/plan/source-image hashes matched the initial M04B
snapshot. The preceding user-accepted stage and verification record were copied
to `C:/Users/nicol/AppData/Local/Temp/dbd-m04b-baseline/release` before changes.

## Deferred observations

Simultaneous editing remains unsupported until M03. Raw recovery copies can
consume quota and are deliberately retained; no retention/repair workflow belongs
to M04B. A pre-existing future-tense M07A paragraph in the root README remains
outside this contained change.
