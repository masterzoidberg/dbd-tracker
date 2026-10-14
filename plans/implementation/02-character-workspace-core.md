# Character Workspace routing and core implementation plan

> **For agentic workers:** After human authorization, use Superpowers `executing-plans`, or `subagent-driven-development` if selected by the human, task-by-task. Track checkbox steps. Planning only.

**Goal:** Deliver canonical workspace navigation, Overview, compatible Perks/setup destinations, and retire generic character popup navigation only after parity.

**Architecture:** Add one pure anchored hash parser/builder beside existing inventory logic. Keep string views/event delegation in `src/app.js`, reuse artwork/perk/setup helpers and canonical state. Compatibility hashes render shared views without forced redirects.

**Tech stack:** Vanilla ES modules/esbuild, existing hash router, native controls/dialogs, Node test runner and Playwright Core.

**Spec:** All five files under `G:\Projects\dbd-tracker\plans\character-update-rework`, especially `02-current-state-audit.md`, `03-character-workspace-design.md`, `04-routing-and-compatibility.md`; approved `G:\Projects\dbd-tracker\plans\frontpage-character-update-rework\03-dashboard-rework-design.md`. Commands/root/checkpoints: [00-master-roadmap.md](00-master-roadmap.md).

## Global Constraints

- Ordinary identity actions → `#character/<id>/overview`; no last-tab tracking, router replacement or mandatory modal.
- Survivor Overview / Perks / Items & Add-ons; Killer Overview / Perks / Power & Add-ons. Edit/Setup are task pages.
- Preserve five recognized manage/experiment aliases and legacy controls; no fabricated experiment legacy alias.
- Invalid recognized character hashes show unavailable content, not Dashboard fallback. Real links/current-section/focus; read-only browsing.
- P2.5 waits for P1 and P3.1–P3.3. Keep popup until all documented capabilities have working destinations; bounded perk/confirmation dialogs remain.
- No invented inventories, active-account tests or Git initialization. Preserve setup flags, additive completion and immediate P1 semantics.

## Review Focus

- Equivalent route aliases must retain reconciliation session selection → P2.1/P2.3.
- Extra segments/unknown IDs/wrong-role sections cannot resolve via loose parsing → P2.1/P2.2.
- Read-only/unowned browsing differs from Owned-only setup → P2.2/P2.4.
- Setup P1 stays durable if subsequent BW/perk setup is canceled → P2.4.
- Browser selectors must stop assuming character dialogs without deleting persistence assertions → P2.5/P2.6.

## File responsibility map

| Files | Responsibility |
| --- | --- |
| Create `src/character-workspace.js`, `tests/character-workspace.test.js` | Parser/builders/route descriptors |
| Modify `src/character-inventory.js`, `tests/character-inventory.test.js` | Compatibility delegation, canonical session key; retain perk helpers |
| Modify `src/app.js`, `styles.css` | Header/Overview/dispatch/setup/producers/focus |
| Modify `src/perk-filters.js`, `tests/filter-domain.test.js` | Canonical legacy-only context and old aliases |
| Modify `src/character-setup.js`, `tests/model.test.js`, `tests/historical-perks.test.js` | Setup view hosting; keep model semantics |
| Create `tests/browser/character-workspace.mjs`, `character-setup.mjs`, `workspace-file.mjs` | Exported regressions + executable CLI wrappers/disposable direct-file checks |
| Modify `tests/browser/smoke.mjs`, `data-flows.mjs`, `portraits.mjs`, `artwork.mjs`, `editor.mjs`, `compact.mjs`, `filtering.mjs` | Targeted popup/legacy regression updates |

Browser red/green staging throughout: `npm run build`, then `node --input-type=module -e "import {stageRuntime} from './scripts/release.mjs'; import {readFile} from 'node:fs/promises'; await stageRuntime(process.cwd(), {manifest:JSON.parse(await readFile('data/asset-manifest.json','utf8'))});"`, then the task's exact browser command. Run candidate builds, not a stale stage. New focused wrappers reuse `smokeStage(stage,{regression})` and fresh contexts.

### P2.1 — Canonical routes and compatible descriptors

**Files:** create `src/character-workspace.js`, `tests/character-workspace.test.js`; modify `src/character-inventory.js`, `tests/character-inventory.test.js`. Current: `parseCharacterInventoryRoute`, `updateRouteKey`, `create/syncCharacterInventorySession`.

**Interfaces produced:** `characterWorkspaceHref(id,section='overview',mode=null) -> hash`; known character/role-valid section only. `parseCharacterWorkspaceRoute(hash) -> descriptor|null`. Valid `{kind:'character',status:'valid',characterId,section:'overview'|'perks'|'items-addons'|'power-addons'|'edit'|'setup',mode:null|'update'|'legacy',source:'canonical'|'manage'|'experiment',canonicalRoute}`. Invalid recognized prefix `{kind:'character',status:'unavailable',reason:'unknown-character'|'invalid-path'|'wrong-role',characterId:null|string}`; unrelated top-level null. Old inventory parser delegates valid Perks descriptors to its existing mode/result contract.

- [ ] Add tests `workspace canonical routes and bare alias`, `old perk aliases keep meaning`, `invalid prefixes do not become dashboard`, `equivalent update aliases preserve session`. Assert every section plus Perks update/legacy, bare alias→Overview, five old mappings, no experiment legacy, extra slashes/segments, constructor/prototype/unknown IDs, wrong role, optional leading hash. Builder rejects unknown/invalid destinations. Session identity uses canonical descriptor, not raw alias text.
- [ ] Red: `node --test tests/character-workspace.test.js tests/character-inventory.test.js`. Expect missing helper or route/session assertion failure.
- [ ] Implement anchored own-property catalog parsing and approved alias mapping; no redirect/history storage. Keep old public parser as delegator, not second truth. Unavailable descriptors remain distinct from null.
- [ ] Green: same exact command; all routes and existing candidate/tier/card-size checks pass without save mutations.
- [ ] Review/commit: `feat: define canonical character workspace routes`.

### P2.2 — Header, Overview and unavailable views

**Files:** modify `src/app.js` (`render`, artwork/heading/status helpers), `styles.css`; create `tests/browser/character-workspace.mjs`. No generic producer cutover yet.

**Interfaces:** consume P2.1/model/registry status; app-local `characterWorkspaceHeader(character,descriptor) -> html`, `characterOverview(id) -> html`, `characterWorkspaceUnavailable(descriptor) -> html`. Browser exports `characterWorkspaceRegression(page,origin)` with CLI `node tests/browser/character-workspace.mjs release/runtime`. Stable `[data-character-workspace]`, `[data-workspace-section]` selectors supplement accessible names.

- [ ] Add `overview control room and errors`: seed owned/unowned/read-only, notes, native personal/floor differences, long names. Assert direct hashes display h1/name/role/Owned/Favorite/P/BW, three nav links/current indicator, Edit entry, native sources and compact summaries. No full inventory grid, fake catalog denominator or fabricated Power. Viewing/routes never change bytes/timestamps; invalid/wrong-role routes display unavailable links; role shell nav active. Interim `/edit` task states may be unavailable until P3, but do not invoke popup.
- [ ] Red: run staging commands above, then `node tests/browser/character-workspace.mjs release/runtime`; expect missing Overview/error view. Common smoke baseline still uses popup before P2.5.
- [ ] Implement canonical dispatch before fallback, Overview order from spec, artwork fallback and Notes summary. Section shells show truthful unavailable data. Reuse main/h1 focus; native section links, no ARIA tabs; read-only browse remains available.
- [ ] Green: same staging/browser commands and `node --test tests/character-workspace.test.js`; expect content/focus/no-write checks pass.
- [ ] Review/commit: `feat: render character overview and workspace navigation`.

### P2.3 — Canonical Perks and legacy compatibility

**Files:** modify `src/app.js` (`characterInventory`, `characterInventoryUpdate`, `legacyManager`, card links), `src/character-inventory.js`, `src/perk-filters.js`, `tests/character-inventory.test.js`, `tests/filter-domain.test.js`, `tests/browser/character-inventory.mjs`, `compact.mjs`, `filtering.mjs`.

**Interfaces:** consume descriptor/builder; preserve existing view signatures and `setCharacterPersonalTier`/historical helpers. Category key `personal` stays compatible, displayed label becomes Native perks. Extend exact `getFilterContext` legacy case to canonical `/perks/legacy` and old alias. Add explicit all-same-role correction scope using rolePerks while retaining current default candidate pool.

- [ ] Add `canonical perks retains personal semantics`, `canonical legacy filter context`, `aliases preserve all correction controls`: effective-owned default, alias search/scopes/Only unrecorded/retained rows, sizes/preference fallback, minima not persisted, clear personal vs effective floor, historical absent/zero/no-downgrade, special personal acquisition without account unlock. Lower-level correction remains in perk details. Detailed/Compact/advanced filters only legacy. Equivalent canonical/alias update keeps selection.
- [ ] Red: `node --test tests/character-inventory.test.js tests/filter-domain.test.js`; stage then `node tests/browser/character-inventory.mjs release/runtime`. Expect canonical dispatch/control/context failures.
- [ ] Route all modes/aliases to shared views, update links/session keys; use native scope buttons/radios rather than incomplete ARIA tabs. Preserve individual autosave/perk state rules/account libraries.
- [ ] Green: repeat exact commands; old hash stays unchanged while shared view works, unknown personal records preserved.
- [ ] Review/commit: `feat: integrate canonical perks with legacy compatibility`.

### P2.4 — Relocate character/batch Setup

**Files:** modify `src/character-setup.js`, `src/app.js` (`advanceCharacterSetup`, `finishCharacterSetup`, handlers/Overview links); create `tests/browser/character-setup.mjs`; extend `tests/model.test.js`, `tests/historical-perks.test.js`. Account Setup behavior in `src/setup.js` remains.

**Interfaces:** `characterSetupView(save,draft,{workspace=false}={}) -> html` supports h1/task exit outside dialog. App-local `openCharacterSetup(id,{batch=null,returnRoute=null}={})` uses existing draft, navigates `/setup`. Transient batch `{ids,index,completed,returnRoute}`; current `completeCharacterSetup` unchanged.

- [ ] Add `setup hosting retains semantics`, `batch skip resume and distinct flags`: Owned-only start, read-only no writes, immediate P1 remains after cancel, P0/BW1 shortcut, prestiged BW1 continues, additive/higher-tier preservation, special acquisition/historical controls, Finish backup-first, failure does not advance/complete, Survivor-first batch/skips/resume, reload loses only batch context. Account three-step autosave/Finish unchanged; routine Edit does not set setup flags.
- [ ] Red units: `node --test tests/model.test.js tests/historical-perks.test.js`; existing semantic tests can already pass. Stage then `node tests/browser/character-setup.mjs release/runtime`; relocation assertions must fail before changes.
- [ ] Adapt host-specific headers/focus/exit, retain model/backup/immediate-P1 semantics. Overview notice is nonblocking Start/Review initial setup. Batch directly hosts Setup routes; Skip/Exit returns initiating route/Overview, never mandatory popup.
- [ ] Green: repeat commands; all host/flag/writer/semantic checks pass.
- [ ] Review/commit: `feat: host initial character setup in workspace`.

### P2.5 — Capability-gated navigation and popup retirement

**Prerequisites:** P1 complete, P2.1–P2.4, P3.1–P3.3 verified. Missing verified inventory does not remove an existing popup function; gated stock pages show unavailable state. P4 converts Dashboard markup later; generic character action fallback goes to Overview now.

**Files:** modify `src/app.js` (`characterCard`, `handleClick`, character-only dialog/forms, hashchange/editor gating); `tests/browser/smoke.mjs`, `data-flows.mjs`, `portraits.mjs`, `artwork.mjs`, `editor.mjs`, `compact.mjs`, `filtering.mjs`, `character-workspace.mjs`, `character-setup.mjs`. Keep `index.html` perk/confirmation dialogs.

**Interfaces:** generic action uses P3 `requestWorkspaceNavigation` + builder. Collection identity/Prestige real links; independent Owned/Favorite buttons retained, explicit Perks shortcut targets `/perks`. `openDetail` remains perk-only. No character popup host after parity.

- [ ] Add `popup capability parity and universal overview entry`, mapping every audit ledger function to Overview/Edit/Setup/Perks/detail. Assert generic Dashboard fallback/collection identity lands Overview, no character `#detail.open`, explicit Perks shortcut remains; all progression/flags/notes/native/setup/correction capabilities work, quantity/queue state preserved. Rewrite common smoke startup to collection link→Overview→Edit→draft BW/Favorite→Save→reload same persistence assertions. Update affected selectors without deleting their intended checks.
- [ ] Red: stage, `node tests/browser/character-workspace.mjs release/runtime`, `node tests/browser/character-setup.mjs release/runtime`, `node tests/browser/smoke.mjs`; expect old producer/popup behavior fails new expectations.
- [ ] Convert producers minimally and connect dirty guard; remove only obsolete character rendering/form listeners after parity. Dirty Edit perk reference dialogs cannot bypass draft with existing immediate correction controls. Keep bounded confirmations/perk detail. Update shared smoke baseline atomically with cutover.
- [ ] Green: repeat commands and `node --test tests/character-inventory.test.js tests/filter-domain.test.js`; all old bookmark/full capability checks pass, read-only browse intact.
- [ ] Review/commit: `feat: route character actions to overview and retire popup`.

### P2.6 — Direct-file, focus and responsive integration

**Files:** create `tests/browser/workspace-file.mjs`; extend `tests/browser/character-workspace.mjs`, `smoke.mjs`, `tests/release.test.js`; fix only necessary `styles.css`/`src/app.js`; update `docs/runtime-README.md` manual checklist.

**Interfaces:** file CLI `node tests/browser/workspace-file.mjs release/runtime` launches existing browser in fresh context, uses `pathToFileURL` for absolute staged index, blocks external traffic. Integrate workspace/setup exports into full smoke.

- [ ] Test direct canonical/old hashes on file/localhost, bare alias, invalid/wrong-role, back/forward, h1/main focus/current section, no last-tab. Layout at 320/500/760/1100/1440/1600, long name/large safe-integer Prestige/status/actions, keyboard/touch targets/no page overflow (shell nav strip is separate). Legacy alias filter focus persists. File writer unavailable must stay read-only rather than bypass guard.
- [ ] Red: stage then `node tests/browser/character-workspace.mjs release/runtime` and `node tests/browser/workspace-file.mjs release/runtime`; expect identified route/layout/focus regression, not prerequisite failure.
- [ ] Fix targeted errors; update release selectors/assertions and manual direct-file edit/reopen checklist. Real browser 200% zoom in disposable acceptance must be recorded; CSS zoom/deviceScaleFactor is not equivalent proof.
- [ ] Green: same commands plus `npm run release`; full staged smoke/file browse pass. Complete manual 200% zoom, keyboard and writer-capable direct-file Save/reopen before release acceptance.
- [ ] Review/commit: `test: verify workspace compatibility and accessible layouts`.

## Test assertion anchors

Use these in the named failing task tests; fixture setup and additional cases are in each task. Browser assertions use Node assert and existing Playwright page API.

P2.1:

```js
test('old perk aliases keep meaning', () => {
  assert.equal(parseCharacterWorkspaceRoute('#manage/meg-thomas').canonicalRoute,
    '#character/meg-thomas/perks');
  assert.equal(parseCharacterWorkspaceRoute('#character/the-doctor/items-addons').status,
    'unavailable');
});
```

P2.2, after direct Overview hash load:

```js
assert.equal(await page.locator('[data-character-workspace] h1').count(), 1);
assert.equal(await page.getByRole('link', {name:'Overview',exact:true}).getAttribute('aria-current'), 'page');
assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), beforeBytes);
```

P2.3, same-role fixture and old/canonical Update URLs:

```js
assert.deepEqual(characterNormalInventory(save, 'meg-thomas').map(r => r.perk.id), expectedIds);
assert.equal(parseCharacterWorkspaceRoute('#manage/meg-thomas/update').canonicalRoute,
  '#character/meg-thomas/perks/update');
```

P2.4, after Setup immediate P1 then cancel:

```js
const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
assert.equal(saved.characters['meg-thomas'].prestige, 1);
assert.equal(saved.characters['meg-thomas'].setupComplete, false);
```

P2.5, after collection identity link:

```js
await page.waitForURL('**/#character/meg-thomas/overview');
assert.equal(await page.locator('#detail').evaluate(d => d.open), false);
```

P2.6, each viewport after headings/fonts settle:

```js
assert.equal(await page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth), true);
```

## Acceptance boundary

Core may coexist with popup until P2.5; do not cut over early. Working Overview precedes P4 links. Unavailable inventory/Power shells are honest milestones, not completed data ingestion. No code/test commands executed during planning.
