# Killer Power & Add-ons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Enable the Killer Power & Add-ons workspace as an offline Power reference and a 20-item inventory page without changing schema-v2 saves.

**Architecture:** Project `data/dbd-killers-live-10.2.1.json` into a compact, deterministic `data/killer-runtime-catalog.json`, then load that projection into the existing inventory registry. Generate and validate explicit artwork paths before bundling, stage only manifest references, and render the reserved Killer workspace with the existing native detail dialog and shared quantity helpers.

**Tech Stack:** JavaScript ES modules, Node.js 22, `node:test`, esbuild, browser HTML/CSS, and Playwright Core using the existing Edge/Chrome runners.

**Spec:** `docs/superpowers/specs/2026-10-18-killer-power-addons-design.md`

## Global Constraints

- `data/dbd-killers-live-10.2.1.json` is the only Killer research source.
- Preserve the complete existing artwork metadata mapping in the canonical master: 924 Power/Add-on records, 917 non-null paths (843 EXACT, 74 REVIEW), and seven explicit null Power mappings. The audit includes 131 apostrophe-bearing Power/Add-on names whose selected tracked filename differs from a literal `<canonical name>.png`; do not regenerate, normalize, or discard these explicit selections.
- Use the tracked `images/Powers and Add-ons/` paths as stored; do not guess or transform filenames.
- Accept valid EXACT and REVIEW mappings; use accessible fallback only for the seven explicit null Power mappings; fail on invalid non-null mappings.
- Keep EXACT/REVIEW confidence in source/runtime validation metadata; do not show confidence badges in the UI.
- Generate the compact catalog before importing asset generation in the normal build; keep runtime data bundled and offline.
- Keep saves at `schemaVersion: 2` and Killer quantities under `characters[characterId].inventory.addons`.
- Preserve positive safe-integer quantities, sparse zero omission, unknown valid `killer-addon-*` IDs, and known wrong-Killer rejection.
- Do not change model/storage production behavior unless a new failing regression test demonstrates a gap.
- Keep all 20 Add-ons visible in canonical rarity order and source order within rarity; add no search, stock toggle, collapse controls, card sizing, or functional categories.
- Stage only explicit asset-manifest references; never stage the full 2,167-image source tree.
- Preserve Survivor inventory behavior, existing import/export and backup/recovery semantics, and local-only runtime behavior.
- Do not add dependencies or package services for this feature.
- Treat `docs/superpowers/plans/2026-10-16-killer-addons-implementation.md` as historical only; do not reuse its source, artwork paths, or task boundaries without rechecking them against the current repository.
- Do not use reset, restore, or clean commands to discard any working-tree changes. Stage only the files named by the task being committed.
- Before `npm run release`, inspect `release/runtime`, `release/verification.json`, and `release/artwork-file-check.html`; preserve any user-valued output because the existing release workflow recreates those generated release artifacts.

## Review Focus

- **Malformed source relationships or duplicate IDs:** generation rejects the invalid catalog instead of producing a partial runtime registry. Pin this in Task 1's projection tests.
- **Path traversal, junctions, and unusual valid filenames:** allow the exact stored path under the Killer artwork root, reject unsafe paths, and never normalize punctuation. Pin this in Task 3's asset tests.
- **Intentional null versus broken explicit artwork:** render the seven null Power mappings with fallback, but reject a missing, malformed, or nonexistent explicit path. Pin both outcomes in Task 3.
- **Pending or invalid quantity while opening Details or losing writer access:** retain uncommitted input, preserve the stored save, and keep keyboard focus predictable. Pin this in Task 5's browser tests.
- **Killer selection and route boundaries:** render exactly the selected Killer's 20 Add-ons and never display another Killer's pool. Pin this in Tasks 4 and 6.

## File Map

| File | Responsibility |
| --- | --- |
| `scripts/generate-killer-runtime-catalog.mjs` (new) | Validate and project the canonical Killer master; write the deterministic runtime catalog. |
| `data/killer-runtime-catalog.json` (new, generated) | Compact bundled Killer Power/Add-on projection. |
| `data/inventory-catalog.js` | Keep the Survivor adapter intact and combine normalized Killer Add-ons into the existing entity registry. |
| `scripts/build.mjs` | Generate the Killer projection before dynamically importing asset generation. |
| `dist/app.js` (tracked, generated) | Bundled application output; regenerate only through the normal build/release workflow and never hand-edit. |
| `scripts/generate-assets.mjs` | Validate explicit Killer paths and add referenced Killer art to the existing manifest. |
| `data/asset-manifest.json` (generated) | Carry Add-on and Power image paths, dimensions, and generated hashes. |
| `src/assets.js` | Resolve Power artwork from the manifest while keeping existing helpers intact. |
| `src/app.js` | Render the Power & Add-ons route, native Details dialogs, and direct-save quantity controls. |
| `styles.css` | Style the wide Power panel, rarity groups, and responsive Add-on grid. |
| `scripts/release.mjs` | Stage and verify only referenced Killer art and include it in offline artwork checks. |
| `tests/killer-runtime-catalog.test.js` (new) | Cover source projection, completeness, deterministic output, and freshness. |
| `tests/browser/killer-power-addons.mjs` (new) | Cover Killer page, dialog, quantity, ownership, focus, and responsive behavior. |
| Existing inventory/build/release tests | Extend coverage at the current module and browser-test boundaries. |
| `README.md`, `docs/runtime-README.md` | Remove outdated claims that inventory/Power data is unavailable and update build/release guidance. |

## Task 1: Project the canonical master and activate the Killer registry

**Files:**
- Create: `scripts/generate-killer-runtime-catalog.mjs`
- Create: `data/killer-runtime-catalog.json` (generated)
- Create: `tests/killer-runtime-catalog.test.js`
- Modify: `data/inventory-catalog.js`
- Modify: `tests/inventory-catalog.test.js`
- Modify: `tests/inventory-quantities.test.js`
- Modify: `tests/model.test.js`
- Modify: `tests/storage.test.js`
- Preserve and commit the existing artwork metadata diff in: `data/dbd-killers-live-10.2.1.json` (924 Power/Add-on mapping records; 917 tracked paths and seven explicit null Power mappings)

**Interfaces:**
- Produces `projectKillerRuntimeCatalog(source) -> runtimeCatalog`, a deterministic projection with `{dataset, gameVersion, killers}`. Each Killer row contains `characterId`, a Power record with only approved gameplay fields and `{path, confidence}` artwork, and ordered Add-ons with `id`, `characterId`, `name`, `order`, `rarity`, `effect`, and `{path, confidence}` artwork.
- Produces `generateKillerRuntimeCatalog(root) -> runtimeCatalog` and `writeKillerRuntimeCatalog(root) -> runtimeCatalog`, matching the root-argument and generate/write conventions in `scripts/generate-assets.mjs`.
- Produces `adaptKillerRuntimeCatalog(source) -> {addons, powersByCharacterId}` in `data/inventory-catalog.js`. Add-on entities use the existing inventory contract: `kind: 'killer-addon'`, `role: 'killer'`, `map: 'addons'`, explicit `characterId`, stable source ID, canonical `order`, `rarity`, `effect`, `imagePath`, and `artworkConfidence`.
- Keeps `inventoryEntityById` as the combined Survivor/Killer lookup, sets both Killer catalog statuses to `ready`, and populates `killerPowerByCharacterId` from the projected source. Do not add source hashes: the master has explicit paths/confidence but no per-image hash; hashes are generated into the asset manifest.

- [ ] **Step 1: Add failing catalog and real-ID regression tests.** Assert 44 Killers, 880 Add-ons, exactly 20 per Killer, 4/5/5/4/2 rarity counts, unique source IDs/research IDs, correct explicit owners, approved Power fields, and exclusion of research-only fields. Compare two generated projections and the checked-in JSON for deterministic freshness. Update registry assertions and add one real-catalog save case for correct-owner acceptance and wrong-owner rejection; retain existing synthetic tests for unknown IDs, zero omission, malformed quantities, schema v2, and backup/restore.
- [ ] **Step 2: Run the focused tests and verify RED.**

  Run: `node --test tests/killer-runtime-catalog.test.js tests/inventory-catalog.test.js tests/inventory-quantities.test.js tests/model.test.js tests/storage.test.js`

  Expected: FAIL because the runtime projection and active Killer registry do not exist yet.
- [ ] **Step 3: Implement the projector and registry adapter.** Validate source structure, stable IDs, explicit Killer ownership against `data/catalog.js`, required rarity/count invariants, and the approved runtime-field allowlist. Read source files from `root` rather than statically importing the research master so temporary-root tests remain isolated. Write the generated JSON deterministically; leave Survivor adaptation and its entity values unchanged.
- [ ] **Step 4: Generate output and run the focused tests for GREEN.**

  Run: `node scripts/generate-killer-runtime-catalog.mjs`

  Run: `node --test tests/killer-runtime-catalog.test.js tests/inventory-catalog.test.js tests/inventory-quantities.test.js tests/model.test.js tests/storage.test.js`

  Expected: all projection, registry, schema-v2, ownership, and storage assertions pass; the freshness test matches the generated file byte-for-byte.
- [ ] **Step 5: Recheck and commit the pre-existing master diff with this catalog boundary.** Review `git diff -- data/dbd-killers-live-10.2.1.json`; verify every changed field is inside a record-level `artwork` object or the top-level `artworkMetadata` audit summary, and that canonical identity/research fields are unchanged. Confirm all 917 non-null explicit paths resolve to tracked files with matching stored basenames, the 74 REVIEW mappings remain explicit, and the seven null Power mappings remain null. The audit covers 131 apostrophe-bearing Power/Add-on names whose selected tracked filename differs from a literal `<canonical name>.png`; preserve those selected paths exactly. Task 3 validates the full mapped-artwork set against the filesystem. Do not recreate or rewrite the existing mappings. Stage only the listed source, generator, generated catalog, registry, and test files.

  Run: `git add data/dbd-killers-live-10.2.1.json data/inventory-catalog.js data/killer-runtime-catalog.json scripts/generate-killer-runtime-catalog.mjs tests/killer-runtime-catalog.test.js tests/inventory-catalog.test.js tests/inventory-quantities.test.js tests/model.test.js tests/storage.test.js`

  Commit: `feat: generate compact Killer runtime catalog`

## Task 2: Generate runtime data before asset imports

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `tests/asset-build.test.js`

**Interfaces:**
- Keep `buildProject(root, options)` and its existing `bundle` injection. Add test hooks `writeCatalog` and `writeManifest`; default `writeCatalog` to `writeKillerRuntimeCatalog`.
- In production, `buildProject` awaits `writeCatalog(root)`, then dynamically imports `writeAssetManifest` from `scripts/generate-assets.mjs`, then generates the asset manifest, then invokes esbuild. The asset generator must not be statically imported before the generated catalog write, because it statically imports `data/inventory-catalog.js` and the projection JSON.

- [ ] **Step 1: Add failing build tests.** Inject catalog/manifest writers and a bundle callback into `buildProject`; record the call sequence and assert that the generated catalog exists before manifest generation and bundling. Assert a catalog-writer failure prevents both later calls. Run esbuild with `metafile: true` for the real app entry and assert the import graph includes `data/killer-runtime-catalog.json` but excludes `data/dbd-killers-live-10.2.1.json`.
- [ ] **Step 2: Run the focused test and verify RED.**

  Run: `node --test tests/asset-build.test.js`

  Expected: FAIL because the build currently imports and runs asset generation before creating a Killer projection.
- [ ] **Step 3: Update `buildProject` to write the catalog before dynamic asset-module import.** Preserve the current `root` and `bundle` behavior; avoid runtime fetching and avoid importing the application registry from the generator module.
- [ ] **Step 4: Run the focused test for GREEN.**

  Run: `node --test tests/asset-build.test.js`

  Expected: catalog writer, asset writer, and bundle run in order; a failed catalog write stops the build.
- [ ] **Step 5: Commit.**

  Run: `git add scripts/build.mjs tests/asset-build.test.js`

  Commit: `build: generate Killer catalog before asset manifest`

## Task 3: Validate Killer artwork and stage explicit manifest references

**Files:**
- Modify: `scripts/generate-assets.mjs`
- Modify: `src/assets.js`
- Modify: `scripts/release.mjs`
- Modify: `tests/inventory-assets.test.js`
- Modify: `tests/release.test.js`
- Regenerate: `data/asset-manifest.json`
- Regenerate: `dist/app.js` (tracked bundle; `npm run build` regenerates it after the Killer registry and asset integration become active, and it may change; never hand-edit)

**Interfaces:**
- Keep `generateAssetManifest(root)` and `writeAssetManifest(root)` as the manifest entry points. Preserve the existing Survivor manifest behavior.
- Extend `assertInventoryAssetPath(path)` to accept existing Survivor inventory paths and safe explicit paths below `images/Powers and Add-ons/`. Reject absolute paths, backslashes, traversal segments, symlinks, and paths outside the allowed roots.
- Add `killerPowers[characterId]` to the manifest. Keep Killer Add-on artwork in the existing `inventory[addonId]` map so `inventoryIconPath(id, manifest)` continues to resolve it. Add `killerPowerIconPath(characterId, manifest)` in `src/assets.js` for Power art.
- Manifest assets contain `{path, width, height, sha256}` computed from current tracked bytes. A null Power source mapping remains `null`; a broken explicit Killer mapping must throw during generation instead of becoming null or being skipped.

- [ ] **Step 1: Add failing asset/release tests.** Assert 880 Killer Add-on mappings and 44 Power mappings are represented; all 917 non-null mappings resolve; counts are 843 EXACT and 74 REVIEW, with seven null Power entries. Verify both confidence classes resolve, null returns fallback, unsafe paths/symlinks/bad PNGs reject, invalid explicit paths fail, and staging copies referenced paths only. Use fixture files and the existing `stageRuntime`/`verifyStage` interfaces.
- [ ] **Step 2: Run focused tests and verify RED.**

  Run: `node --test tests/inventory-assets.test.js tests/release.test.js`

  Expected: FAIL because the current allowlist excludes the Killer tree and the manifest has no Power map.
- [ ] **Step 3: Extend manifest generation and path validation.** Use `artwork.path` exactly as stored. Preserve `artwork.confidence` in the runtime source for audits/tests; do not derive names, rewrite apostrophes, or require a source SHA absent from the canonical schema. For Killer explicit paths, check each path component with `lstat`, reject symlinks, require a file, validate PNG header/dimensions, and record its generated hash. Keep the current Survivor behavior and `inventoryIconPath` contract.
- [ ] **Step 4: Extend release staging and artwork verification.** Add non-null `killerPowers` paths to `runtimeFiles`, staged hash/dimension verification, release report counts, and `artworkFileCheck`. Inventory Add-on files continue through `manifest.inventory`. Include only references from the manifest, never a directory walk of the 2,167-image source tree.
- [ ] **Step 5: Regenerate and run focused tests for GREEN.**

  Run: `npm run build`

  Run: `node --test tests/inventory-assets.test.js tests/release.test.js`

  Expected: exact-path, null fallback, unsafe path, PNG integrity, and manifest-only staging tests pass; generated manifest includes all validated Killer references.
- [ ] **Step 6: Commit.** Stage `scripts/generate-assets.mjs`, `src/assets.js`, `scripts/release.mjs`, the two tests, and the build-generated `data/asset-manifest.json`; include generated `dist/app.js` if it changed during the build. Never hand-edit the bundle.

  Run: `git add scripts/generate-assets.mjs src/assets.js scripts/release.mjs tests/inventory-assets.test.js tests/release.test.js data/asset-manifest.json dist/app.js`

  Commit: `feat: validate and stage Killer artwork`

## Task 4: Render the Power panel, Add-on groups, and Details dialogs

**Files:**
- Modify: `src/app.js`
- Regenerate: `dist/app.js` through the normal build/release workflow; expected to change and included in this task's commit. Never hand-edit.
- Modify: `tests/browser/character-workspace.mjs`
- Modify: `tests/browser/smoke.mjs`
- Modify: `tests/browser/inventory.mjs`
- Create: `tests/browser/killer-power-addons.mjs`

**Interfaces:**
- Keep the existing `parseCharacterWorkspaceRoute` and `characterWorkspaceView(descriptor)` entry points. Add a Killer `power-addons` branch using the existing registry and manifest.
- Add internal render/open functions in `src/app.js`: `killerPowerAddonsView(characterId)`, `killerPowerDetail(characterId)`, `killerAddonDetail(addonId)`, `openKillerPowerDetail(characterId, opener)`, and `openKillerAddonDetail(addonId, opener)`.
- Use the existing `dialogHeader(...)` and native `#detail` dialog. Add delegated actions `killer-power-details` and `killer-addon-details`; restore focus to the invoking control on close.
- Give the page stable test markers for the Power panel, rarity sections, and Add-on IDs. Keep `inventoryDetail(id)` limited to Survivor inventory so Killer details never expose Survivor family/provenance sections.

- [ ] **Step 1: Add failing browser assertions.** In `tests/browser/killer-power-addons.mjs`, assert the reserved Doctor route renders a Power name/summary and exactly 20 cards in the five visible rarity groups; check source order within each rarity, selected-Killer isolation, every approved Power Details field for a sample Killer, Add-on Details effect, escaped text, and absence of source/verification metadata. Visit a Killer with a null Power artwork mapping and assert the fallback has an accessible name; visit a mapped Power and a REVIEW Add-on and assert their explicit manifest paths render. Update the existing workspace test that currently expects the route to be unavailable and the inventory browser assertion that currently expects zero Killer quantity controls; register the regression in `smoke.mjs`.
- [ ] **Step 2: Run the release browser gate and verify RED.**

  Run: `npm run release`

  Expected: unit tests/build pass, then the staged browser regression fails on the current unavailable Killer route. The release runner removes its unverified staging directory on failure.
- [ ] **Step 3: Add the route renderer and detail handlers.** Show the Power art or accessible null-art fallback, Power name and summary, then all 20 Add-ons grouped Common, Uncommon, Rare, Very Rare, Ultra Rare in source order. Show card artwork, name, rarity, quantity-control markup, and Details action. Keep full Power structures and Add-on effect in the existing dialog; escape canonical text and omit research-only fields.
- [ ] **Step 4: Run the release browser gate for GREEN.**

  Run: `npm run release`

  Expected: `npm run release` invokes the normal build, regenerates `dist/app.js` because `src/app.js` changed, and the route/dialog assertions pass on the staged bundle while existing Survivor browser checks remain green.
- [ ] **Step 5: Commit.**

  Run: `git add src/app.js dist/app.js tests/browser/character-workspace.mjs tests/browser/smoke.mjs tests/browser/inventory.mjs tests/browser/killer-power-addons.mjs`

  Commit: `feat: render Killer Power and Add-ons workspace`

## Task 5: Add direct-save Killer quantity interactions

**Files:**
- Modify: `src/app.js`
- Regenerate: `dist/app.js` through the normal build/release workflow; expected to change and included in this task's commit. Never hand-edit.
- Modify: `tests/browser/killer-power-addons.mjs`
- Reuse without production edits unless a test proves a gap: `src/inventory-interaction.js`, `src/inventory-quantities.js`, `src/model.js`, `src/storage.js`

**Interfaces:**
- Keep `createQuantityInteraction`, `updateQuantityInput`, `acceptQuantityInput`, `stepQuantityInput`, `regroupQuantityEntries`, and `quantityFocusAfterCommit` as the shared primitives.
- Add a Killer session in `src/app.js`, keyed by the current Killer ID and containing only that Killer's 20 entities. Route Killer input, +/- actions, Enter, blur, and Details focus transitions to Killer-specific handlers rather than Survivor `stockSession` family/filter handlers.
- `createQuantityInteraction` sorts positive quantities before zero quantities for its current Survivor workflow. Use the Killer catalog's source sequence for rendering each rarity group and read quantity state from the session; do not render from the helper's stock-first `order`.
- Commit only `characters[characterId].inventory.addons[addonId]` through the existing `commit(mutator, characterId)` and `store.assertWriter()` path. Use the existing `data-inventory-quantity` control convention plus a Killer discriminator so current inventory selectors remain useful.

- [ ] **Step 1: Add failing quantity browser assertions.** Cover default zero display, +/− persistence, safe numeric entry on Enter and blur, zero-key deletion, reload persistence, malformed/unsafe text retention, failed writer retention, pending valid/invalid text while opening Details, focus restoration, reader-window disabled quantity controls with Details still available, and no edits to another Killer's map.
- [ ] **Step 2: Run the release browser gate and verify RED.**

  Run: `npm run release`

  Expected: page rendering passes but the new quantity persistence or focus assertion fails because the controls are not yet wired to a Killer session.
- [ ] **Step 3: Implement the Killer quantity session and handlers.** Reuse the shared input/step validation helpers. Preserve pending edits when a Details dialog opens, commit valid blur/Enter/step values directly, delete the map key at zero, reject unavailable writers, and retain invalid/failed values and focus for correction. Do not add model/storage production changes unless a failing test proves the existing behavior insufficient.
- [ ] **Step 4: Run focused browser and save regression tests for GREEN.**

  Run: `node --test tests/inventory-quantities.test.js tests/model.test.js tests/storage.test.js`

  Run: `npm run release`

  Expected: `npm run release` invokes the normal build and regenerates `dist/app.js` because `src/app.js` changed; schema-v2, persistence, keyboard, pending-input, and browser regressions pass; Survivor quantity tests remain unchanged in behavior.
- [ ] **Step 5: Commit.**

  Run: `git add src/app.js dist/app.js tests/browser/killer-power-addons.mjs`

  Commit: `feat: save Killer Add-on quantities`

## Task 6: Finish responsive styling, artwork coverage, and documentation

**Files:**
- Modify: `styles.css`
- Verify: tracked generated `dist/app.js`; final build/release should leave it unchanged from Task 5. If it changes unexpectedly, investigate the cause before committing anything; never hand-edit.
- Modify: `tests/browser/killer-power-addons.mjs`
- Modify: `tests/browser/artwork.mjs`
- Modify: `tests/browser/smoke.mjs`
- Modify: `README.md`
- Modify: `docs/runtime-README.md`
- Add as approved documentation: `docs/superpowers/specs/2026-10-18-killer-power-addons-design.md` and this implementation plan.

- [ ] **Step 1: Add failing responsive and decode assertions.** Check that the Power panel is horizontal on wide viewports and stacked on narrow viewports, and that the panel and rarity grid at 320, 500, 760, 1100, 1440, and 1600 pixels have no horizontal page overflow, usable 44px quantity/action targets, visible rarity headings, and stable Power art layout. Extend `artworkRegression(page, origin, manifest)` to decode all non-null Killer Add-on and Power references and verify manifest dimensions; default its manifest argument to `generateAssetManifest()`, assert seven Power fallbacks remain null, and assert no external/catalog JSON requests occur.
- [ ] **Step 2: Run the release browser gate and verify RED where layout changes are needed.**

  Run: `npm run release`

  Expected: any unmet narrow-width or artwork-decode assertion identifies its owning layout or asset issue.
- [ ] **Step 3: Add focused responsive styles.** Style the Power summary as a wide horizontal panel at larger widths and stack it at narrow widths. Reuse `.stock-grid`, `.stock-card`, quantity controls, and rarity badges where they fit; keep all rarity headings expanded and add no new filters or controls.
- [ ] **Step 4: Update current user/runtime documentation.** Remove the README and runtime README statements that Killer Power/Add-on data or inventory UI is unavailable/planned. Document the bundled offline Killer workspace and update build/release descriptions to include the canonical Killer master, generated projection, explicit artwork, and current artwork verification behavior. Do not change the approved spec's content.
- [ ] **Step 5: Run final verification.**

  Run: `npm test`

  Run: `npm run build`

  Run: `npm run release`

  Run: `npm run test:browser`

  Expected: unit tests pass; build regenerates both runtime catalog and asset manifest before bundling; release stages only manifest-referenced assets, passes Edge smoke tests, and reports the existing manual direct-file acceptance state; the browser runner passes against that stage.
- [ ] **Step 6: Commit responsive coverage and documentation.** Stage only the files listed in this task, including the already-approved spec and implementation plan, so neither document nor the canonical artwork corrections is lost.

  Run: `git add styles.css tests/browser/killer-power-addons.mjs tests/browser/artwork.mjs tests/browser/smoke.mjs README.md docs/runtime-README.md docs/superpowers/specs/2026-10-18-killer-power-addons-design.md docs/superpowers/plans/2026-10-18-killer-power-addons-implementation.md`

  Commit: `feat: finish responsive Killer workspace and docs`

## Dependency Order

Task 1 establishes the runtime projection and combined registry. Task 2 fixes the build import order required to consume it safely. Task 3 adds strict asset and release support. Tasks 4 and 5 depend on those registries and manifests; Task 5 also depends on the controls rendered in Task 4. Task 6 completes visual and documentation coverage after the page and assets are integrated.

## Implementation Start Check

Before Task 1, inspect `git status --short --branch` and `git diff -- data/dbd-killers-live-10.2.1.json`. The expected existing state includes the full audited artwork metadata mapping (924 records, with 917 tracked paths and seven explicit null Power mappings), the 131 apostrophe-bearing name/filename cases, and the approved design spec. Preserve these changes; validate and commit the artwork-only diff as described in Task 1. Do not restore, reset, clean, or regenerate the canonical master. Do not begin implementation until this plan has been reviewed and an execution method has been selected.
