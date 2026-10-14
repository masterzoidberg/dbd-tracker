# Revision 1 — final converged implementation plan

Approved direction recorded 2026-10-06 for G:\Projects\dbd-tracker. Planning documents only; M01 is ready to start, but this rewrite authorizes no implementation.

## Architecture and baseline

Keep the static SPA, no backend, localStorage, one schema-1 progression document, JSON import/export, five local backup snapshots, canonical character/perk IDs and aliases, derived effective/global tiers and historical unknown/zero/positive semantics. Personal-first architecture; direct file:// and localhost remain supported. No rewrite, framework, cloud service, merge system or unrelated cleanup. Filters, view preferences, artwork paths and writer state never enter progression saves.

data/catalog.js adapts two JSON catalogs into 98 characters and 321 canonical perks. esbuild embeds source and catalogs into regular IIFE dist/app.js; the browser does not fetch catalog JSON. File and localhost storage contexts are separate and browser-dependent; moving the app may require JSON transfer.

The staged runtime opens directly through file://. The same staged static directory can be served over localhost by an appropriate static HTTP server. The runtime release is not itself a Node/npm development project: it excludes server.js, package.json and node_modules. npm start remains a source/development workflow unless a launcher is explicitly chosen for packaging later.

The previous review recorded Node v22.19.0, 47 passing tests and a write-free rebuild equal to the 770,935-byte bundle (SHA-256 8cbd1a37156aafacb1a8ca984246bbf1b24738eda6faae6cf70681e7bb165adf). These are historical results, not tests rerun for this rewrite. There is no Git repository; use explicit implementation snapshots/hashes. See [M00](00-baseline-and-decisions.md), [asset review](asset-review.md), [inventory](asset-audit.json) and reviewed-file-hashes.json. Audit JSON/scripts are planning evidence. Existing rev1.zip is an earlier snapshot, not the authoritative rewritten plan.

## Seven implementation milestones

Existing file numbers remain identifiers, not execution order.

| Order | Deliverable | Dependencies and purpose |
|---|---|---|
| 1 | [M01 — Validated Persistence](01-validated-persistence.md) | M00 reference; S-sized persistence boundary and canonical adoption only |
| 2 | [M02 — Release Staging](02-release-and-packaging.md) | M01; staged release and browser harness |
| 3 | Filtering: [M05 phase 1](05-filter-domain-and-route-state.md) + [M06 phase 2](06-filter-panel-and-counts.md) | M01/M02; M05 nonvisual domain/state foundation, M06 single visible cutover |
| 4 | [M07A — Perk Artwork](07-assets-and-artwork.md) | M02 + complete Filtering; perk-only manifest/icons |
| 5 | [M08 — Compact Capture](08-compact-capture.md) | Filtering + M07A; second-screen release |
| 6 | [M04B — Recovery](04-migration-and-recovery.md) | Later; technically needs M01/M02, uses single-window limitation until M03 |
| 7 | [M03 — Single-Editor Protection](03-single-editor-protection.md) | Later; M01/M02, integrate M04B writers, runtime exclusion probe |

[M00](00-baseline-and-decisions.md) is a decision/baseline reference, not an implementation milestone. [M09](09-browser-and-release-qa.md) is a recurring QA/release gate, not a feature milestone. Conditional M04A migration separation and optional/later M07B portraits sit outside the core sequence.

```text
M00 reference -> M01 -> M02 -> Filtering (M05 -> M06) -> M07A -> M08 -> M04B -> M03
                           M09 applies at every release cut
Conditional M04A and optional M07B do not block this sequence.
```

M03 and M04 do not block Filtering. M04B needs validated persistence and staged tests, not Compact technically; the table gives approved execution order. M03 is not required to ship recovery under the single-window policy.

M05 is independently reviewable/testable but introduces no visible quick/filter UI and does not switch live matching behind the old flat controls. M06 owns the complete visible Filtering cutover and its browser interactions. M01 adds no catalog audit; M02 owns cheap Survivor/Killer patch/date equality, while additional uncovered catalog-integrity work belongs to M09 gap analysis or a future focused catalog-update task. Existing catalog tests remain.

## Frozen decisions

- M01 validates every normal current-save write before persistence. Successful writes must be loadable, invalid writes preserve predecessor bytes, and memory adopts the canonical persisted result. No partial stale-base mechanism in M01.
- Simultaneous editing is unsupported until M03. Unlocked read/compare/write is not concurrency safety. M03 targets guaranteed exclusion among supported cooperating clients; Web Locks is a candidate pending its runtime probe.
- Character quick views: All / Bloodweb Available / Owned / Missing / Needs Upgrade. Predicates: no quick restriction / bloodwebEligible() / effective tier >0 / effective tier ==0 / effective I or II AND eligible. Missing does not imply verified historical absence. No new target-character ownership gate.
- Account quick views: All / Globally Available / Owned by My Characters / Globally Locked. Owned means at least one owned same-role character has effective tier >0. No account-wide Missing.
- Search AND quick view AND advanced groups; OR within a group, AND between groups. Quick selection clears groups, retains search/sort. Later groups refine selected quick view. Filters(n) counts active advanced logical groups only. One summary per group; × clears whole group, label reopens/focuses it. Clear advanced filters affects groups only.
- Facets retain search, selected quick view and other groups, ignore own-group selections and evaluate the option population. No quick-view counts.
- One native nonmodal popover="auto", outside routinely replaced #main, live filtering, no Apply. Same primitive becomes a bounded narrow sheet. Simple trigger-based positioning; no CSS anchor positioning or separate mobile modal.
- Validated canonical-route Map in memory; each manager and role-specific collection/library retains search/quick/groups/sort; reload resets. Compact/Detailed is one separate session-global in-memory choice, Detailed default. No sessionStorage.
- M07A: perk icons only, small generated manifest/resolver bundled into dist/app.js, fixed fallback, three Cenobite placeholders intentionally null, release copies only referenced usable icons. No image paths in saves or source image modification; CSS normalization only. M07B owns portraits/naming/17 misleading WebP extensions. Shared background deferred.
- Compact uses identical results/model, monotonic next-tier action and required historical controls. No automatic width switching, wraparound or downward correction.
- Core Rev1 retains personal legacy migration. Remove no persisted fields: accountCorrectionApplied, inventoryPolicy and top-level setupComplete stay. Per-character setupComplete and accountRulesVersion remain meaningful.

Advanced taxonomy: Global Availability (Available/Locked); Effective Tier in character context (None/I/II/III); Perk Origin (Native to this character/General/Legacy General, Native character-only); Account Unlock Record (Shrine/Legacy account); Source Character (Owned/Locked); Global Automatic Tier in account context (I/II/III). Source-less General matches neither source option.

## Required visible help and limitations

“Simultaneous tracker editing in multiple tabs or windows is unsupported. Use one tracker window at a time, and close other tracker windows before editing, importing, restoring, or resetting progress. Before switching app versions, close all tracker windows.”

“Legacy saves without `accountRulesVersion: 1` are interpreted using this tracker’s existing personal-account migration rules. Arbitrary third-party legacy exports are unsupported. Older local saves and backup restores may also receive those rules.”

Bloodweb Available: “Eligible to appear for the next tier. Bloodweb appearances are random.”

Owned by My Characters: “Perks present on at least one character you own. Counts include owned characters of the same role.” Show a useful empty state with no owned same-role characters.

## Release pipeline and generation decision

One canonical npm run release: source/domain tests (asset tests invoke the generator directly once M07A exists) -> regenerate required build inputs -> fresh build -> clean allowlisted runtime staging -> required-reference/asset verification -> staged browser smoke/regression -> optional Windows ZIP. Staging is canonical. No deterministic ZIP, ZIP dependency or compulsory source-distribution artifact.

**Option B is frozen:** asset tests create current-tree/fixture manifests directly and never consume pre-existing generated output. Build/release regenerate the build manifest before esbuild; staging uses that same generated input. Standalone build also regenerates. “Generated asset data used by tests/build/release must be reproducible from the current asset tree and must not depend on stale workspace output.”

## Release cuts

**First meaningful UX release:** M01 + M02 + complete Filtering + M07A, all milestone-owned tests and applicable M09 QA. Require staged/packaged file:// and localhost startup/edit/reload smoke, narrow-layout checks, single-window limitation and legacy-import limitation. Exclude Compact, M04B, M03, portraits, migration cleanup and dead-field cleanup.

**Strong second-screen release:** first release + M08 + applicable cross-feature QA. Portraits remain optional. Deferred recovery/exclusion require their own gates only when included.

## Test ownership and exit rules

Every milestone owns regressions for behavior it changes. M01: invalid writes, predecessor, canonical adoption, storage failures, round trips and directly affected alias/history/unknown-ID behavior only. M02: patch/date equality, allowlist/recreation/failures/references and staged startup/edit/reload. M05: pure predicate/group/transition/facet and route-state regressions. M06: single visible cutover, live route memory, UI facets/summaries, popover lifecycle, keyboard/focus/caret, narrow layout, historical notes, skip-link route regression and tier-action focus fallback, plus completed Filtering browser interactions. M07A: generator/resolver/aliases/misses/placeholders/fallback/decoding/packaging. M08: same results/state, advancement/disabled/maxed/history, disappearing-row fallback, 500/700/900 whole-shell acceptance. M04B: raw preservation/replacement/failures/corrupt-backup obstruction. M03: actual concurrent contexts, denial/hidden writers/close/retry/latest adoption and file/localhost scopes. M09 reruns shipped tests, audits gaps and checks cross-feature/offline runtime/documentation; feature tests are not deferred to it.

- [ ] Pass each included milestone's acceptance criteria and focused regressions.
- [ ] Run canonical release and applicable M09 gate at each cut.
- [ ] Record exact browser versions, file/localhost results and limitations.
- [ ] Keep conditional/deferred work outside core release blockers.

Next execution: M01 only, under separate implementation authorization.
