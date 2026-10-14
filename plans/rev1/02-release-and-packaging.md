# M02 — Release Staging

## Goal and dependencies

One canonical npm run release produces a verified runtime staging directory from current inputs. M01 supplies safe edit/reload behavior; M00 is the baseline reference. Introduce staged browser coverage here. M03/M04 are not prerequisites.

## Current behavior and scope

npm test runs source tests; npm start rebuilds; index runs dist. No release script exists. esbuild embeds catalog JSON into dist/app.js; catalogs are not fetched by the browser. Personal exports under data and nested ZIPs under images must not leak. .gitignore is not a distribution policy.

Plan a small Node orchestrator, focused release tests, staged browser smoke and accurate documentation. Likely implementation files: package.json, README.md, narrowly relevant .gitignore, scripts/release.mjs, tests/release.test.js, tests/browser and generated dist. Use a development browser runner only if needed and unavailable; no runtime dependency. Optional Windows ZIP uses existing archive tooling. No compulsory source artifact, deterministic ZIP, ZIP library, publishing, installer or new service.

## Canonical pipeline — Option B

1. Source/domain tests, including a cheap Survivor/Killer catalog patch/date equality release assertion owned by M02. Mismatched metadata fails release; no broad catalog audit or catalog production changes. After M07A, asset tests invoke/test the generator directly on current tree and isolated fixtures; they never import already-present generated JSON.
2. Regenerate required build inputs. After M07A, generate perk manifest from current catalogs/image tree. Failure aborts; no stale-output fallback.
3. Fresh build with existing esbuild options. Standalone build also regenerates required manifest before bundling. Catalog/manifest are embedded in regular dist/app.js; no runtime JSON fetch/module loader.
4. Recreate a dedicated clean runtime staging directory from an explicit allowlist. Before recursive removal, verify its resolved absolute path is the intended staging directory.
5. Verify required runtime references/assets in staging. Use the manifest generated for this build for selected icon paths. Check index/CSS/script references and document-relative layout.
6. Run applicable browser smoke/regressions against staged bytes in disposable file and localhost contexts. Minimum: startup -> edit favorite/Bloodweb -> reload and assert saved values.
7. After all gates pass, optionally create Windows ZIP from verified staging. Staging directory is the canonical artifact; ZIP byte determinism is unnecessary.

Tests exercise generation directly -> release generation -> build -> stage/verify -> browser tests. “Generated asset data used by tests/build/release must be reproducible from the current asset tree and must not depend on stale workspace output.” Clean checkout with no manifest must work; deliberately stale manifest is replaced/ignored, never trusted. Share/call normal generation/build path without an unnecessary second build.

## Runtime allowlist

Include index.html, styles.css, dist/app.js and an intentionally authored end-user README. After M07A include only non-null usable referenced perk icons at images/... paths. Portraits wait for optional M07B runtime use; shared background deferred.

Exclude raw catalogs, source, tests, plans, scripts, server.js, package manifests, node_modules, personal exports/recovery data and nested archives. No source-distribution artifact required. Direct-file needs no Node. Serve staging through a temporary static test server on a free port, not the workspace tree. Optional ZIP extraction reproduces the passed runtime tree.

The staged runtime opens directly through file://. The same staged static directory can be served over localhost by an appropriate static HTTP server. The runtime release is not itself a Node/npm development project: it excludes server.js, package.json and node_modules. npm start remains a source/development workflow unless a launcher is explicitly chosen for packaging later.

## Failures and compatibility

Fail fast/nonzero for tests, generation, build, copy, references and browser failures. Incomplete staging is not verified: remove/mark unusable and clear success status. Do not emit a fresh ZIP or present an old ZIP as the new run. Preserve an explicitly separate prior verified artifact. Optional archive failure must accurately report no successful new ZIP; verified stage and archive status are distinct.

Retain npm test/build/start. No save/storage change; synthetic contexts only. Runtime docs explain bundled catalogs, file/localhost storage separation, JSON transfer, the exact single-window and legacy-import limitations in the master README, and how to open staging. Record browser versions/baseline; ES2022 does not establish support.

## Milestone-owned tests and implementation steps

- [ ] Allowlist fixtures include personal export, node_modules, nested source ZIP and obsolete-stage traps; none leak.
- [ ] Clean recreation removes obsolete staging files; out-of-scope stage path cannot cause recursive deletion.
- [ ] Inject test/generation/build/copy/reference/browser failure; no new artifact reported successful.
- [ ] Verify required local references resolve within stage and catalog JSON is not requested.
- [ ] Assert Survivor/Killer catalog patch and date equality; mismatches fail release. Keep existing catalog tests; additional uncovered integrity work is M09 gap analysis or a future focused catalog-update task.
- [ ] Staged startup/edit/reload browser smoke on localhost and direct file. If file automation unavailable, document exact manual release gate/results; do not mark HTTP coverage sufficient.
- [ ] Implement orchestrator/optional Windows ZIP and runtime documentation.
- [ ] M07A later adds absent/stale manifest, generator failure and selected-asset packaging regressions as part of its own work.

## Acceptance and manual verification

One command recreates verified allowlisted staging from current inputs; Survivor/Killer patch/date equality passes. Runtime opens offline through file:// and works over localhost when an appropriate static HTTP server serves the same staged directory, without development files in the artifact. No old manifest/dist dependence, personal data or nested ZIPs. Optional ZIP opens after extraction.

Inspect staging entries, plant obsolete file/rerun, launch offline staged index/edit/reload and repeat through temporary static server. Review end-user README. Preserve previous verified artifact for rollback; close tracker windows before version switch. No save migration.

## Risks and exit gate

Testing source while shipping stale dist, unsafe stage paths, workspace leakage and untested file behavior are the main risks. Explicit inputs/path checks and staged browser gates address them. Exit: M02 tests and file/localhost smoke pass; proceed to complete Filtering. M09 repeats this gate at each cut.
