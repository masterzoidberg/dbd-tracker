# Rev02 UX/UI Planning

Rev02 is a screen-by-screen UX/UI redesign planning pass for the Dead by Daylight tracker. Each major screen is reviewed and documented before any application changes begin. An approved screen plan records its purpose, information hierarchy, content decisions, interactions, accessibility, and responsive needs; approval of a plan does not authorize implementation.

The global audit and proposed direction establish context for individual screen reviews. Auditing a screen does not approve its design. The Dashboard has an approved screen direction. The Survivor roster, full Survivor workspace and Killer roster have design-direction plans recording the user's settled direction and detailed recommendations awaiting review. The Killer roster plan also records the read-only artwork audit and the user's Lore-first Killer character-identity source decision. Other screen entries below remain unreviewed as individual Rev02 plans.

## Process

1. Global audit of the actual application, workflows and shared patterns.
2. Compare and review the proposed design direction.
3. Review and approve screen-by-screen plans.
4. Consolidate and review shared/global design decisions and any design-system record.
5. Inspect all approved plans, current architecture, reusable components, design-system and testing dependencies; create a dependency-aware implementation roadmap for review.
6. Implement only after that roadmap is reviewed and execution is authorized.
7. Perform visual and functional verification against approved behavior and designs.
8. Refine interaction polish and stress-test realistic content, repeated input, responsive layouts and failure states.

## Global audit and strategy

| Document | Status |
| --- | --- |
| [00-ui-ux-redesign-strategy.md](00-ui-ux-redesign-strategy.md) | AUDIT COMPLETE; DESIGN RECOMMENDATION AWAITING REVIEW |
| [00a-ux-audit-matrix.md](00a-ux-audit-matrix.md) | AUDIT COMPLETE; OBSERVATIONS AND COVERAGE LIMITS |
| [00b-open-design-questions.md](00b-open-design-questions.md) | OPEN QUESTIONS AND RECOMMENDATIONS FOR REVIEW |

Existing-interface screenshots are under [evidence/](evidence/) and indexed in the audit matrix. They are audit records, not proposed redesigns or automated visual baselines.

Explicit user decisions and approved Rev02 screen plans take precedence over recommendations in the global audit. Product facts and proposed visual decisions are identified separately in the strategy. A later PRODUCT.md or DESIGN.md must reference and remain consistent with approved Rev02 decisions; no competing context documents were created for this audit.

## Plan index

| # | Screen / topic | Plan | Status |
| --- | --- | --- | --- |
| 1 | Dashboard | [01-dashboard.md](01-dashboard.md) | **APPROVED DESIGN DIRECTION — PLANNING ONLY; NOT IMPLEMENTED** |
| 2 | Survivor roster | [02-survivor-roster.md](02-survivor-roster.md) | **DESIGN-DIRECTION PLAN — USER DIRECTION RECORDED; DETAILED RECOMMENDATIONS FOR REVIEW; NOT IMPLEMENTED** |
| 3 | Full Survivor workspace: shell, Overview, character Perks, Items & Add-ons, contextual editing | [03-survivor-workspace.md](03-survivor-workspace.md) | **DESIGN-DIRECTION PLAN — USER DIRECTION RECORDED; DETAILED RECOMMENDATIONS FOR REVIEW; NOT IMPLEMENTED** |
| 4 | Survivor Perks — standalone account library | — | NOT YET REVIEWED; character Perks tab covered by plan 03 |
| 5 | Survivor Items & Add-ons — workspace tab | [03-survivor-workspace.md](03-survivor-workspace.md#items--add-ons-tab) | COVERED BY FULL WORKSPACE PLAN 03; RECOMMENDATIONS FOR REVIEW; NOT IMPLEMENTED |
| 6 | Killer roster / character artwork audit | [04-killer-roster.md](04-killer-roster.md) | **DESIGN-DIRECTION PLAN — SIX-PER-PAGE AND LORE SOURCE DIRECTION RECORDED; DETAILED RECOMMENDATIONS FOR REVIEW; NOT IMPLEMENTED** |
| 7 | Killer character workspace | — | NOT YET REVIEWED |
| 8 | Killer Perks | — | NOT YET REVIEWED |
| 9 | Killer Power & Add-ons | — | NOT YET REVIEWED |
| 10 | Data / Backups | — | NOT YET REVIEWED |
| 11 | Shared/global design findings | — | NOT YET REVIEWED |
| 12 | Final implementation roadmap | — | NOT YET REVIEWED |

## Planning boundary

The full Survivor workspace review consolidates its three tabs in plan 03. No separate competing character-Perks or stock plan is created. The standalone Survivor account perk library and Killer workspace screens remain future reviews. Plan 04 establishes Killer character-identity source direction without redesigning the Killer workspace. Material workspace decisions are tracked as SW01–SW04; the missing-Lore fallback policy is KR01 in the open-questions document.

- Screen plans describe intended UX/UI and note dependencies; they do not implement changes.
- Do not create a screen plan until that screen has been reviewed.
- The final implementation roadmap is deferred until the major screen plans are complete.
- Source code and application behavior remain unchanged during this planning pass.
