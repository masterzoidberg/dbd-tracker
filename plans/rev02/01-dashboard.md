# Rev02 Dashboard Design

## Status

**Approved design direction · Planning only · Not implemented.** This document records the current Rev02 Dashboard direction. Where it conflicts with earlier Dashboard planning notes, this Rev02 direction is the current planning reference; older documents remain unmodified history.

## Purpose

The Dashboard is the application's opening page. It should orient the user, show overall progression, show what they intend to work on next, and provide a quick way back to the last workspace location they were using.

It is not a dense analytics page or a place to expose every statistic the tracker can calculate. Keep the opening view focused on three jobs and move secondary detail deeper into the application.

## Primary User Questions

1. Where am I overall?
2. What am I doing next?
3. Where was I last?

## Information Hierarchy

The three primary Dashboard sections, in order, are:

1. **Progression Snapshot** — a concise, balanced Survivor and Killer account overview.
2. **Up Next** — each role's manually ranked, curated short list, with its Prestige or Playing intent visible.
3. **Continue Where You Left Off** — one compact return to the most recently used character workspace location.

These sections should be visually distinct in importance. Secondary recommendations, charts, favorites, and administrative details must not compete as additional primary sections.

### 1. Progression Snapshot

Give Survivor and Killer progression equal standing while making the roles easy to distinguish. Prefer one concise summary per role rather than separate cards for each metric family.

Reliable measures already available from the current save and catalog are:

- **Characters owned / total in the role catalog.** `roleCharacters(role)` supplies the current role total; saved `owned` flags supply the numerator.
- **Prestige progress.** The Dashboard already calculates owned characters at P1+ and P3+. These are compact, understandable indicators; total and average Prestige can stay out of the main hierarchy.
- **Account-wide perk access / total for that role.** `isAvailable(save, perk)` and `rolePerks(role)` provide a reliable access count. A single concise count or progress measure can be reused.

Keep account perk access distinct from a character's personally recorded perk inventory. General perks count as globally available under current model rules; availability does not mean every character has personally acquired that perk. Label the measure as account access or availability.

Current sources that can be reused are the calculations in `roleSummary(role)` and `perkSummary(role)` in `src/app.js`, backed by `roleCharacters`, `rolePerks`, `save.characters`, `isAvailable`, and `globalTier`. The collection totals and perk-access counts are real current data, not proposed metrics. The role cards should share the same visual weight and amount of detail.

De-emphasize or omit locked-character counts when they merely repeat owned / total, separate Total Prestige and Average Prestige, Favorite totals, standalone perk Tier III and locked counts, and the P0/P1/P2/P3+ distribution chart. These are either derivable, secondary, or more detailed than the opening-page question requires. Do not add a new percentage or completion score unless it is simply a clearly labeled presentation of supported counts.

### 2. Up Next

Up Next is the user's immediate, curated priority list. It contains up to five pinned Survivors and up to five pinned Killers. The two role lists have independent contents and rankings; never combine them into one Survivor/Killer ranking.

Each entry should make the character, its position, and its intent clear. Intent is one of:

- **Prestige** — the user is working toward a Prestige goal.
- **Playing** — the user wants to play this character soon.

Users can edit their pinned lists and manually reorder each role's list. Up Next order belongs to this curated shortlist and does not have to match a character's position in a longer queue. A pin/unpin or edit action should not silently change a deeper queue's order.

If drag sorting is used, provide keyboard- and touch-accessible Move Up / Move Down controls as an alternative. Do not make drag interaction the only way to reorder. The full queue-management experience is outside this screen plan; the Dashboard only needs to explain and expose the curated short list.

#### Survivor Up Next

Show only pinned Survivors, in the user's independent Survivor ranking. Each can carry a Prestige or Playing intent label. The list can be empty and must remain useful in that state; it must not be filled automatically from recommendations.

#### Killer Up Next

Show only pinned Killers, in the user's independent Killer ranking. Each can carry a Prestige or Playing intent label. Its ordering and empty state are independent of the Survivor list.

#### Relationship to Prestige Queue

The Prestige Queue answers **“Who do I intend to level or prestige?”** It may contain more characters than the Dashboard shortlist. A queued character may be pinned to Up Next, but pin ranking is curated separately from Prestige Queue rank. Queue membership or a recommendation must not automatically promote a character to Up Next.

The current application has a persisted Prestige Queue, but it is one globally ordered list of character IDs and target Prestige values. It does not currently have a role-specific queue, an Up Next pin, or an independent Up Next rank. The current Dashboard's “My Prestige Queue” panel previews and manages this longer list, and derives one Current Focus from the first available, unfinished goal. Rev02 should surface only pinned entries in Up Next; it should not repeat the entire queue or add a separate Current Focus block that duplicates the curated list. Rev02 Core must include a subordinate Manage queues surface reached from Up Next, with role and Prestige/Playing separation. It need not add a seventh global navigation destination. Preserve existing Prestige add/target/remove/reorder capabilities and the approved D01/D02 semantics recorded in [the decision register](00b-open-design-questions.md).

#### Relationship to Playing Queue

The Playing Queue answers **“Who do I actually want to play soon?”** It is separate from Prestige intent because a progression goal and a play-interest priority can differ. It is also role-separated: Playing Survivors and Playing Killers have their own lists.

The current application has no Playing Queue or persisted Playing intent. Up Next must not infer this intent from Favorites, recent edits, or Prestige recommendations. A subordinate Manage queues surface is required in Core to add/remove/reorder Playing entries independently per role. The approved D01/D02 membership and pin semantics are recorded in [the decision register](00b-open-design-questions.md). Exact dialog/inline geometry is an engineering detail. This does not add a fourth primary Dashboard job.

### 3. Continue Where You Left Off

Keep this section compact and actionable. Its primary action is to return to the character and stable workspace section the user most recently worked in. The card should identify the character, role, workspace section, and recency, and provide a clear **Continue** action. It is not a large activity log.

The current “Continue where you left off” area is a list of up to five recently edited characters, based on character `updatedAt` timestamps. Each link currently opens the character's Overview route. An edit timestamp is not evidence of a visit or the last workspace section used, so this list cannot satisfy the Rev02 resume behavior by itself. Do not relabel a recent edit as a saved location.

The route system already expresses a character and section in the URL. `parseCharacterWorkspaceRoute()` and `characterWorkspaceHref()` in `src/character-workspace.js` handle canonical routes, and the character workspace navigation exposes Overview, Perks, and the role-specific Items & Add-ons or Power & Add-ons section. The URL, current route, and browser history can identify a location while navigating, but no persisted `lastLocation` or recent-route record exists in the save. `lastRoute` and workspace history bookkeeping in `src/app.js` are runtime navigation state, not a saved resume preference. The existing `updatedAt` is changed by saved edits in `commit()`, not by opening a workspace.

The consolidation recommendation is one small **browser-local last meaningful workspace** record, separate from progression data, edit timestamps and export. Record only a successfully resolved stable character/section navigation (optionally visit time), not every render, input, search or hover. Stable Overview, Perks browse, Items & Add-ons and Power & Add-ons are resumable. Temporary Edit/Setup map to Overview; Update/legacy Perks map to browse. Do not overwrite the last valid stable location merely because a temporary dialog opens.

Validate via canonical parser/href and current catalog. No local record means quiet “Open a character to continue”; bad/unknown/wrong-role record is ignored. Derive role/name from catalog. Preference write failure must not block real save/navigation. Store no drafts or interaction history. Refresh may restore this one location; import/restore invalidates it and reset clears it to avoid misleading resume across replaced account data. Session-only detailed filters are retained only while valid in the running session; do not promise their cross-refresh restoration. D04/D05 are resolved recommendations consistent with the brief.

## Existing Dashboard Content Review

| Current Section | Recommendation | Reason |
| --- | --- | --- |
| Account overview heading and subtitle | KEEP | Keep a clear page identity, with a concise subtitle that supports the three Dashboard jobs. |
| Perk catalog note | DE-EMPHASIZE | Catalog provenance is useful but not a primary opening-page task. Keep details discoverable through the existing data/catalog destination. |
| Account setup prompt (shown before setup is complete) | DE-EMPHASIZE | Preserve a restrained onboarding entry while setup is incomplete, below the three primary sections. Review its longer-term home during the Data / Backups screen plan. |
| My Prestige Queue and Current Focus | MERGE | Use eligible pinned entries in the role-separated Up Next lists. Do not duplicate one derived focus callout or show the entire longer queue on the Dashboard. |
| Continue where you left off: five recent edits | MERGE | Replace the prominent edit list with one persisted last-workspace-location action. A recent edit may only be secondary context because it does not identify a visit or section. |
| Suggested P1 targets | REMOVE FROM DASHBOARD | This algorithm ranks characters by remaining native perk access, not by the user's declared intent. It competes with the manually curated Up Next lists. This recommendation does not delete the selector or decide a destination for it. |
| Survivor and Killer collection summaries | MERGE | Reuse owned / total and compact Prestige counts inside the paired Progression Snapshot role summaries. De-emphasize duplicated locked counts and deeper total / average Prestige figures. |
| Survivor and Killer perk summaries | MERGE | Reuse a concise role-specific account-access count in Progression Snapshot; avoid another pair of equally prominent cards and clarify global availability. |
| Prestige distribution charts | MOVE | Remove the analytics block from the opening hierarchy. A deeper collection or statistics destination can be considered when those screens are reviewed; no destination is chosen here. |
| Favorites disclosure and character shortcuts | MOVE | Favorites are useful navigation shortcuts but do not express current Prestige or Playing intent. Keep them available in the role rosters if still useful there; do not use them to populate Up Next. |

Global shell actions such as save status, Export JSON, and Run character setups are in the shared top bar, not Dashboard content. The earlier Dashboard-only placement boundary is superseded by the explicit global shell brief: plan 06 preserves the capabilities and visible status while adapting labeled Menu/Actions placement to width.

## Desktop Layout Direction

- Use the available workspace width more effectively. The current shell gives `main` a 1750px maximum with 36px desktop padding (44px at wider breakpoints), but the Dashboard breaks content into several separate two-column and full-width regions. At the audited 1920px the shell already uses most available width. The problem is interior grouping and repeated enclosures rather than simply a narrow main cap: a tall stack of similarly framed boxes, with some paired information cards narrower than the workspace needs to be.
- Give the three primary sections clear separation and weight. Keep Survivor and Killer measures balanced within Progression Snapshot, and keep the two Up Next rankings visibly separate. Continue should be compact and easy to act on.
- Make the three-section hierarchy apparent through grouping, spacing, and relative emphasis rather than giving every statistic its own panel. Avoid adding a collection of equally prominent boxes.
- Do not lock a new color system, card treatment, or global max-width here. Reuse the current visual language as a starting point; record broader questions below for the shared/global review.

## Mobile / Responsive Considerations

- Stack the role summaries and Up Next lists when two columns no longer give names, intent labels, and controls adequate room. Keep Survivor and Killer headings and their independent order explicit after stacking.
- Keep Continue as a compact single-column action. Do not turn queue lists into horizontally scrolling tables.
- Allow long character names and labels to wrap without clipping. Preserve visible rank, intent, and primary action at narrow widths.
- Revisit the breakpoint behavior: the current `.two-column` layout remains two columns down to 760px, so the 761–1100px range can leave narrow role cards beside the fixed sidebar. Select breakpoints based on content fit during the later shared responsive review.
- Reordering and editing controls need usable touch targets and must remain available without drag gestures.

## Accessibility Considerations

- Use a clear heading structure for the page and each of its three primary sections. Label Survivor and Killer subsections in the content, not with color alone.
- Represent each ranked Up Next list as a meaningful ordered list. Give edit/reorder controls character-specific accessible names such as “Move Zarina Kassir up.”
- Keep keyboard operation available for pinning, editing, reordering, and continuing. If a reorder updates the rendered list, preserve focus on the moved row/control and announce the new position to assistive technology.
- If progress bars are used, expose their value and text equivalent programmatically; never make color or bar length the only carrier of progression.
- Keep Prestige / Playing intent, role, and rank visible as text. Ensure focus indicators and target sizes work at desktop and mobile widths.

## Existing-Code Observations

- `src/app.js` contains the Dashboard rendering: `dashboard()`, `roleSummary()`, `perkSummary()`, and `prestigeChart()`. It builds HTML strings inside the existing single-page application; there is no separate Dashboard component file.
- `src/dashboard-selectors.js` provides `suggestedP1Targets()`, `recentCharacters()`, and `favoriteCharacters()`. Recent characters are selected by parsed edit timestamp and the current Dashboard links them to Overview. These selectors are not last-location tracking.
- `src/prestige-queue.js` validates, derives, and mutates the one saved Prestige Queue. `derivePrestigeQueue()` calculates completion and Current Focus from current character progress; it does not persist focus. The queue currently preserves a single global rank.
- `src/model.js` is at schema version 2. `freshSave()` creates `prestigeQueue: []`; `src/storage.js` validates and stores saves in local storage. Character records have `updatedAt`, but the save has no Playing Queue, Up Next pin/order, intent marker, or last-workspace-location field.
- `src/character-workspace.js` defines canonical character routes and role-specific workspace sections. `src/app.js` tracks the active route and browser history at runtime, but does not save the last character section as a user preference.
- `styles.css` sets `main` to `max-width: 1750px`, styles `.two-column` at equal widths, and collapses it at 760px. Dashboard summaries, perk summaries, and panels use related but distinct card rules. These are relevant existing constraints, not a prescribed global redesign.
- Dashboard behavior is covered by `tests/dashboard-selectors.test.js`, `tests/prestige-queue.test.js`, and `tests/browser/dashboard.mjs`. The browser regression currently asserts the old section order, one global Prestige Queue, Current Focus, and its management interactions. Later implementation and verification planning must revisit those expectations against the completed Rev02 decisions. The original Dashboard review ran no tests; current consolidation verification is recorded in the audit matrix.

## Dashboard Data Model Review — 2026-10-25

### Current Relevant State and Reusable Logic

`SCHEMA_VERSION = 2`; `freshSave` has one `prestigeQueue: []`. Each entry is `{ characterId, targetPrestige }`; array index is rank. `validatePrestigeQueue` rejects holes, duplicate/unsafe IDs and invalid targets, but preserves syntactically valid unknown character IDs. `derivePrestigeQueue` calculates unavailable/completed state and Current Focus without persisting it. Add requires an owned resolved character and a positive safe target greater than current Prestige; saved completed/unowned/unresolved goals remain representable. Preserve those distinctions.

`save.characters` stores owned/favorite/prestige/bloodwebLevel/setupComplete/notes/perks/inventory/updatedAt; `perkOverrides` and naming `settings` are separate account facts. There are no Playing queues, pins or Continue fields. `queueView.role` is a runtime filter over the one global queue, not independent saved role order. `recentCharacters` reads edited timestamps and cannot recover visits. Reuse progression/access helpers and target-benefit calculations without reinterpreting timestamps or Favorites.

### Likely New Persisted Account State

Schema v3 uses one `planning` object as the sole writable planning state. Array position is manual rank; completion and availability are derived from current progression/catalog facts rather than persisted as stale flags.

| State | Logical contents / ordering | Default / constraints |
| --- | --- | --- |
| Prestige queues by role | `planning.prestigeQueues.survivor/killer`: ordered `{characterId,targetPrestige}` entries | Independent array rank; preserve target; completion/unavailable is derived. No five-entry limit on longer queues. |
| Playing queues by role | `planning.playingQueues.survivor/killer`: ordered `{characterId}` entries | Independent manually editable lists; no inferred Favorites/recent intent and no invented Prestige target. |
| Up Next by role | `planning.upNext.survivor/killer`: ordered `{characterId,intent}` pins; intent is `prestige` or `play` | Unique character per lane, max five active pins each, manual order independent of both longer queues. Direct pin needs no queue membership; other-queue membership may appear as secondary context. |
| Unresolved planning records | `planning.unresolved`: ordered `{queue,role,rank,record}` wrappers, where `role` may be `null` if unknown | Preserve the source queue, role when supplied, original rank and full record. Keep unresolved records read-only and outside active lanes; never guess a role or discard a valid unknown goal/pin. |

The `planning` object is the sole writable planning state; schema v3 does not retain the legacy global `prestigeQueue`. Split known old goals by canonical role while preserving within-role order, target and derived completion/unavailable behavior. Move unknown IDs to `planning.unresolved` with the original cross-role rank and record rather than guessing a role. `validateSave`, fresh defaults, `TrackerStorage.load/save/replace`, migration backup copy, import summaries/reset warnings, Data schema display and export all require compatible updates.

### Migration / Old Export Compatibility

- Accept existing v1 and v2 through an explicit migration chain; future unsupported versions remain rejected. Existing v1→v2 creates empty stock/Prestige queue, so preserve that path before adding new foundations.
- Split each known old Prestige goal into its catalog role, preserving **relative within-role order**, target and completion/unavailable state. Cross-role interleaving no longer expresses a shared rank. Preserve unresolved goals without assigning a fictional role.
- Default Playing and Up Next to empty; never auto-pin the first five old goals or derive play intent from Favorites. New clean save defaults are empty for every role list.
- Back up the validated predecessor before persisting migration; writer capability and backup failure protections remain. Read-only startup must not write migration. Unsupported/invalid account data enters existing recovery behavior without destructive cleanup.
- Export future canonical queue/pin state; import/re-export preserves order and targets. Derived `effectivePerks`/`perkInventorySummary` remain recomputed export conveniences, not personal-record input. Existing exports without these fields remain valid.
- Old application builds cannot be promised to preserve new saves: current code rejects future versions and strips unknown extra fields in v2. Never label a v3 payload v2 for apparent backwards compatibility. Updated readers must accept supported older exports; downgrade compatibility is not lossless.
- Import/restore/reset and local backup snapshots must carry the new fields. Confirmation copy must disclose replacement/defaults. Standalone Data & Backups keeps its existing screen architecture, but this schema compatibility work is in Core.

### Validation / Malformed-State Recovery

Use canonical safe IDs, supported roles, dense arrays, unique entries, valid targets/intent and max five active unique pins per role. Known character IDs must agree with lane role. Preserve completed/unowned saved goals and pins rather than silently removing them or refilling lanes; creation eligibility must preserve existing Prestige rules. Direct pins are allowed and do not create membership; queue membership changes do not remove, reorder or retarget pins. Unknown or unresolved pins remain visible as read-only recovery information and never count as a hidden sixth active pin.

New-state validation must distinguish missing fields in supported **older-version migration** (default empty) from malformed declared new-version fields (reject replacement, retain original). Do not silently truncate over-cap lanes, drop duplicates or manufacture ordering on corrupt portable input. Offer the existing raw export/import/backup recovery path. Valid unresolved records are preserved read-only and excluded from active resolved pin slots, with any retention container explicit; do not erase them to make the Dashboard look tidy. Final unresolved-pin policy must honor the unique/five limits without presenting a hidden sixth active entry.

Reorders move one entry within its role lane and commit atomically. New pin in full lane presents its current five for explicit replace/unpin or Cancel; no silent eviction. Recommended replacement occupies the chosen rank and is one atomic edit. Queue edits cannot silently change pin rank. Completion, unowning, queue removal and dual membership preserve pin data and explicit intent under the approved D01/D02 decisions.

### Continue State and Routing

Recommended local-only logical value: `{characterId, section, visitedAt?}` with no standalone role duplication. Small preference is not an account-schema field, not exported and not tracked as progression `updatedAt`. Canonical parser/href validates stable sections. Write once per meaningful navigation, tolerate unavailable local preference storage, normalize temporary routes and ignore malformed state. Clear/invalidate on data replacement/reset as above. No behavioral telemetry or multi-entry activity history.

### Queue Management Boundary

Up Next exposes pin/edit/reorder and a subordinate **Manage queues** entry. The management surface distinguishes role and Prestige/Playing, retains valid target editing and independent add/remove/reorder, exposes unknown goals read-only, and does not duplicate a Current Focus primary panel. It can be an inline expansion or accessible dialog according to actual content fit; no new global route is required. The approved D01/D02 decisions precede and govern the final schema/interaction contract.

## Open Product Decisions

**D01 and D02 are approved** and recorded centrally. D03 is resolved as explicit full-lane replacement/cancel; D04 stable browse-only resume; D05 browser-local preference. Exact fields, migration fixtures, control geometry and route-hook placement are engineering details for Phase 1B/11.

## Dependencies / Verification Implications

Schema/state foundations precede Dashboard rendering despite plan number 01. Later verification must cover old-save migration, independent role/queue/pin ordering, caps/duplicates/wrong role/unknown records, atomic failure, raw recovery/backups, derived-export recomputation, resume normalization/reset/import, keyboard Move Up/Down, focus and responsive lanes. Existing Dashboard browser assertions encode the old global queue/Current Focus and require intentional updates. This is a dependency record, not task-by-task implementation phases.

## Shared / Global Findings

These observations are reconciled by `06-shared-global-design.md`, not separate Dashboard-only shell solutions:

- **Desktop content width:** `main` has a 1750px maximum, while pages use multiple grids and card types. Review the usable width across the fixed sidebar and wide displays, and whether cards should span more of that working area.
- **Responsive breakpoints:** `.two-column` changes to one column at 760px while the fixed sidebar remains until then. Other pages may also become cramped in the intermediate width range.
- **Page-header hierarchy:** The current global page heading combines an eyebrow, large title, subtitle, and optional right-side content. Check consistency and available room across screens.
- **Card styling:** `.panel`, `.summary-panel`, and `.perk-summary` share a base surface but differ in padding and treatment. Repeated bordered boxes can flatten hierarchy.
- **Spacing scale:** Review current 20–24px panel padding, 20px grid gaps, section spacing, and mobile reductions as a system across screens.
- **Typography hierarchy:** The global 34px H1, 16px H2, 14px H3, small eyebrow labels, and 10–12px supporting copy should be checked for consistent emphasis and readability.
- **Action-button hierarchy:** Shared button sizing and primary/secondary emphasis need review, including 44px touch targets for frequent actions such as reordering.
- **Responsive shell:** The fixed sidebar, top bar, and action wrapping affect available page width on multiple screens; apply the global compact-shell contract in plan 06.

## Explicit Non-Goals

- No implementation in this phase.
- No application redesign implementation in this pass; Core planning covers the shell and six principal role/Dashboard surfaces.
- No speculative redesign of unreviewed screens.
- No changes to research datasets.
- No schema implementation now; required queue/pin migration and validation are documented above.
- Queue management stays a subordinate Core surface; detailed control geometry is deferred without deferring the required functionality.
- No final implementation roadmap in this consolidation task; the completed Core planning set is now ready for that next step.
