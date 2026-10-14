# M04A conditional migration separation / M04B later recovery

## Position and dependencies

M04A is conditional and outside core Rev1. M04B is implementation milestone 6, later in the approved sequence after Compact; technically requires M01/M02, not M03 or M08. Until M03, recovery follows the single-window limitation. Neither scope blocks Filtering, artwork or Compact.

## Current behavior and preserved schema

applyAccountRules skips accountRulesVersion 1; otherwise converts old Shrine provenance, adds eight owner-specific Legacy unlocks, forces original licensed names and sets inventoryPolicy/accountRulesVersion. load and replace apply these personal-account rules to unmarked old data. accountCorrectionApplied does not govern migration.

Top-level accountCorrectionApplied, inventoryPolicy and setupComplete remain persisted/validated/round-tripped. Remove none in Rev1; later schema cleanup only. Per-character setupComplete and accountRulesVersion remain meaningful.

Corrupt backup JSON throws and obstructs replacements. Restore currently refuses blocked current storage. Recovery import preserves raw current, but can snapshot fresh fallback memory and still fail on corrupt backup JSON. Ordinary Export JSON can present fallback memory as if it were the damaged account. M04B addresses these contained failures.

## M04A — conditional only

Core Rev1 leaves current personal-account migration untouched. Required documentation:

“Legacy saves without `accountRulesVersion: 1` are interpreted using this tracker’s existing personal-account migration rules. Arbitrary third-party legacy exports are unsupported. Older local saves and backup restores may also receive those rules.”

Before general third-party legacy support, separate generic normalization from owner-specific correction. Future authorization must define generic provenance/display policy and explicit owner correction. Do not infer ownership or remove already recorded tiers. M04A owns tests for marked/unmarked imports, idempotency, history/aliases/unknown IDs and local/backup compatibility when authorized. No migration-policy or dead-field changes in M04B.

## M04B — minimal raw-preserving recovery

Goal: recover corrupt current state from validated import/known-good backup after exact predecessor preservation. Likely implementation files: src/storage.js load/replace/restore paths, src/app.js Data/import/restore/export handlers, focused storage/browser tests and README.md. Keep backup array/five snapshots and schema; no new dependency/service.

1. Distinguish corrupt-current blocked state from normal progression. Validate/normalize incoming candidate through existing personal rules and M01 before destructive replacement. Selected backup must be readable/valid; unmarked payload retains current migration semantics.
2. Re-read exact current raw bytes, preserve them verbatim in a separate uniquely named recovery entry, then replace. Do not parse/restringify the predecessor. Read/preservation failure aborts with current unchanged.
3. Save only after preservation succeeds; adopt canonical persisted result. Never snapshot fresh fallback memory as predecessor. Valid-current replacement retains ordinary backup-before-replace prerequisite.
4. Corrupt backup data remains an explicit obstruction for operations needing the collection; never automatically turn it into []. Corrupt-current validated import uses raw-current preservation instead of fallback snapshot, leaves corrupt backup bytes untouched and need not depend on reading that collection. Restore requires an accessible known-good item; if collection is corrupt, explain obstruction and direct to validated import. No collection repair/reset machinery here.
5. Disable ordinary Export JSON while startup current storage is corrupt, with explanation. Provide clearly named “Export original stored data” for exact readable raw bytes; fallback memory must not impersonate the damaged account. Raw text is never rendered as HTML; inaccessible storage cannot be claimed exported.
6. Final write failure retains current bytes and blocked/unchanged memory; preserved copy may remain. When M03 later lands, recovery uses its exclusion guard. M04B introduces no partial stale-base mechanism.

No broad salvage, repair/reset workflow, backup reinitialization, automatic raw-data deletion or elaborate retention framework. Recovery raw entries stay separate from progression JSON. File/localhost remain supported under single-window policy.

## Milestone-owned tests and implementation steps

- [ ] Corrupt current + valid import: exact predecessor preserved first, canonical result adopted, no fallback snapshot.
- [ ] Corrupt current + known-good backup: same ordering/adoption; old-backup migration unchanged.
- [ ] Invalid replacement rejected before preservation/current writes; read/preservation/quota/access failures cannot erase current.
- [ ] Final current setItem failure leaves bytes/memory unchanged; preserved copy harmless.
- [ ] Corrupt backups obstruct restore/ordinary snapshots without writes or automatic []; corrupt-current import preserves current and leaves backup bytes untouched.
- [ ] Normal Export disabled on corrupt startup; original export yields exact readable bytes; successful recovery reenables normal canonical export.
- [ ] Implement contained shared recovery path, wire blocked export/import/restore messages, run focused storage and staged browser cases on file/localhost.

## Acceptance and manual verification

No corrupt-current replacement without exact successful preservation. No fallback exported/snapshotted as prior account; corrupt backups never silently empty. Original survives failure. History/aliases/unknown IDs, all persisted fields and migration rules remain compatible.

Disposable tests: corrupt current only -> export original -> valid import/restore; corrupt both -> restore obstructed -> valid import without backup reset; deny preservation/final write -> verify original bytes; unmarked legacy fixture -> existing personal rules. Verify narrow Data controls and repeat file/localhost.

## Rollback, risks and exit gate

Keep raw entries/validated exports; close all windows before reverting contained storage/UI changes. Quota/access can prevent recovery; never erase original automatically for space. Multiwindow editing remains unsupported until M03. Exit: preservation/replacement/export/obstruction tests and applicable M09 gate pass. M04A and dead-field cleanup remain outside this deliverable.
