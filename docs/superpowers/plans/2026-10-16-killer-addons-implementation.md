# Killer Add-ons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verified per-Killer Add-on inventory tracking to the reserved Power & Add-ons Character Workspace route.

**Architecture:** Keep the new versioned Add-on master JSON as the sole research source. A deterministic generator validates it and the existing Power research file, then writes a compact generated runtime catalog; `data/inventory-catalog.js` merges normalized Killer entities with the existing Survivor entities. Persist quantities in the current schema-v2 per-character `inventory.addons` maps, reuse the stock quantity interaction, and extend the existing manifest/release pipeline for explicit curated images.

**Tech Stack:** Vanilla JavaScript ES modules, JSON modules, Node `node:test`, esbuild, Playwright Core, static offline release.

**Spec:** `docs/superpowers/specs/2026-10-16-killer-addons-design.md`

## Global Constraints

- Keep save schema v2 unless implementation proves a structural incompatibility; none is currently known.
- Store Killer quantities only in per-character `inventory.addons`; missing/zero means unowned, and only positive safe integers persist.
- Preserve unknown correctly namespaced IDs; reject resolved wrong-role and wrong-Killer IDs.
- Every Add-on record has an explicit canonical `characterId`; never infer ownership from names, Power records, folders, or image filenames.
- Do not modify `data/dbd-killer-power-master-44-FINAL-verified-10.2.1.json` or use the old 720-Add-on corpus as the live catalog.
- Keep research/provenance out of the compact runtime catalog; do not hand-edit generated files or `dist/app.js`.
- Do not change Survivor inventory semantics, schema-v1 migration, storage/recovery, character IDs, or import-replace behavior.
- Do not add builds, favorites, recommendations, synergy, calculators, a global encyclopedia, or hard Power-mechanic links.

## Prerequisite

Before Task 1, the new verified live Add-on dataset must be available for the target patch. Create the provisional `data/dbd-killer-addons-live-10.2.1.json` only from that verified dataset, with its independently audited expected record count. If the source is unavailable or still incomplete, stop before implementation; do not substitute the old 720-entry corpus. The plan does not invent a live Add-on count.

## Review Focus

- A formerly unknown `killer-addon-*` ID becomes catalog-known on the wrong Killer: test that it fails explicitly without moving or dropping the original record.
- A pre-feature schema-v2 save has empty maps and existing Survivor quantities: test exact compatibility and no save rewrite caused only by catalog availability.
- Add-on IDs, aliases, owners, rarity, and Power mapping are malformed or ambiguous: pin each invalid source case to a catalog-generator test.
- An artwork path is missing, unsafe, or has changed bytes: test explicit fallback behavior, hash rejection, and release-stage exclusion.
- A direct-file runtime could accidentally depend on fetched source JSON: assert the bundle has no catalog fetch and staged local references include all Add-on images.

---

### Task 1: Verified source and compact runtime catalog

**Files:**

- Create: `data/dbd-killer-addons-live-10.2.1.json` from the forthcoming verified live source.
- Create: `data/killer-runtime-catalog.json` as deterministic generated runtime input, containing normalized Add-ons and compact Power summaries only.
- Create: `scripts/generate-killer-runtime-catalog.mjs`.
- Modify: `data/inventory-catalog.js`.
- Modify: `scripts/build.mjs`.
- Test: `tests/inventory-catalog.test.js`.
- Test: `tests/asset-build.test.js`.

**Interfaces:**

- `generateKillerRuntimeCatalog({ addonSource, powerSource, characters, powerRecordByCharacterId })` returns `{ addons, powersByCharacterId }`.
- `writeKillerRuntimeCatalog(root)` reads the two canonical source files, validates them, and writes stable-key-ordered `data/killer-runtime-catalog.json`.
- `adaptKillerAddonCatalog(source, characters)` returns normalized entities with `id`, `kind`, `role`, `map`, `characterId`, `name`, `rarity`, `order`, `aliases`, `description`, optional descriptive `powerEffects`, `imagePath`, and `imageSha256`.
- A reviewed explicit `characterId -> Power source record key` mapping produces `powersByCharacterId[characterId] = { characterId, powerName, shortSummary }`; all 44 records must map one-to-one and have `researchStatus === 'VERIFIED'`.
- `data/inventory-catalog.js` continues exporting `inventoryEntities` and `inventoryEntityById`, appends generated Killer entities, exports `killerPowerByCharacterId`, and changes Killer catalog status to ready only after generation/validation.

- [ ] **Step 1: Add failing catalog-generator tests**

  In `tests/inventory-catalog.test.js`, add tests named:
  - `Killer Add-on adapter requires explicit canonical owners and stable killer-addon IDs`
  - `Killer Add-on adapter rejects duplicate IDs, ambiguous aliases, invalid rarity, and wrong-role owners`
  - `Power summary projection maps all 44 verified Power records exactly once`
  - `generated Killer runtime catalog omits research-only source fields`
  - `runtime catalog generation is deterministic`

  Assert valid fixtures preserve explicit `characterId`; aliases cannot resolve to multiple records; invalid/unknown owner, bad rarity, duplicate ID, unverified record, missing Power mapping, duplicate Power mapping, and wrong Power status throw. Assert runtime records do not expose sources, verification notes, recent changes, provenance, or archive metadata.

  Update the `tests/asset-build.test.js` fixture to include a minimal verified Add-on source and 44 minimal Power rows keyed by the exported explicit mapping, so `buildProject(root)` proves it generates the compact catalog before bundling.

- [ ] **Step 2: Run the focused catalog tests and observe RED**

  Run: `node --test tests/inventory-catalog.test.js`

  Expected: FAIL because the Killer adapter/generator and runtime exports do not exist yet. Do not weaken the existing Survivor adapter assertions.

- [ ] **Step 3: Add the source schema and generator**

  Add the supplied verified rows to `data/dbd-killer-addons-live-10.2.1.json`. Include a fixed audited `expectedCount`, patch/date/provenance, stable explicit `id`, explicit `characterId`, name, valid rarity, verified description, optional aliases and descriptive `powerEffects`, per-row verification/source metadata, and explicit artwork mapping or fallback reason.

  Implement `adaptKillerAddonCatalog`, `generateKillerRuntimeCatalog`, and `writeKillerRuntimeCatalog` in `scripts/generate-killer-runtime-catalog.mjs`. Validate the record count, namespaced unique IDs, unique aliases, the canonical character’s Killer role, rarity allowlist, verified status, and artwork metadata. Project only fields in the Interfaces block into the generated file.

  Add the explicit 44-entry Power source mapping and project only Power name/summary. Do not edit or bundle the Power master JSON. Make `data/inventory-catalog.js` import the generated compact file and combine it with the unchanged Survivor adapter.

  In `scripts/build.mjs`, call `writeKillerRuntimeCatalog(root)` before loading `scripts/generate-assets.mjs` and before esbuild bundles `src/app.js`. Load the asset generator after generation so it reads the current generated entity registry.

- [ ] **Step 4: Verify catalog tests and generated output**

  Run: `node scripts/generate-killer-runtime-catalog.mjs`

  Expected: `data/killer-runtime-catalog.json` is rewritten deterministically from the canonical sources.

  Run: `node --test tests/inventory-catalog.test.js tests/asset-build.test.js`

  Expected: PASS; generated output is repeatable, all actual source rows match the literal audited `expectedCount`, all 44 Power records are mapped, and runtime output excludes research-only fields.

- [ ] **Step 5: Commit the catalog boundary**

  ```bash
  git add data/dbd-killer-addons-live-10.2.1.json data/killer-runtime-catalog.json data/inventory-catalog.js scripts/generate-killer-runtime-catalog.mjs scripts/build.mjs tests/inventory-catalog.test.js tests/asset-build.test.js
  git commit -m "Add verified Killer Add-on runtime catalog"
  ```

### Task 2: Schema-v2 quantity compatibility

**Files:**

- Modify: `tests/inventory-quantities.test.js`.
- Modify: `tests/model.test.js`.
- Modify: `tests/storage.test.js`.
- Do not change by default: `src/inventory-quantities.js`, `src/model.js`, `src/storage.js`.

**Interfaces:**

- Continue using `canonicalizeQuantityMaps(inventory, characterId, inventoryEntityById)`, `validateCompleteV2`, `parseSave`, `exportSave`, and `TrackerStorage.replace` unchanged.
- Killer Add-on quantity input uses `inventory.addons[entity.id]` on the record’s explicit owner.

- [ ] **Step 1: Add failing persistence and ownership regressions**

  In `tests/inventory-quantities.test.js`, add:
  - `known Killer Add-on quantities validate only for their explicit owner`
  - `unknown killer-addon IDs survive canonicalization and export round trip`
  - `zero Killer Add-on quantities are omitted and malformed quantities reject`

  In `tests/model.test.js`, add:
  - `pre-feature schema v2 saves load with zero Killer stock and preserve Survivor maps`
  - `Killer Add-on import/export round trip preserves quantities without schema change`

  In `tests/storage.test.js`, add:
  - `Killer Add-on quantities survive replacement, backup, and restore`

  Use `freshSave()` and synthetic IDs/quantities only. Verify the same resolved Add-on fails on a different Killer, unresolved correctly-namespaced IDs remain in their original character map, zero disappears, and schemaVersion remains 2.

- [ ] **Step 2: Run the focused save tests and observe RED**

  Run: `node --test tests/inventory-quantities.test.js tests/model.test.js tests/storage.test.js`

  Expected: the old “Killer unavailable” count/status assertions fail after catalog activation, and new coverage is absent. Existing schema-v1 migration assertions must continue passing.

- [ ] **Step 3: Update regression expectations without changing save semantics**

  Update old catalog-count/status expectations to include the verified Killer catalog. Keep production quantity, model, and storage code unchanged unless a new test demonstrates a concrete gap in the already-present Killer namespace/owner behavior. If a gap exists, make the smallest change in `src/inventory-quantities.js` and add its failing case before that change.

- [ ] **Step 4: Run focused persistence tests**

  Run: `node --test tests/inventory-quantities.test.js tests/model.test.js tests/storage.test.js`

  Expected: PASS; pre-feature v2 saves retain their shape and Survivor maps, unknown IDs survive, owner mismatches reject, and import/export/backup/restore retain Killer quantities.

- [ ] **Step 5: Commit schema compatibility coverage**

  ```bash
  git add tests/inventory-quantities.test.js tests/model.test.js tests/storage.test.js src/inventory-quantities.js
  git commit -m "Verify Killer Add-on schema v2 compatibility"
  ```

### Task 3: Curated artwork and release staging

**Files:**

- Create: curated byte-identical PNG copies under `images/killer-addons/{characterId}/{semanticSlug}.png`.
- Modify: `data/dbd-killer-addons-live-10.2.1.json` with explicit original source path, curated path, and SHA-256, or explicit fallback reason.
- Regenerate: `data/asset-manifest.json` and `dist/app.js` through `npm run build`.
- Modify: `scripts/generate-assets.mjs` (`assertInventoryAssetPath`, `generateAssetManifest`, `writeAssetManifest`).
- Modify: `scripts/release.mjs` (`runtimeFiles`, `verifyStage`, `artworkFileCheck`).
- Modify: `tests/inventory-assets.test.js`, `tests/asset-build.test.js`, and `tests/release.test.js`.
- Modify: `tests/browser/artwork.mjs`.

**Interfaces:**

- Keep `inventoryIconPath(id, manifest)` in `src/assets.js` unchanged; it continues returning the manifest path or null fallback.
- Curated Killer image paths are accepted only by the explicit inventory asset allowlist and are looked up by canonical entity ID.

- [ ] **Step 1: Add failing asset and release tests**

  In `tests/inventory-assets.test.js`, assert that every Add-on’s explicit mapping resolves to the referenced bytes/hash, missing art is null only with an intentional fallback, and modified bytes do not bind.

  In `tests/release.test.js`, assert that staging contains each mapped Killer image, excludes unreferenced files from `images/updated-images/Powers and Add-ons/`, rejects unsafe paths/hash mismatches, reports all staged inventory images in the offline artwork check, and checks the verified Add-on patch/count metadata.

  In `tests/browser/artwork.mjs`, assert that mapped Killer images decode in the staged runtime and null fallbacks render the existing accessible fallback.

- [ ] **Step 2: Run focused asset/release tests and observe RED**

  Run: `node --test tests/inventory-assets.test.js tests/asset-build.test.js tests/release.test.js`

  Expected: FAIL because the Killer path is outside the current Survivor-only allowlist and the offline artwork check omits inventory images.

- [ ] **Step 3: Curate explicit images and extend the current pipeline**

  Copy selected PNG bytes from `images/updated-images/Powers and Add-ons/` into `images/killer-addons/{characterId}/{semanticSlug}.png`; do not rename or modify the raw originals. Populate source `sourcePath`, curated path, and SHA-256 for each mapped entity.

  Extend `assertInventoryAssetPath` and `generateAssetManifest` for the dedicated Killer path. Retain symlink, path, PNG, hash, and fallback checks. Extend `artworkFileCheck` to list `manifest.inventory` entries and intentional inventory fallbacks. Keep `runtimeFiles` and `verifyStage` limited to exact manifest references, verifying dimensions and hashes.

- [ ] **Step 4: Run focused asset/release tests**

  Run: `node --test tests/inventory-assets.test.js tests/asset-build.test.js tests/release.test.js`

  Expected: PASS; only mapped images stage, hashes match, all fallbacks are declared, and the offline check covers Killer inventory art.

  Run: `npm run build`

  Expected: PASS; regenerated manifest contains the curated Killer paths and the bundle remains self-contained.

- [ ] **Step 5: Commit artwork pipeline**

  ```bash
  git add data/dbd-killer-addons-live-10.2.1.json images/killer-addons data/asset-manifest.json dist/app.js scripts/generate-assets.mjs scripts/release.mjs tests/inventory-assets.test.js tests/asset-build.test.js tests/release.test.js tests/browser/artwork.mjs
  git commit -m "Integrate curated Killer Add-on artwork"
  ```

### Task 4: Killer Power & Add-ons workspace

**Files:**

- Modify: `src/app.js` (`characterOverview`, `characterWorkspaceView`, `stockFocusOrder`, `stockInput`, `stepStock`, `acceptStock`, `inventoryDetail`).
- Modify: `src/inventory-interaction.js` (`visibleQuantityEntries`) only to include Killer `description`/aliases in the shared search text.
- Modify: `styles.css` for the Power summary and any Killer-specific card layout needed.
- Modify: `tests/character-workspace.test.js`.
- Create: `tests/browser/killer-addons.mjs`.
- Create: `tests/browser/killer-addons-runner.mjs` for focused pre-release browser feedback against the built source checkout.
- Modify: `tests/browser/smoke.mjs` and `tests/browser/character-workspace.mjs`.
- Regenerate: `dist/app.js` through `npm run build`.
- Modify: `tests/inventory-quantities.test.js` only if a focused interaction-helper case is required.
- Do not change: `src/character-workspace.js` unless route tests expose a defect; `power-addons` is already reserved and role-checked.

**Interfaces:**

- Add app renderer `killerAddonsView(characterId)`; it reads only entities with `role === 'killer'`, `map === 'addons'`, and matching `characterId`.
- Reuse `createQuantityInteraction`, `visibleQuantityEntries`, `updateQuantityInput`, `stepQuantityInput`, and `quantityFocusAfterCommit`; preserve direct-save writer/error/focus behavior in `stockInput`, `stepStock`, and `acceptStock`.
- Add-on details use the existing dialog through a Killer-specific branch in `inventoryDetail(id)`; display verified description and optional descriptive `powerEffects`, with no research source list or relational mechanic claim.

- [ ] **Step 1: Add failing workspace assertions**

  In `tests/character-workspace.test.js`, add a Killer route assertion that the Power & Add-ons workspace shows Power name/summary and only that Killer’s Add-ons. Assert each representative Add-on has image/fallback, name, rarity, accessible quantity controls, description/details, and starts at zero in a fresh save. Assert another Killer’s Add-ons do not appear.

  Assert the Killer overview no longer says reference data is unavailable when both Power and Add-on catalogs are ready, and its View Power & Add-ons link targets the existing canonical route.

- [ ] **Step 2: Add and wire the failing browser regression**

  In `tests/browser/killer-addons.mjs`, cover the ready route, correct-Killer scoping, accessible quantity controls, Enter/blur persistence after reload, zero omission, save failure/focus retry, keyboard details, image decode/fallback, no catalog/network JSON request, and no overflow at 320, 500, 760, 1100, 1440, and 1600.

  Assert visible keyboard focus on quantity controls. Hook the regression into `tests/browser/smoke.mjs`, create `tests/browser/killer-addons-runner.mjs` to call `smokeStage` against the built project root with only this regression, and replace the old unavailable-route expectation in `tests/browser/character-workspace.mjs`.

- [ ] **Step 3: Run focused workspace tests and observe RED**

  Run: `node --test tests/character-workspace.test.js`

  Expected: FAIL because the reserved route still renders unavailable content and Killer overview still shows the unavailable placeholder.

- [ ] **Step 4: Run the focused browser regression and observe RED**

  Run: `npm run build`

  Expected: PASS; the generated catalog, manifest, and bundle are ready.

  Run: `node tests/browser/killer-addons-runner.mjs`

  Expected: FAIL on the still-unavailable Killer route. The runner serves only the built local checkout and uses a disposable browser profile; it does not read the owner’s save.

- [ ] **Step 5: Implement the Killer renderer using shared quantity behavior**

  Add `killerAddonsView(characterId)` and route it from `characterWorkspaceView` only when the selected Killer’s catalog/power data is ready. Reuse stock card/quantity classes and existing save guards. Add search and rarity filter only through `visibleQuantityEntries`; retain the full Add-on list at the default state.

  Make `stockFocusOrder` and the focus destination list handle the single-Killer list without Survivor family grouping. Keep Survivor family selection behavior unchanged. Add the Power summary branch to `characterOverview`. Add a Killer branch to `inventoryDetail` for description and optional descriptive effects. Provide stable page heading, status text, keyboard focus, visible labels, and responsive card geometry.

- [ ] **Step 6: Run focused workspace, interaction, and browser tests**

  Run: `node --test tests/character-workspace.test.js tests/inventory-quantities.test.js`

  Expected: PASS; route, owner scoping, shared quantity helpers, and all existing Survivor interaction assertions pass.

  Run: `node tests/browser/killer-addons-runner.mjs`

  Expected: PASS; focused Killer workspace interaction and responsive checks pass.

  Run: `npm run release`

  Expected: PASS; full Node suite, fresh build, staged Edge browser suite, and release asset checks pass.

- [ ] **Step 7: Commit the workspace surface**

  ```bash
  git add src/app.js src/inventory-interaction.js styles.css dist/app.js tests/character-workspace.test.js tests/inventory-quantities.test.js tests/browser/killer-addons.mjs tests/browser/killer-addons-runner.mjs tests/browser/smoke.mjs tests/browser/character-workspace.mjs
  git commit -m "Open Killer Power and Add-ons workspace"
  ```

### Task 5: Final verification and README correction

**Files:**

- Modify: `README.md` line 145: schema v1 export wording to schema v2.
- Do not edit: `docs/runtime-README.md`, which already documents schema v2.

**Interfaces:**

- Browser coverage uses the existing `smokeStage` disposable profile and local fixture saves; no personal/local production save is read.
- `npm run test:browser` exercises Edge by default. `node tests/browser/smoke.mjs --chrome` exercises Chrome against the exact staged runtime created by release verification.

- [ ] **Step 1: Confirm the stale export wording**

  Run: `rg -n "schema v1 save" README.md`

  Expected: one match at the export description; the README introduction already identifies schema v2 as the canonical export.

- [ ] **Step 2: Correct the root README export version**

  Change the stale `README.md` export claim from schema v1 to schema v2. Keep the wording consistent with the introduction and `src/model.js` `exportSave()`; leave schema-v1 migration compatibility described as read compatibility.

- [ ] **Step 3: Run full Node and build verification**

  Run: `npm test`

  Expected: all tests pass; record exact test/pass/fail totals.

  Run: `npm run build`

  Expected: runtime catalog, manifest, and `dist/app.js` regenerate successfully without hand edits.

- [ ] **Step 4: Run release verification and both browser channels**

  Run: `npm run release`

  Expected: release test/build/staging/Edge smoke pass; `release/runtime/` contains all and only allowlisted bundle files and referenced assets; staged hashes/dimensions match.

  Run: `npm run test:browser`

  Expected: Edge passes again against the newly staged runtime.

  Run: `node tests/browser/smoke.mjs --chrome`

  Expected: Chrome passes the same staged runtime regression. Open `release/artwork-file-check.html` directly from disk for the established offline image decode check.

- [ ] **Step 5: Review the final generated and source diff**

  Run: `git diff --check`

  Expected: no whitespace errors.

  Run: `git status --short` and `git diff --stat`.

  Inspect the full diff. Confirm schema and Power JSON did not change, Survivor inventory quantities remain unaffected, there is no remote runtime request, and generated files came from the normal build.

- [ ] **Step 6: Commit the documentation correction**

  ```bash
  git add README.md
  git commit -m "Correct README export schema version"
  ```

## Plan Self-Review

- **Spec coverage:** source shape, catalog count/identity/owner/rarity/alias validation, compact runtime projection, 44 Power summaries, schema-v2 compatibility, unknown IDs, artwork/hash/fallback, workspace display/edit, responsive/browser behavior, release staging, and README correction each have an owning task.
- **Step granularity:** every code task starts with focused failing tests, runs them, implements only that boundary, reruns verification, and ends at one commit boundary; the documentation-only task checks the exact stale sentence before editing it.
- **Interface consistency:** the generator returns `{ addons, powersByCharacterId }`; generated Add-on entities use the existing `kind/role/map` fields; quantity helpers continue to consume `inventoryEntityById`; the UI route continues to use `characterWorkspaceHref`.
- **Review Focus coverage:** wrong-owner future IDs belong to Task 2; old v2 and Survivor preservation belong to Task 2; source ambiguity belongs to Task 1; asset failures belong to Task 3; offline references belong to Tasks 4 and 5.
- **Proportion:** no save migration, Power JSON rewrite, second runtime loader, global inventory abstraction, or deferred gameplay feature is planned.

## Execution Handoff

Review this plan before implementation. No implementation has been authorized by this planning document; use the user's next instruction to select the execution approach after review.
