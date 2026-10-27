# Rev02 UX/UI Planning

**Roadmap created · 2026-10-25 · Phases 0–10 complete. D01/D02 approved 2026-10-27. Phases 1B, 11 and 12 authorized; Phases 13–14 and deployment remain out of scope.**

This set defines Rev02 Core across the actual vanilla JS/HTML/CSS tracker. Archive when browsing. Tool when editing. Explicit user decisions outrank older recommendations, confirmed functional behavior and skill preferences. Detailed recommendations remain labeled; this consolidation is not blanket approval of exact visual geometry.

## Repository Safety / Evidence

The prior consolidation started clean on `main`, HEAD and `origin/main` **351ca1c**. Roadmap creation preserved those uncommitted planning changes and reverified that live GitHub main still matched. History contains the PC/GitHub reconciliation merge and effective-export bundle regeneration. No pull/reset/clean, branch, production change, migration, build, deployment or data replacement was performed during either planning pass.

All checked-out Markdown plans were reviewed as one set against current source. The 19 historical PNGs under [evidence/](evidence/) were inventoried/reviewed together; original rendered audit limits remain recorded in the matrix. [rev02.zip](rev02.zip) is historical reference only, even if manually refreshed between planning passes. **The checked-out Markdown files below are authoritative.** Roadmap creation did not alter the ZIP or evidence images.

## Plan Index

| File | Coverage / status |
| --- | --- |
| [00-ui-ux-redesign-strategy.md](00-ui-ux-redesign-strategy.md) | Audit, historical identity alternatives, consolidated product principles; reconciled. |
| [00a-ux-audit-matrix.md](00a-ux-audit-matrix.md) | Historical evidence plus complete Core planning/source-dependency coverage; reconciled. |
| [00b-open-design-questions.md](00b-open-design-questions.md) | Decision/rationale history; D01/D02 approvals recorded; no remaining product input blocks this batch. |
| [01-dashboard.md](01-dashboard.md) | Approved three-job hierarchy; role pins/queue state, migration/import/export and local Continue dependencies documented. |
| [02-survivor-roster.md](02-survivor-roster.md) | Six-per-page 3/2/1 roster; ownership status, Favorite, account-scope terminology and shell reconciled. |
| [03-survivor-workspace.md](03-survivor-workspace.md) | Full Overview/Perks/Items & Add-ons; contextual capability audit, explicit Update/Done and safe working context reconciled. |
| [04-killer-roster.md](04-killer-roster.md) | Six-per-page/Power identity, artwork audit; Lore and neutral named fallback policy reconciled. |
| [05-killer-workspace.md](05-killer-workspace.md) | New full Overview/Perks/Power & Add-ons plan, editor audit, quantities and structured reference. |
| [06-shared-global-design.md](06-shared-global-design.md) | New bounded shared shell/layout/interaction/state/accessibility contract; Core boundary and dependency shape. |
| [07-implementation-roadmap.md](07-implementation-roadmap.md) | Primary execution plan: dependency graph, phase tasks/files/tests, approved D01/D02 semantics, migration safety, visual/release/manual acceptance and recovery. |

No separate competing plans are needed for character Perks or inventory tabs; they belong in the full role workspaces. Standalone account perk libraries are distinct from those character tabs.

## Resolved Direction

- Recorded personal Tier, automatic minimum, effective character Tier and account access are distinct. Effective = max(recorded, automatic); General availability may exist at global zero. Derived export fields never become personal records on import.
- Perks uses explicit Update Inventory, per-selection atomic persistence and Done. Correction is a separate selected-perk task. No collection-wide staged Save or false Cancel.
- Preserve capabilities, retire the giant Edit Character interface after contextual parity. Overview owns character state/progression/notes/setup; Perks owns records/correction; role inventory owns quantities. Preserve validation, conflicts, unknowns, setup and central normalization/migrations.
- Preserve safe session working context across neighbors, with canonical same-role order. Drafts/pending values/errors/selected perks/change counts never transfer. Roster Back restores its separate invoking context.
- Both rosters display Owned/Locked; ownership changes in Overview. Favorite remains independent. Six per page is settled, not reopened by responsive layout.
- Killer Lore is the character-identity source across roster/workspace. The Slasher has no Lore; use neutral named fallback, no older square exception. Power assets remain separate.
- Full sidebar only when useful; earlier compact labeled navigation when content constrains. Plan 06 recommends Menu header and derives an initial ~1300px transition candidate; final cutoff follows fit, not a 768px device rule.
- Survivor family→Item→compatible Add-ons versus Killer→Power→flat Add-ons. Shared additive −1/value/+1/+5/+10, direct entry, pending/error/focus safety; no rarity accordions.
- Dashboard requires new persisted role queue/pin state and backward-reading migration support; Continue is recommended as one browser-local stable workspace preference, without telemetry.

## Approved Queue / Pin Decisions

**D01 approved:** dual Prestige/Playing membership; one Up Next pin per character with one explicit primary intent. **D02 approved:** direct pins need no queue membership; queue changes do not remove, reorder or retarget a pin. Full decisions and rejected alternatives are retained in the question register. These semantics govern schema, migration and Dashboard acceptance.

## Rev02 Core Implementation Boundary

Core includes shared application shell/system, Dashboard, Survivor/Killer rosters, full Survivor/Killer workspaces and persistence/schema changes required for them. Subordinate queue management is part of Dashboard functionality, not a new primary Dashboard job.

Standalone **Survivor Perks library**, **Killer Perks library**, and **Data & Backups** may keep current information architecture initially. They must stay functional under the new shell and support new save formats, recovery and export/import correctly. Shell integration, shared typography/vocabulary, accessibility and compatibility styling are in Core; a full dedicated redesign is not a prerequisite.

## Execution Order — Not Plan Number Order

Recommended roadmap order: **0 baseline → 1A v2 schema/migration safety → 2 shared shell → 3 roster behavior → 4 Survivor roster → 5 Killer roster → 6 workspace/context → 7 shared editing/Perks/quantities → 8 Survivor workspace → 9 Killer workspace → 10 editor parity/retirement → 1B approved queue/pin schema → 11 Continue/Dashboard → 12 standalone compatibility → 13 accessibility/stress/polish → 14 final release/manual acceptance.**

Plan 01's Dashboard cannot be implemented first merely because it has the lowest screen number. The approved D01/D02 decisions unblock Phase 1B after Phase 10; the current Dashboard consumers must migrate atomically with the schema. Local Continue task 11.1 remains independently testable once workspace routing is ready. No optional duplicate dependency matrix was needed.

## Next Step / Readiness

**Phases 0–10 complete; Phases 1B, 11 and 12 authorized.** Use [07-implementation-roadmap.md](07-implementation-roadmap.md) as the execution reference. D01/D02 are recorded; Phase 1B governs queue/pin schema and dependent Dashboard state. Stop before Phase 13 and do not deploy under this authorization.

## Consolidation Checks

Existing nine data/interaction test files passed (model, storage, effective exports, character edit/inventory/workspace, quantity parsing/interaction and Prestige Queue). Document links/structure, all 19 historical image comparisons and diff whitespace checks passed. These checks support the current-code evidence; they do not claim Rev02 UI or future schema tests already pass. Production code and assets remain unchanged.

Roadmap creation checked phase coverage, document/source references and unchanged plans 00–06/evidence; no application tests, build or release were rerun. The roadmap records that ignored local release staging/report is older than the tracked bundle, and requires Phase 0 to establish fresh matching release evidence before implementation.
