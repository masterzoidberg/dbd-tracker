# Complete schema v2 and persistence implementation plan

> **For agentic workers:** After human authorization, use Superpowers `executing-plans`, or `subagent-driven-development` if the human selects it, task-by-task. Track steps with checkboxes. This document authorizes planning only.

**Goal:** Safely read v1 and read/write complete v2 containing both Prestige Queue and per-character quantity maps.

**Architecture:** Extend the current canonical `src/model.js` validation boundary and `TrackerStorage`; separate structural version conversion from existing account normalization. Small pure quantity/queue helpers make validation and UI contracts testable without a catalog or browser. Preserve storage keys and adopt only successful canonical writes.

**Tech stack:** Vanilla JS ES modules, Node >=22 `node:test`, localStorage/Web Locks, esbuild, existing Playwright Core/Edge.

**Spec:** `G:\Projects\dbd-tracker\plans\character-update-rework\05-inventory-and-editing-design.md`; `01-survivor-items-addons-quantity-requirements.md` in that directory; `G:\Projects\dbd-tracker\plans\frontpage-character-update-rework\03-dashboard-rework-design.md`. Read their audits for current behavior. Root/command convention: [00-master-roadmap.md](00-master-roadmap.md).

## Global Constraints

- One complete schema v2; `prestigeQueue`, `inventory.items`, `inventory.addons`. No intermediate queue-only v2.
- Preserve `safeId` syntax and existing native/global/personal/historical perk semantics. Quantities: non-negative safe integers, sparse positive canonical state.
- Unknown well-formed IDs survive; known wrong role/map/owner and malformed state reject whole candidates. No records fabricated from unknown queue references.
- Existing account-rule normalization stays at load/replace entry points; no new normalization on parse or normal save.
- Writer-gated writes/backups/recovery; read-only migration is memory-only. Keep `dbdTrackerData`, `dbdTrackerBackups`, existing recovery keys and maximum five backups.
- No catalog fabrication, dependencies, cloud, broad refactor or active-account testing. Commit/checkpoint convention is in roadmap; runtime cutover only in P1.3.

## Review Focus

- Explicit zero is canonical omission for quantities but remains meaningful in historical personal perks → P1.1/P1.3.
- Unknown quantity definitions becoming known can reveal incompatibility; fail without pruning → P1.1 and P3.4/P3.5.
- Parse-time conversion must not hide a pending migration or replace predecessor version in backup → P1.3.
- Valid but differently formatted timestamps stay byte-preserved through structural conversion → P1.3/P1.4.
- Backup/write failure cannot adopt candidate state, including recovery originals → P1.3/P1.4.

## File responsibility map

| Files | Responsibility |
| --- | --- |
| Create `src/inventory-quantities.js`, `tests/inventory-quantities.test.js` | Safe namespace/quantity canonicalization and edit validation; no I/O |
| Create `data/inventory-catalog.js` | Catalog registry exports, initially genuinely unavailable/empty, no synthetic runtime IDs; populated by P3 |
| Modify `src/model.js`, `tests/model.test.js` | Complete-v2 validation, v1 preservation/migration/defaults/serialization |
| Modify `src/storage.js`, `tests/storage.test.js`, `tests/editor.test.js`, `tests/recovery.test.js` | Migration signal/predecessor/write/replacement safety |
| Create `src/prestige-queue.js`, `tests/prestige-queue.test.js` | Queue validation/actions/derived rows/focus/benefits |
| Modify `src/app.js`, `tests/browser/data-flows.mjs`, `recovery.mjs`, `editor.mjs` | Schema/import/reset/restore copy and runtime adoption; no Dashboard rework here |
| Modify `README.md`, `docs/runtime-README.md` | Version portability and structural migration information when runtime changes |

Do not extract unrelated model/view code. New modules have one necessary pure-domain/catalog responsibility.

### P1.1 — Quantity canonicalization with catalog-compatible validation

**Files:** create `src/inventory-quantities.js`, `data/inventory-catalog.js`, `tests/inventory-quantities.test.js`. Current reference: `src/model.js` private `safeId`, `integer`, `validateSave`; leave its runtime version unchanged in this task.

**Interfaces produced:** `freshInventory() -> {items:{},addons:{}}`; `canonicalizeQuantityMaps(inventory, characterId, entityById) -> {inventory,warnings:string[]}`; `parseQuantityInput(text:string) -> number` (throw useful validation error); `assertQuantityEntity(characterId,map:'items'|'addons',id,entityById) -> void` (requires known applicable entity for UI). Registry exports `inventoryEntityById`, `inventoryEntities`, `inventoryCatalogStatus={survivor:'unavailable',killerAddons:'unavailable',killerPowers:'unavailable'}`, `killerPowerByCharacterId={}`. No runtime entities until verified ingestion.

- [ ] Add tests `quantity sparse canonicalization is separate from perk zero`, `unknown slug quantities survive`, `known incompatible quantities reject`, `numeric text rejects blank fractional unsafe`. Use a clearly synthetic test-only registry: one Survivor Item, one Survivor Add-on, one Killer Add-on with actual known character owner, each following approved prefixes. Assert input not mutated; zero keys omitted; positive/max-safe retained; errors on array/null maps, slash/prototype/constructor keys, wrong namespace/map, Killer items, known other-Killer add-on, numeric strings/null/bools/negative/fraction/unsafe values. Unknown characters retain valid maps without inferred role. Unknown well-formed allowed namespace preserves quantity/warning; known Survivor/Killer role mismatch rejects even when entity unresolved by prefix.
- [ ] Red: `node --test tests/inventory-quantities.test.js`. Expect FAIL for missing helpers; after imports exist, require failing behavioral assertions rather than syntax failures.
- [ ] Implement the signatures above using current slug grammar unchanged and `Number.isSafeInteger`. Lookup full IDs for known owner checks; do not parse a variable-length character slug from hyphens. Unknown namespace-valid IDs stay unresolved; UI assertion requires registry membership. Empty registry is data-unavailable state, not a fabricated catalog.
- [ ] Green: `node --test tests/inventory-quantities.test.js tests/model.test.js`. Expect all pass, existing v1 behavior untouched. Include a test resolving an unknown fixture to an incompatible owner and asserting rejection without mutation.
- [ ] Review/commit only listed files: `feat: define canonical inventory quantity validation`.

### P1.2 — Validate the full v2 shape without activating runtime v2

**Files:** modify `src/model.js`, `tests/model.test.js`; create `src/prestige-queue.js`, `tests/prestige-queue.test.js` (validation only). Current points: `freshProgress`, `freshSave`, `migrateData`, `validateSave` reconstruction loop.

**Interfaces:** consume P1.1 registry/helpers. Produce `validatePrestigeQueue(value) -> canonical entries[]` and `validateCompleteV2(input,{inventoryCatalog=inventoryEntityById}={}) -> {save,warnings}`. Queue entries are exactly `{characterId,targetPrestige}`. Keep `SCHEMA_VERSION=1` and existing `validateSave` path active until P1.3; complete-v2 validator can be directly unit-tested before cutover. Reuse existing field validation internally without changing v1 default semantics.

- [ ] Add `complete v2 requires all maps and queue`, `queue unavailable references are retained without records`, `v2 quantity and queue round trip structure`, `historical explicit zero survives v2`. Assert required maps for supplied records, defaults for omitted known-catalog records, preserved unknown character records; fail missing queue, duplicate IDs, malformed entries, zero/negative/fraction/unsafe targets, absent inventory/items/addons, wrong role/map/owner. Completed/unowned goals remain structurally valid. An unknown queue ID absent from characters stays absent. Extra queue metadata is canonicalized away. Existing perk zero is retained while quantity zero is omitted.
- [ ] Red: `node --test tests/model.test.js tests/prestige-queue.test.js`. Expect missing complete-v2 validator/queue validation or failed shape assertions.
- [ ] Implement explicit v2 reconstruction including P1.1 maps. Apply namespace rules without requiring unknown IDs to resolve. Preserve all existing supported character/account fields and warnings. `validateCompleteV2` must reject schema1 and future versions; public dispatch added next. Omitted known catalog records get `{...freshProgress(),inventory:freshInventory()}` in this pre-cutover validator even while the public v1 freshProgress remains unchanged. Canonical save fields stay data-only, not migration metadata.
- [ ] Green: `node --test tests/model.test.js tests/prestige-queue.test.js tests/inventory-quantities.test.js`. Expect v1 remains active, full-v2 fixtures pass, all malformed cases reject. Treat test-only entity fixtures as injected registry, never production definitions.
- [ ] Review/commit: `feat: validate complete schema v2 before runtime cutover`.

### P1.3 — Atomic version dispatch and protected structural migration

**Files:** modify `src/model.js`, `src/storage.js`, `tests/model.test.js`, `tests/storage.test.js`, `tests/editor.test.js`, `tests/recovery.test.js`. Current points: `SCHEMA_VERSION`, `freshProgress/freshSave`, `parseSave/validateSave/migrateData`, `TrackerStorage.load/save/replace`.

**Interfaces produced:** `SCHEMA_VERSION=2`; `freshProgress` includes fresh inventory, `freshSave` includes empty queue. `validateSave(input,{inventoryCatalog=inventoryEntityById}={})` and `parseSave(text)` return `{save,warnings,sourceSchemaVersion,migrationRequired,predecessor}`; predecessor is validated supported v1 state with `schemaVersion:1` when converting, otherwise null. `migrateData(data) -> complete-v2 canonical data`, no account-rule normalization. `TrackerStorage.load` keeps its existing caller result and `migrationPending`, adding metadata without breaking callers. Save document never serializes metadata.

- [ ] Write `valid v1 migrates all records without activity`, `raw version signals pending migration`, `writable migration backs up v1 predecessor`, `read only migration has no writes`, `failed migration backup/save preserves current bytes`. Build explicit v1 fixtures from supported old fields (do not assume changed `freshSave` produces v1). Include missing account-rule marker versus marker1, aliases, unusual parseable timestamp strings, unknown character, legacy explicit perk0, setup flags/settings/overrides. Assert deep preservation except complete-v2 empty additions and existing normalization at existing boundaries. Future version3 and incomplete v2 reject. Old v1-only validator behavior rejects a v2 fixture; emulate the previous version boundary in a test fixture rather than downgrading current app data.
- [ ] Red: `node --test tests/model.test.js tests/storage.test.js tests/editor.test.js tests/recovery.test.js`. Expect fresh version1/missing structural signal and predecessor-backup assertions fail.
- [ ] Activate version2 only together with full inventory and queue validator, defaults and storage handling. Keep validated v1 predecessor separately before normalization/conversion; normalize the compatible working state only in load/replace as today. Detect migration via source signal OR existing normalization difference. Backup valid predecessor before writer-protected replacement; backup failure prevents save. Structural-only transition keeps account and character times; existing account normalization retains its current account-time behavior. Read-only shows migrated memory and pending notice without writes/backups. Ordinary storage save validates complete-v2; never applies account normalization.
- [ ] Update existing v1 fixtures/assertions deliberately; unsupported-version tests target3, not now-supported2. Do not weaken old invalid-input or canonical-reconstruction assertions. Green: `node --test tests/model.test.js tests/storage.test.js tests/editor.test.js tests/recovery.test.js tests/inventory-quantities.test.js tests/prestige-queue.test.js`. Expect valid v1 reads, complete v2 writes, old bytes/memory unchanged on failures, source inputs unmutated.
- [ ] Review/commit atomic boundary: `feat: migrate and persist complete schema v2`. No published intermediate state; no quantity UI writes before this checkpoint.

### P1.4 — Import/export/restore/reset and recovery contain complete state

**Files:** modify `src/app.js` (`restore/reset/dataPage`, import-file change handler, `enableEditing`), `tests/storage.test.js`, `tests/recovery.test.js`, `tests/browser/data-flows.mjs`, `tests/browser/recovery.mjs`, `tests/browser/editor.mjs`, `README.md`, `docs/runtime-README.md`. `exportSave` in model only if needed; keep existing `exportedAt`.

**Interfaces:** consume P1.3 results and existing `TrackerStorage.replace(current,next,reason,{recover})`. Preserve method shape; no merge. App import/restore confirmation distinguishes v1 empty goals/stock from v2 incoming data using source metadata before canonicalization.

- [ ] Add unit assertions for v2 export→parse semantic retention of queue order/unknowns and both maps, v1 import/restore emptying them, reset defaults, five-snapshot behavior, unknown inventory through ordinary save, backup and restore. Add browser `completeV2DataFlows` checks inside existing exported regression functions: seed disposable full-v2 unknown quantities + goal; export/download/parse; cancel import/restore/reset unchanged; accepted replace backed up; corrupt-current recovery preserves exact raw bytes; write/backup failures retain canonical app memory as well as storage. Assert schema label/copy2 and accurate replacement warnings.
- [ ] Red units: `node --test tests/storage.test.js tests/recovery.test.js`. If unit behavior already passes, browser assertions own new copy/interaction. Build/stage using the commands below, then run the exported data-flows regression and recovery CLI. Expect red on new schema/copy/retention assertion, not staging/startup failure. The data-flows file has no CLI, so importing it alone does not execute tests.

    npm run build
    node --input-type=module -e "import {stageRuntime} from './scripts/release.mjs'; import {readFile} from 'node:fs/promises'; await stageRuntime(process.cwd(), {manifest:JSON.parse(await readFile('data/asset-manifest.json','utf8'))});"
    node --input-type=module -e "import {smokeStage} from './tests/browser/smoke.mjs'; import {dataFlowsRegression} from './tests/browser/data-flows.mjs'; await smokeStage('release/runtime',{regression:dataFlowsRegression});"
    node tests/browser/recovery.mjs release/runtime
- [ ] Implement only schema/copy/import metadata and existing adoption paths needed; assert writer before replacement preparation, preserve raw recovery behavior. Do not show Saved locally after failed write or silently export fallback state under blocked storage. Update portability docs explaining older app rejection and v1 replacement empties goals/stock.
- [ ] Green: repeat those exact unit/build/stage/browser commands; `node tests/browser/editor.mjs release/runtime`. Expect all checks pass with isolated profiles and read-only no writes. Browsing/global export stays usable when storage valid; corrupt storage retains raw-export recovery.
- [ ] Review/commit: `feat: preserve queue and inventory across data workflows`.

### P1.5 — Pure queue actions, focus and truthful native-perk benefit

**Files:** extend `src/prestige-queue.js`, `tests/prestige-queue.test.js`. Current reference: Dashboard inline targets in `src/app.js`; model `globalTier/isAvailable/prestigeTier`, `characterById`.

**Interfaces produced:** `derivePrestigeQueue(save) -> {rows,focus}`; each row `{entry,index,character|null,progress|null,owned,complete:boolean|null,unavailable:boolean,benefit}`; focus is first resolved saved-owned incomplete row or null, never filtered. `applyPrestigeQueueAction(save,action) -> boolean changed`, mutates only queue; actions `{type:'add'|'target'|'remove'|'move',characterId,targetPrestige?,direction?:-1|1}`. `prestigeTargetBenefit(save,characterId,targetPrestige) -> {improvedNativeIds,globalTierMilestone:number|null}`. Schema validation remains independent of creation rules.

- [ ] Add `focus skips complete unowned unknown and reactivates corrections`, `manual order and completed goals survive`, `creation differs from import`, `native benefits respect overrides and General`. Fixture includes saved/resolved/unowned, unknown goal without character record, completed, Prestige correction, same goal duplicate, P1/P3/P6/P9 safe shortcuts. Assert add owned-only append and target >current; existing unowned resolved target edit allowed when >current; unknown target edit denied but remove/move allowed. Boundary move/no-op reports false; no character timestamps/notes/ownership touched. P4+ target never claims new tierIV or unconditional three perks; intermediate P1–P3 improvement labeled as milestone.
- [ ] Red: `node --test tests/prestige-queue.test.js`. Expect missing actions/derivation or incorrect focus assertions.
- [ ] Implement using catalog/model selectors and original array positions. No stored focus/completion/rank/role/history; recommendations do not participate in action logic. Keep deterministic validation/errors and one entry per ID. Do not mutate queue while deriving.
- [ ] Green: `node --test tests/prestige-queue.test.js tests/model.test.js`. Expect exact array-order retention, floor/override benefits and unchanged save except intentional queue action.
- [ ] Review/commit: `feat: define prestige queue actions and derived focus`.

## Test assertion anchors

Place these anchors in the corresponding first failing test, alongside the richer fixtures/assertions required by that task. Use `node:test` and `node:assert/strict`; build explicit v1/v2 fixtures from the specified supported fields. No snippets are production implementations.

P1.1, quantity text boundary:

```js
test('quantity text rejects blank fractional unsafe', () => {
  assert.equal(parseQuantityInput('0'), 0);
  assert.equal(parseQuantityInput('12'), 12);
  for (const text of ['', '-1', '1.5', '9007199254740992'])
    assert.throws(() => parseQuantityInput(text));
});
```

P1.2, imported completed goal versus malformed persisted duplicate:

```js
test('persisted queue validation preserves completed targets', () => {
  const goal = {characterId:'meg-thomas', targetPrestige:1};
  assert.deepEqual(validatePrestigeQueue([goal]), [goal]);
  assert.throws(() => validatePrestigeQueue([goal, goal]), /duplicate/i);
});
```

P1.3, after constructing valid explicit v1 fixture with no inventory/queue:

```js
const result = validateSave(v1Fixture);
assert.equal(result.sourceSchemaVersion, 1);
assert.equal(result.migrationRequired, true);
assert.equal(result.predecessor.schemaVersion, 1);
assert.deepEqual(result.save.prestigeQueue, []);
assert.deepEqual(result.save.characters['meg-thomas'].inventory, {items:{},addons:{}});
assert.equal(result.save.characters['meg-thomas'].updatedAt,
  v1Fixture.characters['meg-thomas'].updatedAt);
```

P1.4, complete candidate with unknown positive quantities and valid queue:

```js
const roundTrip = parseSave(exportSave(v2Fixture)).save;
assert.deepEqual(roundTrip.prestigeQueue, v2Fixture.prestigeQueue);
assert.deepEqual(roundTrip.characters['meg-thomas'].inventory,
  v2Fixture.characters['meg-thomas'].inventory);
```

P1.5, focus skips a completed first row:

```js
const save = freshSave();
save.characters['meg-thomas'].owned = true;
save.characters['meg-thomas'].prestige = 1;
save.characters['dwight-fairfield'].owned = true;
save.prestigeQueue = [
  {characterId:'meg-thomas',targetPrestige:1},
  {characterId:'dwight-fairfield',targetPrestige:1}
];
assert.equal(derivePrestigeQueue(save).focus.entry.characterId, 'dwight-fairfield');
save.characters['meg-thomas'].prestige = 0;
assert.equal(derivePrestigeQueue(save).focus.entry.characterId, 'meg-thomas');
```

## Plan acceptance

After tasks: `npm test`, then `npm run release` (existing staged full suite) when the tasks' focused checks pass. Both queue and maps must exist in actual writes/exports even without ingested catalogs. P2/P3/P4 consume these signatures, not optional v1 extensions. No implementation tests were run to write this plan. Stop for roadmap checkpoint review before later integration.
