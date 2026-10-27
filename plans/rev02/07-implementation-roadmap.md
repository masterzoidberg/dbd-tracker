# Rev02 Implementation Roadmap

> **For agentic workers:** Use `superpowers:executing-plans` for later task-by-task execution, or `superpowers:subagent-driven-development` if the user chooses delegation. Checkboxes track future work; none is authorized or completed by writing this document. Read the applicable design plan as well as this roadmap before each phase.

**Goal:** Deliver Rev02 Core while preserving trustworthy local progression, inventory, portable data and recovery.

**Architecture:** Keep the existing vanilla JavaScript HTML-string rendering, event delegation, hash routing, central validated storage and Web Locks writer guard. Reuse model/interaction helpers; separate session context from per-character pending values. Prepare migration infrastructure independently, and activate the queue/pin schema only after D01/D02 are recorded and all consumers are compatible.

**Tech stack:** ES modules, HTML/CSS, esbuild, Node's test runner, playwright-core with installed Edge/Chrome; static offline-capable bundled runtime. No new runtime dependency is required.

**Spec:** Authoritative checked-out Rev02 documents listed below, particularly plans 01–06. Explicit user decisions outrank recommendations. Exact pixel geometry remains subject to rendered review.

## Status

**Implementation roadmap created · 2026-10-25 · Phases 0–10 complete. D01/D02 were explicitly approved and recorded on 2026-10-27. Phases 1B, 11 and 12 are authorized for this batch; Phases 13–14 and deployment are out of scope.**

## Baseline

- Source baseline: `main` / `origin/main` / live GitHub main = **351ca1c0a546a49a22add6b53dd73fbd41bd0cc0**, verified during this planning pass. PC/GitHub reconciliation is already complete; do not redo it.
- Working tree at roadmap start contains the prior consolidated Rev02 Markdown changes and new plans 05/06. Preserve and include those documents deliberately in any later implementation checkout; a worktree created from HEAD alone will not contain uncommitted plans. No unrelated application work was present.
- Current schema **v2**, save key `dbdTrackerData`, backups key `dbdTrackerBackups`; five local backup slots. Current migration accepts v1/v2; unsupported future schemas fail closed. Do not use real player data as browser fixtures.
- Full release passed after reconciliation per the user's baseline. Existing ignored `release/verification.json` records localhost **AUTOMATED PASS**, Edge `156.0.4314.42`, and **AWAITING_MANUAL_ACCEPTANCE**, but is **historical staging evidence, not proof of the current bundle**: its SHA-256 and `release/runtime/dist/app.js` are `ea1b1dbf91744517cccac4634c9fb9708a2a6b07b8fd917125feb2b365e9f72f`, while current tracked `dist/app.js` is `b0f01ac066ecb34748294c4050ecc37653de2ae20b2c87e560198585ea4b7ca4`. Current bundle's Git object matches HEAD (`86a1c8556bb1a966ae4c29f88637af120289b6d8`), so this is stale ignored stage/report, not an uncommitted application discrepancy. Phase 0 must regenerate the baseline stage/report. Automated success is not recorded human direct-file acceptance.
- The prior consolidation ran nine focused data/interaction test files successfully. This roadmap pass inspects code/reports; it does not rerun release or regenerate bundles. Phase 0 re-establishes the executable baseline before implementation.
- Existing reconciliation/safety branches and any retained external safety bundle remain historical insurance. No recurring full external bundle per phase is required.

## Authority / Inputs

Read this as an execution order for one design system, not replacement designs:

| Input | Execution responsibility |
| --- | --- |
| [00-ui-ux-redesign-strategy.md](00-ui-ux-redesign-strategy.md) | Product identity, hierarchy, density and stack constraints. |
| [00a-ux-audit-matrix.md](00a-ux-audit-matrix.md) | Evidence, source constraints, existing defects and coverage limits. |
| [00b-open-design-questions.md](00b-open-design-questions.md) | Decision record; D01/D02 are the only remaining product questions. |
| [01-dashboard.md](01-dashboard.md) | Three Dashboard jobs, queue/pin state, migration and local Continue. |
| [02-survivor-roster.md](02-survivor-roster.md) | Survivor roster behavior and useful card geometry. |
| [03-survivor-workspace.md](03-survivor-workspace.md) | Contextual capability audit, personal Perks and family-compatible stock. |
| [04-killer-roster.md](04-killer-roster.md) | Power identity, Lore mappings/qualifications and missing-source policy. |
| [05-killer-workspace.md](05-killer-workspace.md) | Killer contextual editing, owner-specific Add-ons and structured Power reference. |
| [06-shared-global-design.md](06-shared-global-design.md) | Shared shell, state lifetimes, save vocabulary, accessibility and Core boundary. |
| [README.md](README.md), [evidence/](evidence/) | Index and 19 original UI captures reviewed together. ZIP is historical, not authority. |

## Core Scope

Global application shell/shared interactions; Dashboard; Survivor and Killer rosters; both full character workspaces; required account-state migration and local resume. Subordinate queue management is included. Standalone Survivor/Killer perk libraries and Data & Backups keep their current information architecture initially, with functional shell, terminology, accessibility and schema compatibility.

## Global Constraints / Explicit Non-Goals

- **Archive when browsing. Tool when editing. Power is identity, not metadata.** Avoid SaaS metrics walls, excessive enclosure, decorative horror/motion and invented functionality.
- Six characters per roster page; 3×2 desktop target, 2×3 when fit allows, 1×6 phone. No All default. Owned/Locked display; ownership mutation in Overview; Favorite independent.
- Effective Tier = max(recorded Tier, automatic minimum). Account access is separate; General can be available at global tier zero. Never materialize derived exports into personal `perks`.
- Explicit **Update Inventory**, per-selection atomic persistence, **Done** exits saved mode. Separate **Correct personal record**; no staged collection transaction.
- Survivor **Item Family → Item → Compatible Add-ons**; Killer **Killer → Power → Add-ons**. Flat rarity sorting, no accordions. Quantity **−1 | value | +1 | +5 | +10** with direct entry and zero minimum.
- Lore is Killer identity source. The Slasher uses a neutral named fallback; no invented 44th Lore file or silent square substitution. Canonical Power data stays read-only.
- Preserve unknown valid records, aliases, historical zero versus absence, writer protection, backups/raw recovery, strict validation and offline runtime. No broad schema/CSS rewrite, rename campaign, framework/Tailwind/shadcn migration, new service or speculative abstraction.
- No production deployment is part of this roadmap's execution acceptance. Distribution/publishing remains a separate action after manual acceptance.

## Resolved Product Decisions

### D01 — Dual membership and one pin representation

**Approved 2026-10-27:** a character may belong to both longer queues. Up Next has at most one pin per character, with exactly one explicit primary intent (`Prestige` or `Play`); membership in the other queue may be secondary context but never creates a second row. Keep manual pin rank independent. Do not infer or silently change primary intent.

### D02 — Direct pin independent of queue membership

**Approved 2026-10-27:** a character may be pinned without either longer-queue membership. Pinning creates no membership; queue membership changes do not remove, reorder or retarget a pin. Keep Up Next explicit and independent. Do not infer intent from Favorites, edits or recommendations.

**Gate procedure:** Decisions are recorded in [the decision register](00b-open-design-questions.md) and affected Dashboard planning language. Finalize the persisted contract and tests against these approved semantics.

**Status:** D01/D02 no longer block Phase 1B, the dependent Dashboard work in Phase 11, or Phase 12 schema compatibility. Phase 13/14 acceptance and deployment remain outside this batch.

## Repository Architecture / File Map

Paths below are repository-relative to `G:\Projects\dbd-tracker`; they are exact existing paths unless explicitly marked proposed. Keep changes surgical inside current modules.

| Area | Current source and responsibility | Tests / dependency |
| --- | --- | --- |
| Runtime/shell | `index.html`, `styles.css`; `src/app.js`: `route`, `render`, `preserveRender`, `editorPresentation`, central `commit` | Global styles and HTML dialogs affect every screen; app imports are bundled into `dist/app.js`. |
| Data | `src/model.js`: `freshSave`, `validateSave`, `validateCompleteV2`, `parseSave`, `exportSave`, account rules/alias sync; `src/storage.js`: `TrackerStorage`; `src/editor.js`: exclusive writer | `tests/model.test.js`, `storage.test.js`, `recovery.test.js`, `editor.test.js`, `export-effective-perks.test.js`. |
| Dashboard | `src/dashboard-selectors.js`, `src/prestige-queue.js`; app `dashboard`, queue rendering/actions/import/reset | Current role selector filters one global queue; no independent role rank, Playing or pins. |
| Rosters | App `collection`, `characterCollectionCard`, `characterMatches`; `src/perk-filters.js` route memory; `src/survivor-collection.js` positive-known-type counts | Shared renderer for both roles. Current All/5/10, page state outside filter Map, duplicate links/ownership mutation. |
| Routes/context | `src/character-workspace.js`: parser/hrefs/neighbors; app `requestWorkspaceNavigation`, `finishWorkspaceNavigation`, hash/history, storage/unload handlers | Valid role-specific routes and manage/experiment aliases; full-catalog neighbors. Filter memory is session-only. |
| Drafts/setup | `src/character-edit.js`, `src/character-setup.js`, `src/setup.js`; app edit/setup handlers | Whole-save fingerprint/raw input/final floors; setup's P1 saves immediately, Finish backs up and adds/upgrades. |
| Personal perks | `src/character-inventory.js`, `src/historical-perks.js`; app browse/update/detail/quick picker | Candidate union, automatic floors, density preference and route-keyed sessions; historical/correction APIs differ. |
| Quantities | `src/inventory-quantities.js`, `src/inventory-interaction.js`; app `stockView`, `acceptStock`, `killerPowerAddonsView`, `acceptKillerQuantity` | Synchronous storage, per-character raw/pending/error sessions; shared parser/step/focus primitives already exist. |
| Reference/assets | `data/inventory-catalog.js`, `data/killer-runtime-catalog.json`, `data/catalog.js`, `src/assets.js`, `data/asset-manifest.json`; app detail renderer | Bundled catalog adapter defines compatibility/owners. Do not duplicate those relationships in a view. |
| Build/release | `scripts/build.mjs`, `generate-killer-runtime-catalog.mjs`, `generate-assets.mjs`, `release.mjs`, `docs/runtime-README.md`, `server.js` | Build writes catalog/manifest/runtime images/bundle. Release tests, rebuilds, stages, validates and smokes. |

### Reuse and Proposed Additions

Prefer existing functions. Two small pure state modules are justified if page/context logic cannot remain clear in existing helpers: **proposed** `src/roster-state.js` with `tests/roster-state.test.js`, and **proposed** `src/workspace-context.js` with `tests/workspace-context.test.js`. They contain pagination/session state only, not saves or renderers. Phase 11.1 may add **proposed** `src/workspace-resume.js` / `tests/workspace-resume.test.js` for optional browser-local preference validation. Phase 1B may add **proposed** `src/dashboard-state.js` / `tests/dashboard-state.test.js` for approved queue/pin actions, keeping existing Prestige benefit rules. Do not create all of these as scaffolding in Phase 0; add only with their tested behavior. No speculative component tree or giant `app.js` extraction is prescribed.

## Dependency Graph

```text
0 baseline/safety
  ├─ 1A migration/version safety, still v2
  │    └─ [explicit D01 + D02] ─ 1B final queue/pin schema + consumer compatibility
  └─ 2 global shell/visual foundation
       ├─ 3 shared roster behavior ─ 4 Survivor roster ─ 5 Killer roster
       └─ 6 workspace/context/transition foundation
            └─ [also requires 1A] 7 shared contextual editing, Perks and quantities
                 └─ 8 Survivor workspace ─ 9 Killer workspace ─ 10 editor parity/retirement
6 ─ 11.1 browser-local Continue (independent of D01/D02)
1B + 2 + 6 + 8 + 9 + 10 + 11.1 ─ 11.2/11.3 Dashboard completion
4 + 5 + 10 + 11 + 1B ─ 12 untouched-screen compatibility
12 ─ 13 cross-screen accessibility/interaction stress and bounded polish
13 ─ 14 final Core release + human manual acceptance
```

Recommended serial order is **0 → 1A → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1B → 11 → 12 → 13 → 14**. 1B can move earlier after its gates if the current Dashboard's `prestigeQueue` consumers are adapted atomically with the schema. Prefer landing it close to Dashboard delivery to minimize the interval with a compatibility bridge. 6 does not logically require completed rosters, but the serial sequence limits shared-renderer churn; it consumes roster-return state when available.

This refines the broad dependency shape: prepare data safety early, separate reusable operational primitives before role inventories, add an explicit editor-retirement milestone, and keep final gated persistence close to its UI. Dashboard plan number 01 does not make it first; it consumes state, canonical routes, shell and stable workspaces. No concurrency/delegation is implied by graph branches.

## Phase Summary

| Phase | Goal | Depends on | Product gate | Major risk | Verification |
| --- | --- | --- | --- | --- | --- |
| 0 | Implementation checkout and reproducible safety baseline | Execution authorization | None | Missing uncommitted specs / real data touched | Git baseline, tests, release report |
| 1A | Bounded version/migration protections on v2 | 0 | None | Broader migration rewrite | Data unit tests + release |
| 2 | Global shell and small visual foundation | 0 | None | Legacy screens/focus constrained | Shell browser checks + screenshots + release |
| 3 | Shared six-result roster/state/control grammar | 2 | None | Role/page/focus leakage | Pure state + collection browser tests |
| 4 | Survivor roster | 3 | None | Wrong perk scope / navigation mutations | Collection tests + visual gate |
| 5 | Killer roster / required assets | 3; serial after 4 | None | Wrong identity/Power fallback | Asset/collection tests + release + visual gate |
| 6 | Workspace context and guarded routes | 2; consumes 3 | None | Lost draft or history loop | Route/edit/quantity tests + release |
| 7 | Shared task editors, Perks/quantity operations | 6, 1A | None | False save/correction or overwrite | Model/draft/interaction + browser checks |
| 8 | Complete Survivor workspace | 7, 4 | None | Compatibility/stock duplication | Inventory/setup/browser + visual gate |
| 9 | Complete Killer workspace/reference | 7, 5; serial after 8 | None | Wrong owner / omitted mechanics | Killer/browser/reference + visual gate |
| 10 | Prove parity, retire giant editor | 8, 9 | None | Early deletion / dead smoke bootstrap | Parity matrix + full release |
| 1B | Approved portable queue/pin state and migration | 1A | **D01 + D02** | Data loss / old Dashboard consumer | Migration/round trips/recovery + release |
| 11 | Local Continue + Dashboard UI/management | 1B, 2, 6, 8–10; 11.1 only needs 6 | **Queue tasks gated** | Fake intent / divergent ordering | Queue/resume/browser + visual gate + release |
| 12 | Standalone libraries and Data compatibility | 1B, 4, 5, 10, 11 | Indirect | Schema/UI incompatibility | Filtering/data/recovery browser + release |
| 13 | Cross-screen accessibility/stress/polish | 12 | Indirect | Unstable repetitive entry | Stress fixtures, keyboard/zoom/screenshots |
| 14 | Final Core verification/manual acceptance | 13 | All gates closed | Automated pass mistaken for acceptance | Full release + recorded human checklist |

## Common Execution and Verification Rules

Every phase below has its own exit gate. Within each checkbox task: write the meaningful regression first, run it and see the expected failure, make the smallest change, rerun focused coverage, then commit code and its tests together. New browser cases must be reachable from `tests/browser/smoke.mjs`; adding an uncalled export is not coverage. Presentational-only changes need browser/visual checks, not tests mirroring CSS text.

Commands below are for a **later implementation session**, from the repository root. Expected success is exit 0 plus the named behavioral assertions; unresolved failures block dependent phases. Update intentional old UI assertions as their new behavior lands, preserving model/safety assertions.

- `npm test`: actual package script, Node unit tests; no browser/staging guarantee.
- `npm run build`: regenerates Killer runtime catalog, asset manifest/runtime portrait copies and `dist/app.js`; it does **not** refresh `release/runtime`.
- Focused browser CLIs that exist can use a fresh source-root bundle, e.g. `node tests/browser/collection-cards.mjs .`, `node tests/browser/character-workspace.mjs .`, `node tests/browser/character-inventory.mjs .`, `node tests/browser/inventory.mjs .`, `node tests/browser/character-setup.mjs .`. Their shared smoke bootstrap currently exercises Edit Character first; Phase 10 replaces that path. Browser tests import source fixtures, so stale bundles create misleading failures.
- `tests/browser/killer-power-addons.mjs`, `data-flows.mjs` and `workspace-layouts.mjs` export functions but have **no standalone CLI**. Do not run them as if that executes tests; use the integrated suite.
- `npm run release`: `npm test` → catalog-revision checks → removes stale manifest/bundle → build → stage/validate runtime allowlist/hashes → `smokeStage` browser regressions → `release/verification.json` and artwork check page. It is local staging, not deploy. On failure staging is removed and report says FAILED. Retain diagnostics, fix the cause, rerun.
- `npm run test:browser`: smokes **already-fresh `release/runtime`**. It neither builds nor stages. Use after a successful release when repeating browser-only verification is warranted.
- `node tests/browser/workspace-file.mjs release/runtime`: existing automated direct-file route probe with a disposable browser. It still does not establish human reopen/zoom acceptance.
- `node server.js`: source-root localhost preview without `npm start`'s implicit build; build explicitly first after source changes. Stop any preview started for verification. Installed Edge is default; existing CLIs supporting `--chrome` can use Chrome if needed.

## Phase 0 — Implementation-Start Baseline / Safety

### Goal / Why Here

Establish a reviewable implementation checkout containing the live consolidated specifications and a known-safe test/data baseline. This verifies current state; it does not repeat historical reconciliation.

### Likely Files / Modules

**Expected:** no app change; deliberately preserve/commit current `plans/rev02` docs before creating a worktree from that commit. **Possible additions:** only private disposable fixtures outside the release runtime. **Generated:** baseline release outputs under the existing pipeline, inspected before committing any generated delta.

### Behavior to Preserve

Unrelated user work and original player data remain intact. Never import fixtures into the user's normal origin/profile. Existing safety refs/bundle stay retained.

### Implementation Tasks / Test-First Requirements

- [ ] 0.1 Run `git fetch origin`, `git status --short --branch`, `git log --oneline --decorate -20`, `git remote -v`; compare `HEAD`/`origin/main`. Resolve new divergence deliberately, never pull/reset/clean reflexively.
- [ ] 0.2 Make a planning checkpoint containing the **working-tree** specs, then use a dedicated `codex/rev02-core` branch/worktree via the worktree skill if isolation is chosen. Confirm all plans are present in the execution checkout. Do not invent separate branches for tiny CSS tweaks.
- [ ] 0.3 Export real progress outside the test origin before any migration exercise; retain a pre-migration JSON copy outside the rotating five snapshots. Use synthetic v1/v2 and disposable browser storage for tests.
- [ ] 0.4 Run `npm test`, then `npm run release`; record SHA/browser/report state and inspect `git diff --stat`. If failures exist, reproduce and classify them before changes; do not call a failing baseline green.

### Acceptance / Verification / Manual Check

Commands above exit 0, localhost release says AUTOMATED PASS, working tree is understood, fixtures cannot overwrite user data, specs are available. Inspect data-export readability without changing it. A baseline report may still await manual acceptance; record that honestly.

### Risks / Rollback / Exit Gate

Risk: worktree lacks uncommitted specs or test profile shares production storage. Recovery: return to the planning checkpoint, fix isolation, preserve original bytes. **Exit:** known source/spec baseline and green automation or explicitly resolved baseline defects; no downstream phase until data isolation is established.

## Phase 1A — Schema / Storage Foundation A (No New Schema Yet)

### Goal / Why Here

Pin down current migration/version/error contracts and make only the narrow infrastructure changes required to support another version later. **Keep SCHEMA_VERSION at 2**, keep current defaults and accepted versions, and add no D01/D02-dependent fields. This can complete while product answers are pending.

### Likely Files / Modules

**Expected:** `src/model.js`, `src/storage.js` only where missing safeguards/tests justify change; `tests/model.test.js`, `storage.test.js`, `recovery.test.js`, `export-effective-perks.test.js`, `tests/fixtures/schema-v1.js`. **Possible additions:** `tests/fixtures/schema-v2.js` for deterministic migration/unknown-state fixtures. **Generated:** bundle/catalog/manifest only at the build/release checkpoint.

### Behavior to Preserve

`validateSave` returns canonical save, warnings, source version, migration flag and predecessor. `TrackerStorage.load({persistMigration:false})` never writes; failed backup/write leaves original data recoverable. v1→v2 stock/queue defaults, account normalization/alias maxima, historical zero, unknown valid characters/perks/stock/queue goals, malformed/future rejection all remain. No nominal future-version support without its contract.

### Implementation Tasks / Test-First Requirements

- [ ] 1A.1 Add missing regressions for unsupported version rejection, v1 predecessor preservation, repeat load/idempotence, read-only zero writes, backup failure blocking migration, write failure retaining original, and malformed quantities/wrong-role data. Verify new tests fail only where the contract is currently unprotected or broken; retain existing passing coverage.
- [ ] 1A.2 Keep existing validation boundaries; if another-version dispatch requires a small extraction, preserve the v1/v2 algorithms and result metadata. Do not build a generic migration framework or accept v3 yet. If tests already prove the needed infrastructure, finish with fixtures/tests rather than manufacture a source refactor.
- [ ] 1A.3 Extend export tests: raw `perks` byte/structure unchanged; native/Prestige/Shrine/Legacy/manual maxima included in derived inventory; import discards even stale/tampered `effectivePerks`/summary; old exports without derived fields work. Ensure General access at global zero is not turned into an automatic tier.
- [ ] 1A.4 Run focused tests, build, inspect generated diff, run full release and commit the bounded checkpoint.

### Acceptance Criteria / Verification Commands

`node --test tests/model.test.js tests/storage.test.js tests/recovery.test.js tests/export-effective-perks.test.js`, then `npm run build`, `npm run release`. All pass; fresh and re-exported saves are still v2, unsupported versions still rejected, no queue/pin guesswork.

### Manual Verification / Risks / Recovery / Exit Gate

Inspect fixture exports/predecessors and failed-write raw bytes; no real import required. Main risk is turning a test-hardening phase into a schema rewrite. Revert this source checkpoint safely while all stored data is still v2; keep fixture backups. **Exit:** current data contracts proved, no premature schema activation; 2–10 remain unblocked, 1B remains gated.

## Phase 2 — Shared Shell and Small Visual Foundation

### Goal / Why Here

Give all screens useful content width and understandable navigation before screen geometry depends on it.

### Likely Files / Modules

**Expected:** `index.html`, `styles.css`, `src/app.js` shell/current-route/focus handlers; `tests/browser/filtering.mjs`, `workspace-layouts.mjs`, `recovery.mjs`, `smoke.mjs`, `tests/filter-ui.test.js` where markup assertions change. **Possible additions:** focused exported shell regression inside the existing browser suite, not a new component library. **Generated:** normal build/release outputs.

### Behavior to Preserve

All six labeled destinations; Export/setup actions; visible save/read-only/recovery status; skip link, canonical routes and dialogs. Untouched libraries/Data remain operable immediately, not only in Phase 12.

### Tasks / Test-First Requirements

- [ ] 2.1 Add browser failures for cramped intermediate width, all labeled destinations reachable, Menu expanded state/Escape/focus return, route focus unobscured by sticky chrome, skip-link hover contrast and no account-data writes from navigation.
- [ ] 2.2 Implement full desktop sidebar and compact labeled Menu header based on actual fit. Use ~1300px as an initial candidate, then test 1280/1366 and nearby widths; retain labels, current destination/product identity and reachable Actions. Choose disclosure versus modal semantics consistently and implement the corresponding focus behavior.
- [ ] 2.3 Add only useful shared width/type/spacing/divider/focus rules within `styles.css`. Keep existing variables/stack; adjust the selectors that affect these contracts, no stylesheet reorganization. Start from readable 14–16px controls, 12–13px support where appropriate, tabular digits and bounded prose; verify rather than freeze these as new global tokens.
- [ ] 2.4 Build, run shell/route coverage and full release, capture shell screenshots across the common matrix; review on roster, workspace, both libraries and Data before committing.

### Acceptance / Commands / Manual Verification

`npm test`, `npm run build`, `node tests/browser/filtering.mjs .`, `npm run release`. Shell is legible at 1920, 1440/1366, collapse±40px, 1024, 768, 390/320; keyboard reaches all destinations/actions and returns from Menu. Manually inspect text enlargement, contrast and short laptop height. Screenshots demonstrate content fit, not pixel parity with old captures.

### Risks / Rollback / Exit Gate

Global cascade or sticky layers may break legacy controls. Revert shell/CSS commit without data rollback; do not discard working data. **Exit:** release passes and shell visual/keyboard gate is accepted; all dependent layouts use this one shell policy.

## Phase 3 — Shared Roster Behavior and Session State

### Goal / Why Here

Implement shared discovery, six-result paging and return semantics once before role-specific composition.

### Likely Files / Modules

**Expected:** `src/app.js` collection/filter/pager/Favorite handlers, `src/perk-filters.js`, `styles.css`; `tests/collection-cards.test.js`, `perk-filters.test.js`, `tests/browser/collection-cards.mjs`. **Possible additions:** pure `src/roster-state.js` and `tests/roster-state.test.js`. **Generated:** bundle on browser verification; stage only at milestone.

### Behavior to Preserve

Canonical name search; existing ownership/Prestige/Favorite AND filters and sort/tie-break meanings; Favorite writer/failure protection and timestamps; real links/new-tab behavior. Do not repurpose Recently updated as visits or modify perk calculations.

### Tasks / Test-First Requirements

- [ ] 3.1 Test six-result selection after filtering/sorting, empty/one/final page, 54→nine pages and 44→eight pages derived from fixtures, reset on search/filter/sort, resize preserving page, clamp on external result shrink and independent per-role state. Pure pagination consumes an already ordered matching list; it never edits saves.
- [ ] 3.2 Replace All/5/10 runtime paging with six; put primary pager below results, current-page/range semantics and concise announcements. Build one toolbar with scoped disclosure/removable restrictions; Reset filters retains query/sort, Clear search is separate.
- [ ] 3.3 Use one broad real card anchor and sibling Favorite. Prove Favorite cannot navigate, failed save does not fake a toggle, and filtered removal/reorder recovers focus. Preserve caret on search; explicit page activation focuses/reveals results.
- [ ] 3.4 Remember page/query/filter/sort/origin per role for same-session Back; restore focus/scroll or safe results fallback. Keep context outside portable save and validate/clamp on return. Keep role-specific content branches intact until 4/5.

### Acceptance / Commands / Manual Verification

`node --test tests/collection-cards.test.js tests/perk-filters.test.js` plus proposed state tests if created; `npm run build`; `node tests/browser/collection-cards.mjs .`. Both roles obey the same state/keyboard contract. Manually verify anchor text selection/context menu, wrapping pager and announcements without noise.

### Risks / Rollback / Exit Gate

Shared renderer changes can affect both roles and history focus; introduce no global persistent UI setting. UI/state commit is reversible without save migration. **Exit:** pure state and browser behavior pass for both roles; no invalid page/origin or accidental mutation.

## Phase 4 — Survivor Roster

### Goal / Why Here

Compose the approved Survivor browsing hierarchy on the shared shell/roster grammar.

### Likely Files / Modules

**Expected:** `src/app.js` Survivor card/header branch, `styles.css`, `tests/collection-cards.test.js`, `tests/browser/collection-cards.mjs`; reuse `src/assets.js`/model selectors. **Possible additions:** none expected. **Generated:** bundle for screenshots; asset inputs unchanged unless a verified mapping defect exists.

### Preserve / Tasks / Test-First Requirements

Preserve role-correct art, alias-aware displayed perk names, model floors and Favorite independence. Ownership status may precede its new contextual control while the old editor remains available until Phase 10.

- [ ] 4.1 Add failures for six cards, one workspace destination/Favorite sibling, Owned/Locked text without roster ownership mutation, native account state including General/global-zero, and absence of inventory-stat panels/dialog controls on cards.
- [ ] 4.2 Implement portrait/name → prominent Prestige/Bloodweb → scoped native names/account access → navigation cue. Integrate catalog/owned count in header; keep result count separate. Use `isAvailable` plus `globalTier`; do not substitute effective native I as account unlock.
- [ ] 4.3 Set at most three columns/320px useful minima; desktop 3×2, tablet 2×3 where inner width fits, phone 1×6. Preserve long paired names/P100 and same page across resize; no forced viewport-height fit or unreadable dimming.
- [ ] 4.4 Build and review screenshots with real art/long names plus populated/unowned/zero-match states; retain tests from Phase 3.

### Acceptance / Commands / Manual Verification

`node --test tests/collection-cards.test.js tests/model.test.js`, `npm run build`, `node tests/browser/collection-cards.mjs .`. All approved facts visible, no duplicate tab stops or detailed inventory dashboard, filtering slices the correct six. Manually review art recognition, native-name wrapping, click separation and phone scrolling at common widths.

### Risks / Rollback / Exit Gate

Risk: internal `characterStats.owned` leaks ambiguous Owned copy or a shared CSS change damages Killers. Revert scoped presentation commit; no data transformation. **Exit:** Survivor roster visual/functional gate passes and shared Killer baseline remains usable.

## Phase 5 — Killer Roster and Required Asset Integration

### Goal / Why Here

Apply roster grammar with genuine Killer Lore and visible Power identity, without a broad asset cleanup.

### Likely Files / Modules

**Expected:** `src/app.js` Killer card/artwork branch, `src/assets.js` only if identity lookup needs an explicit shared helper, `styles.css`; `tests/collection-cards.test.js`, `assets.test.js`, `portraits.test.js`, `killer-runtime-catalog.test.js`, `tests/browser/collection-cards.mjs`, `artwork.mjs`. **Possible additions:** small fallback/fit cases within existing tests. **Generated:** manifest/bundle/runtime portrait artifacts only via existing generators; no source-image move/rename.

### Preserve / Tasks / Test-First Requirements

Preserve canonical IDs, exact path/Unicode aliases, art qualifications and separate Power/portrait domains. Current collection mapping already covers **43 Killers**, with null for The Slasher; do not create replacement art.

- [ ] 5.1 Test missing/null/decode-failed Lore shows neutral named fallback with working navigation; square workspace art is never silently used. Verify all existing Lore mappings and optional Power icons against manifest.
- [ ] 5.2 Compose Lore/name → Owned/Locked/Favorite → Prestige/Bloodweb → **Power name** → native account rows → View Killer. No Add-ons, difficulty, meta or tier ratings on cards. Power name survives missing/qualified icon; no guessed image paths.
- [ ] 5.3 Reuse six-result controls/3/2/1 layout; inspect Slasher fallback, Good Guy low resolution, Singularity near-square composition and long Power/native names. Non-destructive fit metadata only if real crops need it.
- [ ] 5.4 Run asset/unit/browser checks, full release and combined roster visual gate. Record actual decoded/fallback counts from current manifest/report, not hardcoded stale README totals.

### Acceptance / Commands / Manual Verification

`node --test tests/collection-cards.test.js tests/assets.test.js tests/portraits.test.js tests/killer-runtime-catalog.test.js`, `npm run build`, `node tests/browser/collection-cards.mjs .`, `npm run release`. Exactly the available genuine Lore set is used; Power supplies a structural role difference. Manually inspect fit/fallbacks and both roster roles at common widths/zoom.

### Risks / Rollback / Exit Gate

Risk: art-domain confusion, path casing or over-enlargement. Revert lookup/layout commit and rebuild matched assets; never delete originals. **Exit:** both rosters and local asset packaging pass automation plus visual/keyboard review; no fabricated Lore coverage.

## Phase 6 — Shared Workspace, Session Context and Guarded Navigation

### Goal / Why Here

Provide one route/header/context/transition contract before editing behavior is spread across tabs.

### Likely Files / Modules

**Expected:** `src/character-workspace.js`, `src/app.js` header/router/hashchange/storage/unload handlers, `styles.css`, `index.html` dirty-dialog copy as needed; `tests/character-workspace.test.js`, `character-edit.test.js`, `inventory-interaction.test.js`, browser `character-workspace.mjs`, `workspace-layouts.mjs`, `workspace-file.mjs`. **Possible additions:** `src/workspace-context.js` / `tests/workspace-context.test.js` for safe role-local context only. **Generated:** normal build/release outputs.

### Behavior to Preserve

Canonical ID/role sections, manage/experiment aliases, full-role catalog neighbors, no wraparound, browser Back/Forward and unavailable-route handling. Existing old editor remains accessible and protected. Keep source and destination transitions serialized; do not commit pending input under the destination's character ID.

### Tasks / Test-First Requirements

- [ ] 6.1 Test pure safe-context retention versus reset: tab/query/filter/sort/density/family/valid Item carry appropriately; invalid Item falls back; selected perk/picker/correction/change count/raw/error never cross characters. Roster return state stays independent per role. Preserve density's current local preference/legacy key fallback.
- [ ] 6.2 Build compact named neighbors, recognizable identity, role/progression/status, linked sections and task-specific widths. Adopt Killer Lore/neutral fallback via Phase 5 identity policy. Keep one H1; no new fourth principal tab.
- [ ] 6.3 Route all tab/neighbor/Back/hash transitions through pending quantity settlement and scoped draft guards, extending beyond the current Edit-only guard. Test Save/Discard/Stay, invalid/failed input blocking, setup draft departure, writer loss, stale underlying save, filter/context hiding and external import/storage events. Keep full-save conflict safety until a narrower merge is proved safe.
- [ ] 6.4 Preserve source section/Update mode on deliberate neighbors; ordinary tab departure ends Update while safe filters survive. Restore roster origin focus/scroll; route focus clears sticky shell. Defer actual `/edit` removal/redirect to Phase 10.

### Acceptance / Commands / Manual Verification

`node --test tests/character-workspace.test.js tests/character-edit.test.js tests/inventory-interaction.test.js` plus new context tests if added; `npm run build`, `node tests/browser/character-workspace.mjs .`, `npm run release`. No history loop, lost input, wrong-character save or transferred errors. Manually test Back during invalid input, direct hashes/refresh, short-height layout and text zoom; old Edit still works.

### Risks / Rollback / Exit Gate

Highest risk: blur/hash/history ordering or asynchronous dialog answer acts on a stale session. Tie any delayed transition to source character/task/save identity; tests must exercise rapid navigation and later stale confirmation. Revert route/state commit without migration. **Exit:** safe context and protected transitions prove correct for both roles; contextual editors can attach to this guard.

## Phase 7 — Shared Contextual Editing, Perks and Quantity Operations

### Goal / Why Here

Implement reusable task safety and repeated-entry behavior before either role workspace is completed. This is refinement of existing primitives, not a replacement inventory architecture.

### Likely Files / Modules

**Expected:** `src/character-edit.js` scoped task helpers retaining existing exports, `src/character-inventory.js`, `src/inventory-interaction.js`, `src/inventory-quantities.js`, app shared editors/quick picker/commit integration, `styles.css`; relevant unit tests and browser `character-edit.mjs`, `character-inventory.mjs`, `inventory.mjs`, `killer-power-addons.mjs`. **Possible additions:** focused task tests in existing files; a separate pure helper only if the current file cannot express both old/new safely. **Generated:** bundle; old editor implementation stays until parity.

### Behavior to Preserve

Progression safe integers/no P100 cap, Bloodweb 1–50, escaped full notes, no-op timestamp behavior, alias normalization, unknowns, writer/failure atomicity. `commit` currently always timestamps writes: scoped tasks must detect no-ops **before** calling it. Ordinary perk setter permits eligible lowering/clear; historical acquisition cannot downgrade, explicit zero differs from absence; correction accepts null/I–III, not zero.

### Tasks / Test-First Requirements

- [ ] 7.1 Add scoped progression-pair/note/boolean regressions: invalid raw text retained, cancelled task changes nothing, no-op preserves timestamps, external account/source Prestige change conflicts, failed save retains draft. Implement task atomic candidate/commit semantics without a new cross-task Save.
- [ ] 7.2 Add browse-without-mutation, alias search/category/retained/all-role/sort/density and explicit Update tests. Normal None/I/II/III saves one selection; Done saves nothing extra. Failed intent is retained for Retry / Discard failed selection / Stay, prior successes remain saved. Session counts reset per character/Update entry; No effective tier is not Not recorded.
- [ ] 7.3 Add separate selected-perk Correct personal record disclosure with record/minimum/effective-result preview, Apply correction / Cancel. Keep account-wide Shrine/Other controls clearly separate and resolve active explicit drafts first. Historical positive→lower/clear correction remains available; historical Not owned zero uses its existing acquisition path.
- [ ] 7.4 Extend quantity tests for −1/0, direct digits, MAX_SAFE_INTEGER/overflow/fraction/negative/blank normalization, pending text before steps, 100 rapid +1 clicks yielding +100, failed storage/writer loss, rerender focus, switch/filter/import replacing data. Keep synchronous save path; do not invent async cancellation infrastructure. Test stale **dialog/navigation callbacks** if introduced, not nonexistent async save responses.
- [ ] 7.5 Reuse one quantity markup/control contract where clear, with object-specific semantic labels and readable input; +5/+10 reflow below on phone. Preserve stable order during entry, errors locally revealed and focus after In Stock removes zero. Keep per-role compatibility/owner adapters separate. Build and run focused tests/browser integration before committing each task.

### Acceptance / Commands / Manual Verification

`node --test tests/character-edit.test.js tests/character-inventory.test.js tests/historical-perks.test.js tests/inventory-quantities.test.js tests/inventory-interaction.test.js tests/export-effective-perks.test.js`, `npm run build`, `node tests/browser/character-inventory.mjs .`, `node tests/browser/inventory.mjs .`; integrated Killer cases run through the next full release. Manually inspect keyboard order, labels/pressed state, raw text selection, correction preview and prompt-free repeated edits.

### Risks / Rollback / Exit Gate

Risk: accidentally staged autosaves, weakened floors/conflicts, error hidden by rerender, or helper changes breaking old draft mode. Preserve old tests until parity and revert narrowly by primitive. **Exit:** shared operations work for both roles with old editor still protected; no derived field becomes a record.

## Phase 8 — Survivor Workspace

### Goal / Why Here

Complete Survivor Overview, Perks and Items & Add-ons using shared operations; prove Survivor capability parity before any editor retirement.

### Likely Files / Modules

**Expected:** app `characterOverview`, personal inventory views, `stockView`, stock selection/filter/Details/setup handlers; `src/character-setup.js`, `src/survivor-collection.js` if summary reuse needs adjustment, `styles.css`; unit `character-inventory`, `character-edit`, `inventory-interaction`, `inventory-catalog`, `inventory-quantities`; browser `character-workspace`, `character-inventory`, `character-setup`, `inventory`. **Possible additions:** scoped regressions in those files, no competing standalone stock spec. **Generated:** usual bundle/release artifacts, unchanged research definitions.

### Preserve / Tasks / Test-First Requirements

Preserve family/Item compatibility IDs, one Add-on quantity per Survivor/Add-on across compatible Items, unknown records, setup ownership eligibility/P0-level1 skip/additive Finish/backup/batch behavior.

- [ ] 8.1 Test/implement Overview contextual ownership/Favorite, atomic progression pair and note; native effective/recorded/minimum/account facts, compact effective/positive-known-type summaries, quiet complete setup/prominent actionable incomplete setup. Set P1 immediate save must remain honestly distinct from draft Finish/Cancel.
- [ ] 8.2 Integrate Phase 7 Perks toolbar/density/search/filter/sort, explicit Update/Done and correction. Browse opens reference rather than editing; account actions remain scoped. No roster-style perk pagination.
- [ ] 8.3 Test/implement **family → selected Item → compatible Add-ons** with separate selection, quantity and Details targets, synchronized selector, explicit context when selected Item is hidden by filters. Retain valid family/Item through neighbors; never copy quantities. No incompatible Add-on appears in a flat rarity-sorted compatible set.
- [ ] 8.4 Distinguish zero stock, unknown records, no filtered match and “This item does not use Add-ons.” Test Firecracker-like no-compatibility and multiple compatible Items sharing the same Add-on stock. Preserve search/effect scope, In Stock/type/rarity filters, Event-last and stable catalog ties.
- [ ] 8.5 Build/release and visual gate for Overview, Perks browse/update/correction and stock at common widths with realistic populated fixtures. Complete Survivor rows of the Phase 10 parity matrix without deleting the old form.

### Acceptance / Commands / Manual Verification

`node --test tests/character-inventory.test.js tests/character-edit.test.js tests/inventory-interaction.test.js tests/inventory-catalog.test.js tests/inventory-quantities.test.js`, `npm run build`, `node tests/browser/inventory.mjs .`, `node tests/browser/character-setup.mjs .`, `npm run release`. Manual: match game stock by real art/name, tab through a sequence of quantities, switch Med-Kits between Survivors, cancel/retry progression/note, inspect Details/error/focus at 390/320 and zoom. Verify no accidental data mutation from browse/selection.

### Risks / Rollback / Exit Gate

Risk: global mixed Add-ons, per-Item duplicated stock, setup losing draft protections. Revert presentation/task integration only; export remains canonical v2 (or approved new version if 1B ran early). **Exit:** Survivor visual/functional parity recorded; all data/route guards pass and Killer baseline remains intact.

## Phase 9 — Killer Workspace and Structured Power Reference

### Goal / Why Here

Complete Killer Overview/Perks/Power & Add-ons, retaining role specificity while sharing proven editors/controls.

### Likely Files / Modules

**Expected:** app Killer Overview/quantity/detail renderers and focus handlers, `src/assets.js` if needed, `styles.css`, `index.html` detail sizing hooks only as required; `tests/killer-runtime-catalog.test.js`, `inventory-quantities.test.js`, `inventory-interaction.test.js`; browser `killer-power-addons.mjs`, `character-workspace.mjs`, `character-inventory.mjs`, `smoke.mjs`. **Possible additions:** `tests/power-reference.test.js` only if a pure structured renderer is extracted for meaningful content coverage. **Generated:** existing catalog/manifest/bundle process; no canonical definition edits.

### Preserve / Tasks / Test-First Requirements

Preserve Lore/fallback policy, all Power fields/qualifications, owner-specific IDs, strict owner/map/role checks, flat rarity sorting and writer/read-only Details behavior. Old Killer form's inventory-unavailable copy does not mean dedicated stock is unsupported.

- [ ] 9.1 Test/implement Lore identity plus prominent supplied Power name/short summary; native/effective/account records, notes/progression/state/setup reuse Survivor safety. Context stays Killer-local; no family/Item layer.
- [ ] 9.2 Test/implement compact Power header and flat owner Add-ons with scoped name/effect search, In Stock, optional rarity restriction and direction. Derived catalog totals, not hardcoded 20. Shared quantity control/pending/focus behavior; unknown imported records retained separately.
- [ ] 9.3 Add content-preservation tests for long/varied Power structures and empty fields. Adapt existing native `#detail` infrastructure to a larger Power reference: summary/full sections, component name heading/type label/description, nested content without repeated raw implementation keys. Escape text; canonical data is never user-editable. Add-on dialog stays smaller/contextual.
- [ ] 9.4 Browser-test named dialog entry/focus/Escape/return, readable one-region scrolling, missing Power icons and filtered-away opener fallback. Phone uses full-height readable reference; do not add a new route or narrow fashion-driven sheet without evidence the existing dialog cannot meet acceptance.
- [ ] 9.5 Run integrated release and visual gate across longest Power/name, Slasher, missing/REVIEW icons, large/zero quantities, errors and setup states. Complete Killer parity rows.

### Acceptance / Commands / Manual Verification

`node --test tests/killer-runtime-catalog.test.js tests/inventory-quantities.test.js tests/inventory-interaction.test.js tests/character-inventory.test.js` plus new reference test if created, `npm run build`, `npm run release`. Killer Power browser checks are integrated exports, not a standalone runnable script. Manually verify substantial mechanics/component reading, keyboard scroll/close, on-screen keyboard and rapid owner switch without stale quantities.

### Risks / Rollback / Exit Gate

Risk: dropping irregular reference fields, wrong-owner writes, content lost to over-dense rendering. Revert renderer/layout checkpoint without changing catalogs. **Exit:** Killer visual/functional parity and reference completeness pass; both roles ready for retirement proof.

## Phase 10 — Capability Parity and Giant Edit Character Retirement

### Goal / Why Here

Remove obsolete navigation/surface only after both contextual replacements prove safety. Cross-task all-character cancellation intentionally ends; per-task atomicity remains.

### Likely Files / Modules

**Expected:** `src/app.js` old form/render/action/draft hookups, `src/character-workspace.js` `/edit` compatibility, `src/character-edit.js` only dead composite helpers after reference audit, `index.html` dirty-dialog text, `styles.css` obsolete editor selectors; unit/browser edit/workspace/setup/inventory/data-flow/compact/portrait tests; **`tests/browser/smoke.mjs` bootstrap**, `workspace-file.mjs`, `workspace-layouts.mjs`, `docs/runtime-README.md`. **Possible additions:** parity cases in existing task tests. **Generated:** bundle/release; preserve validated shared helpers.

### Behavior to Preserve / Parity Matrix

| Capability | Replacement proof before removal |
| --- | --- |
| Owned/Favorite | Overview/header writes, roster Favorite isolation, failure/read-only/no erasure. |
| Prestige/Bloodweb | Pair Save/Cancel, raw invalid text, bounds, no-op and effective unlock preview. |
| Notes | Full escaped text, Save/Cancel, failure retention. |
| Setup/reconciliation | Owned eligibility, immediate P1, additive backed-up Finish, historical/special records, batch and dirty departure. |
| Perks/correction/account access | Update/Done, normal floors, historical zero/absence, deliberate correction, separate overrides and derived propagation. |
| Stock | Survivor compatibility and Killer owner direct quantities; pending/error/focus/navigation guarantees. |
| Timestamps/conflicts | Successful task timestamps only, no-op preserves; stale full-save fingerprint prevents overwrite. |
| Normalization/migration/unknowns | Central model/storage/alias routines remain; unknown maps survive every task and round trip. |
| Failure/dirty transitions | Retry/discard/stay, Back/Forward/hash/unload, storage-event/import replacement and writer loss on both roles. |

### Tasks / Test-First Requirements

- [ ] 10.1 Run the matrix against both roles; add failing replacement tests for every uncovered safety behavior. Keep old form accessible until all replacement rows pass. Record intentional loss of a single cross-task Cancel, not loss of fields/correction capabilities.
- [ ] 10.2 Update smoke bootstrap from old Edit Character to new focused progression/Favorite workflows with equal reload/persistence assertions. Migrate old UI-dependent tests throughout `tests/browser` and source-string unit assertions; preserve safety assertions in replacement tests, not delete coverage wholesale.
- [ ] 10.3 Only now remove obsolete primary Edit navigation/form. Resolve old `/edit` bookmarks to Overview contextual management without an unavailable route; test direct entry, aliases, browser history and pending-state protection. No redirect loop or unexpected draft save.
- [ ] 10.4 Audit references before deleting composite-only handlers/CSS/helpers. Keep shared validators/draft safety if still used; no unrelated file reorganization. Update manual acceptance instructions that still tell users to click Edit Character, then build and run full release/direct-file probe.

### Acceptance / Commands / Manual Verification

`node --test tests/character-edit.test.js tests/character-workspace.test.js tests/character-inventory.test.js tests/storage.test.js tests/export-effective-perks.test.js`, `npm run build`, `npm run release`, `node tests/browser/workspace-file.mjs release/runtime`. Adapt tests, do not run an intentionally obsolete bootstrap. Manual: every parity row on Survivor/Killer, old bookmarked Edit routes, cancel/retry and no data loss. No giant editor in principal navigation after gate.

### Risks / Rollback / Exit Gate

High-risk removal; source-string tests and older browser probes explicitly depend on the old form. Revert retirement commit while contextual replacements remain; restore only the old surface/route, never revert real player data to an earlier snapshot automatically. **Exit:** matrix complete, replacement smoke and full release pass; no remaining required capability exists only in deleted code.

## Phase 1B — Schema / Storage Foundation B and Dashboard State

### Goal / Why Here

D01/D02 are explicitly approved and recorded. Implement the final portable queue/pin contract and safe migration. Recommended landing is after Phase 10, immediately before Dashboard UI, while design-independent UI proceeds on v2. This is the highest data-risk checkpoint.

### Likely Files / Modules

**Expected:** `src/model.js`, `src/storage.js`, `src/prestige-queue.js`, `src/dashboard-selectors.js`, app legacy queue/import/export/reset/schema-label/storage-event consumers; `tests/model.test.js`, `storage.test.js`, `recovery.test.js`, `prestige-queue.test.js`, `dashboard-selectors.test.js`, `export-effective-perks.test.js`, `tests/browser/dashboard.mjs`, `data-flows.mjs`, `recovery.mjs`, `docs/runtime-README.md`. **Possible additions:** `src/dashboard-state.js`, `tests/dashboard-state.test.js`, `tests/fixtures/schema-v2.js` if not already added. **Generated:** normal build/release outputs; snapshots only in disposable storage during verification.

### Behavior to Preserve

Accept valid old exports (v1/v2) and preserve raw personal state, unknowns and alias/account rules. Current v2 validator reconstructs fields, so **do not smuggle new fields into v2**. Likely next version is v3, finalized here after decisions. No unsupported-future guessing; old builds cannot safely round-trip a new save. Keep original pre-migration export outside rotating backups.

### Tasks / Test-First Requirements

- [ ] 1B.1 Record D01/D02 answers, then define one canonical field/entry contract for role-separated Prestige and Playing queues plus independent ordered pins, target/intent/eligibility/removal semantics, unresolved retention and fresh defaults. No final field names/intent representation are prescribed by this roadmap. Ensure cap is five unique active characters per role; completed/unowned entries never silently vanish or refill.
- [ ] 1B.2 Add failing pure action/validation tests for independent roles/ranks, duplicate/hole/unsafe ID/wrong-role/invalid target/intent/over-cap payload, explicit full-lane swap/cancel, no automatic pinning, approved membership/removal/dual-intent behavior and unknown record recovery. Current Prestige creation requires owned/resolved character and target above current; preserve it.
- [ ] 1B.3 Add v1→v2→new and v2→new migration fixtures. Preserve original predecessor/source metadata; split known old goals by role preserving within-role relative rank/targets/completion/unavailable state. Preserve unknown valid goals in explicit unresolved storage without guessing role. New Playing/pins default empty; no auto-fill, truncation or silent corruption repair. Missing older fields can default only in versioned migration; malformed declared-new payload rejects replacement and retains original bytes.
- [ ] 1B.4 Implement validator/fresh defaults/version dispatch, writer-only persisted migration, predecessor backup and read-only pending migration. Audit `TrackerStorage.load`'s current hardcoded empty-save source version and migration reason along with model dispatch; keep historical v2 validation available for the migration chain. Test backup/write failures, raw recovery, idempotence, stale storage event and import/restore/reset/cancel paths. Include queue state in backups/export/round trips; derive effective perk fields afresh and ignore them on import. Update Data schema label, replacement/default warnings and version-specific migration reason text.
- [ ] 1B.5 Update **all live queue consumers atomically with activation**: current Dashboard and `commitPrestigeQueueAction` cannot keep reading a removed `save.prestigeQueue`. Prefer moving directly into Phase 11 UI next; if a brief bridge is needed, use read-only projections of canonical role state and role-scoped actions, never another writable legacy queue or inferred Up Next. Audit all test fixtures/source-string assertions as well: browser edit/workspace/dashboard/data-flow tests currently write or assert the old queue/schema; retain v1/v2 examples specifically as migration fixtures while current-state fixtures use the new contract. Adapt old Dashboard assertions for the explicit intermediate state so full release remains meaningful.
- [ ] 1B.6 Run focused tests, build/inspect generated diff and full release; test old export/import/backup replacement in a disposable profile. Commit this checkpoint separately from cosmetic Dashboard layout.

### Acceptance Criteria / Verification Commands

`node --test tests/model.test.js tests/storage.test.js tests/recovery.test.js tests/prestige-queue.test.js tests/dashboard-selectors.test.js tests/export-effective-perks.test.js` plus new dashboard-state tests if created; `npm run build`, `npm run release`. No valid data lost; inactive reader never writes migration; failure preserves recoverable original; active consumers agree with the new schema. Native/Prestige/Shrine/Legacy/manual max precedence and old-style export compatibility remain green.

### Manual Verification / Risks / Rollback / Exit Gate

Inspect pre/post exports, unresolved goals and role order; perform import, reload, restore, reset/cancel and storage-denial in synthetic profiles. Rollback is **not just code revert after new data is written**: keep the new-schema reader or restore an explicitly selected pre-migration export in an isolated copy. Warn that an old snapshot omits later edits; never relabel a new save as v2 or silently downgrade/delete fields. **Exit:** D01/D02 recorded, migration/recovery/consumer tests and full release pass; final Dashboard UI may consume the contract.

## Phase 11 — Local Continue and Dashboard UI

### Goal / Why Here

Deliver only Progression Snapshot → role Up Next → Continue, consuming proven portable state and stable workspaces. Task 11.1 can proceed independently after Phase 6; 11.2/11.3 require 1B and recorded gates.

### Likely Files / Modules

**Expected:** `src/app.js` Dashboard/queue management/navigation and replacement-success hooks, `src/dashboard-selectors.js`, approved state helpers from 1B, `styles.css`, `tests/dashboard-selectors.test.js`, `prestige-queue.test.js`, browser `dashboard.mjs`, `data-flows.mjs`, `recovery.mjs`, `smoke.mjs`. **Possible additions:** `src/workspace-resume.js` / `tests/workspace-resume.test.js`. **Generated:** normal bundle/release outputs; local preference is not portable schema state.

### Preserve / Tasks / Test-First Requirements

Preserve user-declared intent/rank, canonical routes, account metrics/provenance and no progression mutation on visits.

- [ ] 11.1 Test/implement one small browser-local stable resume record: Overview, Perks browse, Survivor stock or Killer Power/Add-ons. Edit/Setup normalize to Overview; Update/legacy Perks normalize to browse. Record only successfully resolved meaningful navigation, not every render/search/edit. Derive role/name; ignore invalid/wrong-role/unknown/malformed values; unavailable preference storage never blocks save/navigation. No draft/history telemetry or export field. Invalidate on successful import/restore and clear on reset, including recovery paths and external save replacement; pending replacement confirmation/cancel must not prematurely clear it.
- [ ] 11.2 After 1B, test/implement per-role max-five manually ranked Up Next, explicit pin/unpin/swap/cancel and keyboard Move Up/Down with focus/position announcement. Reuse exact approved intent/membership/removal semantics. Full-lane swap is atomic; deeper queue edits never silently alter pin rank.
- [ ] 11.3 Build subordinate Manage queues surface for role Prestige/Playing add/remove/reorder and Prestige target editing; keep unknown/completed/unavailable facts explicit. Implement Snapshot from owned/catalog, P1+/P3+ and account access; show one compact Continue action. Remove competing Current Focus/recommendation/chart/Favorite primary blocks without inventing a Statistics route. Build/release and review Dashboard visuals, populated and empty independently by role.

### Acceptance / Commands / Manual Verification

Run current/new resume/state unit tests, `node --test tests/dashboard-selectors.test.js tests/prestige-queue.test.js tests/export-effective-perks.test.js`, `npm run build`, `node tests/browser/dashboard.mjs .`, `npm run release`. Task 11.1 uses unit/route verification alone until new Dashboard assertions land. Manual: independent empty/populated lanes, fifth/sixth pin workflow, keyboard reorder, cross-tab resume, refresh and import/reset/restore invalidation. No fake Playing intent from Favorites or edit times.

### Risks / Rollback / Exit Gate

Risk: schema/UI drift, false resume recency, or a reorder persists to the wrong lane. Revert Dashboard view independently while keeping new-schema reader; preserve canonical state/export. Preference can be discarded without data loss. **Exit:** three-job visual hierarchy and all approved pin/queue/resume behavior pass automation and human visual review.

## Phase 12 — Untouched-Screen Compatibility and Release Documentation

### Goal / Why Here

Confirm Core integration has not broken the standalone libraries or Data & Backups after final schema/routes settle. This is a final compatibility pass, supplementing earlier phase checks rather than deferring all compatibility until now.

### Likely Files / Modules

**Expected:** scoped `styles.css`/app library/Data adjustments, `docs/runtime-README.md`, `README.md` only where actual runtime instructions need correction; browser `filtering.mjs`, `compact.mjs`, `data-flows.mjs`, `recovery.mjs`, `portraits.mjs`, `artwork.mjs`; `tests/filter-domain.test.js`, `perk-filters.test.js`, `filter-ui.test.js`, `release.test.js`, `asset-build.test.js`, `inventory-assets.test.js`. **Possible additions:** focused regression cases only. **Generated:** runtime README copy, bundle/manifest/staged artifacts through release; do not hand-edit generated files.

### Preserve / Tasks / Test-First Requirements

Preserve current library/Data information architecture, filter quick views/advanced facets/alias naming and explicit replacement/backup protections. Compatibility styling is not a full redesign.

- [ ] 12.1 Test all six destinations under new shell, library/table/popup keyboard access and readable narrow containment; retain search caret, scope language and accessible current state without forced character-inventory UI.
- [ ] 12.2 Test Data import/export/current schema label, replacement previews, old v1/v2 imports, backup/restore/reset/cancel, corrupt-current raw export, corrupt backups, writer denial/storage failure and unknown records. Verify full new planning state and raw-versus-derived perks round-trip; Continue invalidates only after successful replacement.
- [ ] 12.3 Correct actual stale runtime documentation: current `docs/runtime-README.md` says **1428 images / seven fallbacks**, omits 97 collection portraits, describes expanded rarity groups and assumes Edit Character. Describe flat lists/contextual edits and use measured current counts/report rather than hardcoded permanent truth. Baseline total is **1,525** (321 perks + 98 portraits + 97 collection + 92 Survivor inventory + 880 Killer Add-ons + 37 Powers), **eight null fallbacks** (Slasher + seven Powers). New integration must recalculate; do not invent art to keep a count fixed.
- [ ] 12.4 Confirm build/release allowlist, no runtime catalog fetches/external services, image mapping/casing/MIME and missing-art fallbacks still work; build and run full release.

### Acceptance / Commands / Manual Verification

`node --test tests/filter-domain.test.js tests/perk-filters.test.js tests/filter-ui.test.js tests/storage.test.js tests/recovery.test.js tests/release.test.js tests/asset-build.test.js tests/inventory-assets.test.js`, `npm run build`, `npm run release`. Manual: libraries and Data at common widths, backups/raw recovery in disposable profile, offline asset/reference access. Instructions match the UI and measured release output.

### Risks / Rollback / Exit Gate

Risk: compatibility CSS hides controls or stale docs misdirect acceptance. Revert targeted presentation/docs without removing new-schema support. Never downgrade data as a layout rollback. **Exit:** all six destinations, old/new imports and recovery work; no requirement for full legacy IA redesign remains.

## Phase 13 — Accessibility, Interaction Stress and Bounded Polish

### Goal / Why Here

Exercise the integrated product with realistic records and repeated input; fix only demonstrated issues before final acceptance. Accessibility has already been tested phase by phase.

### Likely Files / Modules

**Expected:** only affected source/CSS/test files identified by reproduced failures; browser `smoke.mjs`, `workspace-layouts.mjs`, `collection-cards.mjs`, `inventory.mjs`, `killer-power-addons.mjs`, `character-inventory.mjs`, `dashboard.mjs`, `editor.mjs`, `recovery.mjs`. **Possible additions:** reusable synthetic fixtures in `tests/fixtures` when several tests need the same populated state. **Generated:** source bundle for browser changes; release only when fixes warrant a new checkpoint.

### Preserve / Tasks / Test-First Requirements

Preserve stable IDs/values/focus under speed. No decorative animation or late redesign justified as polish.

- [ ] 13.1 Add failing regressions for any uncovered stress case: repeated tier acquisition/correction; 100 quantity clicks; rapid query/filter/page churn; Next/Previous and Back/Forward with pending edits; import replacement while fields are active; external storage conflict; localStorage unavailable; malformed/over-cap/future imports; read-only two-window operation. Keep source identity checks around delayed modal answers; no invented async save mechanism.
- [ ] 13.2 Use populated synthetic fixtures with longest paired Survivor names, long Killer/Power/perk names, P100 and larger valid Prestige, large safe quantities, empty/stocked/unknown inventories, unowned/setup incomplete, missing art and failures. Choose longest Power content from actual catalog, not one empty Doctor page.
- [ ] 13.3 Inspect keyboard/screen-reader order, status announcements, labels/pressed states, dialog Escape/focus/scroll, skip link/contrast, native link behavior, touch/number keyboards and reduced motion. Check 200% text and 400% reflow/320px without clipping or obscured focus; exact requirements in the common visual matrix below.
- [ ] 13.4 Review screenshots for SaaS drift, nested boxes, weak hierarchy, empty canvas, over-compressed inventory/art, number width and intermediate breakpoints. Fix defects in their owning modules with focused tests; record any genuine unresolved issue rather than declaring a pass by deleting assertions. No new performance budget invented; compare interaction responsiveness to baseline with the same fixture and investigate stalls, focus jumps or delayed actions.

### Acceptance / Commands / Manual Verification

`npm test`, `npm run build` after source changes, then applicable focused browser CLIs; use `npm run release` before entering 14 with any fixes. Manual stress includes real keyboard/zoom/phone scrolling and reading substantial Power content. Every reported defect has a reproduction and verification; no active draft loss or wrong-character save.

### Risks / Rollback / Exit Gate

Risk: scope expansion or “polish” hides errors/changes semantics. Revert each independent fix, retaining the last accepted functional checkpoint. **Exit:** integrated stress/a11y/visual review passes; remaining manual-only checks are explicitly listed for Phase 14, not waved away by unit success.

## Phase 14 — Final Core Release and Manual Acceptance

### Goal / Why Here

Produce a reproducible reviewed Core candidate and distinguish automated release success from explicit human acceptance. No deployment is implied.

### Likely Files / Modules

**Expected:** verification records/docs only unless a reproduced failure sends work back to its owning phase; `docs/runtime-README.md`, `plans/rev02/README.md` implementation status only when actually earned. **Possible additions:** dated acceptance record under `docs/` with SHA/browser/viewport/fixture/results, no personal save attached. **Generated:** `release/runtime`, `release/verification.json`, `release/artwork-file-check.html` and normal build outputs; commit according to existing tracked/ignored policy.

### Tasks / Test-First Requirements

- [ ] 14.1 Confirm all phase gates and D01/D02 recorded decisions; inspect source/generated diff and unchanged canonical research/image originals. Re-run `npm test`, `npm run release`. Inspect automated report, bundle hash, stage allowlist, actual asset counts and absence of external/catalog JSON requests.
- [ ] 14.2 Run `node tests/browser/workspace-file.mjs release/runtime`; execute the final manual checklist below in a disposable profile on this exact staged path/hash, including genuine offline close/reopen and numeric persistence. Automated direct-file probe supplements, never replaces, this check.
- [ ] 14.3 Record browser/version/date/SHA/viewport and PASS/FAIL for desktop, intermediate/tablet, phone, keyboard/zoom, dialog/reference, data edits/recovery and navigation. Missing acceptance remains **AWAITING_MANUAL_ACCEPTANCE**. Do not change status merely because commands exit 0.
- [ ] 14.4 If any check fails, reproduce, add focused coverage where possible, repair in the owning phase, regenerate as needed and rerun affected/manual checks plus full release for the final candidate. Only record Core complete after all checks pass. Retain previous accepted runtime and pre-migration export; merge/distribute only under separate authorization/workflow.

### Acceptance / Commands / Manual Verification

All commands above pass on the same candidate; human checklist recorded with no unexplained data changes or visual/interaction blockers. Source checkout and staged bundle agree. **Exit:** Rev02 Core is accepted, or accurately remains awaiting named checks; no CI-only acceptance or automatic deploy.

### Risks / Rollback / Recovery

A stale stage or different direct-file path changes the tested artifact/storage origin. Record exact paths/hash and use disposable copies. For post-migration rollback use the recovery rule from 1B, not an old reader against new data. Preserve current exported data before any deliberate restore.

## Test Strategy / Existing Coverage to Extend

| Contract | Existing tests / where to extend | Owning phase |
| --- | --- | --- |
| Versions, validation, migrations, snapshots, recovery | `tests/model.test.js`, `storage.test.js`, `recovery.test.js`, `tests/fixtures/schema-v1.js`; add deterministic v2 fixture if useful | 1A, 1B, 12 |
| Raw/derived exports and all tier sources | `tests/export-effective-perks.test.js`, `model.test.js`, `historical-perks.test.js`; spoofed derived fields never become `perks` | 1A, 7, 1B, 12 |
| Writer/multiple windows | `tests/editor.test.js`, browser `editor.mjs`, `editor-probe.mjs`; renderer-crash test remains **last** in full smoke because it closes the page | 2, 6, 7, 13 |
| Route parsing/aliases/neighbor/context | `tests/character-workspace.test.js`, browser `character-workspace.mjs`, `workspace-layouts.mjs`, `workspace-file.mjs`; optional pure workspace context test | 6, 10, 11 |
| Paging/filter/reset/return/Favorite/card links | `tests/collection-cards.test.js`, `perk-filters.test.js`, browser `collection-cards.mjs`; optional roster-state test | 3–5 |
| Scoped drafts/floors/history/correction | `tests/character-edit.test.js`, `character-inventory.test.js`, `historical-perks.test.js`; browser `character-edit.mjs`, `character-inventory.mjs`, `data-flows.mjs` | 7–10 |
| Setup atomicity/backup/special acquisition | Model tests, browser `character-setup.mjs`; add dirty setup/tab/history regressions | 6–10 |
| Quantity parsing/compatibility/owners/focus | `tests/inventory-quantities.test.js`, `inventory-interaction.test.js`, `inventory-catalog.test.js`, `character-inventory.test.js`, `killer-runtime-catalog.test.js`; browser `inventory.mjs`, `killer-power-addons.mjs` | 7–9, 13 |
| Approved queues/pins/caps/migration | `tests/prestige-queue.test.js`, `dashboard-selectors.test.js`, optional `dashboard-state.test.js`; browser `dashboard.mjs`, `data-flows.mjs` | **1B after D01/D02**, 11 |
| Local stable resume/preference failure/replacement | Proposed `workspace-resume.test.js`, route tests, browser `dashboard.mjs`, `data-flows.mjs`, `recovery.mjs` | 11.1 independent; final integration 12 |
| Libraries/facets/legacy accessibility | `tests/filter-domain.test.js`, `filter-ui.test.js`, `perk-filters.test.js`; browser `filtering.mjs`, `compact.mjs` | 2, 12, 13 |
| Artwork identity/build/packaging | `tests/assets.test.js`, `portraits.test.js`, `inventory-assets.test.js`, `asset-build.test.js`, `killer-runtime-catalog.test.js`, `release.test.js`; browser `artwork.mjs`, `portraits.mjs`, `collection-cards.mjs` | 5, 9, 12, 14 |

Do not remove old tests simply because a selector changed. Replace old UI expectations (All/5/10, ownership buttons, primary Edit, old Dashboard order/Current Focus, rarity grouping) when their intentional replacement lands; retain data/failure/alias/focus protections in equivalent workflows. Existing unit tests also inspect app source strings, so renderer changes may require revising those assertions alongside browser behavior. No new test files are written during roadmap creation.

## Review Focus: Five Easily Missed Conditions

1. **Raw record versus effective state:** unowned native I, General at zero global tier, historical absent/zero and malicious stale derived export fields; tests in 1A/7/1B.
2. **Navigation race with invalid or failed input:** blur, hash/history, delayed dialog and external replacement target different sessions; tests in 6/7/13.
3. **Unknown planning records during role migration:** valid unresolved goals survive without guessed role or hidden sixth active pin; tests in 1B/12.
4. **Responsive focus with long real content:** all six labeled destinations, long names/large digits, dialog scroll and sticky clearance; tests/manual gates in 2/4/5/8/9/13.
5. **Old UI baked into release harness:** smoke bootstrap and direct-file/layout/data-flow probes use deleted Edit routes; migration/replacement fixtures assume v2; parity/harness tests in 10 and 1B, final release in 14.

## Visual / Responsive Checkpoints

At phases **2, 4/5, 8, 9, 11 and 14**, capture consistent synthetic states and record viewport, zoom, role, route and source SHA. Keep captures outside the original historical `plans/rev02/evidence` files, e.g. ignored `test-results` during development with reviewed samples in acceptance documentation as needed. Compare against Rev02 hierarchy/intention, not pixel-match old captures.

| Checkpoint | Required inspection |
| --- | --- |
| 1920×1080 wide desktop | Bounded roster/prose, useful operating width, no fourth/fifth roster column or empty stretched panels. |
| 1440×1000 and 1366×768 laptop | Sidebar fit, short-height task reachability, art/name hierarchy, no tall repeated chrome. |
| Actual collapse cutoff −40/at/+40; include 1280 | Smooth content-driven switch, all labels/actions reachable, no squashed columns or focus jumps. ~1300 is a candidate only. |
| 1024 landscape and 768×1024 tablet | Compact navigation, two roster columns when inner width allows, no cramped perk side pane; pending controls remain visible. |
| 390×844 and 320×800 phone | One roster column/six results, number width with reflowed +5/+10, reachable labeled sections, full reference and no horizontal page overflow. |
| 200% text / 400% reflow and reduced motion | Readable wrapping/labels/values, unobscured focus, usable dialog close/menu, no required animation. |

Use longest actual character/Power/perk names and art exceptions, P100, large safe quantities, empty/populated/locked/setup-incomplete/error/read-only records. Inspect touch targets around 44px for frequent actions, WCAG AA contrast/text-backed state, actual keyboard and screen-reader semantics. Browser viewport overrides alone do not certify physical keyboards, real zoom or mobile touch.

## Full Release Milestones / Generated Outputs

Run full `npm run release` at **0 baseline, 1A, 2 shell, 5 both rosters, 6 routes, 8 Survivor, 9 Killer, 10 parity/retirement, 1B schema, 11 Dashboard, 12 compatibility and 14 final**. Phase 13 fixes that change the candidate trigger another final release. Other tasks use focused checks; do not repeat full release without a new change/failure/milestone reason.

For source milestones: **source/tests → focused checks → build/regenerate → inspect generated diff → release checks**. Release itself rebuilds again for freshness; after that inspect the resulting tracked diff once more. Generated paths include `dist/app.js`, `data/killer-runtime-catalog.json`, `data/asset-manifest.json` and generator-owned runtime portrait copies when changed. `release/runtime`, report/artwork page and `test-results` are staging/evidence; inspect actual Git tracking before adding, never indiscriminately commit staging or fixture data. Do not hand-edit a bundle, generated JSON or staged README. Planning-only/test-only checkpoints do not need a standalone build merely for noise; required release milestones still exercise the full real pipeline.

Current runtime docs are demonstrably stale: image totals omit collection art and rarity/old-editor instructions predate current behavior. Phase 12 contains the bounded correction, not an asset-cleanup project. Existing release reporting can remain awaiting manual acceptance after automation; preserve that distinction.

## Commit / Branch and Recovery Strategy

One dedicated implementation branch/worktree is sufficient. Preserve the uncommitted live plans before branching; create coherent commits by independently testable task, with tests beside the behavior and milestone generated output together when appropriate. Do not make one giant Rev02 commit or a branch per CSS tweak. Keep a clean checkpoint before 1B and before 10; inspect diff for unrelated changes before each commit.

Shell/roster/reference changes can normally revert by source commit. Migration changes require a compatible reader and a deliberate data restore decision; source rollback alone cannot undo a player writing new-schema data. Export current data first, preserve pre-migration external JSON, retain validated predecessor backup, never wipe malformed raw storage or silently load defaults. A failed migration/replacement must not claim success. Existing rotating snapshots are not a durable substitute for the external pre-migration copy.

## Final Manual Acceptance Checklist

Run against the exact staged bundle/hash in a disposable profile; record human reviewer/date/browser/version and each result. No user production save is attached to reports.

- [ ] Desktop/laptop, intermediate/tablet and phone hierarchy/scrolling match approved intent with populated/empty/error fixtures; art and text readable; no SaaS drift or excessive nested boxes.
- [ ] All six global destinations and workspace sections usable by keyboard; Menu, filters/pagination/Favorite/current links have correct semantics, focus visibility/recovery and concise announcements. Zoom/reflow and real touch/numeric keyboard checked.
- [ ] Perks browse does not edit; Update persists one selection, Done saves no batch; historical/correction/account-scope distinctions and minima correct; failure/read-only intent retained.
- [ ] Ownership/Favorite/progression/note/setup tasks validate, Save/Cancel/Retry honestly, preserve unknowns and timestamps. Setup P1 immediate versus Finish/cancel is clear; no lost draft on character/tab/Back transition.
- [ ] Survivor family/Item compatibility and shared Add-on quantities correct; Killer Power remains central with flat owner Add-ons. Rapid increments, zero/direct/large/invalid values, focus and filters behave predictably.
- [ ] Large Power and smaller Add-on details preserve content; keyboard scroll/Escape/close restore focus. Slasher/Power-image failures remain neutral and named; offline runtime accesses no external service/catalog JSON.
- [ ] D01/D02-approved queues/pins independently rank by role, max five/swap/cancel work, completion/unavailable/removal preserve intent and data; no implicit Favorites/edit-based priority.
- [ ] Continue resumes stable browse location after refresh, never a draft; import/restore/reset invalidation correct and optional preference failure does not break real data.
- [ ] Import old/new synthetic exports, re-export raw/derived perks and queue state, restore backup, reset/cancel, recover corrupt storage/raw export and reject malformed/future payload; verify no unexpected data changes from browsing.
- [ ] Back/Forward, direct hash/old Edit alias, refresh and close/reopen preserve only intended state. Genuine offline direct-file reopen at the same staged path verifies Bloodweb/Favorite/perks/quantities and queue persistence in a supported writer browser.
- [ ] Automated full release and direct-file probe pass; acceptance record names exact source/bundle hashes and remaining limitations. If any human check is missing, status stays **AWAITING_MANUAL_ACCEPTANCE** and Core is not marked accepted.

## Roadmap Quality / Cross-Check

Phase 1A can be taken independently: exact source/fixtures, preserved v2 behavior, missing test cases, commands, acceptance and downstream gates are stated. D01/D02 are now approved; Phase 1B must encode those semantics and activate all schema consumers atomically. Shared shell precedes fitted screens; operational primitives precede both inventories; retirement follows both capability proofs; final schema consumers/import compatibility activate atomically. Every Core requirement is assigned to a phase/test/visual gate above.

No source evidence requires changing settled designs or plans 00–06. Runtime documentation/harness updates are necessary implementation tasks, not product-direction corrections. No optional dependency matrix is added because the graph, phase table and test map already cover those relationships without a duplicate checklist.

**Phase 0–10 are complete; Phases 1B, 11 and 12 are authorized for the current batch.** D01/D02 are recorded in the decision register. Stop after Phase 12; Phases 13–14, final acceptance and deployment require separate authorization.
