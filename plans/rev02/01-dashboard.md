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

The current application has a persisted Prestige Queue, but it is one globally ordered list of character IDs and target Prestige values. It does not currently have a role-specific queue, an Up Next pin, or an independent Up Next rank. The current Dashboard's “My Prestige Queue” panel previews and manages this longer list, and derives one Current Focus from the first available, unfinished goal. Rev02 should surface only pinned entries in Up Next; it should not repeat the entire queue or add a separate Current Focus block that duplicates the curated list. A later queue-management design must define how the longer list is accessed and edited.

#### Relationship to Playing Queue

The Playing Queue answers **“Who do I actually want to play soon?”** It is separate from Prestige intent because a progression goal and a play-interest priority can differ. It is also role-separated: Playing Survivors and Playing Killers have their own lists.

The current application has no Playing Queue or persisted Playing intent. Up Next must not infer this intent from Favorites, recent edits, or Prestige recommendations. The complete Playing Queue management UI is deferred to future queue-design work.

### 3. Continue Where You Left Off

Keep this section compact and actionable. Its primary action is to return to the character and stable workspace section the user most recently worked in. The card should identify the character, role, workspace section, and recency, and provide a clear **Continue** action. It is not a large activity log.

The current “Continue where you left off” area is a list of up to five recently edited characters, based on character `updatedAt` timestamps. Each link currently opens the character's Overview route. An edit timestamp is not evidence of a visit or the last workspace section used, so this list cannot satisfy the Rev02 resume behavior by itself. Do not relabel a recent edit as a saved location.

The route system already expresses a character and section in the URL. `parseCharacterWorkspaceRoute()` and `characterWorkspaceHref()` in `src/character-workspace.js` handle canonical routes, and the character workspace navigation exposes Overview, Perks, and the role-specific Items & Add-ons or Power & Add-ons section. The URL, current route, and browser history can identify a location while navigating, but no persisted `lastLocation` or recent-route record exists in the save. `lastRoute` and workspace history bookkeeping in `src/app.js` are runtime navigation state, not a saved resume preference. The existing `updatedAt` is changed by saved edits in `commit()`, not by opening a workspace.

Supporting the intended Continue action therefore needs a later decision and persistence design for a last-used character plus workspace section. Role can be derived from the character catalog. The design must decide where that navigation state lives and how it behaves through refresh, import, restore, and a missing or invalid character. It should also decide whether only stable workspace tabs are resumable or whether temporary flows such as Edit, Setup, or perk Update are included. Until then, the current recent-edits list is only secondary edit context, not a valid last-location substitute.

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

Global shell actions such as save status, Export JSON, and Run character setups are in the shared top bar, not Dashboard content. This Dashboard plan does not change their placement.

## Desktop Layout Direction

- Use the available workspace width more effectively. The current shell gives `main` a 1750px maximum with 36px desktop padding (44px at wider breakpoints), but the Dashboard breaks content into several separate two-column and full-width regions. The result is a tall stack of similarly framed boxes, with some paired information cards narrower than the workspace needs to be.
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
- Dashboard behavior is covered by `tests/dashboard-selectors.test.js`, `tests/prestige-queue.test.js`, and `tests/browser/dashboard.mjs`. The browser regression currently asserts the old section order, one global Prestige Queue, Current Focus, and its management interactions. Later implementation and verification planning must revisit those expectations against the completed Rev02 decisions. No tests were run for this planning task.

## Dependencies / Future Design Work

- **Queue and pin model:** Define separate Prestige and Playing queues for Survivors and Killers, plus independent Up Next pin membership and ordering within each role. Current persistence supports only one globally ordered Prestige Queue with targets. A future architecture/roadmap review must determine the save-model, validation, import/export, backup, and migration implications.
- **Queue-management screen:** Design the full longer-term queue experience separately. The Dashboard plan only defines how a capped, editable shortlist is surfaced and how it relates to those queues.
- **Continue state:** Define how the last stable character workspace location is recorded, persisted, refreshed, imported/restored, and recovered if unavailable. Decide whether it is part of the portable progression save or local navigation preference, and whether temporary workflows are eligible resume targets.
- **Other screen destinations:** Decide where catalog details, setup, suggestions, favorites, and detailed Prestige analytics belong as the Data / Backups, Survivor roster, Killer roster, and perk screens are reviewed.
- **Verification:** Once all screen plans and the implementation roadmap are reviewed, specify model/selector coverage for independent queue and pin order, route-resume behavior, keyboard reordering, and responsive Dashboard layouts. Existing Dashboard browser assertions will need to be reconciled with the approved hierarchy.

### Open decisions exposed by this plan

1. Can the same character be in both Prestige and Playing queues? If so, should Up Next show one row with both intents or separate rows, and how does that interact with the five-character cap?
2. Is Up Next pinning limited to characters already present in one of the two queues, or can a user pin a character directly without queue membership?
3. When a role's five Up Next slots are full, what explicit edit/swap flow should be offered?
4. Should Continue remember only stable tabs (Overview, Perks, Items & Add-ons, or Power & Add-ons), or also temporary Edit, Setup, and Update workflows?
5. Should last-location state travel with the user's exported save, or remain a browser-local navigation preference?

## Shared / Global Findings

These are observations for the future `11-shared-global-design.md` review, not Dashboard-only solutions:

- **Desktop content width:** `main` has a 1750px maximum, while pages use multiple grids and card types. Review the usable width across the fixed sidebar and wide displays, and whether cards should span more of that working area.
- **Responsive breakpoints:** `.two-column` changes to one column at 760px while the fixed sidebar remains until then. Other pages may also become cramped in the intermediate width range.
- **Page-header hierarchy:** The current global page heading combines an eyebrow, large title, subtitle, and optional right-side content. Check consistency and available room across screens.
- **Card styling:** `.panel`, `.summary-panel`, and `.perk-summary` share a base surface but differ in padding and treatment. Repeated bordered boxes can flatten hierarchy.
- **Spacing scale:** Review current 20–24px panel padding, 20px grid gaps, section spacing, and mobile reductions as a system across screens.
- **Typography hierarchy:** The global 34px H1, 16px H2, 14px H3, small eyebrow labels, and 10–12px supporting copy should be checked for consistent emphasis and readability.
- **Action-button hierarchy:** Shared button sizing and primary/secondary emphasis need review, including 44px touch targets for frequent actions such as reordering.
- **Responsive shell:** The fixed sidebar, top bar, and action wrapping affect available page width on multiple screens; review them globally after screen reviews.

## Explicit Non-Goals

- No implementation in this phase.
- No full-site redesign yet.
- No speculative redesign of unreviewed screens.
- No changes to research datasets.
- No changes to inventory schemas unless a later approved design specifically requires them.
- No complete queue-management UI design in this Dashboard document.
- No final implementation roadmap until the major screen plans are complete.
