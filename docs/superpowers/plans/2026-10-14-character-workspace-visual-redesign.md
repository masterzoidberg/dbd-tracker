# Character Workspace Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Character Workspace visual redesign so Overview, Perks, and Survivor Items & Add-ons share one polished workspace language while preserving all existing schema-v2, routing, persistence, and inventory-editing semantics.

**Architecture:** Keep the current static/browser architecture and route model. Add one pure family-grouping selector to the inventory interaction layer, then reshape only the Character Workspace renderers and scoped CSS in `src/app.js` and `styles.css`; use the existing bounded dialog and writer/persistence paths rather than introducing a new subsystem. Preserve the Perks domain and card grid, and treat family collapse/filter state as session-only presentation state.

**Tech Stack:** Vanilla JavaScript ES modules, HTML templates in `src/app.js`, CSS, Node.js `node:test`, Playwright Core browser regressions, esbuild release bundle.

**Spec:** `docs/superpowers/specs/2026-10-14-character-workspace-visual-redesign-design.md`

## Global Constraints

- Schema remains v2. No schema v3, migration, save-identity, localStorage-key, JSON import/export, backup, or recovery changes.
- Do not change canonical or compatibility routes.
- Do not change Prestige Queue or Dashboard behavior.
- Do not start P3.5 or invent Killer Power/Add-on production data.
- Do not change perk candidate, effective-owned, automatic-minimum, historical, tier, or reconciliation semantics.
- Preserve direct raw quantity typing, non-negative safe-integer validation, sparse positive persistence, zero canonicalization, Enter/blur detail-page commit, failed raw-text retention, stable editing order, Edit Character draft-only behavior, and unresolved imported IDs.
- Families render in verified catalog order. Inside each family render Items before Add-ons, then positive stock before zero stock, then canonical order inside each stock group.
- Zero-stock entries remain visible and editable by default and keep the same card geometry as positive stock.
- Inventory rarity is always text-labeled and uses inventory-specific styling distinct from perk tier styling.
- The owner’s active save must never be accessed. Use `freshSave()` or synthetic fixtures only.
- Required layout widths: 320, 500, 760, 1100, 1440, 1600. No page-level horizontal overflow.
- Genuine browser 200% zoom must be manually rechecked after implementation.
- No sticky inventory toolbar in this implementation.

## Review Focus

1. **Invalid raw quantity while In Stock is enabled:** the edited card remains visible, raw text survives, and no save occurs until valid input is committed. Covered in Task 1 pure tests and Task 5 browser tests.
2. **Zero commit while In Stock is enabled:** the card may disappear only after a successful commit, and focus moves to a deterministic visible destination rather than the document body. Covered in Task 5 browser tests.
3. **Search temporarily revealing a user-collapsed family:** search may force the matching family open, but clearing search restores the user’s collapse choice. Covered in Task 3 browser tests.
4. **Details dialog opener removed by filtering/navigation:** closing restores to the originating button when present, otherwise a deterministic page-level control. Covered in Task 4 browser tests.
5. **Long names, narrow widths, and 200% zoom:** controls wrap without horizontal overflow, quantity remains usable, and focus stays visible. Covered in Task 6 responsive/release verification plus owner manual zoom acceptance.

---

## File map

- `src/inventory-interaction.js` — add pure family-local grouping and quantity-step helpers while preserving existing raw/pending/error interaction state.
- `src/app.js` — shared character header, Overview composition, family-first stock renderer, collapse/filter UI state, Details action, quantity stepper wiring, Perks intro cleanup.
- `styles.css` — Character Workspace-only visual system, rarity tokens, family sections, inventory cards, Overview layout, responsive rules.
- `tests/inventory-interaction.test.js` — pure ordering/grouping/stepper state coverage.
- `tests/browser/character-workspace.mjs` — shared header and Overview behavior.
- `tests/browser/inventory.mjs` — family sections, filters, collapse, rarity, quantity, Details, focus, unresolved imports, responsive behavior.
- `tests/browser/character-inventory.mjs` — normal Perks intro/header regression only; existing reconciliation assertions stay intact.
- Existing model, storage, route, queue, catalog, and quantity-validation modules remain semantically unchanged.

---

### Task 1: Family-local inventory presentation selector

**Files:**
- Modify: `src/inventory-interaction.js`
- Modify: `tests/inventory-interaction.test.js`

**Interfaces:**
- Consumes: existing `createQuantityInteraction(state)`, `visibleQuantityEntries(state, filters)`, entity fields `familyId`, `map`, `order`, and verified family objects `{ id, displayName, ... }`.
- Produces: `groupQuantityEntries(state, filters, families)` returning `Array<{ family, items, addons }>` in family source order; `stepQuantityInput(state, id, delta)` returning `{ state, quantity, error }` without mutating the caller.

- [ ] **Step 1: Write failing family-grouping tests**

Add tests that assert:

```js
const families = [{id:'key',displayName:'Keys'},{id:'map',displayName:'Maps'}];
const grouped = groupQuantityEntries(state, {}, families);
assert.deepEqual(grouped.map(group => group.family.id), ['key','map']);
assert.deepEqual(grouped[0].items.map(entity => entity.id), ['key-positive','key-zero']);
assert.deepEqual(grouped[0].addons.map(entity => entity.id), ['key-addon-positive','key-addon-zero']);
```

Also assert pending/invalid entries still survive `{ inStock:true }`, grouping does not reorder a pending raw edit, and unresolved/non-catalog entities cannot appear because the helper only receives resolved `state.entities`.

- [ ] **Step 2: Run the focused unit test and confirm RED**

Run: `node --test tests/inventory-interaction.test.js`

Expected: FAIL because `groupQuantityEntries` is not exported yet.

- [ ] **Step 3: Implement `groupQuantityEntries(state, filters, families)`**

In `src/inventory-interaction.js`, build from `visibleQuantityEntries(state, filters)`, preserve family source order, split each family into `items` and `addons`, and preserve the interaction snapshot order inside each subsection. Do not move grouping into storage/model code.

- [ ] **Step 4: Write failing quantity-step helper tests**

Test exact behavior:

```js
assert.equal(stepQuantityInput(state,'a',1).quantity, 1);
assert.equal(stepQuantityInput(stateAtZero,'a',-1).quantity, 0);
assert.equal(stepQuantityInput(stateAtMax,'a',1).quantity, Number.MAX_SAFE_INTEGER);
assert.ok(stepQuantityInput(invalidRawState,'a',1).error);
assert.equal(stepQuantityInput(invalidRawState,'a',1).state.raw.a, 'bad');
```

The helper must never coerce invalid raw text and must clamp only at the legal zero/MAX_SAFE_INTEGER boundaries.

- [ ] **Step 5: Run focused test and confirm RED**

Run: `node --test tests/inventory-interaction.test.js`

Expected: FAIL because `stepQuantityInput` is not exported yet.

- [ ] **Step 6: Implement `stepQuantityInput(state, id, delta)`**

Use the existing parse/accept path so button stepping and typed input share validation semantics. Return a cloned state with updated raw/pending data and a validated numeric quantity; on invalid raw input, preserve the raw text and return an error.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run: `node --test tests/inventory-interaction.test.js`

Expected: all inventory-interaction tests PASS.

- [ ] **Step 8: Run all Node tests**

Run: `npm test`

Expected: PASS with zero failures.

- [ ] **Step 9: Commit**

```bash
git add src/inventory-interaction.js tests/inventory-interaction.test.js
git commit -m "Add family-local inventory presentation helpers"
```

---

### Task 2: Shared Character Workspace header and Overview composition

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/character-workspace.mjs`

**Interfaces:**
- Consumes: `characterWorkspaceHref()`, `characterArtwork()`, `perkArtwork()`, existing save/character stats selectors.
- Produces: one shared `characterWorkspaceHeader(character, descriptor)` identity/header used by normal Overview, Perks, and Inventory sections; Overview sections with stable data attributes for browser tests.

- [ ] **Step 1: Add failing browser assertions for the shared header**

In `tests/browser/character-workspace.mjs`, assert the Overview route exposes:

- exactly one workspace `h1` with the character name;
- visible role, Owned/Not owned, Favorite state;
- separate labeled Prestige and Bloodweb values;
- one `Edit Character` link to `#character/<id>/edit`;
- one workspace nav with `aria-current="page"` on Overview;
- no duplicate portrait/name/back-link block inside the Overview body.

Add a narrow-width assertion at 320px that the header has no horizontal page overflow and the Edit Character control remains at least 44px tall.

- [ ] **Step 2: Add failing Overview composition assertions**

Assert the body has explicit sections for:

- Native Perks with artwork and nearby tier/provenance;
- Progress/setup context;
- Perks summary;
- Items & Add-ons or Power & Add-ons summary;
- Notes.

For a Survivor with empty sparse stock maps, assert the summary says `No quantities recorded yet.` rather than `No stock`. For the synthetic unresolved ID already used by the test, assert unresolved stock is called out separately. For Killer Overview, preserve truthful unavailable Power/Add-ons messaging.

- [ ] **Step 3: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/character-workspace.mjs release/runtime`

Expected: FAIL on new header/Overview structure assertions.

- [ ] **Step 4: Implement the shared header in `src/app.js`**

Update `characterWorkspaceHeader(character, descriptor)` so it renders, in DOM order: breadcrumb, identity/portrait/name/role/statuses, labeled Prestige/Bloodweb values, Edit Character action, workspace nav. Owned/Favorite remain display-only in this header.

- [ ] **Step 5: Recompose `characterOverview(id)`**

Replace the stack of equally heavy panels with semantic sections matching the spec. Use existing native perk artwork/tier/provenance data and existing `characterStats()` values only. Do not add completion percentages or new metrics.

Add stable section hooks such as:

- `[data-overview-section="native-perks"]`
- `[data-overview-section="progress"]`
- `[data-overview-section="perks"]`
- `[data-overview-section="inventory"]`
- `[data-overview-section="notes"]`

- [ ] **Step 6: Add scoped CSS for shared header and Overview**

Keep existing Ledger tokens. Add only Character Workspace-scoped layout/status/progress/Overview rules. Use two columns where useful at desktop widths and logical single-column stacking at narrow widths.

- [ ] **Step 7: Rebuild and confirm browser GREEN**

Run: `npm run release`

Then run: `node tests/browser/character-workspace.mjs release/runtime`

Expected: PASS.

- [ ] **Step 8: Run all Node tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app.js styles.css tests/browser/character-workspace.mjs
git commit -m "Redesign Character Workspace header and overview"
```

---

### Task 3: Family-first Survivor inventory page and compact filters

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/inventory.mjs`

**Interfaces:**
- Consumes: `groupQuantityEntries(stockSession, stockFilters, survivorInventorySource.itemFamilies)` from Task 1; existing `inventoryEntities`, `survivorInventorySource`, `inventoryEntityById`.
- Produces: family section UI, session-only collapse state, visible Search/In Stock controls, compact Type/Rarity disclosure, optional Jump-to-family if implementation remains simple.

- [ ] **Step 1: Add failing browser assertions for family architecture**

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

- [ ] **Step 2: Add failing toolbar/filter assertions**

Assert Search and In Stock are immediately visible. Assert Type and Rarity are inside a compact Filters disclosure and the trigger reflects the active secondary-filter count. The old always-visible family dropdown is absent from the normal redesigned page.

- [ ] **Step 3: Add failing collapse/search-state assertions**

Assert:

1. families begin expanded;
2. individual family toggle uses `aria-expanded`;
3. Collapse all and Expand all work;
4. user-collapsed family + matching search is temporarily revealed;
5. clearing search restores the user's prior collapsed state;
6. collapse/search state is not written into `dbdTrackerData`.

- [ ] **Step 4: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: FAIL on family/filter/collapse assertions.

- [ ] **Step 5: Implement session-only family state in `src/app.js`**

Add presentation state separate from `save`, with explicit sets for user-collapsed and temporarily forced-open family IDs. Reset appropriately when entering a different stock-session key, but never persist into JSON.

- [ ] **Step 6: Replace flat `stockView()` rendering with family sections**

Render `groupQuantityEntries(...)` output in verified family order. Items always precede Add-ons. Preserve current quantity inputs, pending/error status regions, image fallback, and unresolved-record source collection.

- [ ] **Step 7: Implement toolbar and filter disclosure**

Keep `#inventory-search` and `#inventory-in-stock` directly visible. Replace the old always-visible map/family/rarity strip with a Filters disclosure containing Type and Rarity. Preserve existing search semantics across name/effect text and existing In Stock pending/error visibility.

- [ ] **Step 8: Implement family collapse actions**

Use native buttons with `aria-expanded`. Add `Collapse all` and `Expand all` actions. Search, error focus, and explicit family navigation may force a family open without rewriting user collapse intent.

- [ ] **Step 9: Add family/card CSS**

Add scoped family headings, subsection rhythm, responsive `auto-fit/minmax` card grids around a 220px practical minimum, larger artwork media areas, and quieter zero-stock treatment with identical geometry.

- [ ] **Step 10: Rebuild and confirm browser GREEN**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: family/filter/collapse assertions PASS while existing save/edit assertions remain PASS.

- [ ] **Step 11: Run all Node tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/app.js styles.css tests/browser/inventory.mjs
git commit -m "Group Survivor inventory by item family"
```

---

### Task 4: Inventory rarity and bounded Details dialog

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/inventory.mjs`

**Interfaces:**
- Consumes: current inventory entity fields `rarity`, `familyId`, `effect`, `compatibleItemIds`, `needsVerification`, `notes`, `provenance.references`; existing bounded `#detail` dialog infrastructure.
- Produces: inventory-specific rarity badge/accent classes and `stock-details` action that opens a read-only bounded dialog and restores focus.

- [ ] **Step 1: Add failing rarity assertions**

Assert representative cards render visible rarity text and inventory-specific rarity classes/tokens. Assert Event remains Event for known qualified Banquet entries and that no alternate underlying rarity changes card display/filter membership.

- [ ] **Step 2: Add failing Details-dialog assertions**

For an Item and an Add-on, assert the card has one explicit `Details` button and no persistent `Reference and compatibility` disclosure. Opening Details must show only supported catalog metadata: name/artwork, displayed rarity, family, effect, exact compatible Item names when applicable, qualification note if present, and provenance links.

- [ ] **Step 3: Add writer-independent and focus-restoration assertions**

Open a read-only second page/window and assert Details still opens while quantity editing remains disabled. Assert closing the dialog restores focus to the exact Details opener. Then hide/remove the originating card with a filter and assert close restoration falls back to `#inventory-search` or another deterministic page-level control.

- [ ] **Step 4: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: FAIL on Details/rareness structure assertions.

- [ ] **Step 5: Implement inventory rarity presentation**

Add a helper/class mapping in `src/app.js` limited to verified rarity values and inventory-specific CSS tokens in `styles.css`. Always render rarity text. Never reuse perk tier classes.

- [ ] **Step 6: Implement `stock-details` using the existing bounded dialog**

Store the opener, render verified metadata only, and preserve current modal close/Escape conventions. Do not move quantity editing into the dialog and do not require writer access.

- [ ] **Step 7: Remove card-level reference disclosure**

Replace repeated persistent reference/compatibility blocks with the Details action. Update any focus-destination lists that previously referenced disclosure summaries/source links so quantity blur behavior remains deterministic.

- [ ] **Step 8: Rebuild and confirm browser GREEN**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app.js styles.css tests/browser/inventory.mjs
git commit -m "Add inventory rarity and details dialog"
```

---

### Task 5: Quantity stepper, error reveal, and focus-safe regrouping

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/browser/inventory.mjs`

**Interfaces:**
- Consumes: `stepQuantityInput()` and existing `stockInput`/commit/regroup/focus helpers.
- Produces: optional-in-spec but implemented `[-] [raw text field] [+]` quantity control using the same validation/commit semantics as direct typing.

- [ ] **Step 1: Add failing stepper browser assertions**

Assert every resolved editable card has:

- decrement button accessible name `Decrease quantity of <name>`;
- existing direct text input accessible as `Quantity of <name>`;
- increment button accessible name `Increase quantity of <name>`;
- practical 44px button/input targets.

Assert decrement is disabled at zero and increment is disabled at `Number.MAX_SAFE_INTEGER`.

- [ ] **Step 2: Add failing invalid-raw and single-commit assertions**

Set raw input to `bad`, press +/- and assert raw text stays `bad`, storage bytes do not change, and the error remains visible. For a valid value, activate +/- and assert exactly one persisted change occurs with no second timestamp/write caused by blur.

- [ ] **Step 3: Add failing regroup/focus assertions**

Cover both transitions:

- zero -> positive moves the card into the positive group only after successful commit and restores focus deterministically;
- positive -> zero under In Stock may hide the card after commit, but focus lands on the next visible target or `#inventory-search`.

Also assert an error-summary action expands a collapsed family, preserves invalid raw text, and focuses the bad quantity field.

- [ ] **Step 4: Build staged runtime and confirm browser RED**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: FAIL on stepper/focus assertions.

- [ ] **Step 5: Implement stepper rendering and button actions**

Render the three-part control inside each resolved editable card. Use `stepQuantityInput()` and the existing commit path; explicitly guard blur/button sequencing so a click cannot cause two commits. Invalid raw input disables/blocks stepping without normalization.

- [ ] **Step 6: Update focus destination logic around family sections**

Before restoring focus to a quantity field, expand its family if it is user-collapsed/temporarily hidden. After a commit that removes the current card under active filters, use the existing deterministic next/previous/search fallback contract.

- [ ] **Step 7: Update error-summary reveal behavior**

When focusing a stock error, clear only the minimum filters required by the existing contract, force the containing family open, render, then focus the field without altering raw text.

- [ ] **Step 8: Rebuild and confirm browser GREEN**

Run: `npm run release`

Then run: `node tests/browser/inventory.mjs release/runtime`

Expected: PASS including all pre-existing draft, writer-lock, save-failure, unresolved-ID, and image-fallback assertions.

- [ ] **Step 9: Run all Node tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/app.js styles.css tests/browser/inventory.mjs
git commit -m "Add focus-safe inventory quantity steppers"
```

---

### Task 6: Perks-page cleanup, full responsive regression, and release acceptance candidate

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
- family headings/toolbars wrap rather than overflow;
- Overview section order is correct on narrow layouts.

- [ ] **Step 9: Manual genuine-browser 200% zoom check**

Using disposable/synthetic state only, manually verify Overview, Perks, and Items & Add-ons at actual browser 200% zoom. Confirm no horizontal page trap, clipped focused controls, inaccessible Details dialog, or unusable quantity control. Record PASS/FAIL in the implementation progress/checkpoint, not in schema/save data.

- [ ] **Step 10: Commit**

```bash
git add src/app.js styles.css tests/browser/character-inventory.mjs tests/browser/character-workspace.mjs tests/browser/inventory.mjs
git commit -m "Finish Character Workspace visual redesign"
```

- [ ] **Step 11: Whole-branch review**

Review the complete diff against the approved spec. Confirm no changes to `src/model.js`, `src/storage.js`, `src/character-workspace.js` route semantics, `src/prestige-queue.js`, Dashboard behavior, schema version, save identity, or Killer inventory registry status.

---

## Self-review

### Spec coverage

- Shared header: Task 2.
- Overview dashboard composition: Task 2.
- Family-first inventory, family-local ordering, collapse/search behavior, filters, zero-stock visibility: Tasks 1 and 3.
- Inventory card imagery/rhythm/rarity: Tasks 3 and 4.
- Details progressive disclosure and unresolved-record separation: Tasks 3 and 4.
- Quantity semantics and optional preferred stepper: Tasks 1 and 5.
- Perks limited refinement: Task 6.
- Accessibility/focus/error behavior: Tasks 2 through 6.
- Responsive targets and 200% zoom: Task 6.
- Data/model boundaries and non-goals: Global Constraints plus Task 6 whole-branch review.

No approved spec section is left without an owning task.

### Step scan

Each task follows a RED -> minimal implementation -> GREEN -> commit cycle. No step requires production data outside the verified Survivor catalog, and no task accesses the owner’s active save.

### Type/interface consistency

- `groupQuantityEntries(state, filters, families)` is defined in Task 1 and consumed in Task 3.
- `stepQuantityInput(state, id, delta)` is defined in Task 1 and consumed in Task 5.
- Shared header/Overview hooks are created in Task 2 and only asserted/refined later.
- Existing quantity validation remains in `src/inventory-quantities.js`; the plan does not duplicate that authority.

### Review Focus coverage

All five Review Focus items have explicit owning browser or pure tests in Tasks 1, 3, 4, 5, and 6.

### Proportion

The plan fixes interfaces, test obligations, and task boundaries without transcribing renderer/CSS implementations. Production choices not pinned by the approved spec remain implementation details.