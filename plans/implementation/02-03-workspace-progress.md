# Workspace/core and Edit batch checkpoints

Authorized order: P2.1, P2.2, P2.3, P2.4, P3.1, P3.2, P3.3, P2.5. Stop before P2.6/P3.4/Plan4.
No Git initialization; checkpoints replace commits. Plan1 progress remains unchanged. TDD with disposable browser/Node fixtures only; no active account/profile/save access.

Superpowers executing-plans/TDD workflow. Pure route/session modules first, existing string views/event handlers preserved. Each task records files, red/green results and rulings below.

Survivor candidate for next ingestion gate: G:\DBD Site\add-ons\dbd-survivor-items-addons-final-enriched-10.2.0.zip. Human reports10.2.0, seven families,38 Items,54 Add-ons with JSON/provenance/validation; these are supplied expectations, not this batch's ingestion verification. Archive not ingested. Killer Add-ons/Power separate gates. Runtime registry remains unavailable.

P2.1 complete: route module/adapter/session keys and route tests. Red25 tests:21 pass/4 fail intended missing contract. Green same exact command:25 pass/0 fail. Reviewed exact anchored paths/role checks/invalid descriptors; compatibility renders without redirects. Old parser's canonicalRoute expectations updated to actual canonical Perks URLs; old mode/source semantics retained. Schema unchanged.

P2.2 complete: workspace browser red missing mount; green PASS, route unit4/4. Files app/styles/workspace browser. Reviewed no-write summaries/unavailable state.
P2.3 complete: Perks canonical links/scopes/special acquisition, legacy filter context and equivalent session model. Red focused38:37 pass/1 fail; browser red missing Native label. Green38/38 and full character-inventory browser PASS. Existing generated-link expectations changed to canonical URLs, direct old-hash fixtures retained. Files app/character-inventory/perk-filters and focused tests; reviewed no model changes.
P2.4 complete: Setup host wrapper/app draft/route/batch handling, model host test and browser setup regression. Red unit53:52 pass/1 fail; browser missing host. Green53/53 and Setup browser PASS. Reviewed backup-before-Finish/immediateP1/P0BW1/prestigedBW1/special acquisition/skip and distinct flags; schema/model setup mutator unchanged.
P3.1 complete: src/character-edit.js and six tests. Red6/6 failed missing helpers; green exact four-file command84/84. Reviewed pure cloning, raw invalid text, final floor errors, no-op/conflict, historical modes and test-only quantity registry. No timestamp/storage calls in domain.
P3.2 complete: Edit page/draft-bound fields/perks/corrections, explicit single protected Save and unavailable inventory notice; app/styles/edit browser. Red browser missing task; green Edit browser PASS and unit6/6. Failure retry regression found transient save error incorrectly retained as validation; fixed separation, reran green. No automatic field writes; no-op no stamp, unknown/queue/setup preserved.
P3.3 complete: app/index dirty dialog and Edit browser. Red missing Stay before guard; green character-edit browser PASS (back/forward, link/Cancel, Save/Discard/Stay, import/reset, conflict) and unit6/6; editor browser PASS. Synthetic reset fixture moved inside main because sidebar overlapped body placement. No persisted drafts or visit tracking.
P2.5 complete: red workspace/setup/smoke commands failed missing real collection link, as intended. Green Workspace/Setup and full staged smoke PASS. Cutover removes character dialog renderer/autosave listeners, keeps perk detail and confirmations.

Final review: fresh reviewer inspected routes/drafts/writer/conflict/Setup/reference boundaries; no Important/Critical findings. Author's integrated verification additionally found Enable editing missing from dirty action guard. New forced-action regression failed missing Stay, then green after guarded retry and fresh session reset. Retry never retains a baseline from the previous saved snapshot.

Ruling: browser regressions use explicit Save/retry and retained draft semantics instead of old popup immediate rollback assertions. Persisted-byte, writer, validation, focus, correction and image checks retained. Recognized malformed manage routes assert unavailable workspace per approved design.
Ruling: legacy alias filter regression now waits for route rendering with its existing navigation helper, rather than reading immediately after hash-only goto; avoids a demonstrated scheduling race without weakening filter-memory assertions.

Files created: src/character-workspace.js, src/character-edit.js, tests/character-workspace.test.js, tests/character-edit.test.js, tests/browser/character-workspace.mjs, tests/browser/character-setup.mjs, tests/browser/character-edit.mjs, this checkpoint record and verification logs.
Files modified: src/app.js, src/character-inventory.js, src/character-setup.js, src/perk-filters.js, styles.css, index.html; tests/character-inventory.test.js, tests/filter-domain.test.js, tests/model.test.js; tests/browser/character-inventory.mjs, smoke.mjs, data-flows.mjs, portraits.mjs, editor.mjs, filtering.mjs. Candidate dist/staged runtime regenerated. Plan3 source-gate note updated; Plan1 record preserved.

Final focused unit commands actually rerun:
- node --test tests/character-workspace.test.js tests/character-inventory.test.js →25/25
- node --test tests/character-workspace.test.js →4/4
- node --test tests/character-inventory.test.js tests/filter-domain.test.js →38/38
- node --test tests/model.test.js tests/historical-perks.test.js →53/53
- node --test tests/character-edit.test.js tests/character-inventory.test.js tests/inventory-quantities.test.js tests/model.test.js →84/84
- node --test tests/character-edit.test.js →6/6
- npm test →228/228,0 failures.

Before browser runs: npm run build, then node --input-type=module -e "import {stageRuntime} from './scripts/release.mjs'; import {readFile} from 'node:fs/promises'; await stageRuntime(process.cwd(), {manifest:JSON.parse(await readFile('data/asset-manifest.json','utf8'))});" → success.
Final Workspace/Setup/Edit CLI commands: node tests/browser/character-workspace.mjs release/runtime; node tests/browser/character-setup.mjs release/runtime; node tests/browser/character-edit.mjs release/runtime → each PASS.
node tests/browser/editor.mjs release/runtime → PASS (writer exclusion/retry/migration/recovery/crash/unavailable APIs).
node tests/browser/smoke.mjs → AUTOMATED PASS, msedge155.0.4283.45,0 page errors; complete output workspace-browser-tests.log. One full smoke invocation passed directly via smokeStage after diagnosing legacy test selectors; final exact CLI also passed. Browser harness reports scenario PASS rather than individual assertion totals. These final five browser entry points all passed.

Scope inspection: SCHEMA_VERSION2 unchanged; complete-v2 model/storage/queue domain untouched. Registry remains empty/unavailable. No inventory ingestion, production IDs, Workspace acceptance P2.6, quantity P3.4 or Dashboard Plan4. No Git created; no active account used. Manual file/200% zoom acceptance remains outstanding.
