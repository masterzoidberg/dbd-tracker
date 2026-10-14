# Plan 1 execution checkpoints

Plan: G:\Projects\dbd-tracker\plans\implementation\01-schema-v2-persistence.md
Authorized scope: P1.2–P1.5; stop before Plan 2. P1.1 already complete.

Execution uses TDD and disposable Node/browser fixtures. No active browser/account save access. No Git checkout exists; reviewed file/test checkpoints replace commits, as approved in the roadmap.

## Source note

The human supplied candidate verified Survivor source:
G:\DBD Site\add-ons\dbd-survivor-items-addons-final-enriched-10.2.0.zip
Path existence confirmed. No ingestion or archive-content inspection in Plan 1. Later P3.4 is source verification/ingestion, not research from artwork. Killer Add-ons and structured Power remain independent data gates.

## Pre-flight

P1.2 supplies complete-v2 validation to P1.3; P1.3 supplies metadata/defaults/storage safety to P1.4; P1.5 consumes unchanged account selectors and shared queue validation. No interface conflicts found.

## P1.2 — complete

Red: node --test tests/model.test.js tests/prestige-queue.test.js — 34 passed, 8 failed for missing complete-v2 validator/queue behavior.
Green: node --test tests/model.test.js tests/prestige-queue.test.js tests/inventory-quantities.test.js — 57 passed, 0 failed.
Reviewed: model base validation reused without changing public v1 dispatch; new complete-v2 validator and queue validator only. SCHEMA_VERSION remained1 and runtime registry empty. Checkpoint: validate complete v2 before cutover.

## P1.3 — complete

Red: node --test tests/model.test.js tests/storage.test.js tests/editor.test.js tests/recovery.test.js — 74 passed, 6 failed for missing version/metadata/structural migration.
Green: node --test tests/model.test.js tests/storage.test.js tests/editor.test.js tests/recovery.test.js tests/inventory-quantities.test.js tests/prestige-queue.test.js — 98 passed, 0 failed.
Reviewed: complete-v2 defaults/dispatch and storage cut over atomically. Validated v1 predecessor retained, raw-version signal explicit, read-only no writes, structural timestamps unchanged; failed backup/current write retains old bytes. P1.1's version assertions intentionally advanced to full-v2 defaults, with empty runtime registry assertions retained. Existing tests were not relaxed.

Ruling: Added shared test-only fixtures/schema-v1.js to construct explicit old supported shape and frozen old version boundary, avoiding deriving historical fixtures from changed freshSave. No downgrade serializer.

## P1.4 — complete

Node red/green command: node --test tests/storage.test.js tests/recovery.test.js — 35 passed, 0 failed; persistence behavior already implemented in P1.3. New browser assertions supplied the required red: data-flow regression failed on the old SCHEMA v1 label.
Green browser: smokeStage('release/runtime',{regression:dataFlowsRegression}), node tests/browser/recovery.mjs release/runtime, node tests/browser/editor.mjs release/runtime — 3 commands passed, 0 failures (disposable Edge contexts). Build/staging commands passed.
Reviewed: v1 import/restore confirmation warns empty queue/stock; reset copy updated; schema badge2; recovery fixtures now include queue and both-role quantities; editor browser verifies v1 predecessor backup. Model/storage replacement APIs preserved.
Ruling: Data-flow regression uses the exported-function harness because that existing file has no executable CLI. Browser runners report scenario success, not Node test counts.

## P1.5 — complete

Red: node --test tests/prestige-queue.test.js — 4 passed, 5 failed for missing derivation/actions/benefit helpers.
Initial green: node --test tests/prestige-queue.test.js tests/model.test.js — 50 passed, 0 failed.
Reviewed: validatePrestigeQueue, derivePrestigeQueue, applyPrestigeQueueAction and prestigeTargetBenefit; only the intentional queue array is mutated, with no stamps/focus/history persisted.

Clarification: improvedNativeIds denotes actual availability/tier improvement, not a blanket count of newly unlocked perks. General native perks already available can gain an automatic global tier; the test explicitly verifies zero new availability in that case. Targets above3 expose at most milestone3 and no new global tier.

Final deterministic/full staged verification in progress. Stop before Plan 2.

Final integrated model/storage/recovery/editor/quantity/queue: 106 passed, 0 failed.
First full npm test: 213 passed, 1 failed. Root cause: tests/historical-perks.test.js hardcoded loaded.schemaVersion1; historical zero/missing/tier assertions already passed.
Ruling: update that assertion to2 and additionally assert empty queue/inventory, retaining all historical semantics checks. This necessary regression update adds one test file beyond the named task map; no product behavior change.

Review finding: sparse JS queue arrays could serialize as null slots and become unreadable. Added domain/storage red tests: 35 passed, 2 failed. Reject own-slot absence before map/serialization; no relaxation of queue contract.

Final green integrated command: node --test tests/model.test.js tests/storage.test.js tests/editor.test.js tests/recovery.test.js tests/inventory-quantities.test.js tests/prestige-queue.test.js — 108 passed, 0 failed.
Final full npm test — 216 passed, 0 failed. Historical regression focused command — 62 passed, 0 failed.
Full npm run release automated staged suite passed, with separate manual direct-file acceptance still required. After review fix, regenerated bundle/stage verified and focused data-flow browser rerun passed. Final npm run release rerun: 216 Node tests passed, 0 failed; full disposable staged browser smoke AUTOMATED PASS, exit0. Final focused queue/model command: 52 passed, 0 failed. No stale generated bundle remains.

Runtime SCHEMA_VERSION2 includes queue and inventory maps on all98 known character defaults. Runtime inventory registry remains empty/unavailable, no production definitions or candidate Survivor archive ingestion. No Workspace/Edit/quantity/Dashboard UI or routing changes.

Reviewed changed sources/tests and hash-based file scope (non-Git checkout). Generated dist/app.js and release runtime/verification artifacts reflect required build/release checks; asset-manifest content unchanged. README/runtime README document new portability boundary.

Stop: Plan1 complete; Plan2 safe to begin only with new authorization. Its later popup cutover still depends on Plan3 edit/session readiness.
