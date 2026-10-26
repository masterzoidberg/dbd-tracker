# Rev02 Shared / Global Design System

## Status

Planning consolidation · 2026-10-25 · No application implementation. User decisions in the consolidation brief are settled. Specific geometry and the engineering recommendations identified below remain subject to rendered verification; they are not claims of user approval. Read with plans 01–05 and the question register.

Authority: explicit user decisions → approved Rev02 decisions → confirmed behavior to preserve → shared Rev02 principles → relevant skill guidance → generic preferences. This document consolidates shared behavior; it does not introduce a component library or competing PRODUCT.md/DESIGN.md.

## Product Identity

**Archive when browsing. Tool when editing.** The Ledger is a local-first personal DBD record. Character art, native perks, Power identity, Prestige/Bloodweb, rarity and actual inventory relationships supply its identity. Trials Archive, Bloodweb Terminal and Killer technical dossier describe hierarchy and precision, not literal skins. No decorative horror props, glass, gratuitous gradients, generic SaaS metrics or equal-weight nested boxes.

## Archive vs Tool Modes

Browsing emphasizes recognition, concise progression and provenance on demand. Editing reduces wrapper spacing, repeated headings and art scale so values and controls appear promptly. Readable names and targets remain. Update Inventory is an explicit operational mode, not a global appearance preference.

## Application Shell

### Desktop Navigation

One labeled navigation retains all six destinations: Dashboard, Survivors, Killers, Survivor perks, Killer perks, Data & backups. Use the full sidebar only when it leaves the active task enough useful width. Preserve product identity, current location, save/read-only/recovery status, Export JSON and Run character setups. The prior Dashboard-only decision to leave the top bar unchanged does not prohibit this explicitly requested global shell adaptation.

### Intermediate Width Navigation

Recommended shared pattern: compact top header with product name, current destination and a **Menu** button opening the complete labeled navigation. This is preferable to an icon-only rail or another horizontally hidden global strip: six destinations remain discoverable while the content recovers the sidebar width. Retain the full desktop labels inside the menu; no five-destination bottom bar assumption. Export and setup may move into a labeled Actions disclosure when needed; save and editing-state feedback stays visible.

Use native disclosure/button semantics where adequate. If implemented as a modal drawer instead, its focus containment, Escape, outside dismissal and trigger focus restoration must be complete. Do not impose dialog behavior on a non-modal disclosure. Close navigation on successful route activation, and use one main-landmark focus/scroll policy with sticky-header clearance.

### Mobile Navigation

Use the same labeled Menu pattern, with current destination and product identity visible. All destinations and actions remain reachable without icon memorization, sideways discovery or hover. A phone menu expands vertically and scrolls if necessary. Avoid stacking sticky global navigation, workspace tabs and another permanent editing toolbar over the task.

## Layout Widths

Keep a shared outer canvas with task-specific inner measures. Rosters use at most three columns, around 320px useful card minima and 20px gaps: about 1000px inner width for three, 660px for two. Explore a 1200–1320px roster bound. Inventory can use more working width; prose/reference stays around 60–75 readable characters per line. These are initial engineering/visual candidates, not final tokens. Main's current 1750px cap is not itself the primary problem; repeated enclosures and poorly grouped interiors waste space too.

## Typography Roles

Workhorse/system sans, no required font import. Compact page H1; section H2; readable object names; subordinate provenance; tabular numerical values. Initial body/control exploration 14–16px, supporting text 12–13px with rem sizing. Remove low-value repetition before shrinking text. Do not retain 8px roster headings. Long names, Unicode, large Prestige and long quantities must wrap/grow without clipping.

## Surface / Divider Language

Cards identify peer characters or cohesive editing objects. Open sections and dividers explain summaries, reference and tool regions. Dialog elevation serves an actual overlay. Avoid cards around every number, double icon frames, excessive pills and forced equal heights. Control boundaries, focus, selected, pending and error states must remain distinguishable.

## Character Artwork

### Survivor Portraits

Preserve existing role-correct mappings. Larger recognition area on roster/Overview, smaller but meaningful operational identity. Contain first; review paired characters and face placement. Stable text background, no blanket destructive crop or replacement art.

### Killer Lore Portraits

Canonical identity source: `images/updated-images/Character Portraits/Killers/Lore` (repository root `G:\Projects\dbd-tracker`). Apply to roster, workspace and other character-identity surfaces. Current roster already maps 43/44; workspace maps the older square set. Reuse canonical ID/manifest relationships and explicit Pinhead/Cenobite and Ghostface/Ghost Face aliases. Power/perk/Add-on artwork is a separate asset domain.

### Fallbacks

**Neutral named fallback until genuine Lore art exists. No square-portrait exception is approved.** The Slasher is the current sole missing Lore case. Keep a stable neutral slot, readable character name and quiet Portrait unavailable text; navigation remains functional. The same treatment covers decode/load failure. Do not generate, rename or copy an older square image into Lore. Good Guy's low resolution and Singularity's near-square composition require fit review, not source substitution. Missing Power icons retain Power names and a quiet independent fallback.

## Role Differentiation

Survivor inventory is **Item Family → Item → compatible Add-ons**. Killer inventory is **Killer → Power → Add-ons**, with Power name/summary prominent and no Item-family layer. Power is identity, not metadata. Shared progression/perk/control semantics do not imply identical content or blue/red role themes. Rarity/tier colors keep their own meaning.

## Page Headers

One compact H1, explicit role/scope, integrated catalog/account counts and task-relevant action. Keep filtered-result counts by results. Workspace header contains identity/progression once; do not repeat it as another metrics panel. No global primary Edit Character competing with each task.

## Search / Filter / Sort Toolbars

One scoped toolbar; visible restrictions and clear reset semantics. Reset filters retains query/sort; Clear search affects query; Clear search and filters explicitly affects both. Immediate search retains focus/caret. Roster searches canonical character names; perk search reuses alias-aware `perkSearchText`; stock search uses name/effect in the current compatible context. Shared visual grammar does not imply identical facets. Stable ordering during repeated edits takes priority over automatic resorting.

## Roster Pagination

Six per role page after filtering/sorting: desktop 3×2, tablet 2×3 when width fits, phone 1×6. Bottom pager, truthful range/current-page state, named Previous/Next, bounded page links where room exists. Search/filter/sort resets page one; resize preserves page; data changes clamp; zero results shows recovery, not 1–0. Explicit paging focuses/reveals results; typing retains input focus. Favorite remains an independent sibling action to one broad real workspace anchor.

## Character Workspace Shell

Back to role roster; compact named neighbors; portrait/name/role; grouped Prestige/Bloodweb; ownership/Favorite; three linked sections; task content. Overview, Perks and role-specific inventory are the principal workspaces. Setup remains a focused temporary flow. Operational tabs use smaller chrome rather than tiny controls. Preserve valid deep links and legacy/manage aliases.

## Previous / Next Navigation

Keep canonical same-role catalog order, no wraparound and named real links. This is a conservative engineering recommendation preserving current behavior; filtered traversal is deferred, not a product blocker. Roster Back separately restores its invoking page/query/filter/sort and origin focus during the session.

Carry the section and, for deliberate Previous/Next while updating, Update Inventory mode. Retain safe role-local query/filter/sort/density; Survivor family and valid selected Item; Killer Add-on filters/sort. On a different role use that role's independent context. Revalidate against catalog/role/compatibility; retain a selected Item hidden by filters and identify it explicitly. Invalid selections fall back to the first valid catalog Item, with correct no-compatible/no-catalog state where none exists.

Never transfer drafts, raw quantities, stale errors, selected perk/quick picker, correction panel or change count. Settle pending source edits before any switch; invalid/failed input keeps the user in place until retry or deliberate discard. Returning to a tab on the same character retains its safe session filters; leaving Perks ends Update mode unless the action was its explicit neighbor navigation. Re-enter editing deliberately. Continue always resumes browse, never edit mode.

## Tabs

Use canonical links and `aria-current`, not ARIA tabs without implementing their keyboard contract. Keep section labels readable and discoverable; wrap or use an accessible section selector before hiding destinations. Stable URLs remain Overview, Perks, Items & Add-ons / Power & Add-ons. Update has a supported subordinate route; old Edit links will resolve to Overview contextual management after parity, not a fourth workspace.

## Progression Treatment

### Prestige

Strong Pn number with accessible Prestige n name. Non-negative safe integer; no invented P100 cap. Overview Edit progression saves Prestige/Bloodweb together. Preview account-derived tier consequences without rewriting personal records; lowering recorded Prestige does not erase inventory.

### Bloodweb

Recorded level 1–50 beside Prestige. Optional subordinate track shows level only, not linear XP/spend/percentage to P100. No automatic reset unless an existing supported operation explicitly does it.

## Ownership / Favorite

Roster displays **Owned / Locked**, with mutation in Overview. Locked means character ownership only, not every perk unavailable or workspace inaccessible. Unowning does not erase progress, stock or notes. Favorite may be an independent immediate roster/header action; never infer queues/pins. Both mutations are writer-guarded, validated and truthful on failure; rerender/filter removal must recover useful focus.

## Perk Semantics

### Recorded Tier

Explicit per-character `perks` map. UI: **Recorded: Not recorded / I / II / III**. Own-property presence matters: absent differs from historical explicit zero (Not confirmed versus Recorded: Not owned). `recordedTier()` returns zero in both cases, so it is insufficient for that distinction.

### Automatic Minimum

`automaticTier` is max(native I, `globalTier`) for the same role. `globalTier` takes source Prestige capped at III and Shrine/Legacy/manual override maxima. Native minimum can exist on an unowned source character; saved source Prestige derives tiers regardless of source owned flag. General account availability alone does not supply a positive minimum.

### Effective Tier

**`effectiveTier = max(recordedTier, automaticMinimum)`**, implemented by `inventoryTier`. UI: **On this character · Effective Tier II**, with recorded/minimum detail. Zero is No effective tier, never an ambiguous Owned label. `characterStats.owned` is an internal effective-positive count; user copy is Effective perks, not recorded completeness.

Exports keep `perks` as explicit records and add derived `effectivePerks` plus `perkInventorySummary` (`tracked`, `maxed`, `upgradeable`). Import ignores those derived fields and recomputes them; they must never be copied into personal records or treated as authoritative persisted state. Existing v2 exports lacking derived fields still import.

### Account Access

`isAvailable` is General or positive global tier. **General can be available at global tier zero.** Recommended roster native scope: Native perks · Account access, using both availability and tier; workspace personal browsing leads with effective tier and shows recorded/minimum/account separately. Scope selection is a consolidation recommendation grounded in plan 03, not a change to calculation rules. Never use Owned for character ownership, availability and explicit records interchangeably.

## Perk Cards

Readable diamond art/name/effective state; quiet provenance on inspection. Browse opens reference/state, not mutation. Keep Native, General, account-unlocked and retained candidates plus explicit all-role/special-acquisition access; do not lose historical/retained records. Relabel current Only unrecorded (effective zero) as No effective tier; any true Not recorded filter must check map presence. No six-card pagination on perk collections. Existing Compact/Standard/Large density remains available at all usable widths.

## Perk Update Mode

**Update Inventory → per-selection atomic persistence → Done.** Normal picker: Not recorded / I / II / III, applying existing automatic-floor validation. None removes the explicit record, not the derived minimum. No giant collection draft and no Cancel pretending to undo earlier selections. Do not reinterpret existing normal setter as globally monotonic: it can lower eligible ordinary records; historical acquisition has its own non-downgrade rules.

Successful tier/historical selections commit through the existing clone/normalize/validate/writer-guarded storage path, then show Saved and update the current character's session count. Failed writes leave canonical state unchanged; retain the intended selection for retry and show Not saved. Navigation/Done with an unresolved failed selection offers Retry / Discard failed selection / Stay; discard never reverses prior successful writes. There is no collection dirty state after success. Character switch clears counts/selection/errors only after settlement; tab switch ends mode and carries safe filters only.

Exceptional **Correct personal record** is a secondary disclosure for the selected perk. Show current record, automatic minimum and resulting effective tier. Recommended guard: small task draft with explicit **Apply correction / Cancel**; one intentional Apply suffices, no repeated generic confirmation. Reuse `correctPersonalPerkTier` (null or I–III), retaining its ability to lower/clear historical records. Historical explicit zero remains supported by its separate acquisition control; do not claim the correction helper accepts zero. Cancelling correction affects only its unapplied value. Account unlock controls remain separately labeled account-wide mutations; resolve any active local draft first.

## Inventory Quantity Controls

Canonical **−1 | quantity | +1 | +5 | +10**, additive, minimum zero, safe-integer ceiling, direct numeric editing. Existing Enter/blur commits and immediate steps remain; parse pending raw input before stepping. Blank-on-blur normalization is an app interaction rule, not permission for the strict parser to accept blanks. Invalid fractions/negatives/unsafe text retain error/input. Zero removes canonical positive stock entries. Preserve unknown valid records read-only and on export.

On narrow cards put −1/value/+1 first and +5/+10 below. Protect a useful number field before columns. Semantic names include object and increment; avoid repeating visible Quantity of X on every card. Rapid edits retain focus, stable ordering and local feedback. Settle pending input before hiding it through filters/context or navigation; failed/invalid fields remain revealed. Reuse `inventory-quantities.js` and `inventory-interaction.js`, not a second parser or per-role save system.

## Rarity

Text plus existing art/color. Flat lists, default high→low, optional inverse; no rarity accordions. Preserve current additional/Event-last ordering and stable catalog tie order. Survivor compatibility still scopes the list; Killer owner still scopes the list. Do not change research rarity assignments.

## Details / Reference Surfaces

Read-only reference never edits canonical Power definitions. Recommended large Power dialog: bounded readable mechanics, structured components, internal scroll, full-height treatment on phone. Add-on details use a smaller contextual dialog; same focus/close conventions, different geometry. Preserve full data and source qualification; no raw object keys as repeated visible headings. Focus enters a named surface, Escape closes and returns to its opener or useful fallback.

## Save Vocabulary

| Label | Meaning |
| --- | --- |
| Save progression / Save note | Validate and commit that explicit task draft atomically. |
| Done | Leave already-autosaved Update mode; never imply batch save. |
| Cancel | Discard only an unapplied draft/correction; never earlier direct writes. |
| Reset filters | Clear specified restrictions, retain visible query/sort. |
| Reset progression | Existing destructive data action with confirmation/backup; separate from filter reset. |
| Update Inventory | Deliberately enable personal perk editing. |
| Correct personal record | Exceptional scoped record correction with before/result explanation. |
| Apply correction | Commit the one deliberate correction after preview. |

## Status / Feedback

Local draft/pending/saved/error states take precedence over a global stored timestamp. Read-only allows browsing and reference, disables mutations with a useful reason. Storage failure never displays success or replaces canonical in-memory state. Do not announce every repeated step assertively. Browser-local preferences failing to persist must not block progression edits or masquerade as data loss.

## Setup / Reconciliation

Normal = quiet; problem = prominent. Owned incomplete setup is actionable; complete setup is subordinate. Preserve ownership eligibility, P0/Bloodweb 1 skip, special acquisition, additive/max-tier Finish, backup-before-Finish and batch resume/skip. Set P1 saves immediately and Cancel does not undo it. Guard unsaved setup Bloodweb/perk departure explicitly; current Edit dirty guard does not automatically protect setup. Reconciliation is manual recording, not game telemetry/import.

## Empty States

Distinguish no effective perks, zero stock, no filtered matches, no compatible Add-ons, missing reference data/art and unknown saved records. No compatible Add-ons: “This item does not use Add-ons.” Filtered empty: retain context with Clear filters. Missing data must not look like an empty valid inventory.

## Error States

Retain raw invalid text and failed intent with associated errors/retry. Loss of writer capability or external-save change retains the draft and requires deliberate reload/discard/retry; do not silently merge stale data. Unknown IDs remain preserved, not guessed into another role/owner. Import/reset/restore keep explicit confirmation and backup/recovery protections.

## Loading States If Applicable

Catalogs are bundled, not per-tab network fetches. Preserve honest startup/loading/recovery state while storage/editor initializes; do not flash fresh-save zeros as loaded data or invent skeleton delays on every local route.

## Accessibility

Target WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text/essential non-text cues; non-color states, labels, reflow and accessible errors. Practical frequent touch targets around 44px, distinct from WCAG's minimum/spacing rules. Validate later with keyboard/screen reader, 200% text, 400% reflow, 320px width and real numeric keyboards. Earlier screenshots/source are not certification.

## Keyboard Interaction

Native links/buttons/selects, logical DOM order, no drag-only reordering or hover-only actions. Up Next Move Up/Down announces position and retains moved-row focus. Quantity text selection/direct entry stays native. Do not add mandatory custom shortcuts.

## Focus Management

Route focus must clear sticky chrome; preserve input focus on local rerender. Explicit page activation focuses results; filtering keeps its control; removed Favorite/zero-stock row moves to a sensible remaining result. Dialogs restore opener. Draft/error navigation keeps/reveals the actionable field. Fix skip-link hover contrast and sticky heading obstruction during shell work.

## Touch Targets

Preserve practical target spacing and number width. A smaller visible icon may have a larger target. Reflow control groups before shrinking fields or hiding secondary increments.

## Motion

Immediate tiers, quantities, search, filters, sorting, paging, tabs and neighbors. No animated counters, staggered cards or theatrical transitions. Rare functional disclosure motion may be brief and reduced-motion aware; no motion dependency.

## Responsive Breakpoints

Content fit governs once for the global shell. Starting recommendation: full sidebar needs about 220px + 72px gutters + 1000px useful roster = **1292px** before scrollbar/zoom allowance; explore transition around **1300px**, including 1280/1366 boundary checks. This releases width earlier than today's 760px rule and can preserve three useful roster columns at a 1280px laptop after removing the sidebar. Exact CSS cutoff is an engineering verification detail, not a new product approval.

| Usage / validation viewport | Shell and task behavior |
| --- | --- |
| Wide desktop, 1600–1920+ | Full labeled sidebar; bounded three-column rosters, fluid operational area, bounded prose. |
| Ordinary laptop, 1366/1440 | Full sidebar only while ~1000px task width fits; compact editing header; check short heights. |
| Narrow laptop / landscape tablet, 1024–1280 | Compact Menu header; no reserved sidebar; roster three columns only above its inner threshold, otherwise two. Drop perk side pane before crushing results. |
| Tablet, ~768–1024 | Compact shell; two roster columns above ~660px inner width; labels/controls wrap, six entries stay. No device-name breakpoint law. |
| Phone, 320–430 and other narrow widths | Compact labeled menu, one roster column/six entries; usually one quantity column with reflowed steps; one/two readable perk columns. |

Zoom/long labels may trigger compact treatment sooner. Test available content width, not user-agent device categories. Screens must not choose independent global navigation thresholds.

## State Ownership

| State | Owner / lifetime | Portability / switching |
| --- | --- | --- |
| Character ownership, Favorite, Prestige/Bloodweb, notes, setup, explicit perks, stock, overrides | Persisted account save | Export/import/restore with validation and existing unknown-record protection. |
| Prestige/Playing queues and independent Up Next order | New persisted account state, plan 01 | Migration/import/export dependency; never derived from Favorites or edit dates. |
| Licensed naming settings | Existing portable `save.settings` | Preserve aliases and meanings across roles. |
| Perk density | Existing browser-local user preference | Preserve current localStorage/legacy-key fallback; not new portable progression state. Applies across character switch. |
| Last meaningful workspace | New small browser-local UI preference, plan 01 | Refresh survives if available; not exported; stable character/section only plus visit time. |
| Roster query/filter/sort/page/origin | Session-only, separate per role | Back restores/clamps and recovers origin focus; fresh session uses defaults. |
| Workspace tab/mode, perk query/filter/sort, Survivor family/valid Item, Add-on query/filter/sort | Session-only safe context, independent per role | Preserve across explicit neighbors as above; clear edit mode on ordinary tab departure. No new save schema for these. |
| Selected perk, quick picker, correction preview, changed IDs | Character-specific transient session | Clear on character switch; count starts fresh on each Update entry. No cross-character selection/errors. |
| Progression/notes/setup draft, pending/failed quantity/tier intent, errors | Character/task-specific transient component state | Settle or explicitly discard before leaving; never transferred or promised crash recovery. |

Keep no unnecessary new persisted preferences. `lastRoute`/filter Map/history are currently runtime-only and do not fulfill Continue. Current quantity sessions also reset by character: retained safe context requires separating it from pending value/error state.

## Shared Components Worth Considering Later

Conceptual contracts: labeled shell/navigation, scope-aware heading/toolbar, six-result pager, roster link/Favorite behavior, workspace header/neighbors, perk state/editor, task draft guard, quantity group, reference dialog and status/error presentation. Reuse existing helpers where possible. No framework, component-library migration or speculative abstraction requirement.

## Things That Must Remain Role-Specific

Killer Lore identity/Power and owner-specific Add-ons; Survivor family/Item compatibility and one stock record reused across compatible Items; separate role catalogs, independent queue/pin orders and session contexts. Account library scope remains different from personal inventory even with shared terminology.

## Rev02 Core Boundary and Dependencies

Core includes shell, Dashboard, both rosters and full workspaces, shared interactions and required persistence foundations. Standalone Survivor/Killer perk libraries and Data & Backups retain existing information architecture initially, with functional shell integration, typography, accessibility and compatibility styling. Their import/export/recovery behavior must understand the new schema even without a screen redesign.

Dependency observation only, not a coding roadmap: repository/data safety → schema/state foundations → shared shell/system → roster primitives → both rosters → workspace shell/primitives → Survivor workspace → Killer workspace → Dashboard data features/UI → untouched-screen compatibility → visual/functional verification → polish/stress testing. State foundations precede Dashboard UI despite its plan number.

## Explicit Non-Goals

No production code/CSS/assets/schema changes, new framework/dependency/service, final tokens, implementation phases or task-by-task roadmap in this pass. No redesign prerequisite for every legacy screen. No giant composite transaction retained merely to preserve the old form. Full editor retirement is conditional on capability parity and verified route/draft safeguards, not a claim that parity exists today.
