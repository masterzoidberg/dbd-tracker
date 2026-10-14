# Edit Character and inventory surfaces implementation plan

> **For agentic workers:** After human authorization, use Superpowers executing-plans, or subagent-driven-development if selected, task-by-task. Track checkbox steps. Never bypass data gates with production fixture entities.

**Goal:** Implement explicit-save character updates and shared quantity management, gated by verified catalogs.

**Architecture:** A pure edit module owns raw input/draft validation; app handlers own navigation/writer/storage effects. Reuse existing perk helpers and P1 quantity validation. Small pure interaction helpers own stable order/filter/focus independently of draft versus durable commits.

**Tech stack:** Existing vanilla ES modules/native controls, esbuild, localStorage/Web Locks, Node/Playwright Core. No dependencies.

**Spec:** All five documents under G:\Projects\dbd-tracker\plans\character-update-rework. Read 05-inventory-and-editing-design.md for commit/persistence detail. Contracts: [01-schema-v2-persistence.md](01-schema-v2-persistence.md), [02-character-workspace-core.md](02-character-workspace-core.md). Sources: [00-master-roadmap.md](00-master-roadmap.md).

## Global Constraints

- One in-memory draft, explicit Save Character, no writes beforehand; one changed-save timestamp, no no-op timestamp.
- Dirty Cancel/navigation Save / Discard / Stay; errors/writer loss/storage failure retain draft; stale-save conflict blocks overwrite until explicit discard/reload.
- Detailed quantities valid Enter/blur autosave; comprehensive quantities regroup only after successful Save. No live resort or hidden active controls.
- Preserve floors/historical zero/absence/overrides/unknown state/queue/other characters/setup flags. Detailed pages cannot bypass dirty draft.
- Verified IDs before stock editors; Power read-only, unavailable content allowed. No definitions inferred from artwork.
- Positive-first, readable muted visible zero, canonical order, native labeled inputs, In Stock off by default, no main inventory tables.
- No new stores/services/config/dependencies/active-account tests. Checkpoint convention in roadmap.

## Review Focus

- Untouched records below derived perk floor remain; changed invalid selections show errors → P3.1/P3.2.
- Invalid raw text is dirty even when parsed draft equals baseline → P3.1/P3.3.
- Detail/global mutation/storage events cannot bypass dirty session → P3.2/P3.3.
- Blur regrouping respects clicked/tabbed destination → P3.4/P3.6.
- Unknown quantities survive edits; later resolved incompatibility rejects without pruning → P3.1/P3.4/P3.5.

## File responsibility map

| Files | Responsibility |
| --- | --- |
| Create src/character-edit.js, tests/character-edit.test.js | Pure session/raw input/candidate/no-op/conflict |
| Modify src/app.js, styles.css, index.html | Task/save/guard/native three-choice dialog/reference-only detail |
| Create src/inventory-interaction.js, tests/inventory-interaction.test.js | Stable display/filter pinning/focus, no storage |
| Modify data/inventory-catalog.js; create tests/inventory-catalog.test.js | Frozen adapters/verified data only |
| Gated create data/survivor-inventory-verified.json, data/killer-addons-verified.json, optional data/killer-powers-verified.json | Reviewed snapshots/provenance; never dummy production entities |
| Modify src/assets.js, scripts/generate-assets.mjs, scripts/release.mjs; tests/assets.test.js, asset-build.test.js, release.test.js | ID→art mapping, relative paths, allowlisted staging/hashes |
| Create tests/browser/character-edit.mjs, inventory.mjs; extend workspace-file.mjs, smoke.mjs, data-flows.mjs, editor.mjs | Focused exported regressions/CLI and full/file suite |

Registry exports from P1 remain inventoryEntities, inventoryEntityById, inventoryCatalogStatus, killerPowerByCharacterId. Entity interface: {id, sourceId, kind: survivor-item|survivor-addon|killer-addon, role, map: items|addons, familyId: string|null, characterId: string|null, order: number, name, rarity, description, effect, compatibleItemIds: string[], imagePath: string|null, provenance}. Empty registry means verified data unavailable. Adapter independent of model avoids circular imports. Synthetic fixtures are test-only.

Browser red/green staging: run npm run build, then:

    node --input-type=module -e "import {stageRuntime} from './scripts/release.mjs'; import {readFile} from 'node:fs/promises'; await stageRuntime(process.cwd(), {manifest:JSON.parse(await readFile('data/asset-manifest.json','utf8'))});"

Then each task's CLI. Focused wrappers reuse smokeStage and fresh contexts. P2.5 updates common startup baseline only when destinations work.

### P3.1 — Pure edit session and one-record candidate

**Files:** create src/character-edit.js, tests/character-edit.test.js. Current reference: setCharacterPersonalTier, correctPersonalPerkTier, setHistoricalPerkTier, P1 quantity helpers/model validation.

**Interfaces produced:** createCharacterEditSession(save,id,returnRoute=null) → {characterId,baseFingerprint,baseline,draft,rawInputs,errors,dirty,returnRoute,conflicted:false}. updateCharacterEditSession(session,change,save,{entityById=inventoryEntityById}={}) → immutable session; changes {field,value}, perk {field:'perk',id,value,mode:'personal'|'historical'|'correction'}, stock {field:'quantity',map,id,text}. buildCharacterEditCandidate(currentSave,session,{entityById=inventoryEntityById}={}) → {candidate:null|save,changed:boolean,errors:[{field,id?,message}],conflict:boolean}; no timestamp/storage effects. characterEditPreview(save,session) → transient save. Fingerprint uses complete canonical save JSON conservatively.

- [ ] Write tests “session purity”, “no-op versus invalid dirty input”, “final prestige validates changed floors”, “unknown quantity retention”, “stale save conflict”. Draft never mutates original. BW1–50/P>=0 safe integer; invalid raw text retained. Valid reverted fields clean/no-op. Ordinary clear retains effective floor; historical absence/zero/no-downgrade and separate deliberate correction remain. New Prestige rejects changed non-null tier below final floor, untouched below-floor record retained; no automatic tier materialization. Unknown maps/perks, queue/overrides/setup/other characters/times unchanged; changed underlying save returns conflict.
- [ ] Red: node --test tests/character-edit.test.js. Expect missing helper/purity assertions fail.
- [ ] Implement immutable raw validation with existing rules; known entity required for new UI quantities, imported unknowns retained. No Date/storage calls; errors identify exact control.
- [ ] Green: node --test tests/character-edit.test.js tests/character-inventory.test.js tests/inventory-quantities.test.js tests/model.test.js. Expect all constraints pass.
- [ ] Review/commit: feat: define explicit-save character edit session.

### P3.2 — Comprehensive renderer and protected Save

**Files:** modify src/app.js (render, commit, writer presentation, input/change/submit, perkDetail), styles.css; create tests/browser/character-edit.mjs; extend tests/browser/editor.mjs.

**Interfaces:** app-local characterEditView(id,session) → HTML, saveCharacterEdit() → boolean. Valid changed candidate uses existing protected commit exactly once; no-op bypasses it. Browser exports characterEditRegression(page,origin), CLI node tests/browser/character-edit.mjs release/runtime.

- [ ] Add “one multi-field snapshot commits once”: change P/BW/Owned/Favorite/Notes/multiple tiers; bytes/times unchanged before Save including Enter/blur. Save stamps account+character once and preserves queue/unknown/setup/other characters; reload retained. No-op identical bytes. Invalid BW/P/floor blocks all writes/focuses error. Writer loss/write exception retains draft/old bytes/memory. Reference dialog inside Edit disables immediate global/personal mutations; outside still works. Missing data means notice/no stock editor; Power has no input.
- [ ] Red: stage candidate then node tests/browser/character-edit.mjs release/runtime. Expect absent task or autosave-before-Save failure.
- [ ] Render compact searchable sections and draft handlers. Reuse perk controls with explicit draft/canonical destination, not duplicate models. Validate/no-op/conflict before commit; patch intended character fields only, stamp/adopt once. Return caller/Overview with heading/Edit focus and saved announcement; failure keeps raw draft. Register every new mutation in writer gating.
- [ ] Green: same staging/CLI plus node --test tests/character-edit.test.js. Expect one changed write and no detail bypass.
- [ ] Review/commit: feat: implement comprehensive explicit-save character editing.

### P3.3 — Dirty navigation, cancel and stale-save protection

**Files:** modify src/app.js (click/hashchange/storage/import/restore/reset/setup/submit/beforeunload), index.html; extend tests/browser/character-edit.mjs, tests/character-edit.test.js, tests/browser/editor.mjs.

**Interfaces produced:** requestWorkspaceNavigation(destination,{source='link'}={}) → Promise<boolean>; resolveDirtyCharacterEdit(intent) → Promise<'proceed'|'stay'>. Native Save/Discard/Stay dialog distinct from destructive two-choice confirmation. Underlying changes flag retained session conflicted, block Save until discard/reload.

- [ ] Add “dirty routes/history honor choices”, “failed guard save stays”, “global actions cannot bypass draft”, “storage event retains conflicted draft”. Sections/collections/Dashboard/Setup/batch/import/restore/reset/Cancel/back/forward: Stay or failed Save preserves form/text/route/focus; Discard never stamps; Save commits once then intended action. Clean exit and direct reload fallback. Native unload warning only dirty, no persisted draft.
- [ ] Red: stage then node tests/browser/character-edit.mjs release/runtime; node --test tests/character-edit.test.js for new transitions. Expect unconditional hashchange loss/global bypass/stale overwrite.
- [ ] Intercept internal links before hash changes; modifier/new-tab keeps native behavior. Browser traversal uses ephemeral history state/index to restore edit entry while dialog pending, resume approved target once, suppress self-generated callbacks. This is history bookkeeping, not visit tracking. Guard mutation before its own confirmation. Writer loss disables writes without clearing draft; explain termination loses memory-only draft.
- [ ] Green: repeat commands and node tests/browser/editor.mjs release/runtime. Expect history/choices/conflicts without duplicate commits. This releases P2.5 capability cutover.
- [ ] Review/commit: feat: protect dirty character sessions across navigation.

### P3.4 — Survivor catalog and shared quantity interaction

**GATED ON SOURCE VERIFICATION for ingestion/production UI.** Candidate structured source supplied at `G:\DBD Site\add-ons\dbd-survivor-items-addons-final-enriched-10.2.0.zip`; reported 10.2.0, seven families, 38 Items/54 Add-ons with JSON/provenance/validation. This batch did not inspect or ingest it. P3.4b must verify identities, metadata, provenance, review flags and frozen save-ID mappings before runtime activation. Pure helper/test boundary can proceed with isolated test registry; production controls cannot.

**Files:** create src/inventory-interaction.js, tests/inventory-interaction.test.js, tests/inventory-catalog.test.js, verified snapshot after gate; modify data/inventory-catalog.js, src/app.js, src/assets.js, scripts/generate-assets.mjs, scripts/release.mjs; extend tests/assets.test.js, asset-build.test.js, release.test.js; create tests/browser/inventory.mjs, extend character-edit.mjs.

**Interfaces:** adaptInventoryCatalog(source,'survivor') → entities[]. Source {patch,verifiedAt,provenance,itemFamilies,items,addons} with source IDs/rarity/effect/description/compatibility/order/references. Frozen prefixes survivor-item-/survivor-addon- plus manifest family/entity converted to hyphens; verify all source identities/counts. inventoryIconPath(id,manifest) → relative path|null; manifest adds inventory ID-keyed assets. Pure createQuantityInteraction(entities,inventory,{mode:'detail'|'draft',inStock:false}={}) → state; updateQuantityInput(state,id,text) → state; acceptQuantityInput(state,id) → {state,quantity,error:null|string}; visibleQuantityEntries(state,filters) → entries[]; regroupQuantityEntries(state,committedInventory) → state; quantityFocusAfterCommit(before,{entityId,nextTargetId,trigger,visibleIds}) → targetId|null.

#### P3.4a — Pure quantity interaction and adapter validation

**Files:** src/inventory-interaction.js, tests/inventory-interaction.test.js, data/inventory-catalog.js (pure adapter only), tests/inventory-catalog.test.js. No verified snapshot/registry activation yet. Produces the pure interaction/adapter interfaces above for P3.4b/c.

- [ ] Write “frozen ordering/filter pinning”, “blur respects destination”, “verified mapping” using isolated test fixtures. Blank/negative/fraction/unsafe, +/- boundaries, positive-first/visible-zero/canonical order, no crossing-zero movement before commit, failure text/order retention, draft Enter/blur no regroup. In Stock pins pending/invalid; search retains draft. Enter entity/next/previous/filter fallback; blur respects destination. Adapter duplicate/kind/provenance/identity errors reject.
- [ ] Red: node --test tests/inventory-interaction.test.js tests/inventory-catalog.test.js. Expect missing helper or behavioral assertion failures.
- [ ] Implement pure interaction/adapter validation only, leave exported runtime registry unavailable. No UI/save writes or fabricated source snapshot.
- [ ] Green: same exact command plus node --test tests/inventory-quantities.test.js. Expect stable interaction and unchanged input fixtures.
- [ ] Review/commit: feat: define stable inventory quantity interactions.

#### P3.4b — Verified Survivor source and referenced assets

**GATED ON SOURCE VERIFICATION (candidate archive above). Files:** data/survivor-inventory-verified.json, data/inventory-catalog.js, src/assets.js, scripts/generate-assets.mjs, scripts/release.mjs, tests/inventory-catalog.test.js, tests/assets.test.js, tests/asset-build.test.js, tests/release.test.js. Consumes reviewed source and P3.4a adapter; produces ready registry and inventory asset manifest.

- [ ] Once actual source supplied, record its exact path/version/counts/provenance in this plan; add actual-source tests against reviewed identities and manifest mappings. No fabricated Firecracker add-ons, no display-label-derived IDs; preserve existing perk version. Test referenced art hash/path/fallback/alias handling, unknown→known incompatible validation without pruning.
- [ ] Red: node --test tests/inventory-catalog.test.js tests/assets.test.js tests/asset-build.test.js tests/release.test.js. Expect missing source ingestion/runtime inventory assets; missing supplied source itself is a blocked gate, not functional red.
- [ ] Snapshot/adapt reviewed source and set ready only after identity verification. Extend relative asset validation/generation/staging for referenced art, no archive mutation or image-tree wildcard. Preserve raw slash source IDs and immutable prefixed save mapping.
- [ ] Green: same command, then npm run build and staging command above. Expect actual-source metadata/IDs/counts verified and staged assets present; no runtime JSON fetch.
- [ ] Review/commit: feat: ingest verified survivor inventory catalog.

#### P3.4c — Survivor detailed and comprehensive stock editors

**BLOCKED until P3.4b. Files:** src/app.js, styles.css, tests/browser/inventory.mjs, tests/browser/character-edit.mjs, tests/browser/data-flows.mjs. Consumes verified registry/art, P3.1 session and P3.4a interactions; produces shared role-neutral quantity renderer/handler reused by P3.5.

- [ ] Add browser zero/positive crossing/no-live-move/Enter/blur/failed-save/focus/In Stock/filter cases plus all three Survivor stock flows: Item detail autosave, Add-on detail autosave, both maps in one draft Save. Assert read-only gating, sparse round trip, unknown read-only records escaped/preserved. Enter→blur unchanged quantity must not stamp twice.
- [ ] Red: stage then node tests/browser/inventory.mjs release/runtime and node tests/browser/character-edit.mjs release/runtime. Expect missing editors/commit/focus behavior with actual verified registry.
- [ ] Implement numeric-first cards, family/type/rarity/compatibility/search/In Stock and description disclosure. Detail single-entity commit/regroup only success; draft holds entry grouping until Save and pins pending stock rows. Section/Data warnings show unresolved IDs/counts read-only.
- [ ] Green: same exact staging/browser commands and node --test tests/inventory-interaction.test.js tests/inventory-quantities.test.js. Expect both maps, focus and failure/read-only retention pass.
- [ ] Review/commit: feat: manage survivor stock with stable quantity editing.

### P3.5 — Killer Add-ons gate and optional Power ingestion

**BLOCKED ON DATA:** Add-on production UI and Power ingestion independently. Raw artwork inadmissible; counts/patch unknown until verified. Power unavailable shell unblocked.

**Files:** gated data/killer-addons-verified.json and optional data/killer-powers-verified.json; modify data/inventory-catalog.js, src/app.js, assets/generation/release from P3.4; extend catalog/quantity/asset tests, tests/browser/inventory.mjs and character-edit.mjs.

**Interfaces:** same registry/interaction. adaptInventoryCatalog(source,'killer'); source {patch,verifiedAt,provenance,addons} rows frozen slug/canonical characterId/rarity/effect/description/order/references. Save killer-addon-<character-id>-<entity-slug>. adaptKillerPowers(source) → character-ID keyed read-only {characterId,name,iconPath:null|string,sections:[{id,title,blocks:[{type:'text'|'list'|'value',text?,items?,label?,value?,unit?}]}],provenance}; all mechanics/units/citations must come from verified source, never user save state.

- [ ] Add “Killer stock owner scoped”, “unknown owner survives until resolved”, “Power informational/unavailable”. Pure fixture tests wrong known owner/nonempty Killer items, unknown retention. After gate actual-source owner/ID tests and browser current-Killer-only detail/draft stock, no other Killer inventory or editable Power. Missing Power must not hide verified add-ons/routes.
- [ ] Red: node --test tests/inventory-catalog.test.js tests/inventory-quantities.test.js; after real gate stage then node tests/browser/inventory.mjs release/runtime and node tests/browser/character-edit.mjs release/runtime. Unavailable Power tests need no fabricated content.
- [ ] Ingest verified registry/art, reuse shared quantity/draft handlers and ready status gating. Optional Power renders only verified escaped sections; otherwise unavailable. No invented alias merge/sum. Newly resolved incompatible unknown save fails explained validation/recovery without deletion.
- [ ] Green: same unit/stage/browser commands and P3.4 asset suites. Assert source counts/owners against actual supplied data; Power branch may stay blocked separately.
- [ ] Separate review/commits: feat: ingest verified killer addons and quantity surfaces; optional feat: display verified structured killer power reference.

### P3.6 — No-data milestone and accessibility integration

**Files:** extend tests/browser/character-edit.mjs, inventory.mjs, workspace-file.mjs, smoke.mjs, tests/release.test.js; targeted styles.css/src/app.js fixes and docs/runtime-README.md checklist.

**Interfaces:** register edit/inventory exports in full smoke. inventory CLI branches only on real registry status: ready catalog requires stock tests, unavailable requires notice/no-editor checks, never skip-on-error.

- [ ] Add “no data milestone is honest”: routes/Perks/Setup/P/BW/flags/Notes/draft/guard work, unknown imported quantities survive edits/export/recovery; blocked editors show notice. This is not full inventory completion. Verify 320/500/760/1100/1440/1600, many entries/long labels/max-safe counts, readable muted zero/numeric labels/44px targets/no nesting/tables/page overflow, focus after errors/save/filter/regroup and read-only/dirty behavior.
- [ ] Red: stage then node tests/browser/character-edit.mjs release/runtime; node tests/browser/inventory.mjs release/runtime; node tests/browser/workspace-file.mjs release/runtime. Expect actual layout/focus/availability gaps, not blocked-data failure.
- [ ] Fix contained errors; allow one quantity column at320, Save/Cancel not covering focused fields, search/anchors preserve draft/errors. Record real disposable browser200% zoom/file Save/reopen; CSS zoom/deviceScaleFactor is not equivalent.
- [ ] Green: same focused commands, npm test, npm run release. Full available stock tests execute; file/localhost/staged canonical safety holds.
- [ ] Review/commit: test: verify explicit-save and inventory accessibility.

## Test assertion anchors

Add these anchors to the corresponding first failing tests; fixture setup and remaining assertions belong to the task steps. Browser beforeBytes is captured from disposable canonical storage before editing. Test-only entity fixtures never become runtime catalog.

P3.1:

~~~js
const save = freshSave();
const session = createCharacterEditSession(save, 'meg-thomas');
const changed = updateCharacterEditSession(session, {field:'bloodwebLevel',value:'43'}, save);
assert.equal(save.characters['meg-thomas'].bloodwebLevel, 1);
const result = buildCharacterEditCandidate(save, changed);
assert.equal(result.changed, true);
assert.equal(result.candidate.characters['meg-thomas'].bloodwebLevel, 43);
assert.equal(result.candidate.characters['meg-thomas'].updatedAt,
  save.characters['meg-thomas'].updatedAt);
~~~

P3.2, draft has valid changed progression:

~~~js
assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), beforeBytes);
await page.getByRole('button', {name:'Save Character',exact:true}).click();
const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
assert.equal(saved.characters['meg-thomas'].bloodwebLevel, 43);
assert.equal(saved.characters['meg-thomas'].updatedAt, saved.updatedAt);
~~~

P3.3, dirty navigation dialog:

~~~js
await page.getByRole('button', {name:'Stay',exact:true}).click();
assert.ok(page.url().endsWith('#character/meg-thomas/edit'));
assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), beforeBytes);
~~~

P3.4, display snapshot before and during active quantity change:

~~~js
const beforeIds = visibleQuantityEntries(state, {}).map(e => e.id);
const typing = updateQuantityInput(state, zeroEntityId, '5');
assert.deepEqual(visibleQuantityEntries(typing, {}).map(e => e.id), beforeIds);
~~~

P3.5, known add-on belongs to another Killer in test-only registry:

~~~js
assert.throws(() => canonicalizeQuantityMaps(
  {items:{},addons:{[otherKillerAddonId]:2}}, 'the-doctor', testEntityById),
  /owner|Killer|compatible/i);
~~~

P3.6, unavailable catalog milestone:

~~~js
assert.equal(await page.locator('[data-inventory-quantity]').count(), 0);
assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), beforeBytes);
~~~

## Completion states

P3.1–P3.3 plus pure interaction/availability checks deliver unblocked milestone for popup/Dashboard. Full quantities require P3.4/P3.5 add-on gates; structured Power may remain unavailable by approved design. Report blocked tasks unchecked. No implementation/tests executed while planning.
