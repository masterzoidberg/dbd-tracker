# Dashboard and Character Workspace implementation roadmap

Date: 2026-10-13. Status: implementation plans prepared for human review; no code execution authorized. Repository: `G:\Projects\dbd-tracker`. All relative paths/commands in this plan family resolve there. Read the approved designs before execution; these plans select technical interfaces, not new product behavior.

## Plans and execution order

Authoritative specifications (relative to the repository root):

- [Shared quantity requirements](../character-update-rework/01-survivor-items-addons-quantity-requirements.md)
- [Character current-state audit](../character-update-rework/02-current-state-audit.md)
- [Workspace design](../character-update-rework/03-character-workspace-design.md)
- [Canonical routing](../character-update-rework/04-routing-and-compatibility.md)
- [Inventory and editing](../character-update-rework/05-inventory-and-editing-design.md)
- [Dashboard audit](../frontpage-character-update-rework/01-dashboard-current-state-audit.md)
- [Dashboard options rationale](../frontpage-character-update-rework/02-dashboard-design-options.md)
- [Approved Dashboard design](../frontpage-character-update-rework/03-dashboard-rework-design.md)

| Plan | Deliverable | Dependencies |
| --- | --- | --- |
| [01-schema-v2-persistence.md](01-schema-v2-persistence.md) | Complete v2 validator, migration, protected persistence and queue domain | None; first safe task is P1.1 |
| [02-character-workspace-core.md](02-character-workspace-core.md) | Routes, Overview, Perks aliases, setup hosting and navigation cutover | Core P2.1–P2.4 can be developed independently of P1; P2.5 cutover waits for P1 and P3.1–P3.3 |
| [03-edit-character-and-inventory.md](03-edit-character-and-inventory.md) | Draft editing, dirty guard, data adapters and quantity pages | P1 complete and P2.1–P2.4 for runtime integration; P3.4/P3.5 blocked on verified data |
| [04-dashboard-prestige-queue.md](04-dashboard-prestige-queue.md) | Option B, queue controls and Overview links | P1 complete and P2.5 navigation/capability cutover; no catalog dependency for Dashboard |

Recommended serialized order: P1 → P2.1–P2.4 → P3.1–P3.3 → P2.5–P2.6 → P4 → data-gated P3.4–P3.6 → final verification. P3.6 also defines the no-data milestone and can be checked without executing its gated ingestion branches. Do not call the entire requested inventory feature complete while data branches remain blocked.

Safe overlap: pure route tests and P1 domain tests can be prepared independently; verified data acquisition/review can proceed alongside all plans. Dashboard pure selector tests can follow P1 queue interfaces while core views progress. Runtime integration changes share `src/app.js`, `src/model.js` and browser smoke entry points: serialize those mutations and review interfaces first, rather than simultaneously modifying shared files. This roadmap does not authorize parallel agents or implementation.

## Source-data inventory and gates

Discovery was read-only. Inspected tracker `data/`, `docs/`, `plans/`, image manifests/reports, related `G:\Projects\dbd-helper`, `G:\DBD Site`, `G:\DBD Profiles`, `G:\Deep Research Reports`, matching files in Downloads/Documents/Desktop, and relevant ZIP listings. No application/account was opened. These findings cover inspected locations, not every disk/archive in existence.

| Actual source | Version/count/IDs | Provenance and readiness |
| --- | --- | --- |
| `data/dbd-survivor-perks-live-10.1.2a-2026-10-05-corrected.json`; `data/killer-perks-audited-10.1.2a-2026-10-05.json`; `data/catalog.js` | 10.1.2a, verified 2026-10-05; runtime 54 Survivors, 44 Killers, 321 canonical perks; existing slug/alias maps | Existing runtime authority for characters/perks. Ready; do not upgrade these as part of this work |
| `images/survivor-items-addons/survivor-items-addons-image-manifest.json`, path/export reports | Reported 10.2.0, 38 Items/54 Add-ons; `entityType`, `itemTypeId`, `family/entity` IDs; seven families | Verified artwork mapping, not full entity definitions. No rarity/effect/description dataset. Ready only for mapping/artifact verification after structured source is supplied |
| `G:\DBD Site\dbd-survivor-perks-live-10.2.0.json` and `dbd-killer-perks-live-10.2.0.json`, related dated/r2 reports | 10.2.0 verified2026-10-06; 176 Survivor /151 Killer raw perk rows; source slug IDs (runtime aliases may consolidate) | Newer perk research; not inventory catalogs. Not an authorized replacement for existing runtime perks |
| `G:\DBD Site\dbd-local-data-pack-v14.zip`; `dbd-local-data-v15-release-candidate.zip` | ZIP entries are glossary, survivor editorial/mechanics/guide/validation/manifest. Both embedded survivor-mechanics.json files contain only verified patch/date and 176 perk rows, no inventory collection | Inspected archive lists and mechanics JSON structure; do not treat narrative guide material as canonical Item/Add-on definitions |
| `images/updated-images/_inventory/dbd-image-assets-inventory-report.md` and `Powers and Add-ons/` | Reported 2,158 add-on image files incl. duplicate, retired/unknown/unused buckets; not verified entity counts | Artwork forensic inventory, no canonical owner/rarity/effect catalog. Not ready for Killer quantity editors |
| G:\DBD Site\add-ons\dbd-survivor-items-addons-final-enriched-10.2.0.zip | Final enriched10.2.0 candidate supplied by the human after planning; path exists, archive not ingested/inspected during Plan1 | P3.4b is now source verification/ingestion once supplied in execution scope, not permission to reconstruct or research from artwork. Verify actual counts, IDs, provenance and reference metadata before activation |
| Structured Killer Add-on dataset | No implementation-ready file found; expected count cannot be asserted from artwork | **BLOCKED ON DATA: P3.5 quantity branch.** Need version/provenance, frozen entity slug, canonical character owner, order, rarity/effect/description and verified references |
| Structured Killer Power dataset | No finalized verified structured mechanics found; count unknown | **BLOCKED ON DATA: P3.5 reference-ingestion branch only.** Does not block Power route/unavailable state or rest of workspace |

Do not create production fixture entities or persisted IDs to bypass gates. Synthetic test-only catalogs may test validator/adapter behavior, clearly isolated from bundled runtime data. Final source identity mapping is constrained by the approved namespaces in Character design 05. Source import destinations/signatures are fixed in P3, but the source file must be actually supplied and verified before ingestion.

## Integration checkpoints and runtime boundaries

1. **Foundation:** P1 tasks validate complete queue+inventory v2 before `SCHEMA_VERSION` cutover. P1.3 atomically makes complete v2 the runtime write/export format. No queue-only v2 commit/release; pre-cutover helpers can exist unused. Writable v1 transition backs up a validated v1 predecessor; read-only migration never writes.
2. **Core routes:** P2 adds canonical pages and aliases without changing generic producers prematurely. Unknown/wrong-role hashes have explicit unavailable views. Perks compatibility retains its meanings and correction tools.
3. **Edit/capability readiness:** P3.1–P3.3 provide progression/personal perks/Owned/Favorite/Notes and full dirty guard; P2.4 supplies setup/batch hosting. P2.5 removes character popup producers only after this parity gate, retaining bounded perk/confirmation dialogs. Missing verified inventory never removes previously existing functionality; pages clearly explain data availability.
4. **Dashboard cutover:** P4 switches every Dashboard character producer only after working Overview and capability destinations. Queue domain and writes use P1 complete v2; no new inventory Dashboard panels. Queue management itself is independent of missing reference catalogs.
5. **Inventory:** complete validator/storage and actual verified IDs precede any quantity writes. Gated data integration strengthens catalog-known compatibility validation without dropping unknown IDs. Direct-file asset staging must include all referenced inventory art before release.

## Commands, TDD and commit convention

Plans contain commands for later execution only; none were run while writing them. Node >=22 as existing README; ES modules/import attributes, esbuild and installed `playwright-core`, installed Edge/Chrome. Node tests use `node --test`; browser regressions are exported functions and must be invoked via their CLI wrapper/smoke harness, not Node's unit runner.

Each task specifies red/green commands and assertions. Expected red must come from the named behavior, not missing browser/bundle or a syntax error. Build/stage the candidate before browser red so stale `release/runtime` cannot produce a false result. New browser wrappers reuse `smokeStage(stage,{regression})`; it always runs startup persistence checks. P2.5 changes those common checks from popup autosave to Overview/Edit/explicit Save only when the destinations work.

`npm run release` currently runs Node tests, builds/stages allowlisted assets and full disposable browser smoke; do not use it to stage a red browser test because a failing suite can abort staging. During TDD use `npm run build`, then the existing exported `stageRuntime()` (commands in plans), then the focused browser CLI. No new dependencies/services/config. Direct-file checks use a new disposable browser context, never the user's current profile.

No `.git` is present in this workspace. Each task still has a review/commit boundary: record only its listed files and verification output as a checkpoint; if executing in a user-provided Git checkout, use its specified commit message. Do not initialize Git, create a worktree or publish merely to satisfy the word “commit.” Stop on an unexpected source/design conflict; do not reopen settled products for routine implementation choices.

## Final verification and acceptance

After integrated tasks and any available data gates: `npm test` → focused storage/recovery/domain suites if new fixes justify repeats → `npm run release` staged full browser smoke → `npm run test:browser -- --chrome` if Chrome installed → new direct-file workspace smoke → responsive matrix and manual real-browser 200% zoom/keyboard acceptance. Use only disposable profiles/seeded fixtures. P2.6/P3.6/P4.5 own specific layout/focus checks; release verifies them together. File/localhost storage portability remains separate.

Scenario: v1 import → complete v2/backup → setup → Overview → multi-field edit/draft cancel/save → stock edit if verified catalog available → queue add/move/corrected-state focus → export/reload/restore/reset/recovery → old bookmarks and back/forward. Assert queue and quantity state survive every non-destructive transition and old v1 runtime rejects a v2 fixture without changing bytes. No active save is a test fixture.

## Coverage and review gate

P1 owns schema/storage/queue-domain requirements; P2 owns route/alias/setup/capability compatibility; P3 owns draft/quantity/catalog/focus; P4 owns Dashboard presentation/queue actions/recommendation/recent selectors. Each plan's Review Focus conditions have owning tests. Shared signatures below are consistent across plans: `parseCharacterWorkspaceRoute`, `characterWorkspaceHref`, `inventoryEntityById`, `derivePrestigeQueue`, `applyPrestigeQueueAction`, `createCharacterEditSession`, `buildCharacterEditCandidate`, `requestWorkspaceNavigation`.

Plans were self-reviewed against all eight authoritative documents. No unexpected product decision was discovered. Data gates remain explicit; no plan fabricates catalogs or promises completed blocked inventory. **Stop at human implementation-plan review.** First implementable task after authorization: P1.1, complete-v2 quantity/queue validation helpers and tests without runtime cutover.
