# M01 — Validated persistence boundary

## Goal

“If the tracker successfully writes the current save, that persisted state must be loadable, and the application must adopt the canonical state that was actually persisted.”

## Why now

This is the smallest correctness fix and protects all later UI work.

## Dependencies

M00 approved baseline reference; no unresolved audience/UI or M03 runtime decision blocks this milestone. First implementation milestone.

## Current behavior

`src/storage.js:save` calls `setItem(SAVE_KEY, JSON.stringify(save))`. `load` calls `parseSave`, which validates ranges/roles/structures. In-memory reproduction: Bloodweb 51 is written successfully then rejected by load. `src/app.js:commit` clones current state, mutates, synchronizes aliases and stamps timestamps; it catches storage errors and applies the clone only after success. This existing clone-before-write pattern is useful, but canonicalization at storage would diverge from `save = next` unless the returned state is adopted. `replace` validates then applies account rules and alias normalization before saving. Raw recovery writes are intentionally not valid saves. Backup snapshots can contain older/unmarked schema-1 documents and are not current-save envelopes.

## Desired behavior

Validate the final candidate immediately before serialization/setItem. Return that canonical save; every caller adopts it. Invalid candidates and setItem failures leave both prior current bytes and app state unchanged. Normal writes must not perform owner migration; loading/replacement retain existing personal-account migration in core Rev1; M04A separation is conditional.

## Scope

S-sized validated current-save persistence boundary only: validate before setItem, return/adopt canonical state, preserve predecessor bytes and committed memory on failure, and verify valid round trips plus existing alias/history/unknown-ID behavior directly affected by validation. Audit actual save callers; keep raw recovery data separate.

## Non-goals

Concurrency (including any partial stale-base read/compare/write check), new catalog auditing or catalog-specific production changes, schema version bump, persisted-field removal, backup schema redesign, domain changes, broad app error-handling refactor. Simultaneous editing is unsupported until later M03. Existing catalog tests remain unchanged; Survivor/Killer patch/date equality belongs to M02, and additional uncovered catalog-integrity improvements belong to M09 gap analysis or a future focused catalog-update task.

## Files/components likely affected

`src/storage.js:save/load/replace`; `src/app.js:commit` and actual save/replacement callers; persistence cases in `tests/model.test.js` or an optional focused `tests/storage.test.js`. No catalog-specific production changes or new catalog test scope.

## Proposed implementation approach

`save(candidate)` obtains `validateSave(candidate).save`, applies alias consolidation to the canonical copy if save is to own normalization, then validates the final copy again only if a normalization step can change validity. Prefer app's existing alias sync plus final validation to avoid redundant passes. Serialize once, setItem once, return canonical save. No mutation of caller input. `commit` assigns `save = store.save(next)` only after success; load/replace return the actual saved object after any normalization. Put mutator/sync/timestamp inside commit's caught operation so validation or mutator exceptions reach a visible rejection; keep change minimal. Distinguish invalid internal data from quota/access failure while keeping a clear “edit not applied” result. Do not display Saved after a rejection.

Tests must distinguish load-time owner correction from boundary validity: current marked saves round-trip identically; old saves may intentionally migrate under existing personal rules throughout core Rev1; conditional M04A is not part of this write fix. Unknown safe IDs remain supported. Preserve explicit zero historical entries and missing records.

## Data model / persistence impact

Schema-compatible; same schema 1 and storage keys. Canonicalization strips unsupported top-level extras just as imports already do. Remove no fields in Rev1: accountCorrectionApplied, inventoryPolicy and top-level setupComplete stay. Per-character setupComplete and accountRulesVersion remain meaningful.

## Backwards compatibility

Known aliases/unknown IDs/partial catalogs, existing saves, old backup payloads and file mode keep existing semantics. `exportedAt` is import metadata, not progression. Raw strings stay in recovery keys, never passed through save validation.

## UI/UX behavior

Rejected edits retain the last saved display and show a clear error. Existing autosave/one-click flow is unchanged after success.

## Error/failure behavior

Validation runs before any current setItem. Quota/access failures do not apply memory changes. Replacement's backup may already exist if final current write fails; that is harmless and must not be deleted as “rollback.” Validation itself must precede any normal current-save setItem, including load normalization and replacement; raw recovery data is separate.

## Tests first

- Table-driven storage writes reject Bloodweb 0/51, negative/fractional Prestige, tier 4, wrong-role perk, null character, array inventory, invalid policy/settings/override. **Invariant:** old bytes remain identical.
- Valid partial candidate returns canonical defaults and unknown records; `parseSave(currentBytes).save` equals returned state. **Invariant:** memory/persistence contract.
- Quota/access/failing setItem leaves app's committed state and stored bytes unchanged; successful subsequent retry works. Audit load/replace/commit callers for canonical adoption, not just direct storage return.
- Explicit historical zero, absent inventory key and higher alias tiers survive round-trip.

## Implementation steps

- [ ] Add failing boundary tests using in-memory storage and existing fixture patterns.
- [ ] Implement validate-before-setItem and return canonical state.
- [ ] Update commit/load/replace adoption; audit every `store.save` call.
- [ ] Keep raw/backup preservation paths separate from current validation.
- [ ] Run `npm test`; write-free build or `npm run build` during actual implementation; normal-edit/reload smoke.

## Acceptance criteria

Every valid write reloads; each malformed example throws before setItem; prior bytes survive failure; returned state equals persisted canonical state. All 47 baseline domain tests still pass, plus new meaningful cases.

## Manual verification

Edit Meg's Bloodweb and favorite, reload, verify both. Try invalid number input; previous value stays persisted. In a disposable test harness inject invalid candidate, verify rejection and last-save display. Run normal startup/edit/reload smoke on direct file:// and localhost using disposable storage; source boundary regressions belong to M01, not M09.

## Rollback strategy

Revert boundary/caller changes together; saves remain schema 1. Preserve any backups created during testing. Rollback reintroduces the original write gap, so do not ship it as safe.

## Risks

Validator returns a new object; missing one caller causes divergence. Overvalidation could drop unknown future data or zero confirmations; use current validator guarantees. Repeated validation on every notes keystroke should be measured only if noticeable with the real 98-character save; no speculative batching.

## Exit gate

M01-owned boundary/adoption/failure/history tests pass; no progression or concurrency-policy change; current bundle rebuilt for any actual product release. Single-window limitation remains as stated in master README. Ready for M02.
