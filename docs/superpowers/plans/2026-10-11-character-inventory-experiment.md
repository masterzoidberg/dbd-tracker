# Character Inventory Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reversible experimental character inventory and Update Inventory workflow without changing the existing manager, account libraries, save schema, or progression model.

**Architecture:** Put candidate/category/filter/tier-safety/session rules in a focused pure module. Add isolated `#experiment/<id>` and `#experiment/<id>/update` routes to the existing renderer, using the existing `commit()` persistence path and one shared perk-card renderer for both experimental views. Add CSS-only tier framing and targeted browser coverage while leaving legacy routes untouched.

**Tech Stack:** Vanilla ES modules bundled with esbuild, browser HTML/CSS, Node's built-in test runner, Playwright smoke tests.

**Spec:** `docs/superpowers/specs/2026-10-11-character-inventory-experiment-design.md`

## Global Constraints

- Do not change the save schema, migrations, or progression selectors.
- Do not change account-wide Killer Perks / Survivor Perks behavior.
- Do not delete or replace the existing `#manage/<character-id>` implementation.
- Do not add Detailed/Compact modes or advanced filters to the experiment.
- Do not edit or recolor source perk PNGs.
- All tier edits save immediately through the existing persistence and EditorGuard path.
- Session-only change markers must never be serialized.

## Review Focus

- Native-plus-General overlap must resolve to Personal once, especially the Cenobite's catalog data; pin with category precedence tests in Task 1.
- A tracked historical/manual copy must remain in All even when no current global unlock explains it; pin with retained-exception tests in Task 1.
- Automatic minimums must survive clearing a recorded tier and reject lower direct selections; pin with tier-safety tests in Task 1.
- Leaving an Update route must clear changed markers while ordinary persistence remains intact; pin with session lifecycle tests in Task 1 and browser coverage in Task 4.
- The existing manager and account library routes must keep their old controls; pin with browser route regression in Task 4.

### Task 1: Experimental domain selectors and session state

**Files:**
- Create: `src/character-inventory-experiment.js`
- Test: `tests/character-inventory-experiment.test.js`

**Interfaces:**
- Consumes: `characterById`, canonical `rolePerks`, `perkName`, `perkSearchText`, and existing model selectors (`inventoryTier`, `automaticTier`, `recordedTier`, `globalTier`, `correctPersonalPerkTier`, `setHistoricalPerkTier`).
- Produces: `EXPERIMENT_CATEGORIES`, `experimentalCandidateInfo(save, characterId, perk)`, `experimentalCandidatePool(save, characterId)`, `filterExperimentalCandidates(save, characterId, candidates, state)`, `experimentalNormalInventory(save, characterId)`, `setExperimentalPersonalTier(save, characterId, perkId, tier)`, `createExperimentSession(route)`, `syncExperimentSession(session, route)`, and `markExperimentChanged(session, perkId)`.

- [ ] **Step 1: Write failing tests** for the exact candidate union, canonical deduplication, Personal → General → Unlocked precedence, General/source-less perks, source prestige/global unlocks, Shrine/Legacy/manual provenance, tracked retained exceptions, `Only unrecorded`, alphabetical ordering, normal effective inventory, direct tier clearing with automatic floors, rejection below floors, historical downgrade preservation, and route-scoped transient changed state.
- [ ] **Step 2: Run the focused test file** with `node --test tests/character-inventory-experiment.test.js` and verify it fails because the module does not exist.
- [ ] **Step 3: Implement the pure module** using canonical `rolePerks(character.role)` as the source list. Category precedence must return `personal`, `general`, `unlocked`, or `retained`; retained-only items are included only in All. `setExperimentalPersonalTier` must allow `null` or tiers at/above `automaticTier`, while historical records continue through `setHistoricalPerkTier` in the UI layer.
- [ ] **Step 4: Re-run the focused tests** and verify all domain/session assertions pass.
- [ ] **Step 5: Run the existing Node suite** with `npm test` and verify the baseline suite remains green.

### Task 2: Isolated experimental routes and renderer

**Files:**
- Modify: `src/app.js` in route parsing, render dispatch, shared artwork/card helpers, click/change handling, and existing manager entry point.
- Test: extend `tests/character-inventory-experiment.test.js` only if a pure renderer-facing helper needs coverage.

**Interfaces:**
- Consumes: all Task 1 exports plus existing `commit()`, `perkName`, `perkSearchText`, `perkIconPath`, `assetManifest`, `characterById`, and historical model functions.
- Produces: working `#experiment/<character-id>` and `#experiment/<character-id>/update` routes, an entry link from the existing manager, normal effective inventory rendering, Update Inventory workspace, selected-perk editor, direct tier actions, and historical/manual correction handling.

- [ ] **Step 1: Add route/state tests or pure assertions first** for valid experimental route parsing, candidate counts from the supplied Doctor/Cenobite save, normal inventory filtering, and session marker reset behavior; run them and observe the expected failures.
- [ ] **Step 2: Add route dispatch and session lifecycle** without changing legacy route dispatch. Reset the experiment session when leaving the Update route or switching character; retain it across same-route saves.
- [ ] **Step 3: Add the normal experimental view** showing only `inventoryTier > 0`, tracked/maxed summary, reusable cards, and the prominent Update Inventory action. Add a temporary “Try experimental inventory” entry link to the existing manager.
- [ ] **Step 4: Add the Update workspace** with Search perks…, All/Personal/General/Unlocked tabs, Only unrecorded, candidate counts, deterministic alphabetical cards, selected card state, and the selected-perk detail panel.
- [ ] **Step 5: Wire direct tier actions** through existing `commit()`. Non-historical options must show effective tier, automatic minimum, and recorded tier; disable/reject below-floor choices and make Not recorded remove only the personal record. Historical/manual perks must retain confirmed/explicit-zero and no-downgrade semantics.
- [ ] **Step 6: Add transient changed markers** only after a successful persistence mutation, show the session count, and do not include session state in any save/export path.
- [ ] **Step 7: Run `npm run build`** and verify the bundle succeeds with both experimental routes available.

### Task 3: Experimental card and responsive visual treatment

**Files:**
- Modify: `styles.css`
- Modify: `src/app.js` only where card markup/artwork parameters need the shared component.

**Interfaces:**
- Consumes: Task 1 candidate info and Task 2 card markup/state classes.
- Produces: CSS tokens `--perk-tier-none`, `--perk-tier-1`, `--perk-tier-2`, `--perk-tier-3`, icon-first tilted-square cards, explicit Roman tier labels, provenance/unrecorded/changed states, selected-card treatment, side-panel layout, and responsive grid columns without a display-mode toggle.

- [ ] **Step 1: Add markup-level assertions** for card state classes/tier text/Changed this update labels and run them before CSS changes.
- [ ] **Step 2: Add the tier tokens and card styles** without using `perk_background2.png`; keep source artwork images untouched and use color plus explicit text.
- [ ] **Step 3: Add responsive grid/panel rules** for wide, narrow, and very narrow layouts using the existing breakpoints and no alternate renderer.
- [ ] **Step 4: Run `npm run build`** and verify no CSS or bundle errors.

### Task 4: Browser verification and final audit

**Files:**
- Create: `tests/browser/experimental.mjs`
- Modify: `tests/browser/smoke.mjs` to invoke the focused experimental regression.

**Interfaces:**
- Consumes: built runtime from Task 2/3 and existing browser test helpers.
- Produces: focused end-to-end checks for route entry, candidate scopes, search/unrecorded behavior, card selection/editor, direct tier persistence, automatic floor protection, transient markers, responsive layout, and unchanged legacy/account library controls.

- [ ] **Step 1: Write the focused browser regression** against a disposable browser profile and a fixture save seeded through localStorage; run it and verify it fails before the experimental routes exist.
- [ ] **Step 2: Implement only the browser harness wiring** needed to call the regression from the existing smoke path.
- [ ] **Step 3: Run `npm test`** and verify the complete Node suite passes.
- [ ] **Step 4: Run `npm run build`** and `npm run test:browser`; verify no page errors, failed requests, or regression failures.
- [ ] **Step 5: Run the Doctor/Cenobite candidate audit against the supplied data** and record exact counts, multiple-provenance perks, surprising inclusions/omissions, historical exceptions, and the final recommendation.
