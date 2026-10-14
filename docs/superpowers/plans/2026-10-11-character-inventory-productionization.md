# Character Inventory Productionization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the validated role-neutral character inventory experiment into the permanent Survivor/Killer workflow at `#manage/<character-id>` and `#manage/<character-id>/update`, while keeping the old manager available at `#manage/<character-id>/legacy` until the release gates and a real support window are complete.

**Architecture:** Promote the pure experiment domain module to neutral character-inventory names and keep one shared candidate/card/view implementation for both roles. Add exact route parsing before the broad manager fallback, dispatch canonical and experiment-alias routes to the promoted renderer, and dispatch only the explicit `/legacy` route to the existing manager. Keep progression selectors and persistence unchanged; UI-only card-size state remains browser-local and is scoped to the promoted character surfaces.

**Tech Stack:** Vanilla JavaScript ES modules, HTML-string renderers in `src/app.js`, CSS custom properties, `localStorage` UI preference state, Node’s built-in test runner, esbuild, Playwright browser smoke, and the existing release staging script.

**Spec:** `docs/superpowers/specs/2026-10-11-character-inventory-productionization-design.md` and `docs/superpowers/specs/2026-10-11-character-inventory-experiment-design.md`

## Global Constraints

- Canonical routes are `#manage/<character-id>` and `#manage/<character-id>/update`.
- The temporary old-manager route is exactly `#manage/<character-id>/legacy`.
- Compatibility aliases are `#experiment/<character-id>` and `#experiment/<character-id>/update`.
- Parse exact canonical `/update` and `/legacy` subroutes before any broad `manage/` handling.
- Invalid IDs, malformed hashes, and extra path segments must fail safely and must never be interpreted as a character ID.
- The normal character page shows only `inventoryTier(save, character.id, perk.id) > 0`.
- Update candidates come only from `rolePerks(character.role)` and use the approved native/General/global/retained union predicate.
- Category precedence is Personal, General, Unlocked, then retained-only exception; retained candidates remain visible in All and do not get a new top-level tab.
- `Only unrecorded` means `inventoryTier(...) === 0` after candidate construction.
- Preserve `recordedTier`, `automaticTier`, `inventoryTier`, `globalTier`, `bloodwebEligible`, historical/manual ownership, and automatic-minimum safeguards.
- Direct tier edits must use the existing validated `commit()` path and must not persist automatic tiers as personal records.
- Account unlock changes continue to affect candidates only through the existing `globalTier()` behavior.
- Do not expose `manualTier` in user-facing copy.
- Do not introduce an ownership gate for locked characters; preserve the current model behavior.
- Small/Medium/Large is UI-only state outside progression JSON, defaults to Medium, and affects only canonical/alias character inventory cards.
- The existing narrow layout remains authoritative: two columns, no horizontal overflow, stacked editor, wrapped controls, and hidden size selector where necessary.
- Use one shared renderer for Survivors and Killers; do not copy the experiment into role-specific implementations.
- Keep the old manager at the explicit legacy route through the first release gate and support window.
- Do not modify save schema, migrations, account-rules behavior, localStorage progression keys, backups, recovery, JSON import/export semantics, setup architecture, account-wide library behavior, or unrelated product areas.
- Do not add dependencies, backend/cloud/auth behavior, concurrency work, or a new save document.
- This workspace has no Git metadata. Per-task commit steps are not applicable; use the test/build/browser verification checkpoint instead and do not initialize Git.

## Review Focus

1. **Route precedence:** `/update` and `/legacy` must be recognized as exact subroutes before broad `manage/` handling; route tests must prove they are not parsed as character IDs and that extra segments fail safely. Owning task: Task 1, with browser confirmation in Task 5.
2. **Promotion drift:** the renamed module and renderer must be the only candidate/card implementation; no `experimentalCandidatePool` or duplicated production helper may remain in an active source path. Owning task: Task 2, with source/import checks in Task 3.
3. **Automatic-tier mutation:** canonical normal inventory must be read-only with respect to automatic minima; clearing a personal record may lower `recordedTier` to zero but must not write an automatic tier into the save. Owning task: Task 4 and the canonical direct-edit checks in Task 10.
4. **Preference leakage:** card-size state must not affect account-wide perk libraries, the legacy manager, or narrow-screen geometry. Owning task: Task 8 and the desktop/mobile browser checks in Task 10.
5. **Bookmark loops/regressions:** old experiment aliases must render the shared canonical workflow without redirect loops, and old manager access must remain available at `/legacy`. Owning task: Task 6 and the compatibility browser checks in Task 10.

## File and Responsibility Map

Map these responsibilities before editing code. Do not invent alternate filenames during execution.

### Promote or rename

- Rename `src/character-inventory-experiment.js` to `src/character-inventory.js`. It becomes the single role-neutral domain/route/session module.
- Rename `tests/character-inventory-experiment.test.js` to `tests/character-inventory.test.js` and update imports and test names from `experimental...` to neutral production names.
- Rename `tests/browser/experimental.mjs` to `tests/browser/character-inventory.mjs`. It becomes the canonical and compatibility browser smoke module.

### Modify

- `src/app.js`: import the promoted module; rename/promote the shared card, normal inventory, Update Inventory, session, card-size, and event-dispatch call sites; add canonical/legacy/alias routing; update roster and character-dialog destinations/copy.
- `src/perk-filters.js`: keep advanced filtering scoped to the old manager’s explicit `/legacy` route rather than allowing canonical character inventory routes to re-enter the catalog-wide filter surface.
- `styles.css`: rename experiment-only tokens/classes to neutral character-inventory names while preserving the approved diamond, neutral name, selected/change border, desktop presets, and narrow breakpoint behavior.
- `tests/filter-domain.test.js`: pin the legacy-only advanced-filter context and reject canonical inventory/update routes as old-manager filter contexts.
- `tests/browser/compact.mjs`: move old Detailed/Compact and legacy-manager regression coverage to `#manage/<id>/legacy`.
- `tests/browser/filtering.mjs`: move catalog-wide character-manager filter coverage to `/legacy` and keep account-wide library coverage unchanged.
- `tests/browser/data-flows.mjs`: keep old-manager editing/recovery checks on `/legacy` where they exercise the old table, and add canonical persistence assertions where the new workflow is required.
- `tests/browser/artwork.mjs`: use the legacy route for old table artwork checks or canonical inventory checks only where the new card is explicitly under test.
- `tests/browser/portraits.mjs`: verify roster and canonical character navigation while retaining old-manager checks only at `/legacy`.
- `tests/browser/smoke.mjs`: import the renamed character-inventory smoke module and update the reported check label.
- `tests/release.test.js`: extend release-gate assertions only if needed to prove the staged bundle contains and smoke-tests the canonical route; do not change release staging policy.

### Verify without architectural changes

- `src/model.js`: selectors and mutation helpers remain authoritative and should not be rewritten for this rollout.
- `src/storage.js`: `TrackerStorage.save()`, `commit()`, import, export, backup, recovery, and localStorage progression handling remain unchanged.
- `src/setup.js` and `src/character-setup.js`: setup remains a separate utility and is not duplicated in inventory cards.
- `#survivor-perks` and `#killer-perks`: account-wide filters and Account Unlock editor remain unchanged.

### Generated/release artifacts

- `data/asset-manifest.json` and `dist/app.js` are regenerated by `npm run build`; never hand-edit them.
- `release/runtime/`, `release/verification.json`, and `release/artwork-file-check.html` are generated by `npm run release` and must be checked for source/bundle/stage parity.

## Task 1: Freeze the route and compatibility contract with tests

**Files:**

- Modify: `tests/character-inventory-experiment.test.js` initially; this file is renamed to `tests/character-inventory.test.js` in Task 2.
- Test/browser contract reference: `tests/browser/data-flows.mjs` for existing malformed-route expectations; do not move its old-manager route until Task 5.
- No product source changes in this task.

**Interfaces:**

- Future producer: `parseCharacterInventoryRoute(route: string) -> { characterId: string, mode: 'inventory' | 'update' | 'legacy', source: 'canonical' | 'experiment', canonicalRoute: string } | null`.
- The parser accepts a leading `#` or no leading `#` and only accepts known catalog character IDs.

- [ ] **Step 1: Record the current baseline.**

  Run `npm test` from `G:\Projects\dbd-tracker`.

  Expected: 174 tests pass, 0 fail. Record this as the pre-change baseline in the execution notes; do not alter generated files to manufacture a baseline.

- [ ] **Step 2: Add failing parser contract tests.**

  Add assertions for all of these exact inputs and outputs:

  - `#manage/kate-denson` → `{ characterId: 'kate-denson', mode: 'inventory', source: 'canonical', canonicalRoute: '#manage/kate-denson' }`.
  - `manage/kate-denson/update` → mode `update`, source `canonical`, canonical route `#manage/kate-denson/update`.
  - `#manage/the-doctor/legacy` → mode `legacy`, source `canonical`, canonical route `#manage/the-doctor/legacy`.
  - `#experiment/the-doctor` → mode `inventory`, source `experiment`, canonical route `#manage/the-doctor`.
  - `#experiment/the-doctor/update` → mode `update`, source `experiment`, canonical route `#manage/the-doctor/update`.
  - `#manage/the-doctor/update/extra`, `#manage/the-doctor/legacy/extra`, `#experiment/the-doctor/extra`, `#experiment/the-doctor/update/extra`, unknown IDs, `#manage/constructor`, and malformed hashes → `null`.

- [ ] **Step 3: Run the focused test to confirm the contract is red.**

  Run `node --test tests/character-inventory-experiment.test.js`.

  Expected: the new parser import/assertions fail because the neutral parser is not yet provided. Existing experiment-domain assertions should remain green until the promotion task changes their names.

- [ ] **Step 4: Verification checkpoint.**

  Confirm only the intended test file changed. Commit: not applicable because this workspace has no Git metadata.

## Task 2: Promote the role-neutral domain module and tests

**Files:**

- Rename: `src/character-inventory-experiment.js` → `src/character-inventory.js`.
- Rename: `tests/character-inventory-experiment.test.js` → `tests/character-inventory.test.js`.
- Modify: `src/app.js` imports only after the new exports exist; complete the import/call-site update in Task 3.

**Interfaces:**

- Produces `CHARACTER_INVENTORY_CATEGORIES = ['all', 'personal', 'general', 'unlocked']`.
- Produces `CHARACTER_CARD_SIZES = ['small', 'medium', 'large']` and `DEFAULT_CHARACTER_CARD_SIZE = 'medium'`.
- Produces `normalizeCharacterCardSize(value) -> 'small' | 'medium' | 'large'`.
- Produces `parseCharacterInventoryRoute(route) -> route descriptor | null` as specified in Task 1.
- Produces `characterInventoryCandidateInfo(save, characterId, perk)`, `characterInventoryCandidatePool(save, characterId)`, `filterCharacterInventoryCandidates(save, characterId, candidates, state)`, and `characterNormalInventory(save, characterId)` with the existing row shape: `{ perk, candidate?, primaryCategory, reasons, unlockReasons, retained, isHistorical, effectiveTier, recordedTier, automaticMinimum }`.
- Produces `setCharacterPersonalTier(save, characterId, perkId, tier)` where `tier` is `null` or integer 1–3, rejects values below `automaticTier`, and calls the existing `correctPersonalPerkTier` behavior without creating automatic records.
- Produces `createCharacterInventorySession(route)`, `syncCharacterInventorySession(session, route)`, and `markCharacterInventoryChanged(session, perkId)` with the current transient `Set` marker semantics.

- [ ] **Step 1: Rename the module and test file without changing domain behavior.**

  Move the files, update imports, and replace the `experimental` prefix in exported names and internal references with `characterInventory` or `character` names. Do not alter model imports, candidate predicate, precedence, tier calculation, historical handling, sort order, or session behavior.

- [ ] **Step 2: Implement the exact route descriptor.**

  Match the four route families with anchored expressions and reject every extra segment. Match `/update` and `/legacy` before the one-segment canonical inventory case. Set `source: 'experiment'` only for the two experiment aliases; set `canonicalRoute` to the corresponding `#manage/...` route for aliases.

- [ ] **Step 3: Update focused domain tests to neutral names and add the required exact audits.**

  Preserve and rename the existing tests, then assert:

  - Load `data/dbd-tracker-2026-10-05-1502.json` through the existing `parseSave()` boundary and use that real-save fixture for the exact audits: Doctor total 24 (Personal 3, General 19, Unlocked 2, retained 0) and Cenobite total 22 (Personal 3, General 16, Unlocked 3, retained 0).
  - Cenobite’s native/General overlap yields one Personal row per native perk.
  - Kate remains Survivor-scoped and Doctor perks never enter her candidate pool.
  - P0 native, General, P1/P2/P3 Prestige floors, Shrine I/II/III, Other account unlock, Legacy, positive retained history, explicit historical zero, and unconfirmed history retain their approved semantics.
  - Canonical aliases resolve once, candidate IDs are unique, Only unrecorded uses effective tier zero, and normal inventory uses effective tier greater than zero.

- [ ] **Step 4: Run the promoted focused suite.**

  Run `node --test tests/character-inventory.test.js`.

  Expected: all promoted domain and route tests pass. Run `npm test` after the rename to prove the test glob discovers the renamed file and no stale import remains.

- [ ] **Step 5: Check for duplicate implementations.**

  Run `rg -n "experimentalCandidate|experimentalNormal|setExperimental|parseExperimental|character-inventory-experiment" src tests`.

  Expected: no active source/test import or exported implementation remains under the experimental names. If a compatibility re-export is temporarily retained, it must be a one-line documented re-export with a removal point; prefer removing it because current consumers are all in this repository.

- [ ] **Step 6: Verification checkpoint.**

  Confirm `src/model.js`, `src/storage.js`, and all save fixtures remain unchanged. Commit: not applicable because this workspace has no Git metadata.

## Task 3: Promote the shared card and character-inventory view language

**Files:**

- Modify: `src/app.js` around the current experimental card/session/view helpers and event handlers.
- Modify: `styles.css` in the current experimental character-inventory block and its responsive media queries.
- Modify: `tests/character-inventory.test.js` CSS/token assertions.

**Interfaces:**

- Produces one `characterPerkCard(row, characterId, selected = false) -> string` renderer.
- Produces one `characterInventoryCardSizeControl() -> string` with accessible Small/Medium/Large buttons and `aria-pressed` active state.
- Produces production render helpers named `characterInventory(id) -> string` and `characterInventoryUpdate(id) -> string` in the existing app renderer location, using the app’s existing module-level `save` and consuming the promoted domain APIs and current shared artwork/model helpers.
- Event names become `character-inventory-select`, `character-inventory-category`, `character-inventory-set-tier`, and `character-inventory-card-size`; do not leave separate experimental action handlers.
- CSS names become neutral character-inventory names, including the grid, card, editor, control, session, and custom-property tokens. The selected-card rectangular border and `changed-this-update` rectangular outline remain card-level styles.

- [ ] **Step 1: Add/rename source-level renderer assertions.**

  Update focused tests to assert that the source uses neutral renderer/action names, contains exactly one candidate-pool import, and does not expose account-library selectors to the character-card size control. Keep tests about tier semantics in the domain suite, not in CSS string tests.

- [ ] **Step 2: Rename the card/view call sites in `src/app.js`.**

  Rename the current experimental card, editor, normal inventory, Update Inventory, control, and session references in place. Keep the existing HTML-string rendering and event delegation; do not create a second Survivor or Killer renderer. Replace only the experiment-specific labels/classes/actions required for production naming; preserve card content, provenance precedence, direct tier controls, and changed-session behavior.

- [ ] **Step 3: Rename CSS selectors/tokens without changing the approved visual behavior.**

  Preserve the existing values and structure for the black outer diamond, inset tier gradient, neutral unrecorded field, transparent artwork, explicit Roman tier, neutral perk name, selected border, changed outline, and editor-specific artwork sizing. Preserve desktop preset values currently used by the experiment: Small `160px / 10px / 92px / 116px / 210px`, Medium `190px / 12px / 112px / 136px / 238px`, and Large `220px / 14px / 132px / 156px / 270px` for minimum width / gap / art size / art area / minimum height. Preserve `@media (max-width: 760px)` token overrides and `@media (max-width: 430px)` two-column rules.

- [ ] **Step 4: Run focused and full Node tests.**

  Run `node --test tests/character-inventory.test.js` and then `npm test`.

  Expected: all tests pass; there is still no canonical route cutover, so browser route assertions for canonical pages are not added until Task 4.

- [ ] **Step 5: Verification checkpoint.**

  Confirm no changes to `src/model.js`, `src/storage.js`, `src/setup.js`, account-wide library selectors, or generated `dist/app.js`. Commit: not applicable because this workspace has no Git metadata.

## Task 4: Add canonical inventory and Update Inventory dispatch

**Files:**

- Modify: `src/app.js` route calculation, section selection, renderer dispatch, canonical view links, and new production view labels.
- Modify: `tests/character-inventory.test.js` only if route/view helper contracts need additional pure assertions.
- Rename: `tests/browser/experimental.mjs` → `tests/browser/character-inventory.mjs` and update its selectors/routes to the canonical names used by Tasks 4–6.

**Interfaces:**

- `render()` consumes `parseCharacterInventoryRoute(route())` before any `manage/` fallback.
- Canonical inventory view: `#manage/<id>` renders only `characterNormalInventory(save, id)` rows with effective tier greater than zero.
- Canonical Update view: `#manage/<id>/update` renders the relevant candidate pool and the existing editor/session behavior.
- Canonical links use `#manage/<id>` and `#manage/<id>/update`; no normal production link points to an experiment route or legacy route.

- [ ] **Step 1: Add failing browser checks for canonical normal and Update routes.**

  In `tests/browser/character-inventory.mjs`, seed Doctor, Cenobite, and Kate fixtures and assert that `#manage/the-doctor`, `#manage/the-cenobite`, and `#manage/kate-denson` show the inventory heading, no search/category candidate controls, and only effective tracked cards. Assert that the Update link reaches the exact canonical `/update` hash.

- [ ] **Step 2: Dispatch the canonical route descriptor.**

  In `render()`, compute the route descriptor once, derive the nav section from its known character role, and dispatch exact `inventory`/`update` modes before broad route handling. Do not use `current.split('/')[1]` for canonical route interpretation. Keep the account-wide views and dashboard/data routes unchanged.

- [ ] **Step 3: Convert the view copy and links from experimental to permanent.**

  Replace “EXPERIMENTAL” headings and experiment-only explanatory copy with permanent Character Inventory / Update Inventory copy. Keep the portrait, name, role, Owned/Locked, Prestige, Bloodweb, concise tracked/maxed summary, primary Update action, candidate controls, tier editor, provenance, and direct reconciliation behavior specified by the design.

- [ ] **Step 4: Verify normal inventory does not write automatic minima.**

  Use a save with Prestige/account unlock floors and no personal records. Open canonical normal inventory, assert the cards show the effective tiers, assert the corresponding `characters[id].perks` keys remain absent, then clear a personal record through canonical Update and assert the automatic floor remains derived rather than persisted.

- [ ] **Step 5: Run focused tests and the canonical browser smoke against source/build as appropriate.**

  Run `npm test`, then `npm run build`, then the focused browser command used by the repository (`node tests/browser/character-inventory.mjs release/runtime` after staging or the equivalent staged path).

  Expected: canonical normal and Update routes render the shared view and all save assertions pass.

- [ ] **Step 6: Verification checkpoint.**

  Confirm both roles use the same render functions and no account-wide route is dispatched through the character workflow. Commit: not applicable because this workspace has no Git metadata.

## Task 5: Move the old manager behind the explicit legacy route

**Files:**

- Modify: `src/app.js` old-manager dispatch and its temporary escape-hatch copy.
- Modify: `src/perk-filters.js` so advanced manager filtering recognizes only `manage/<id>/legacy` for the old character-manager context.
- Modify: `tests/filter-domain.test.js` route fixtures from `manage/<id>` to `manage/<id>/legacy` where they test old manager filters; add rejection assertions for canonical inventory/update routes.
- Modify: `tests/browser/compact.mjs`, `tests/browser/filtering.mjs`, `tests/browser/data-flows.mjs`, and `tests/browser/artwork.mjs` to use `/legacy` for old-manager behavior.

**Interfaces:**

- `legacy` route mode calls the unchanged old `manager(id)` renderer and preserves Detailed/Compact, advanced filters, catalog-wide perk rows, and existing old-manager controls during the support window.
- `#manage/<id>` and `#manage/<id>/update` must never call `manager(id)`.
- `getFilterContext('manage/<id>/legacy')` returns the existing character perk-filter context; `getFilterContext('manage/<id>')` and `getFilterContext('manage/<id>/update')` return `null` for old-manager filtering.

- [ ] **Step 1: Write the route/filter regression assertions.**

  Assert that canonical inventory has no Detailed/Compact controls, legacy has both controls, advanced filters remain available only on legacy, and canonical Update uses only Search, All, Personal, General, Unlocked, Only unrecorded, and card-size controls.

- [ ] **Step 2: Change dispatch to use only the exact `legacy` mode.**

  Retain `manager(id)` and its old markup. Route the old renderer only from the parser’s `mode === 'legacy'` branch. Replace the old manager’s “Try experimental inventory” link with a support-window link to canonical `#manage/<id>` and keep it clearly secondary.

- [ ] **Step 3: Update old-manager browser fixtures.**

  Change old table/filter/Compact/Detailed tests to `#manage/<id>/legacy`, preserving their existing assertions. Add one assertion that the legacy page can return to the canonical inventory and that the canonical page no longer exposes the old controls.

- [ ] **Step 4: Run old-manager and domain regressions.**

  Run `node --test tests/filter-domain.test.js tests/character-inventory.test.js`, then `npm test`. Run the focused compact/filter browser modules against the staged build.

  Expected: old manager behavior remains available at `/legacy`; canonical routes show no catalog-wide manager UI.

- [ ] **Step 5: Verification checkpoint.**

  Confirm no old-manager code is deleted and no saved data is transformed. Commit: not applicable because this workspace has no Git metadata.

## Task 6: Preserve experiment bookmarks as compatibility aliases

**Files:**

- Modify: `src/character-inventory.js` only if parser tests need final alias behavior.
- Modify: `src/app.js` alias dispatch/link behavior.
- Modify: `tests/browser/character-inventory.mjs` (renamed in Task 4).
- Modify: `tests/browser/smoke.mjs` import and check label.

**Interfaces:**

- Experiment aliases dispatch to the same production renderer and domain functions as canonical routes.
- During Stage A/B, aliases keep their incoming hash to avoid bookmark loops; any new link produced by the view is canonical.
- `#experiment/<id>` maps to `#manage/<id>` behavior and `#experiment/<id>/update` maps to `#manage/<id>/update` behavior without a second implementation.

- [ ] **Step 1: Add alias browser assertions.**

  Open both experiment aliases for one Survivor and one Killer, assert the shared canonical heading/card classes/actions, click Update/back, and assert no repeated navigation or hash loop occurs. Assert alias invalid/extra-segment routes fail safely.

- [ ] **Step 2: Update the browser module to canonical-first coverage.**

  Rename selectors from `.experiment-*`/`data-action="experiment-*"` to the neutral production names. Run the same candidate, tier, session-marker, automatic-floor, and responsive checks against canonical routes, then run the alias checks.

- [ ] **Step 3: Update the main smoke runner.**

  Import `character-inventory.mjs` from `tests/browser/smoke.mjs` and report “canonical character inventory/update workflow and compatibility aliases”. Keep account-wide library checks in their existing modules.

- [ ] **Step 4: Run the focused browser smoke.**

  Run the browser test against a freshly staged runtime. Expected: canonical and experiment routes show identical card behavior; no old-manager route is reached by alias navigation.

- [ ] **Step 5: Verification checkpoint.**

  Confirm no redirect loop, no duplicate candidate implementation, and no changes to experiment save data or persistence. Commit: not applicable because this workspace has no Git metadata.

## Task 7: Update roster and character-detail navigation with focused reuse

**Files:**

- Modify: `src/app.js` `characterCard()` and `characterDetail()` destination labels/copy.
- Modify: `tests/browser/portraits.mjs` and `tests/browser/data-flows.mjs` navigation assertions.

**Interfaces:**

- Existing Survivor/Killer collection renderer remains the roster implementation.
- Existing portrait, favorite, ownership, Prestige, Bloodweb, and tracked-count data remain available.
- Roster primary action links to `#manage/<character-id>` and communicates “Inventory” rather than old catalog-style “Manage perks”.

- [ ] **Step 1: Add failing navigation assertions.**

  From `#survivors`, choose Kate/Meg and assert the primary inventory action has canonical `#manage/<id>` destination; repeat from `#killers` for Doctor/Cenobite. Assert locked characters remain openable and are visibly marked Locked.

- [ ] **Step 2: Change only the destination/copy.**

  Reuse `characterCard()` and its existing metadata. Change the action label and character dialog action to Inventory/canonical character inventory. Do not rebuild cards, remove ownership controls, or add a new ownership gate.

- [ ] **Step 3: Verify setup links remain separate.**

  From the character detail dialog, assert owned characters retain the existing setup action and setup-complete behavior; do not insert setup controls into perk cards.

- [ ] **Step 4: Run roster and navigation checks.**

  Run `npm test` and the portraits/data-flow browser modules. Expected: Survivor and Killer roster actions land on canonical inventory and all existing portrait/ownership behavior remains intact.

- [ ] **Step 5: Verification checkpoint.**

  Confirm `src/setup.js` and `src/character-setup.js` are unchanged. Commit: not applicable because this workspace has no Git metadata.

## Task 8: Promote and scope the card-size preference

**Files:**

- Modify: `src/app.js` UI preference constants/load/save and card-size action handling.
- Modify: `src/character-inventory.js` normalization export if not completed in Task 2.
- Modify: `styles.css` neutral card-size selectors and breakpoint overrides.
- Modify: `tests/character-inventory.test.js` normalization tests.
- Modify: `tests/browser/character-inventory.mjs` preference persistence/leakage checks.

**Interfaces:**

- Permanent key: `dbdTrackerUi.characterCardSize`.
- Compatibility key: existing `dbdTrackerUi.experimentCardSize` is read only as a fallback when the permanent key is absent.
- `loadCharacterCardSize()` returns a normalized Small/Medium/Large value; missing or invalid values resolve to Medium. `saveCharacterCardSize(size)` writes only the permanent UI key and never `dbdTrackerData`.
- The UI control is present on canonical normal/Update and experiment-alias views, is hidden by the existing narrow breakpoint when necessary, and is absent from account-wide libraries and `/legacy`.

- [ ] **Step 1: Add failing preference tests.**

  Test pure normalization for Small/Medium/Large and invalid values. In browser storage, assert: no keys → Medium; valid permanent key wins; absent permanent key plus valid legacy key loads the legacy value; invalid values fall back to Medium; selecting a preset writes the permanent key only; the progression JSON has no card-size property.

- [ ] **Step 2: Implement the permanent-key fallback.**

  Read `dbdTrackerUi.characterCardSize` first. If it is absent, read `dbdTrackerUi.experimentCardSize`; normalize either value. On control selection, normalize and write only `dbdTrackerUi.characterCardSize`. Do not migrate or rewrite the progression save.

- [ ] **Step 3: Scope the modifier classes and CSS.**

  Apply size classes only to the canonical/alias character inventory grids. Preserve current desktop preset values and the existing `max-width: 760px` token override plus `max-width: 430px` two-column layout. Ensure the editor has independent fixed artwork sizing and is not affected by grid preset variables.

- [ ] **Step 4: Run focused tests and inspect route leakage.**

  Run `node --test tests/character-inventory.test.js`, `npm test`, and the browser preference checks. Open `#survivor-perks`, `#killer-perks`, and `#manage/<id>/legacy` after selecting Large; assert their controls/layouts do not gain character size classes or card-size controls.

- [ ] **Step 5: Verification checkpoint.**

  Confirm only UI localStorage changes occur and `dbdTrackerData`, exports, backups, and recovery bytes remain governed by existing persistence APIs. Commit: not applicable because this workspace has no Git metadata.

## Task 9: Verify account-unlock and role-neutral cross-surface behavior

**Files:**

- Modify: `tests/character-inventory.test.js` for any remaining exact role/domain assertions.
- Modify: `tests/browser/character-inventory.mjs` for account-library-to-canonical-Update flows.
- Modify: `tests/browser/filtering.mjs` only if an account-library regression assertion needs to remain explicit.
- Do not modify: `src/model.js` or account-library renderer code unless a real test exposes a blocker; the approved design requires preservation.

**Interfaces:**

- Account library edit remains the existing `account-unlock-tier` action and validated `commit()` path.
- Canonical Update reads `globalTier(save, perk)` on render; no synchronization table or character-account duplicate state is added.

- [ ] **Step 1: Add unit assertions for all account unlock sources.**

  Assert Shrine I/II/III, Other account unlock I/II/III, Prestige P1/P2/P3, and Legacy affect `globalTier`/automatic floors as already defined; assert account changes do not write character personal records and `manualTier` is absent from visible labels.

- [ ] **Step 2: Add browser cross-surface checks for both roles.**

  Edit a Killer Shrine/Other account unlock from `#killer-perks`, open `#manage/the-doctor/update`, and assert the perk appears as Unlocked with the expected effective tier. Repeat with a Survivor account unlock and Kate. Assert a native perk with another unlock source appears once as Personal with secondary provenance.

- [ ] **Step 3: Verify role isolation and locked-source Prestige.**

  Seed locked source characters with Prestige, assert their role-appropriate global unlocks appear in another same-role canonical Update, and assert cross-role perks never appear. Assert locked target characters remain openable and their inventory semantics remain model-derived.

- [ ] **Step 4: Run model, character, and browser checks.**

  Run `node --test tests/model.test.js tests/historical-perks.test.js tests/character-inventory.test.js`, then the focused browser module and `npm test`.

- [ ] **Step 5: Verification checkpoint.**

  Confirm account-library filters and editor labels remain unchanged and all candidate membership changes flow through `globalTier()`. Commit: not applicable because this workspace has no Git metadata.

## Task 10: Expand canonical desktop/mobile browser coverage

**Files:**

- Modify: `tests/browser/character-inventory.mjs`.
- Modify: `tests/browser/smoke.mjs` only for check labels if needed.
- No product source changes unless a browser assertion identifies a concrete regression in the already-approved behavior.

**Interfaces:**

- Browser selectors use the neutral character-inventory class/action names from Task 3.
- Desktop assertions run at wide viewport sizes; mobile assertions run at the existing narrow boundary and do not select a one-column fallback.

- [ ] **Step 1: Cover canonical desktop presets.**

  At a wide viewport, open `#manage/the-doctor/update`, assert Medium is active when storage is empty, select Small/Medium/Large, and measure that Small is denser, Medium balanced, and Large visibly larger/fits fewer cards per row. Assert `aria-pressed` and accessible labels, then reload and assert the selected preset persists.

- [ ] **Step 2: Cover both canonical surfaces.**

  Navigate to `#manage/the-doctor` and assert the same selected size applies to the normal inventory grid; return to Update and assert it remains active. Repeat on a Survivor/Kate route to prove role-neutral behavior.

- [ ] **Step 3: Cover editor independence.**

  Select a perk, record the selected editor artwork bounding box at Small, Medium, and Large, and assert it remains the editor size rather than inheriting card-grid art variables. Assert selected-card and changed-this-update rectangular styles still appear after a direct tier edit.

- [ ] **Step 4: Cover mobile regression at the existing narrow boundary.**

  At 390px (and the existing 320px smoke width where supported), assert two columns, no `document.documentElement.scrollWidth > innerWidth`, readable/nonzero perk art, wrapped controls, hidden card-size selector, and a full-width stacked editor for one Survivor and one Killer. Assert Large selected on desktop does not change mobile card geometry.

- [ ] **Step 5: Cover return to desktop.**

  After mobile checks, restore wide width and assert the previously selected desktop preset is active again. Assert account-wide pages do not expose the control.

- [ ] **Step 6: Run the focused and full browser gates.**

  Run the renamed focused module against a staged runtime, then `npm run test:browser` after the integrated build. Expected: no page errors, no external/catalog JSON requests, and no horizontal overflow at the accepted widths.

- [ ] **Step 7: Verification checkpoint.**

  Confirm mobile remains one shared card renderer/grid with CSS breakpoint overrides, not a separate renderer or progression path. Commit: not applicable because this workspace has no Git metadata.

## Task 11: Verify canonical persistence, import/export, backups, recovery, and file modes

**Files:**

- Modify: `tests/browser/character-inventory.mjs` for canonical edit/reload/export/import assertions.
- Modify: `tests/browser/data-flows.mjs` and `tests/browser/recovery.mjs` only where their route setup must distinguish canonical inventory from `/legacy`.
- Modify: `tests/model.test.js` or `tests/storage.test.js` only if a focused assertion is needed to prove the save shape is unchanged.
- Do not modify: `src/model.js` or `src/storage.js` behavior.

**Interfaces:**

- All progression edits use the existing `commit()` → `TrackerStorage.save()` path.
- JSON export/import, local backups, recovery keys, and direct-file runtime behavior remain the current interfaces.

- [ ] **Step 1: Add canonical direct-edit persistence checks.**

  In canonical Update, set a personal tier, assert the exact character perk record is stored, reload, assert the effective tier and recorded tier remain correct, clear the record, and assert the derived automatic floor remains without a personal key.

- [ ] **Step 2: Add export/import/backup checks from canonical navigation.**

  Export after a canonical edit, verify progression values and absence of UI preference state from the JSON, import a modified valid JSON through the existing Data page, cancel once to prove predecessor bytes remain, accept once to prove the canonical view reflects imported progress, and restore a backup to prove the same effective progression returns.

- [ ] **Step 3: Preserve old-save and alias behavior.**

  Load a current localStorage fixture and an older valid JSON fixture through existing parsing, visit canonical and experiment routes, and assert no reset, schema change, or duplicate alias record occurs. Include a canonical licensed perk alias case.

- [ ] **Step 4: Run persistence and recovery suites.**

  Run `node --test tests/model.test.js tests/storage.test.js tests/recovery.test.js tests/character-inventory.test.js`, then `npm test` and the browser data/recovery modules.

- [ ] **Step 5: Verify direct-file and localhost acceptance after staging.**

  Open `G:\Projects\dbd-tracker\release\runtime\index.html` directly with a `file:///G:/Projects/dbd-tracker/release/runtime/index.html#manage/the-doctor` URL and exercise a read-only route load plus artwork. Start the existing localhost server with `npm start`, open the same canonical and alias hashes, and repeat the route/load checks. Do not treat source-only `src` behavior as release acceptance.

- [ ] **Step 6: Verification checkpoint.**

  Confirm no progression localStorage key, save schema, backup, recovery, or import/export format changed. Commit: not applicable because this workspace has no Git metadata.

## Task 12: Fresh build, source/bundle parity, staging, and release gates

**Files:**

- Modify: `tests/release.test.js` only if an additional assertion is required to tie canonical browser coverage to the staged bundle.
- Generated by commands: `data/asset-manifest.json`, `dist/app.js`, `release/runtime/`, `release/verification.json`, `release/artwork-file-check.html`.
- No hand edits to generated artifacts.

**Interfaces:**

- `npm run build` regenerates the manifest and bundles `src/app.js` into `dist/app.js`.
- `npm run release` runs Node tests, fresh build, stage verification, and the browser smoke against the exact staged runtime.

- [ ] **Step 1: Run the full Node gate after all source/test integration.**

  Run `npm test`.

  Expected: all tests pass, including canonical route, domain, legacy, preference, persistence, and release assertions.

- [ ] **Step 2: Regenerate the production bundle.**

  Run `npm run build`.

  Verify `data/asset-manifest.json` and `dist/app.js` have fresh timestamps/content and that the bundle contains the promoted route/rendering behavior through browser execution. Do not claim completion from `src` tests alone.

- [ ] **Step 3: Run the full staged browser smoke.**

  Run `npm run test:browser` against the current staged runtime when available, or run the repository’s release staging flow first. Confirm the canonical and compatibility route checks execute from the bundle, not source modules.

- [ ] **Step 4: Run the release staging gate.**

  Run `npm run release`.

  Expected: `release/verification.json` reports the staged automated browser pass and a fresh bundle hash; `release/runtime` contains only the verified allowlist; artwork-file check is generated for the required manual file-mode acceptance.

- [ ] **Step 5: Complete manual release acceptance.**

  Open the staged `release/artwork-file-check.html` via file mode and verify the reported image decode pass. Open staged `index.html` via file mode and use a localhost run for interactive canonical/alias checks. Record any failure as a release blocker; do not ship a source/bundle mismatch.

- [ ] **Step 6: Verification checkpoint.**

  Preserve generated outputs only according to the existing repository workflow. Commit: not applicable because this workspace has no Git metadata; do not initialize Git or fabricate a commit/hash.

## Task 13: Stage B support-window gate and Stage C retirement decision

**Files:**

- No product files are changed by this gate unless a release blocker is found.
- Reference: `docs/superpowers/specs/2026-10-11-character-inventory-productionization-design.md`.

**Interfaces:**

- Stage A leaves `#manage/<id>/legacy` and both experiment aliases available.
- Stage C is a separate follow-up after a real support window; it is not an automatic part of the first cutover execution.

- [ ] **Step 1: Confirm Stage A release checklist is complete.**

  Require passing domain, route, roster, desktop, mobile, cross-surface, persistence, fresh-build, staged-browser, localhost, and direct-file checks from Tasks 1–12.

- [ ] **Step 2: Run a support-window parity review.**

  Compare representative Doctor, Cenobite, Kate, native/General overlap, account unlock, Prestige, Legacy, historical, retained, locked-source, import, and alias cases using the new canonical route and the old `/legacy` escape hatch. Keep the old manager unadvertised but reachable.

- [ ] **Step 3: Make the retirement decision without deleting code in this execution.**

  Recommend Stage C as a separate follow-up after support feedback. Only that follow-up may remove obsolete manager/experiment-only renderer code or decide whether a lightweight `/legacy` redirect remains useful. No save fields, migrations, or progression records are deleted as part of retirement.

- [ ] **Step 4: Verification checkpoint.**

  If support feedback reveals a serious issue, rollback by selecting the old renderer/route mapping while leaving all saves untouched. Commit: not applicable because this workspace has no Git metadata.

## Rollout Order and Release Boundary

Execute Tasks 1–3 as the shared contract/promotion foundation, then Tasks 4–6 as the route cutover with the old manager still available. Execute Tasks 7–11 for navigation, preference, cross-surface, and persistence validation. Execute Task 12 as the source/dist/release gate. Do not execute Task 13’s Stage C cleanup during the first cutover; it is a support-window decision gate.

The first production cutover is reversible by changing only route/renderer selection: restore `#manage/<id>` to the old renderer or temporarily point it to `/legacy`, while retaining the same `commit()` and save fields. No save rollback, schema rollback, migration reversal, progression reset, or JSON reimport is required.

## Self-Review

- **Spec coverage:** Current architecture and file responsibilities are mapped before tasks; candidate/category/tier contracts are covered in Tasks 2, 4, and 9; routing and compatibility in Tasks 1, 4–6; roster in Task 7; normal and Update behavior in Task 4; libraries in Task 9; locked/owned behavior in Tasks 7 and 9; setup boundary in Task 7; persistence in Task 11; mobile in Task 10; rollback and support window in Task 13; release/source-bundle parity in Task 12; scope exclusions in the Global Constraints.
- **Exact route consistency:** Every task uses `#manage/<id>`, `#manage/<id>/update`, `#manage/<id>/legacy`, `#experiment/<id>`, and `#experiment/<id>/update`; no alternate legacy name is introduced.
- **Task interfaces:** Each task names its files, produced/consumed functions or route behavior, assertions, runnable commands, and expected result. No step says only “handle edge cases” or “test everything”.
- **Route parser ordering:** Task 2 locks the parser contract; Task 4 requires exact dispatch before broad manager handling; Task 5 proves legacy-only old-manager filtering; malformed/extra-segment behavior is pinned in unit and browser checks.
- **No duplicate implementations:** The plan renames the existing role-neutral domain module and one shared card/view implementation. Experiment aliases are route descriptors, not a second renderer. The old manager remains intentionally separate only as a temporary legacy surface.
- **No automatic-tier persistence:** Task 4 and Task 11 explicitly assert that effective automatic tiers render without personal save keys and that clearing a personal record preserves the derived floor.
- **Preference scope:** Task 8 specifies the permanent UI key, legacy fallback, invalid-value behavior, route scope, and narrow breakpoint override. Task 10 tests account-library/legacy leakage and mobile geometry.
- **Mobile acceptance:** Task 10 explicitly tests Survivor and Killer at narrow widths for two columns, no overflow, readable art, wrapped controls, stacked editor, hidden selector, and desktop preference restoration.
- **Persistence safety:** No task modifies model/storage/migrations or writes direct progression localStorage from UI. Task 11 covers edits, reload, import/export, backups/recovery, aliases, and unchanged save shape.
- **Source/dist/release parity:** Task 12 requires fresh `npm run build`, staged smoke, `npm run release`, and direct-file acceptance. The plan does not consider source-only tests sufficient.
- **Workspace reality:** Every commit step is explicitly not applicable; no branch, hash, worktree, or Git initialization is fabricated.

## Execution Recommendation

**NATIVE** is recommended for this plan. The route parser, renderer promotion, CSS naming, and browser selectors are tightly coupled through `src/app.js`, `styles.css`, and the staged bundle; the workspace has no Git worktrees; and a single executor can maintain the route/save invariants across the cutover with verification checkpoints after each task. Use a fresh reviewer only after the full release gate if the execution workflow supports it; do not parallelize edits to the shared router or renderer.

