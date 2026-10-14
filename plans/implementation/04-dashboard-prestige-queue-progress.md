# Plan 4 implementation progress

FINAL STATUS: P4.1–P4.5 automated implementation and regression gates COMPLETE.
Genuine browser200% zoom/human release acceptance remains OUTSTANDING.

Authoritative plan: 04-dashboard-prestige-queue.md. Prior Survivor checkpoint preserved.
Scope: P4.1–P4.5 only; schema v2, existing queue domain and Workspace routes.
Disposable browser contexts/data only. Genuine browser 200% zoom OUTSTANDING.
P3.5 remains deferred pending verified Killer production data.

Ruling: no Git/worktree/commit scripts in this non-Git workspace; durable checkpoints replace commits, per user instruction.
Preflight: P4.1 selectors feed P4.3; P4.2 domain-derived rows feed P4.4 controls; P4.5 verifies both. No interface contradiction identified.

- P4.1 selector core GREEN: node --test tests/dashboard-selectors.test.js tests/prestige-queue.test.js →14/14. RED missing selector module,11 queue tests passed. New src/dashboard-selectors.js and tests/dashboard-selectors.test.js inspected; ranking copied exactly, chronology parsed, no mutation.
- P4.2 initial panel GREEN: staged node tests/browser/dashboard.mjs release/runtime →PASS. RED missing Current Focus; GREEN global first3+focus preview, unavailable/completed representation, unknown no link, global filter/focus and byte preservation. src/app.js/styles.css/tests/browser/dashboard.mjs changed. Additional state matrix pending.
- P4.3 hierarchy/links GREEN; compact stats final gate in progress. RED absent section anchors; GREEN approved DOM order, canonical Overview links/no dialog, Data review setup entry. Existing Workspace browser selector updated to new link producer.
- P4.4 core GREEN: RED missing Edit target; GREEN add/edit/move/remove/reload, account-only timestamp, inventory unchanged. Extra RED no-op kept dialog open; fixed close without write. GREEN invalid raw target, failed storage retains input and bytes, forced read-only add denied, six widths and44px queue buttons. Domain stays unchanged. Further keyboard/import state coverage pending.
- P4.5 integration in progress: full Node240/240; focused Dashboard and Workspace PASS; editor exclusion PASS; file Edge/Chrome PASS with writer=true and queue Save/reopen. Full release/Chrome smoke running, final rerun required after review fixes.

Changed/created files so far: src/dashboard-selectors.js, src/app.js, styles.css, tests/dashboard-selectors.test.js, tests/browser/dashboard.mjs, tests/browser/character-workspace.mjs, tests/browser/smoke.mjs, tests/browser/workspace-file.mjs, tests/browser/data-flows.mjs, docs/runtime-README.md, this ledger. Generated dist/app.js/release refreshed by required staging.

P4.3 compact stats RED0 disclosures versus2; GREEN two secondary statistic disclosures and account-access/personal-inventory labels. Existing arithmetic unchanged. Dashboard setup prompt only while incomplete; Data review and global setup batch retained.
P4.4/P4.5 extra state matrix GREEN: empty/complete/blocked/unowned/corrected focus, setup-complete suppression, empty role Show All, keyboard target/shortcut/Escape return, read-only forced add, failed storage/no-op byte safety.
Fresh final reviewer (executing-plans/requesting-code-review skills) found Important filtered removal/boundary move focus, Minor identifying labels/announcement. Ruling: promote identifying context to required accessibility correctness because approved design explicitly requires it. RED filtered remove landed Add rather than visible Dwight; GREEN visible role neighbor, boundary same-row fallback, character-specific move names and named n-of-total announcements. Boundary cannot focus a disabled button; retain focus on same row's enabled Remove. No design contradiction or persistence changes.
Historical Workspace test RED hidden Favorite link after approved secondary disclosure; test now expands disclosure, GREEN Workspace PASS. Product behavior unchanged by adaptation.

Exact staging commands for each browser RED/GREEN:
`npm run build`
`node --input-type=module -e "import {stageRuntime} from './scripts/release.mjs'; import {readFile} from 'node:fs/promises'; await stageRuntime(process.cwd(), {manifest:JSON.parse(await readFile('data/asset-manifest.json','utf8'))});"`
`node tests/browser/dashboard.mjs release/runtime`

Additional commands/results: `node --test tests/dashboard-selectors.test.js tests/prestige-queue.test.js`15/15; `node tests/browser/character-workspace.mjs release/runtime`PASS; `node tests/browser/editor.mjs release/runtime`PASS; `node tests/browser/workspace-file.mjs release/runtime`PASS; same with `--chrome`PASS; `npm test`240/240 (p4-node-tests.log).
P4.5 export/import/restore/reset existing inventory/unknown fixtures now include a real UI-appended Meg P6 goal before export, then assert queue plus stock retention. Full smoke registers Dashboard regression before Workspace, Setup, Edit and inventory checks.
Source research/catalog images untouched; SCHEMA_VERSION=2 and queue domain unchanged. Genuine200% zoom remains OUTSTANDING, does not block Plan4 automation. P3.5 Killer Power/Add-ons remains data-deferred.

First full `npm run release` and `npm run test:browser -- --chrome` PASS (p4-release.log/p4-chrome-smoke.log), before final review fixes. Final regression fixture extension initially used an invalid unnamespaced Add-on ID; schema validation correctly blocked it. Corrected disposable fixture to survivor-addon-unknown-preserved-addon; no schema/product change. Failed release correctly removed its runtime stage, causing an overlapping focused test to receive HTTP failure. Restaged after failure, final focused Dashboard PASS. Final release runs sequentially before further staged browser commands.
Final Dashboard chain: UI add/target/move/remove plus reload; role-aware neighbor focus and boundary-row focus; Edit cancel/discard and Save complete Dwight goal→derived Trapper focus→correct Prestige lower→Dwight focus reactivates without reorder; verified/unknown quantities unchanged. Keyboard shortcut/Escape opener retained, six widths include long unknown identity and MAX_SAFE_INTEGER goal. Final release rerun pending.
Ruling: existing release tests already execute the registered full smoke and stage allowlist/hash gates; no duplicate tests/release.test.js assertion mirroring registration added. Existing editor suite plus Dashboard's forced read-only test verify writer boundaries; no redundant editor fixture rewrite. Existing Setup/migration/recovery suites remain part of full regression, not reimplemented.

Final candidate verification:
- `npm run release > plans/implementation/p4-release-final.log 2>&1` →exit0 AUTOMATED PASS;240 Node tests,0 failures; staged full Edge smoke including Dashboard/Workspace/Setup/Edit/92-image inventory/perks/data/recovery/editor.
- `node --test tests/dashboard-selectors.test.js tests/prestige-queue.test.js tests/inventory-quantities.test.js tests/model.test.js` →72/72 (p4-model-queue.log).
- `node tests/browser/workspace-file.mjs release/runtime` and same `--chrome` →PASS on final stage, writer=true, queue Save/reload and Overview navigation.
- `npm run test:browser -- --chrome > plans/implementation/p4-chrome-final.log 2>&1` →exit0 full Chrome smoke AUTOMATED PASS on final candidate.
Release verification.json remains AWAITING_MANUAL_ACCEPTANCE; localhost AUTOMATED PASS. Genuine200% browser zoom remains OUTSTANDING. Disposable direct-file Edge/Chrome automated checks pass; these do not constitute genuine zoom or human signoff.

Final closeout supersedes all earlier in-progress/pending notes:
- P4.1 complete: four selector tests +11 queue tests15/15; unchanged top5 P1 ranking, override/General access, no owned/zero missing, deterministic recent parsed instants/exact bytes/unowned/unknown exclusions, independent name-sorted Favorites.
- P4.2 complete: one domain-derived global focus, ordered preview first3+focus, management role filtering/global positions, honest empty/completed/unavailable/import-preserved states. No derivation writes.
- P4.3 complete: approved action-first hierarchy, canonical Overview producers, semantic recent times, compact collection disclosures/account perk labels, distribution, secondary Favorites, quiet10.1.2a catalog/setup. Setup review does not reset flags. No inventory totals.
- P4.4 complete: owned/resolved append, target validation and P1/P3/P6/P9 shortcuts, completed/unowned target edit support via authoritative domain, unknown removal/moves, protected global moves, writer/no-op/storage failure/character timestamp safety, native dialog focus and announcements.
- P4.5 complete: full Edge/Chrome smoke, inventory/data/recovery/editor regression gates, direct-file Edge/Chrome writer Save/reopen, six-width layout/keyboard focus matrix. All ready Survivor tests execute; Killer unavailable remains truthful.
Fresh reviewer findings fixed with RED→GREEN; no unresolved Critical/Important findings or deferred review minors. File scope inspected; bundle/staged SHA256 both2448de6b351bc7c29541c9775d54b118e06ac21895f52e823da6ed2aaf5c7d01.
Schema remains2; existing queue domain unmodified, only characterId/targetPrestige persisted. No framework/dependencies/config/services/Git/source-research/image changes. No owner active save accessed. No real blocker or product contradiction. Boundary move focus falls back to same row's enabled Remove because the triggering button becomes disabled; documented accessibility ruling above.
Do not start later plans. Next acceptance step: genuine browser200% zoom with disposable data and human signoff. P3.5 still awaits verified Killer Add-on/Power production data.
