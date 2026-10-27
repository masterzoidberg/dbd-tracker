# Rev02 Open Design Questions

## Status

Consolidated 2026-10-25 · D01/D02 approved by explicit user decision on 2026-10-27. Explicit user decisions outrank older recommendations. Resolved questions retain their IDs, alternatives and rationale below; engineering checks are separated from product questions.

## Resolved Queue / Pin Decisions

| ID / question | Approved user decision | Consequences |
| --- | --- | --- |
| D01 — Can a character have both Prestige and Playing intent, and how does Up Next represent it? | A character may belong to both longer-term queues. Up Next contains at most one pin per character, with exactly one explicit primary intent: Prestige or Play. Membership in the other queue may appear as secondary context; it never creates a second pin row. | Keep queue membership independent; keep each role's Up Next rank independent; do not infer or silently change primary intent. Earlier separate-row and dual-label alternatives are rejected. |
| D02 — May users pin directly without deeper queue membership? | A character may be pinned directly to Up Next without either queue membership. Pinning creates no queue membership. Queue membership changes do not remove, reorder or retarget a pin. | Up Next is independent explicit user-controlled state. Any Prestige queue goal still requires a valid target and existing eligibility rules. Earlier queue-prerequisite alternative is rejected. |

These were the only unresolved product questions in this planning set. The user explicitly approved both decisions on 2026-10-27; they are now authoritative for the Phase 1B schema, migration and Dashboard behavior. Field names, target/state representation and unknown-record storage remain engineering decisions that must preserve these semantics.

## Resolved Global Direction Decisions

| ID / historical question | Status / decision | Rationale and retained alternatives |
| --- | --- | --- |
| G01 — Identity direction | **Resolved — user decision:** Archive when browsing. Tool when editing. | Trials Archive and Bloodweb Terminal inform recognition/precision; Killer technical dossier emphasizes Power. Preparation Bench remains a historical alternative, not another required skin. No literal horror decoration. |
| G02 — Dense editing geometry | **Resolved — bounded recommendation:** compact art/value rows or tiles suited to the task; preserve existing perk density choice. | Exact row-versus-tile geometry is a rendered-fit decision. Do not invent a second persistent stock-density feature. Names, numeric width and targets outrank miniature controls. |
| G03 — Visible editing context/actions | **Resolved — user direction plus plan 06 contract:** meaningful but compact identity; contextual task actions. | Retire global primary Edit Character. Save is near genuine drafts, Done exits saved Perks; no full repeated header or default sticky action stack. |
| G04 — Content width | **Resolved — recommendation:** shared outer canvas, task-specific width and bounded prose. | A single enlarged max-width cannot fix repeated empty enclosures. Rosters have useful 3/2/1 columns; inventory may use more area. Exact caps are engineering/visual checks. |
| G05 — Typography/atmosphere | **Resolved — conservative recommendation:** existing workhorse/system sans, numerical alignment, no decorative texture requirement. | Optional heading-font exploration is not a required dependency. Do not add font imports/texture to complete Core. Exact type scale follows readability/zoom checks. |
| G06 — Role distinction | **Resolved — user direction:** explicit role, authentic art and different inventory structures. | Survivor family/Item compatibility versus Killer Power/owner-bound Add-ons; no simplistic blue/red theme or forced symmetric content. |
| G07 — Responsive shell | **Resolved — user decision:** release sidebar width earlier when content constrains. **Recommended pattern:** compact labeled Menu header. | Keeps all six destinations discoverable without an icon-only rail, hidden horizontal strip or forced five-item bottom bar. Initial full-sidebar threshold around 1300px derives from useful width; exact cutoff is verified, not a 768px law. |

## Resolved Workflow Decisions

| ID / historical question | Status / decision | Rationale / preserved limits |
| --- | --- | --- |
| W01 — Match inventory by name, icon, rarity or game position? | **Resolved for Core — recommendation:** readable names/art, rarity direction and stable entry order. | No evidence justifies copying the game grid or inventing another ordering system. Real-content/keyboard verification can refine row geometry without reopening product scope. |
| W02 — Focused progression versus composite form? | **Resolved — user decision:** Overview progression-pair task, Save progression / Cancel. | Preserve capabilities, not the giant form; explicit atomic Prestige/Bloodweb validation remains. |
| W03 — Catalog or invoking-filter neighbors? | **Resolved for Core — conservative recommendation:** existing full-role canonical catalog neighbors, no wraparound. | Filtered traversal is deferred without demonstrated need. Roster Back separately restores filters/page/origin. No routing/schema invention needed to preserve order. |
| W04 — Family/search across characters? | **Resolved — user decision:** retain safe session working context; see SW04 and plan 06 state table. | Reduces repeated work without transferring drafts/invalid selections/counts/errors. |
| W05 — Ownership/tier fact and labels? | **Resolved — user decision:** recorded, automatic minimum, effective character tier and account access are distinct. | Effective = max(recorded, automatic). Recommended native roster scope Account access uses availability plus tier; workspace leads with effective and exposes record/minimum. General can be available at global tier zero. Owned/Locked is character status. |
| W06 — Killer search/In Stock parity? | **Resolved — recommendation in plan 05:** lightweight scoped name/effect search, In Stock, optional rarity restriction and existing rarity sort. | Useful during reconciliation of the fixed owner list; no Survivor family/type layers or identical large filter system for symmetry. Proposed additions, not existing behavior. |
| W07 — Undo for immediate edits? | **Resolved for Core — retain current correction/re-entry:** no new undo history. | No demonstrated error cost requires extra state. Retain local saved/error feedback and deliberate perk correction; never confirm every increment. |
| W08 — Setup, catalog provenance and displaced analytics? | **Resolved for Core — boundary:** setup entry/status in Overview, global setup access retained; reference/catalog details and Data destination remain functional. | Favorites remain roster filters; Dashboard suggestions/distribution leave its primary hierarchy. No new Statistics/Settings route or replacement analytics destination is required. Full legacy screen redesign is deferred. |

## Resolved Dashboard Decisions

| ID / historical question | Status / decision | Rationale / alternatives retained |
| --- | --- | --- |
| D03 — Sixth pin when full? | **Resolved — recommendation:** show current five; explicit replace/unpin or Cancel. | No eviction or silent reranking. Replacing a selected slot is one atomic pin-list edit; cancel is no-op. Controls/geometry are engineering details. |
| D04 — Which routes Continue resumes? | **Resolved — recommendation consistent with brief:** stable Overview, Perks browse, role inventory only. | Edit/Setup return to stable Overview; Update/legacy Perks normalize to Perks browse. No draft restoration or temporary modal route. |
| D05 — Does Continue travel with saves? | **Resolved — recommended local preference:** one last meaningful workspace record, outside account save/export. | Simple explicit local state meets the brief without telemetry. Validate character/section and optional visit timestamp; corrupt preference is ignored. Import/restore invalidates it; reset clears it. No portable visit history. |

## Resolved Survivor / Shared Workspace Decisions

| ID / historical question | Status / decision | Rationale / preserved alternatives |
| --- | --- | --- |
| SW01 — Immediate selection or staged collection Save? | **Resolved — user decision:** explicit Update Inventory, per-selection atomic persistence, Done to exit. | Reject giant staged perk transaction. Cancel cannot undo successful immediate writes. Retain failed intended selection for Retry / Discard failed selection / Stay; no dirty collection after success. |
| SW02 — Deliberate correction guard? | **Resolved — required separate correction; recommended guard:** secondary selected-perk disclosure showing current record/minimum/result, explicit Apply correction / Cancel. | No equal-weight correction on every card and no extra generic confirmation. Preserve historical correction; helper accepts null/I–III, historical explicit zero stays in its acquisition control. |
| SW03 — Retain all-character atomic Save? | **Resolved — user decision:** per-task atomic saves; retire giant Edit after capability parity. | Losing cross-task all-character cancellation is the intended trade-off. Keep validation, conflict protection, unknown data, failed drafts, setup and central migrations/normalization. No evidence requires the monolithic UI. |
| SW04 — Between-character context? | **Resolved — user decision:** safe session context where valid. | Keep section, perk query/filter/sort/density, Survivor family/valid Item, Add-on filters/sort. Never transfer draft values, selected perk/quick picker, correction state, character change counts, raw quantities or stale errors. Settle failures before leaving; ordinary tab departure ends perk edit mode. Plan 06 defines persistence ownership. |

## Resolved Roster Decisions

Ownership mutation is removed from both mostly navigational roster cards. Display **Owned / Locked**, manage ownership in Overview; Favorite remains independently operable. Both rosters retain six per page, 3×2 / 2×3 / 1×6 content-fit layout, bottom pagination and integrated count. Native account access recommendation handles General availability, not global tier alone.

| ID / historical question | Status / decision | Rationale / retained evidence |
| --- | --- | --- |
| KR01 — Use older square art when Lore is missing? | **Resolved — user decision:** neutral named fallback until genuine Lore exists. No square exception approved. | The Slasher is the sole known missing Lore case. Its valid square workspace source is not authentic Lore and must not be copied/renamed into that set. Roster already uses Lore for the other 43; workspace source adoption remains future work. |

## Engineering / Visual Verification Details (Not Product Questions)

- Confirm shell cutoff near the content-derived starting candidate, task widths, art fit, long labels, readable numbers, 200% text/400% reflow and focus clearance. Do not request arbitrary pixel approvals.
- Audit scope-specific dirty/navigation guards, failed tier retry, external-save conflict and pending quantities across tab/character/Back/filter/context changes. Current general Edit guard is not setup parity.
- Finalize schema fields and migration chain while preserving the approved D01/D02 semantics, role-order preservation and unresolved queue records. Validate round trips and fail closed on invalid account-state replacement.
- Verify structured longest-Power rendering, per-image containment, missing art and icon qualification without altering reference data.
- Preserve existing naming settings, density preference, aliases, unknown records, single-writer capability, recovery/backups and untouched screens.

These are acceptance/architecture concerns for the later roadmap. They are not routine work disguised as additional open product questions.

## Readiness

**D01/D02 are resolved and recorded.** They no longer block the final queue/pin contract or related Dashboard work. Plans 01–06 define behavior, shared constraints and persistence dependencies; full standalone libraries/Data redesign is not a prerequisite.
