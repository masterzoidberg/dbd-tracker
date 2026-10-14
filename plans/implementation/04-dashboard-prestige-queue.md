# Dashboard and Prestige Queue implementation plan

> **For agentic workers:** After human authorization, use Superpowers executing-plans, or subagent-driven-development if selected, task-by-task. Track checkbox steps. Planning only.

**Goal:** Implement approved action-first Option B with one authoritative manual queue, derived Current Focus and real Overview links.

**Architecture:** Consume P1 pure queue validation/actions/derivation and P2 route builder. Keep dashboard composition/helpers/string rendering/event delegation in src/app.js; a small pure selector module isolates unchanged suggestions and chronological recent selection. Queue view filters/disclosure are ephemeral, array order is global.

**Tech stack:** Existing ES modules/esbuild, native links/buttons/dialogs, Node tests/Playwright Core, writer-protected canonical localStorage v2.

**Spec:** G:\Projects\dbd-tracker\plans\frontpage-character-update-rework\01-dashboard-current-state-audit.md, 02-dashboard-design-options.md, 03-dashboard-rework-design.md; G:\Projects\dbd-tracker\plans\character-update-rework\04-routing-and-compatibility.md and 05-inventory-and-editing-design.md. Read [00-master-roadmap.md](00-master-roadmap.md), P1 and P2 interfaces before execution.

## Global Constraints

- Option B hierarchy closed: Queue/Current Focus, Continue, P1 suggestions, collection/perk progress, distribution, secondary Favorites.
- Manual global array authoritative; no auto reorder/add/removal, history/completion persistence, queue notes or stored focus.
- Owned/resolved additions only; current focus first resolved saved-owned incomplete entry across full queue. Completed/unowned/unknown entries retained.
- Targets positive safe integer >current on add/edit; stored completed targets valid. P1/P3/P6/P9 shortcuts disable already-reached targets.
- All character links Overview, no popup/last-tab; unknown unresolved goal has no fabricated link.
- Complete v2 from P1 only; P2.5 destination/parity gate before producer switch. Quantity/reference data gates do not block Dashboard; no inventory summaries.
- Writer-safe actions; queue-only commits account timestamp, not character activity. Existing setup/export/recovery available; no framework/dependency/refactor.
- Disposable tests only; checkpoint/Git convention from roadmap.

## Review Focus

- Filtering must not redefine focus or reorder across hidden roles → P4.2/P4.4.
- Known unowned/unknown entries make “all complete” copy dishonest → P4.2/P4.4.
- Equal instants with different timestamp bytes need parsed ordering and name tie-break without rewrite → P4.1.
- Account overrides/General lower native benefit; P4+ must not claim a new global tier → P4.1/P4.2.
- Removing/moving rows cannot lose keyboard focus or shift it just because derived focus changed → P4.4/P4.5.

## File responsibility map

| Files | Responsibility |
| --- | --- |
| Create src/dashboard-selectors.js, tests/dashboard-selectors.test.js | Pure suggestions/recent/resume selection |
| Consume src/prestige-queue.js; extend tests/prestige-queue.test.js if integration reveals missing constraints | Domain actions/focus from P1, no duplicate queue logic |
| Modify src/app.js (dashboard, role/perk summaries, global setup launch, queue handlers/dataPage), styles.css | Composition/native queue actions/states/focus |
| Create tests/browser/dashboard.mjs; extend tests/browser/smoke.mjs, data-flows.mjs, editor.mjs, character-workspace.mjs, tests/release.test.js | Focused exported regression/CLI and staged integration |

Browser red/green staging: npm run build, then:

    node --input-type=module -e "import {stageRuntime} from './scripts/release.mjs'; import {readFile} from 'node:fs/promises'; await stageRuntime(process.cwd(), {manifest:JSON.parse(await readFile('data/asset-manifest.json','utf8'))});"

Then node tests/browser/dashboard.mjs release/runtime. New wrapper invokes smokeStage with exported dashboardRegression(page,origin), fresh context. P2.5's common Overview/Edit startup must already pass.

### P4.1 — Suggestions, recent timestamps and queue view inputs

**Files:** create src/dashboard-selectors.js, tests/dashboard-selectors.test.js. Current: inline dashboard suggestions/recent/favorites in src/app.js, globalTier/isAvailable and existing character timestamps.

**Interfaces:** suggestedP1Targets(save) → [{character,missing}] maximum5, missing globally locked native count; same missing-desc/BW-desc/name-asc ordering. recentCharacters(save,limit=5) → characters sorted parsed instant desc/name asc, catalog-resolved saved records only, includes unowned, no write. favoriteCharacters(save) → same current favorite subset including unowned, deterministic name order. Consume derivePrestigeQueue(save) from P1; never reimplement focus here.

- [ ] Write “P1 ranking unchanged and independent of queue”, “recent parsed instants retain bytes”, “favorite unowned remains independent”. Include owned source with General/override native perks, zero missing/no owned, tied counts/BW/name, >5. Queue mutations leave suggestions unchanged. ISO/offset/valid non-normalized timestamp fixtures sort chronologically, exact strings preserved, equal instants tie name; absent/null/unknown excluded without inventing visit activity; unowned remains. Favorite never adds goals.
- [ ] Red: node --test tests/dashboard-selectors.test.js tests/prestige-queue.test.js. Expect missing selector/ranking or parsed-date assertions.
- [ ] Implement pure selectors using current catalog/model, no persistence/timers/schema additions. Return domain rows for composition with canonical IDs.
- [ ] Green: repeat exact command; unchanged ranking, deterministic chronology, no mutation.
- [ ] Review/commit: feat: define dashboard suggestion and recent-edit selectors.

### P4.2 — Queue panel and honest derived states

**Files:** modify src/app.js (dashboard composition/helpers), styles.css; create tests/browser/dashboard.mjs. Prerequisite P1 queue domain and P2.5.

**Interfaces:** app-local prestigeQueuePanel(save,viewState) → HTML; prestigeQueueRow(row,{management,canReorder}) → HTML; viewState {expanded:false,role:'all'} ephemeral. All links use characterWorkspaceHref(id,'overview'), controls separate native buttons.

- [ ] Add browser “queue preview and focus are global”, “all state copies honest”. Fixtures: empty; no owned candidates; all complete; unknown/unowned blocked; earlier corrected state; focus outside first3. Assert first3 global positions plus focus outside, focus detail only once, completed/unavailable rows represented, role/name/P/BW/target/status/actual marginal benefit. Unknown no navigation/target edit; known unowned Overview/removal present. Manage expands all rows, role filter shows global positions and unknown only All, focus unchanged. Empty role filter offers Show All, no false all-complete with unresolved goals.
- [ ] Red: stage then node tests/browser/dashboard.mjs release/runtime. Expect missing panel/preview/states/Overview links.
- [ ] Compose using derivePrestigeQueue; no writes during completion/focus derivation, no separate persistent pin. Integrated focus detail not a duplicate large section; native ordered-list semantics and readable text statuses.
- [ ] Green: same staging/CLI plus node --test tests/prestige-queue.test.js. Expect preview/focus/order/state assertions pass.
- [ ] Review/commit: feat: render prestige queue and current focus.

### P4.3 — Action-first hierarchy and all real Overview producers

**Files:** modify src/app.js (dashboard, roleSummary, perkSummary, prestigeChart, setup launcher, dataPage Review account setup), styles.css; extend tests/browser/dashboard.mjs, character-workspace.mjs. No queue mutation here.

**Interfaces:** consume P4.1 selectors/queue panel/P2 builder. Preserve summary calculations; change presentation only. Account setup action keeps setupOpen/setupStep and existing three steps.

- [ ] Add “Option B order and destination links”, “setup completion hides prompt but preserves review”, “compact stats keep existing values”. DOM order Queue/Continue→suggestions→collection/perk progress→distribution→secondary Favorites; wide Queue/Continue paired, narrow stacks. Current Focus/queue/suggestion/recent/Favorite all real Overview links, no popup. Continue max5/currentP/BW/time supporting Recently edited text/absolute semantic time, unowned label. Suggestions independent/In queue badges, no invented higher goal optimization. Collection owned/total/locked/P1/P3 retain owned-only; total/average/Favorite count compact disclosure, no stats page. Account access versus personal clearly labeled, distribution P0/P1/P2/P3+ and zero-owned state. Quiet actual10.1.2a catalog line/details, global export/writer/recovery status and Run character setups retained. Completed account hides Dashboard setup prompt; Data Review still reachable without resetting flags.
- [ ] Red: stage then node tests/browser/dashboard.mjs release/runtime; expect previous hierarchy/buttons/setup launcher fail assertions.
- [ ] Implement bounded helper/composition updates, real builder links, exact approved hierarchy/compact treatments. No inventory Dashboard counts, new route/stored activity, or fabricated completion dates. Recommendation Add entry remains independent of row navigation.
- [ ] Green: repeat exact commands and node tests/browser/character-workspace.mjs release/runtime; links land Overview and no dead task destination.
- [ ] Review/commit: feat: apply approved action-first dashboard hierarchy.

### P4.4 — Native queue add/edit/remove/move with protected writes

**Files:** modify src/app.js (handleClick/commit/editor gating/dialog handlers), index.html if existing native dialog content needs bounded target form, styles.css; extend tests/browser/dashboard.mjs, tests/browser/editor.mjs, tests/prestige-queue.test.js.

**Interfaces:** app-local commitPrestigeQueueAction(action) → boolean uses applyPrestigeQueueAction(next,action) with current account save and existing commit, characterId omitted. No-op bypasses commit. openPrestigeTargetEditor(characterId,{adding}) retains native dialog/returns opener focus. Native target input and four shortcut buttons.

- [ ] Add “queue actions persist global intent only”, “creation and imported goals differ”, “filtered ordering disabled”, “writer/storage failure keeps old queue”. Owned/resolved candidate add appends, suggestion validP1 preselected, duplicates blocked, target safe integer/current constraint, reached shortcuts disabled. Existing resolved unowned target edit allowed >current; unknown only remove/move. Completed can raise/remove, never auto-delete; remove touches only goal. Moves one adjacent global position in All, boundary disabled; Survivor/Killer views cannot reorder and explain Show All. Filter doesn't alter focus/order/positions. Queue commit changes account time only; Favorite/Owned remain independent, corrected Prestige/ownership reactivates old goal. Dialog cancel/no-op/failed write no bytes/times changes, one protected successful action, read-only forced events denied before preparations.
- [ ] Red: stage then node tests/browser/dashboard.mjs release/runtime; node --test tests/prestige-queue.test.js for any new domain gap. Expect missing mutation handlers/incorrect gating/timestamps.
- [ ] Implement P1 actions with writer assertion, per-action clone/adopt and no-op check; bounded native target dialogs with inline errors. Append manual goals only; suggestions never reorder. Stable IDs per row/control; after move focus same control, after remove next/previous surviving row or Add, after dialog close opener fallback. Announce position/status politely; derived focus changing never steals focus.
- [ ] Green: same unit/stage/browser commands plus node tests/browser/editor.mjs release/runtime. Expect global order and complete-v2 retention across reload, failure/read-only safe.
- [ ] Review/commit: feat: manage prestige queue with protected native controls.

### P4.5 — Responsive/accessibility and full end-to-end Dashboard integration

**Files:** extend tests/browser/dashboard.mjs, smoke.mjs, workspace-file.mjs, data-flows.mjs, editor.mjs, tests/release.test.js; targeted styles.css/src/app.js fixes; docs/runtime-README.md acceptance evidence.

**Interfaces:** register dashboardRegression in full smoke; file wrapper includes Dashboard Overview producers and queue/editor state. Same P1 complete-v2 save, no second queue store.

- [ ] Add “keyboard queue and layouts”, “v2 dashboard workspace end-to-end”: disposable v1 import→v2 predecessor backup→Setup→Edit cancel/Save→queue target/move/focus correction→export/reload/restore/reset/recovery→old hashes. Assert goals plus quantities/unknown inventory retained through every non-destructive path; v1 replacement empties with warning. Check 320/500/760/1100/1440/1600 long names/unknown IDs/max targets, visible focus/touch targets/native headings/links/no nested controls/no color-only status/no page overflow. Keyboard dialog shortcuts/validation/move/remove/filter focus; writer/recovery/export status never hidden. Actual 200% browser zoom and direct-file acceptance separately recorded.
- [ ] Red: stage then node tests/browser/dashboard.mjs release/runtime and node tests/browser/workspace-file.mjs release/runtime; expect identified keyboard/overflow/integration gaps. Missing verified inventory editors is approved unavailable state, not a fabricated test pass.
- [ ] Fix contained layout/focus defects, integrate required regression exports, update manual checklist/verification details. Keep DOM order and summaries unchanged by responsive styling. Full suite runs all ready-data inventory tests; blocked sources remain explicit.
- [ ] Green: npm test; npm run release; npm run test:browser -- --chrome if installed; node tests/browser/workspace-file.mjs release/runtime. Expected full staged tests pass, disposable file reopen/keyboard/real200%zoom manual acceptance signed off. No active save accessed.
- [ ] Review/commit: test: verify dashboard workspace and persistence integration.

## Test assertion anchors

Include these in each corresponding first failing test with the task's named fixture and additional assertions. New view selectors data-prestige-queue-row/data-queue-position and data-dashboard-character-link should be assigned by their renderer tasks; use accessible names for actual user actions.

P4.1, fixture timestamps in different valid representations:

~~~js
const original = JSON.stringify(save);
assert.deepEqual(recentCharacters(save).map(c => c.id), expectedChronologicalIds);
assert.equal(JSON.stringify(save), original);
~~~

P4.2, role view must not redefine focus:

~~~js
assert.equal(await page.locator('[data-current-focus]').getAttribute('data-character-id'),
  expectedGlobalFocusId);
assert.equal(await page.locator('[data-prestige-queue-row][data-queue-position="1"]').count(), 1);
~~~

P4.3, every resolved Dashboard character producer:

~~~js
for (const href of await page.locator('[data-dashboard-character-link]').evaluateAll(
  links => links.map(link => link.getAttribute('href'))))
  assert.match(href, /^#character\/[a-z0-9-]+\/overview$/);
~~~

P4.4, after successful queue action on existing saved fixture:

~~~js
const after = JSON.parse(await page.evaluate(() => localStorage.getItem('dbdTrackerData')));
assert.notEqual(after.updatedAt, before.updatedAt);
assert.equal(after.characters['meg-thomas'].updatedAt, before.characters['meg-thomas'].updatedAt);
assert.deepEqual(after.characters['meg-thomas'].inventory, before.characters['meg-thomas'].inventory);
~~~

P4.5, keyboard/move checks at each specified viewport:

~~~js
assert.equal(await page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth), true);
assert.equal(await page.locator('#detail').evaluate(dialog => dialog.open), false);
~~~

## Stop at review

P4 consumes completed route/v2 contracts; cannot invent parallel URLs, optional-v1 queue fields or inventory Dashboard panels. Implementation approval is separate from this planning output. No tests/builds/app changes were executed while writing plans.
