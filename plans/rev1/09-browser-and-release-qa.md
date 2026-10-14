# M09 — Recurring QA and release gate

## Role and dependencies

M09 is a recurring gate, not an eighth implementation milestone or a destination for deferred feature tests. Run at every release cut after each included milestone's own tests/exit gate. M02 provides canonical pipeline/browser harness; M00 baseline/runtime documentation is reference. Require only shipped features; no M03/M04B/portrait/Compact gate on first release.

## Scope and release cuts

First meaningful UX release: M01 + M02 + complete Filtering + M07A. Strong second-screen release: first + M08. Later M04B and M03 gates apply only when included. M04A conditional, M07B optional. M09 audits remaining gaps, adds meaningful cross-feature regressions and verifies staged/packaged offline runtime and browser docs.

Baseline has 47 Node tests and no browser suite. M02 introduces staged browser smoke; each feature adds coverage immediately. No fresh baseline test claims in this planning rewrite.

## Ownership boundary

| Owner | Required proof delivered with feature |
|---|---|
| M01 | Invalid write/predecessor/canonical adoption/failures/round trips/affected history and unknown IDs |
| M02 | Survivor/Killer patch/date equality, allowlist, clean stage, release failure/reference checks, staged startup/edit/reload |
| M05 | Nonvisual pure predicates/transitions/groups/facet calculations and route-state model regressions |
| M06 | Single visible cutover/event wiring/live Map, UI facets/summaries, completed browser interaction coverage, nonmodal lifecycle, keyboard/focus/caret/narrow layout/history note/skip route/tier-action fallback |
| M07A | Manifest generation/resolution/aliases/missing/placeholders, runtime fallback, all referenced staged icon decoding/packaging |
| M08 | Same results/state, effective advancement/disabled/maxed/history/focus, 500/700/900 whole shell and rows |
| M04B when included | Exact raw predecessor/replacement/failures/corrupt-backup obstruction/blocked export |
| M03 when included | Actual concurrent contexts/denial/hidden writers/close/retry/latest adoption/file and localhost supported exclusion scopes |
| M09 | Gap audit, cross-feature regression and recurring packaged/offline release/browser/documentation gate |

Rerun existing feature specs; do not recreate duplicate suites or defer their original assertions to M09. Product changes only for evidenced defects with a narrow regression under responsible feature.

## Gate procedure

- [ ] Audit shipped scopes against existing tests; add only uncovered high-value interactions.
- [ ] Review any uncovered catalog-integrity concerns as gap analysis or a future focused catalog-update task, not new M01 scope. Retain existing catalog tests; M02 owns the cheap patch/date equality assertion.
- [ ] Run npm run release: source/domain tests (asset tests invoke generator) -> required generation -> fresh build -> clean allowlisted staging -> references/assets -> staged browser tests -> optional Windows ZIP. Same Option B as M02/M07A; stale/absent manifest cannot supply tests/build.
- [ ] Verify stage offline without source/node_modules; file:// and temporary static localhost server use exact staged bytes. Optional ZIP: extract and verify same runtime tree. No source archive requirement.
- [ ] Exercise cross-feature workflow: quick/group/search -> tier upgrade -> row removal/focus -> route away/back -> detail/history -> reload. With Compact included, switch modes retaining results/state and repeat at all widths. Verify icons/fallback do not disrupt controls.
- [ ] Confirm import/export/backup/restore/reset normal supported paths and cancellation preserve semantics; synthetic fixtures only. Preserve legacy limitation, including older local saves/backup restores.
- [ ] First/second release: verify single-window policy/docs, not a nonexistent exclusion guarantee. If M04B included, test recovery/export; if M03 included, require actual concurrent file/localhost exclusion probe/tests.
- [ ] Inspect 500/700/900 plus desktop. At 700/900 test whole shell/topbar as well as rows; fix only demonstrated overflow/collision. Detailed bounded table scrolling acceptable.
- [ ] Record exact supported Chrome/Edge versions/modes and Popover API baseline/results. Do not promise untested browser support or infer it from syntax/API presence.
- [ ] Record passed gates, artifact identity and deferred scopes. No publishing authorized by this planning work.

## Browser approach and limitations

Use disposable profiles/synthetic saves, headless Chromium for fast suite and recorded real Chrome/Edge checks for Windows support. Test regular staged dist/index/native events, not source module URLs. Free-port server, deterministic assertions/role-label queries, saved-byte/result-ID/focus checks; avoid arbitrary sleeps, screenshot-heavy baselines and production debug globals. Failure injection stays in fixtures/storage adapters.

Direct-file is required for core releases. If automation cannot exercise file URLs/storage, exact manual file workflow/results become a release gate; HTTP pass cannot substitute. Offline block network and confirm no runtime catalog/manifest JSON fetch. File/localhost storage separation intentional. M03 scope probe is specific to that later feature, not a prerequisite for unprotected single-window releases.

## Failure, acceptance and rollback

Any applicable test/build/reference/browser/manual gate failure blocks that release; optional/deferred features are not blockers. Do not mark incomplete stage successful or present old ZIP as new. Preserve previous verified artifact/export; close all tracker windows before changing app versions.

Acceptance: all shipped feature-owned tests plus cross-feature/offline gates pass; canonical staged artifact works on file/localhost; no personal data/source/nested archives; docs accurately state browser baseline, single-window and personal legacy limitations, generation order and deferred work. M03 guarantee required only for releases including M03.

Rollback defect fixes with their focused regressions; no bypass of failed gates. Test teardown must target only known temporary contexts/paths. Main risks are stale workspace output, testing wrong runtime, profile pollution and overstating browser/concurrency support; explicit staged inputs and recorded gates address them.
