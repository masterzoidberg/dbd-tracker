# Character Workspace Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Character Workspace visual redesign so Overview, Perks, and Survivor Items & Add-ons share one polished workspace language while preserving all existing schema-v2, routing, persistence, and inventory-editing semantics.

**Architecture:** Keep the current static/browser architecture and route model. Reuse the completed pure family-grouping selector and Task 5 stepper/focus paths, then refine only inventory rendering and scoped CSS in `src/app.js` and `styles.css`; use the existing bounded dialog and writer/persistence paths rather than introducing a new subsystem. Preserve the Perks domain and card grid, and treat selectedFamilyId/search/filter state as session-only presentation state. Task 5A refines inventory only; Task 6 remains the final completion/release pass.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates in `src/app.js`, CSS, Node.js `node:test`, Playwright Core browser regressions, esbuild release bundle.

**Spec:** `docs/superpowers/specs/2026-10-14-character-workspace-visual-redesign-design.md`

## Execution checkpoint and revised scope

| Work | Status | Implemented commit |
| --- | --- | --- |
| Task 1 — pure grouping/step helpers | COMPLETE | `41d61e2` |
| Task 2 — shared header/Overview | COMPLETE | `1f59725` |
| Task 3 — original family-first inventory document | COMPLETE; presentation superseded by Task 5A | `7196274` |
| Task 4 — rarity/Details | COMPLETE; card decoration refined by Task 5A | `f2e4f59` |
| Task 5 — quantity steppers/focus | COMPLETE; preserve its contracts | `e0f4a728d39acefe70bea2dcc53491c75d9e835b` |
| Asset-only refresh — 92 exact live mappings | COMPLETE; approved baseline | `5d5d7e43749acd5cfc448e33eb08365a97d1c2ea` |
| Task 5A — selected-family navigation/artwork-led cards | PLANNED; awaiting owner review | — |
| Task 6 — Perks/responsive/release acceptance | PAUSED until Task 5A is approved and complete | — |

Tasks 1–5 below preserve the original plan as historical context, not a new execution queue or a claim that every original command was run unchanged. Task 5 completed locally with focused Chrome inventory/Character Edit, 243/243 Node tests and normal build; the full release gate was deferred to Task 6. Resume only at Task 5A after owner approval; do not reimplement Tasks 1–5 or reopen the approved asset mapping.

## Global Constraints

- Schema remains v2. No schema v3, migration, save-identity, localStorage-key, JSON import/export, backup, or recovery changes.
- Do not change canonical or compatibility routes.
- Do not change Prestige Queue or Dashboard behavior.
- Do not start P3.5 or invent Killer Power/Add-on production data.
- Do not change perk candidate, effective-owned, automatic-minimum, historical, tier, or reconciliation semantics.
- Preserve direct raw quantity typing, non-negative safe-integer validation, sparse positive persistence, zero canonicalization, Enter/blur detail-page commit, failed raw-text retention, stable editing order, Edit Character draft-only behavior, and unresolved imported IDs.
- Family navigation follows verified catalog order, with exactly one selected family rendered and a first-catalog-family default. Inside it render Items before Add-ons, then positive stock before zero stock, then canonical order inside each stock group.
- Search/In Stock/Type/Rarity apply only within selectedFamilyId and retain their values across family changes. Family is navigation, never a secondary filter.
- Zero-stock entries remain visible and editable by default and keep the same card geometry as positive stock.
- Inventory rarity/type is always text-labeled; canonical background artwork is supplemental to catalog rarity. Banquet stays Event; reduce redundant card decoration and do not repeat selected-family metadata on cards.
- The owner’s active save must never be accessed. Use `freshSave()` or synthetic fixtures only.
- Required layout widths: 320, 500, 760, 1100, 1440, 1600. No page-level horizontal overflow.
- Genuine browser 200% zoom must be manually rechecked after implementation.
- No sticky inventory toolbar in this implementation.

## Review Focus

1. **Invalid raw quantity while In Stock is enabled:** the edited card remains visible, raw text survives, and no save occurs until valid input is committed. Covered in Task 1 pure tests and Task 5 browser tests.
2. **Zero commit while In Stock is enabled:** the card may disappear only after a successful commit, and focus moves to a deterministic visible destination rather than the document body. Covered in Task 5 browser tests.
3. **Family change with a pending quantity or hidden draft error:** detail switching resolves once and blocks on invalid/save failure; draft switching preserves raw/errors without writes. Search/filters remain selected-family scoped, and the global error summary selects the target family explicitly. Covered in Task 5A.
4. **Details dialog opener removed by filtering/family navigation:** closing restores to the originating button when present, otherwise Search. Preserve Task 4 reading/qualification/provenance behavior. Covered in Task 5A.
5. **Long names, narrow widths, and 200% zoom:** controls wrap without horizontal overflow, quantity remains usable, and focus stays visible. Covered in Task 6 responsive/release verification plus owner manual zoom acceptance.

---

## File map

- `src/inventory-interaction.js` — reuse the completed grouping/step/focus helpers; change only if selected-family visibility requires a narrowly tested adjustment.
- `src/app.js` — shared character header, Overview composition, selected-family stock renderer, family navigation/filter UI state, Details action, quantity stepper wiring, Perks intro cleanup.
- `styles.css` — Character Workspace-only visual system, rarity tokens, family sections, inventory cards, Overview layout, responsive rules.
- `tests/inventory-interaction.test.js` — pure ordering/grouping/stepper state coverage.
- `tests/browser/character-workspace.mjs` — shared header and Overview behavior.
- `tests/browser/inventory.mjs` — selected-family navigation, local filters, artwork/rarity, quantity, Details, focus, unresolved imports, responsive behavior.
- `tests/browser/character-inventory.mjs` — normal Perks intro/header regression only; existing reconciliation assertions stay intact.
- Existing model, storage, route, queue, catalog, and quantity-validation modules remain semantically unchanged.

---

### Task 1: Family-local inventory presentation selector — COMPLETE (historical)

**Files:**
- Modify: `src/inventory-interaction.js`
- Modify: `tests/inventory-interaction.test.js`

**Interfaces:**
- Consumes: existing `createQuantityInteraction(state)`, `visibleQuantityEntries(state, filters)`, entity fields `familyId`, `map`, `order`, and verified family objects `{ id, displayName, ... }`.
- Produces: `groupQuantityEntries(state, filters, families)` returning `Array<{ family, items, addons }>` in family source order; `stepQuantityInput(state, id, delta)` returning `{ state, quantity, error }` without mutating the caller.

- **Original Step 1: Write failing family-grouping tests**

Add tests that assert:

```js
const families = [{id:'key',displayName:'Keys'},{id:'map',displayName:'Maps'}];
const grouped = groupQuantityEntries(state, {}, families);
assert.deepEqual(grouped.map(group => group.family.id), ['key','map']);
assert.deepEqual(grouped[0].items.map(entity => entity.id), ['key-positive','key-zero']);
assert.deepEqual(grouped[0].addons.map(entity => entity.id), ['key-addon-positive','key-addon-zero']);
```

Also assert pending/invalid entries still survive `{ inStock:true }`, grouping does not reorder a pending raw edit, and unresolved/non-catalog entities cannot appear because the helper only receives resolved `state.entities`.

- **Original Step 2: Run the focused unit test and confirm RED**

Run: `node --test tests/inventory-interaction.test.js`

Expected: FAIL because `groupQuantityEntries` is not exported yet.

- **Original Step 3: Implement `groupQuantityEntries(state, filters, families)`**

In `src/inventory-interaction.js`, build from `visibleQuantityEntries(state, filters)`, preserve family source order, split each family into `items` and `addons`, and preserve the interaction snapshot order inside each subsection. Do not move grouping into storage/model code.

- **Original Step 4: Write failing quantity-step helper tests**

Test exact behavior:

```js
assert.equal(stepQuantityInput(state,'a',1).quantity, 1);
assert.equal(stepQuantityInput(stateAtZero,'a',-1).quantity, 0);
assert.equal(stepQuantityInput(stateAtMax,'a',1).quantity, Number.MAX_SAFE_INTEGER);
assert.ok(stepQuantityInput(invalidRawState,'a',1).error);
assert.equal(stepQuantityInput(invalidRawState,'a',1).state.raw.a, 'bad');
```

The helper must never coerce invalid raw text and must clamp only at the legal zero/MAX_SAFE_INTEGER boundaries.

- **Original Step 5: Run focused test and confirm RED**

Run: `node --test tests/inventory-interaction.test.js`

Expected: FAIL because `stepQuantityInput` is not exported yet.

- **Original Step 6: Implement `stepQuantityInput(state, id, delta)`**

Use the existing parse/accept path so button stepping and typed input share validation semantics. Return a cloned state with updated raw/pending data and a validated numeric quantity; on invalid raw input, preserve the raw text and return an error.

- **Original Step 7: Run focused tests and confirm GREEN**

Run: `node --test tests/inventory-interaction.test.js`

Expected: all inventory-interaction tests PASS.

- **Original Step 8: Run all Node tests**

Run: `npm test`

Expected: PASS with zero failures.

- **Original Step 9: Commit**

```bash
git add src/inventory-interaction.js tests/inventory-interaction.test.js
git commit -m "Add family-local inventory presentation helpers"
```

---

### Task 2: Shared Character Workspace header and Overview composition — COMPLETE (historical)

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/character-workspace.mjs`

**Interfaces:**
- Consumes: `characterWorkspaceHref()`, `characterArtwork()`, `perkArtwork()`, existing save/character stats selectors.
- Produces: one shared `characterWorkspaceHeader(character, descriptor)` identity/header used by normal Overview, Perks, and Inventory sections; Overview sections with stable data attributes for browser tests.

- **Original Step 1: Add failing browser assertions for the shared header**

In `tests/browser/character-workspace.mjs`, assert the Overview route exposes:

- exactly one workspace `h1` with the character name;
- visible role, Owned/Not owned, Favorite state;
- separate labeled Prestige and Bloodweb values;
- one `Edit Character` link to `#character/<id>/edit`;
- one workspace nav with `aria-current="page"` on Overview;
- no duplicate portrait/name/back-link block inside the Overview body.

Add a narrow-width assertion at 320px that the header has no horizontal page overflow and the Edit Character control remains at least 44px tall.

- **Original Step 2: Add failing Overview composition assertions**

Assert the body has explicit sections for:

- Native Perks with artwork and nearby tier/provenance;
- Progress/setup context;
- Perks summary;
- Items & Add-ons or Power & Add-ons summary;
- Notes.

For a Survivor with empty sparse stock maps, assert the summary says `No quantities recorded yet.` rather than `No stock`. For the synthetic unresolved ID already used by the test, assert unresolved stock is called out separately. For Killer Overview, preserve truthful unavailable Power/Add-ons messaging.

- **Original Step 3: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/character-workspace.mjs release/runtime`

Expected: FAIL on new header/Overview structure assertions.

- **Original Step 4: Implement the shared header in `src/app.js`**

Update `characterWorkspaceHeader(character, descriptor)` so it renders, in DOM order: breadcrumb, identity/portrait/name/role/statuses, labeled Prestige/Bloodweb values, Edit Character action, workspace nav. Owned/Favorite remain display-only in this header.

- **Original Step 5: Recompose `characterOverview(id)`**

Replace the stack of equally heavy panels with semantic sections matching the spec. Use existing native perk artwork/tier/provenance data and existing `characterStats()` values only. Do not add completion percentages or new metrics.

Add stable section hooks such as:

- `[data-overview-section="native-perks"]`
- `[data-overview-section="progress"]`
- `[data-overview-section="perks"]`
- `[data-overview-section="inventory"]`
- `[data-overview-section="notes"]`

- **Original Step 6: Add scoped CSS for shared header and Overview**

Keep existing Ledger tokens. Add only Character Workspace-scoped layout/status/progress/Overview rules. Use two columns where useful at desktop widths and logical single-column stacking at narrow widths.

- **Original Step 7: Rebuild and confirm browser GREEN**

Run: `npm run release`

Then run: `node tests/browser/character-workspace.mjs release/runtime`

Expected: PASS.

- **Original Step 8: Run all Node tests**

Run: `npm test`

Expected: PASS.

- **Original Step 9: Commit**

```bash
git add src/app.js styles.css tests/browser/character-workspace.mjs
git commit -m "Redesign Character Workspace header and overview"
```

---

### Task 3: Family-first Survivor inventory page and compact filters — COMPLETE (historical)

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/inventory.mjs`

**Interfaces:**
- Consumes: `groupQuantityEntries(stockSession, stockFilters, survivorInventorySource.itemFamilies)` from Task 1; existing `inventoryEntities`, `survivorInventorySource`, `inventoryEntityById`.
- Produces: family section UI, session-only collapse state, visible Search/In Stock controls, compact Type/Rarity disclosure, optional Jump-to-family if implementation remains simple.

- **Original Step 1: Add failing browser assertions for family architecture**

Using the real verified Survivor catalog in the disposable browser fixture, assert:

- every verified family heading appears in catalog order;
- each family renders an Items subsection before Add-ons;
- positive stock precedes zero stock inside each subsection after a successful commit/regroup;
- canonical order is preserved inside positive and zero groups;
- Firecrackers derive an Add-ons empty line matching `No compatible Add-ons in this catalog.` rather than an empty grid.

Use stable hooks:

- `[data-stock-family="<familyId>"]`
- `[data-stock-subsection="items"]`
- `[data-stock-subsection="addons"]`

- **Original Step 2: Add failing toolbar/filter assertions**

Assert Search and In Stock are immediately visible. Assert Type and Rarity are inside a compact Filters disclosure and the trigger reflects the active secondary-filter count. The old always-visible family dropdown is absent from the normal redesigned page.

- **Original Step 3: Add failing collapse/search-state assertions**

Assert:

1. families begin expanded;
2. individual family toggle uses `aria-expanded`;
3. Collapse all and Expand all work;
4. user-collapsed family + matching search is temporarily revealed;
5. clearing search restores the user's prior collapsed state;
6. collapse/search state is not written into `dbdTrackerData`.

- **Original Step 4: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: FAIL on family/filter/collapse assertions.

- **Original Step 5: Implement session-only family state in `src/app.js`**

Add presentation state separate from `save`, with explicit sets for user-collapsed and temporarily forced-open family IDs. Reset appropriately when entering a different stock-session key, but never persist into JSON.

- **Original Step 6: Replace flat `stockView()` rendering with family sections**

Render `groupQuantityEntries(...)` output in verified family order. Items always precede Add-ons. Preserve current quantity inputs, pending/error status regions, image fallback, and unresolved-record source collection.

- **Original Step 7: Implement toolbar and filter disclosure**

Keep `#inventory-search` and `#inventory-in-stock` directly visible. Replace the old always-visible map/family/rarity strip with a Filters disclosure containing Type and Rarity. Preserve existing search semantics across name/effect text and existing In Stock pending/error visibility.

- **Original Step 8: Implement family collapse actions**

Use native buttons with `aria-expanded`. Add `Collapse all` and `Expand all` actions. Search, error focus, and explicit family navigation may force a family open without rewriting user collapse intent.

- **Original Step 9: Add family/card CSS**

Add scoped family headings, subsection rhythm, responsive `auto-fit/minmax` card grids around a 220px practical minimum, larger artwork media areas, and quieter zero-stock treatment with identical geometry.

- **Original Step 10: Rebuild and confirm browser GREEN**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: family/filter/collapse assertions PASS while existing save/edit assertions remain PASS.

- **Original Step 11: Run all Node tests**

Run: `npm test`

Expected: PASS.

- **Original Step 12: Commit**

```bash
git add src/app.js styles.css tests/browser/inventory.mjs
git commit -m "Group Survivor inventory by item family"
```

---

### Task 4: Inventory rarity and bounded Details dialog — COMPLETE (historical)

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/inventory.mjs`

**Interfaces:**
- Consumes: current inventory entity fields `rarity`, `familyId`, `effect`, `compatibleItemIds`, `needsVerification`, `notes`, `provenance.references`; existing bounded `#detail` dialog infrastructure.
- Produces: inventory-specific rarity badge/accent classes and `stock-details` action that opens a read-only bounded dialog and restores focus.

- **Original Step 1: Add failing rarity assertions**

Assert representative cards render visible rarity text and inventory-specific rarity classes/tokens. Assert Event remains Event for known qualified Banquet entries and that no alternate underlying rarity changes card display/filter membership.

- **Original Step 2: Add failing Details-dialog assertions**

For an Item and an Add-on, assert the card has one explicit `Details` button and no persistent `Reference and compatibility` disclosure. Opening Details must show only supported catalog metadata: name/artwork, displayed rarity, family, effect, exact compatible Item names when applicable, qualification note if present, and provenance links.

- **Original Step 3: Add writer-independent and focus-restoration assertions**

Open a read-only second page/window and assert Details still opens while quantity editing remains disabled. Assert closing the dialog restores focus to the exact Details opener. Then hide/remove the originating card with a filter and assert close restoration falls back to `#inventory-search` or another deterministic page-level control.

- **Original Step 4: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: FAIL on Details/rareness structure assertions.

- **Original Step 5: Implement inventory rarity presentation**

Add a helper/class mapping in `src/app.js` limited to verified rarity values and inventory-specific CSS tokens in `styles.css`. Always render rarity text. Never reuse perk tier classes.

- **Original Step 6: Implement `stock-details` using the existing bounded dialog**

Store the opener, render verified metadata only, and preserve current modal close/Escape conventions. Do not move quantity editing into the dialog and do not require writer access.

- **Original Step 7: Remove card-level reference disclosure**

Replace repeated persistent reference/compatibility blocks with the Details action. Update any focus-destination lists that previously referenced disclosure summaries/source links so quantity blur behavior remains deterministic.

- **Original Step 8: Rebuild and confirm browser GREEN**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: PASS.

- **Original Step 9: Commit**

```bash
git add src/app.js styles.css tests/browser/inventory.mjs
git commit -m "Add inventory rarity and details dialog"
```

---

### Task 5: Quantity stepper, error reveal, and focus-safe regrouping — COMPLETE (historical)

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/inventory.mjs`

**Interfaces:**
- Consumes: `stepQuantityInput()` and existing `stockInput`/commit/regroup/focus helpers.
- Produces: optional-in-spec but implemented `[-] [raw text field] [+]` quantity control using the same validation/commit semantics as direct typing.

- **Original Step 1: Add failing stepper browser assertions**

Assert every resolved editable card has:

- decrement button accessible name `Decrease quantity of <name>`;
- existing direct text input accessible as `Quantity of <name>`;
- increment button accessible name `Increase quantity of <name>`;
- practical 44px button/input targets.

Assert decrement is disabled at zero and increment is disabled at `Number.MAX_SAFE_INTEGER`.

- **Original Step 2: Add failing invalid-raw and single-commit assertions**

Set raw input to `bad`, press +/- and assert raw text stays `bad`, storage bytes do not change, and the error remains visible. For a valid value, activate +/- and assert exactly one persisted change occurs with no second timestamp/write caused by blur.

- **Original Step 3: Add failing regroup/focus assertions**

Cover both transitions:

- zero -> positive moves the card into the positive group only after successful commit and restores focus deterministically;
- positive -> zero under In Stock may hide the card after commit, but focus lands on the next visible target or `#inventory-search`.

Also assert an error-summary action expands a collapsed family, preserves invalid raw text, and focuses the bad quantity field.

- **Original Step 4: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: FAIL on stepper/focus assertions.

- **Original Step 5: Implement stepper rendering and button actions**

Render the three-part control inside each resolved editable card. Use `stepQuantityInput()` and the existing commit path; explicitly guard blur/button sequencing so a click cannot cause two commits. Invalid raw input disables/blocks stepping without normalization.

- **Original Step 6: Update focus destination logic around family sections**

Before restoring focus to a quantity field, expand its family if it is user-collapsed/temporarily hidden. After a commit that removes the current card under active filters, use the existing deterministic next/previous/search fallback contract.

- **Original Step 7: Update error-summary reveal behavior**

When focusing a stock error, clear only the minimum filters required by the existing contract, force the containing family open, render, then focus the field without altering raw text.

- **Original Step 8: Rebuild and confirm browser GREEN**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: PASS including all pre-existing draft, writer-lock, save-failure, unresolved-ID, and image-fallback assertions.

- **Original Step 9: Run all Node tests**

Run: `npm test`

Expected: PASS.

- **Original Step 10: Commit**

```bash
git add src/app.js styles.css tests/browser/inventory.mjs
git commit -m "Add focus-safe inventory quantity steppers"
```

---

### Task 5A: Inventory Family Navigation & Artwork-Led Cards

**Status:** PLANNED. Do not implement until the owner reviews this revised checkpoint. Task 6 stays paused.

**Files:**
- Modify: `src/app.js`, `styles.css`, `tests/browser/inventory.mjs`, `tests/browser/character-edit.mjs`.
- Modify `src/inventory-interaction.js` / `tests/inventory-interaction.test.js` only if a minimal selected-family visibility/focus adjustment is necessary; reuse completed helpers by default.
- Regenerate tracked `dist/app.js` using the normal build once source is green. No asset remapping or manual bundle editing.

**Interfaces:**
- Consumes: verified `survivorInventorySource.itemFamilies`, all 92 canonical background assets, `groupQuantityEntries`, `stepQuantityInput`, existing stock session/raw/pending/errors, `acceptStock`, Details and draft/writer paths.
- Produces: session-local `selectedFamilyId`; one labeled native-button family nav with exactly one aria-pressed selection; one `[data-stock-family]` region; selected-family search/filter/focus candidates; prominent uncropped artwork and visible catalog rarity/kind text.
- Scope: no Overview/Perks redesign, schema/persistence/routing change, new entity/family, new global Search, or quantity-model change.

- [ ] **Step 1: Write selected-family/navigation RED assertions**

Use synthetic/disposable state in `tests/browser/inventory.mjs`. Assert the initial family is the first verified source family; every family button follows canonical source order; the nav is named `Item families`, uses native buttons with one `aria-pressed="true"`, no tab roles, and only one verified family region/card set is rendered. Visit every verified family and assert its cards/subsection counts match the catalog, with no other family's cards in the content. Assert Enter/Space changes selection, keeps focus on the activated button, and does not change storage bytes when no edit is pending. Repeated rerenders retain selection; a different character/page session resets it. Preserve read-only family navigation and Details access.

- [ ] **Step 2: Run navigation RED**

Build normally, then run focused Chrome inventory through the existing disposable harness:

```bash
npm run build
node --input-type=module -e "import {smokeStage} from './tests/browser/smoke.mjs'; import {inventoryRegression} from './tests/browser/inventory.mjs'; console.log(await smokeStage(process.cwd(),{channel:'chrome',regression:inventoryRegression}));"
```

Expected: FAIL for the missing selected-family navigation/one-region contract, not a fixture or browser setup error. Do not run the temporary generators or full release gate.

- [ ] **Step 3: Implement the minimal navigation GREEN**

Replace obsolete accordion-only actions/state with selectedFamilyId tied to the existing stock session key. Retain the interaction snapshot across visits. Render the canonical native-button nav and only the selected group; keep the unresolved region outside it. Do not create families from source artwork folders. Rerun the focused command; expected navigation GREEN.

- [ ] **Step 4: Write selected-family scope/transition RED assertions**

Assert Search matches name/effect only inside the selected family; other-family matches never appear. Keep the selected heading/all navigation buttons on local no results. Retain Search/In Stock/Type/Rarity on family changes; clearing Search preserves the other controls. Verify catalog-total heading counts do not imply filtered/owned quantities. Verify Items before Add-ons, positive/zero/canonical ordering, and Firecrackers' catalog-derived no-Add-ons line with no empty grid. No Family filter belongs in Filters. Restore Type=All before default-view assertions after error navigation.

Cover active pending detail edits during family switching: valid raw value commits once before switching; invalid input/save failure retains raw and current family with editable error focus. In Edit Character, switching with valid or invalid raw values preserves drafts/errors and storage bytes; returning restores the exact raw value. Error-summary/Save Character validation selects the error's family and clears only filters needed to reveal it before focusing. Test two retained errors in different families: explicit correction navigation preserves both raw values and can reach the other error despite the ordinary family-button guard. In Stock zero commits use a visible same-family neighbor or Search; ordinary regroup never selects another family.

- [ ] **Step 5: Observe scope RED, implement minimal GREEN**

Run the focused inventory and Character Edit Chrome harnesses and observe expected failures before implementation. Scope grouping/focus candidates to the selected family; preserve Task 5's existing commit and composite-blur rule when switching, without new persistence boundaries or timing-dependent duplicate commits. Adapt historical all-family test assumptions to explicit family selection; do not weaken quantity/write-counter tests. Rerun both suites; expected GREEN.

- [ ] **Step 6: Write artwork/card/Details/responsive RED assertions**

Assert cards use approved manifest paths/background bytes with decorative images; normal desktop art is materially larger than current 96px where geometry permits, toward 128px within the approximate 96–128px range. Check complete uncropped/contain-scaled media and stable positive/zero geometry without empty-padding inflation. Assert visible catalog `rarity · Item/Add-on` text, no prominent repeated family label, no required strong rarity border, and Banquet Event display/filtering independent of image color.

Preserve bounded Details effect/compatibility/provenance/qualification, writer-independent reading, exact-opener restoration and Search fallback after the opener is removed. Unresolved imports remain read-only/discoverable through family and filter changes. At 320/500px assert a bounded single-row scrollable family strip, full-size buttons, selected/focused buttons reachable and visible, one usable card column, 44px quantity targets and zero page overflow. Check 760px wrapping and desktop container-driven grids; do not add a dropdown fallback or custom tab keyboard model.

- [ ] **Step 7: Observe presentation RED, implement GREEN**

Use focused Chrome inventory/Character Edit tests to observe new structural/size failures. Make contained stock/nav/card CSS and markup changes only; preserve image fallback, Details and quantity hooks. Enlarge art using measured card geometry, simplify redundant rarity decoration and card family text, and keep visible catalog metadata. Rerun to GREEN with no quantity regression.

- [ ] **Step 8: Verify the complete refinement checkpoint**

Run `node --test tests/inventory-interaction.test.js`, `npm test`, and `npm run build`. Run full focused inventory and Character Edit Chrome regressions against the rebuilt runtime using `smokeStage(process.cwd(),{channel:'chrome',regression:...})`. Expected: all PASS, including pointer/Enter/Space stepping, pending typed values, one persisted write, zero/MAX and invalid disabling, writer reacquisition, failed-save retry focus, raw retention, draft-only behavior, Details and unknown IDs. Verify generated bundle determinism; keep the full staged release/genuine 200% zoom acceptance in Task 6.

Character Edit command:

```bash
node --input-type=module -e "import {smokeStage} from './tests/browser/smoke.mjs'; import {characterEditRegression} from './tests/browser/character-edit.mjs'; console.log(await smokeStage(process.cwd(),{channel:'chrome',regression:characterEditRegression}));"
```

- [ ] **Step 9: Review, commit and stop for owner checkpoint**

Inspect `git diff --check`, `git diff --stat`, `git status`; review the Task 5A diff against the revised spec. Commit only intended source/CSS/tests/generated runtime with message `Refine inventory family navigation and artwork-led cards`. Report RED/GREEN evidence, transitions, regressions and status. Keep temporary executor infrastructure untouched. Do not begin Task 6 without owner checkpoint review.

---

### Task 6: Perks-page cleanup, full responsive regression, and release acceptance candidate

**Status:** PAUSED. Prerequisite: Task 5A implemented, green and reviewed by the owner. Overview retains its existing design; this is the final limited Perks cleanup and whole-workspace acceptance pass.

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/character-inventory.mjs`
- Modify: `tests/browser/character-workspace.mjs`
- Modify: `tests/browser/inventory.mjs`

**Interfaces:**
- Consumes: completed shared workspace header and current `characterInventory(id)` / `characterInventoryUpdate(id)` behavior.
- Produces: normal Perks page with no duplicate identity block, concise intro, unchanged card grid/reconciliation semantics, and a fully verified redesign candidate.

- [ ] **Step 1: Add failing normal-Perks cleanup assertions**

In `tests/browser/character-inventory.mjs`, assert normal `#character/<id>/perks` has:

- the shared Character Workspace header exactly once;
- a simple `Perks` page heading/introduction;
- exactly one clear `Update Inventory` action;
- no duplicate page-level portrait/back-link/character title block;
- existing card-size control and perk grid unchanged.

Do not change existing Update candidate/tier/history assertions.

- [ ] **Step 2: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/character-inventory.mjs release/runtime`

Expected: FAIL only on new normal-page presentation assertions.

- [ ] **Step 3: Simplify the normal Perks intro**

Update `characterInventory(id)` to remove the duplicated identity/back-link content supplied by the shared header. Consolidate reconciliation helper copy, keep useful tracked/maxed/upgradable counts, one Update Inventory action, the card-size preference, and the existing perk card grid.

Do not alter `characterInventoryUpdate(id)` domain behavior; only remove any redundant full identity block if present under the shared workspace wrapper.

- [ ] **Step 4: Finish responsive CSS across the Character Workspace**

Verify/adjust scoped CSS so:

- 320px uses one usable inventory-card column;
- 500px uses one or two columns only when controls remain usable;
- wider widths add columns through container-driven sizing;
- Overview stacks in semantic order;
- workspace nav/header wraps cleanly;
- Details dialog stays inside viewport;
- no page-level horizontal overflow occurs.

- [ ] **Step 5: Run focused browser suites**

Run:

```bash
npm run release
node tests/browser/character-workspace.mjs release/runtime
node tests/browser/inventory.mjs release/runtime
node tests/browser/character-inventory.mjs release/runtime
node tests/browser/character-edit.mjs release/runtime
```

Expected: all PASS.

- [ ] **Step 6: Run full Node suite**

Run: `npm test`

Expected: PASS with zero failures.

- [ ] **Step 7: Run full staged browser/release verification**

Run: `npm run release`

Then, when installed and supported in the local environment:

```bash
npm run test:browser -- --chrome
```

Expected: Edge staged smoke PASS and Chrome smoke PASS, with no regression to writer locking, persistence, direct-file artifact generation, assets, or routes.

- [ ] **Step 8: Verify responsive widths with disposable state**

At 320, 500, 760, 1100, 1440, 1600, assert:

- `document.documentElement.scrollWidth <= innerWidth`;
- quantity field/button targets remain usable;
- active focus is visible;
- selected-family heading/toolbars wrap; the narrow family strip scrolls internally with visible selected/keyboard focus and no page-level overflow;
- Overview section order is correct on narrow layouts.

- [ ] **Step 9: Manual genuine-browser 200% zoom check**

Using disposable/synthetic state only, manually verify Overview, Perks, and Items & Add-ons at actual browser 200% zoom. Confirm no horizontal page trap, clipped focused controls, inaccessible Details dialog, or unusable quantity control. Record PASS/FAIL in the implementation progress/checkpoint, not in schema/save data.

- [ ] **Step 10: Commit**

```bash
git add src/app.js styles.css tests/browser/character-inventory.mjs tests/browser/character-workspace.mjs tests/browser/inventory.mjs dist/app.js
git commit -m "Finish Character Workspace visual redesign"
```

- [ ] **Step 11: Whole-branch review**

Review the complete diff against the approved spec. Confirm no changes to `src/model.js`, `src/storage.js`, `src/character-workspace.js` route semantics, `src/prestige-queue.js`, Dashboard behavior, schema version, save identity, or Killer inventory registry status.

---

## Self-review

### Spec coverage

- Shared header: Task 2.
- Overview dashboard composition: Task 2.
- Original family-first grouping/ordering: completed Tasks 1 and 3; selected-family navigation, scoped Search/filters and zero-stock visibility: Task 5A.
- Inventory card baseline: completed Tasks 3 and 4; canonical backgrounds: approved asset pass; enlarged art/simplified metadata: Task 5A.
- Details progressive disclosure and unresolved-record baseline: completed Tasks 3 and 4; preservation during selected-family navigation: Task 5A.
- Quantity semantics and completed stepper: Tasks 1 and 5; preservation during selected-family transitions: Task 5A.
- Perks limited refinement: Task 6.
- Accessibility/focus/error baseline: completed Tasks 2–5; selected-family transitions/strip accessibility: Task 5A; final acceptance: Task 6.
- Responsive targets and 200% zoom: Task 6.
- Data/model boundaries and non-goals: Global Constraints plus Task 6 whole-branch review.

No approved spec section is left without an owning task.

### Step scan

Each task follows a RED -> minimal implementation -> GREEN -> commit cycle. No step requires production data outside the verified Survivor catalog, and no task accesses the owner’s active save.

### Type/interface consistency

- `groupQuantityEntries(state, filters, families)` is defined in Task 1 and consumed in Task 3.
- `stepQuantityInput(state, id, delta)` is defined in Task 1 and consumed in Task 5.
- Shared header/Overview hooks were created in Task 2; Task 5A does not redesign them.
- Task 5A reuses groupQuantityEntries/stepQuantityInput and narrows focus candidates to selectedFamilyId without recreating raw interaction state.
- Existing quantity validation remains in `src/inventory-quantities.js`; the plan does not duplicate that authority.

### Review Focus coverage

All five revised Review Focus items have explicit preservation/refinement tests in Task 5A and final acceptance in Task 6. Tasks 1–5 remain completed historical evidence, not tasks to schedule again.

### Proportion

The plan fixes interfaces, test obligations, and task boundaries without transcribing renderer/CSS implementations. Production choices not pinned by the approved spec remain implementation details.
