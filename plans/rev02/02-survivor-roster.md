# Rev02 Survivor Roster Design

## Status

**Design-direction plan · Planning only · Not implemented · 2026-10-21.** The user's six-character pagination, responsive grid direction, stronger artwork/progression hierarchy and broad card navigation are settled direction. The detailed treatments below are recommendations for review, not blanket approval of this document or of implementation. Genuine remaining decisions are listed under Open Questions.

Read with the [global strategy](00-ui-ux-redesign-strategy.md), [audit matrix](00a-ux-audit-matrix.md), [open design questions](00b-open-design-questions.md), and approved [Dashboard plan](01-dashboard.md). The global Archive browsing / Terminal editing concept remains a recommendation awaiting review; this plan uses the explicit principles of artwork, legibility and task-appropriate density without approving a visual system. The Dashboard direction is unchanged.

## Screen Purpose

**Find a Survivor, understand that Survivor's progression state at a glance, and open their workspace.**

This is a browsing, comparison and navigation screen. Detailed ownership/progression editing, personal perk inventory, stock and reference information belong in the character workspace. Desktop is primary; mobile must remain usable without dictating desktop information density.

## Primary User Jobs

1. Recognize a Survivor by portrait and name.
2. Scan and compare Prestige and current Bloodweb level.
3. Understand a small amount of useful native-perk context.
4. Find a particular Survivor through search, existing filters and sort.
5. Open the character's Overview, or independently change Favorite.

Success means six legible, recognizable records with predictable navigation. It does not mean fitting the whole catalog or every stored field into one view.

## Current Screen Assessment

### What Works

- Existing Lore artwork and canonical names establish recognition; no replacement art is needed.
- Prestige and Bloodweb are already adjacent, with numeric values as well as a small track.
- Search, ownership, Prestige, Favorites and useful sorts already exist. Filtering and sorting occur before pagination.
- Real workspace links support canonical routes. Favorite already has a character-specific accessible name, pressed state and a 44px target.
- The existing model supplies the required progression and native-perk facts. This screen needs no invented completion score.

### Current Friction

- The default is **All**, with optional 5/10/All page sizes. The 54-Survivor catalog therefore becomes a long wall of tall cards. At the recorded 1440px desktop viewport the grid shows four narrow columns; the final CSS permits still more as width grows.
- Cards combine identity, an ownership toggle, progression, three perk-dialog buttons, effective perk totals, Tier III totals, item/Add-on type counts and a workspace footer. These compete with the card's discovery/navigation job.
- The portrait region is 190px tall, but content begins over it at 112px. Art fades behind the name, reducing its useful recognition area; locked characters' art is further muted.
- Native-perk headings are 8px and row text 11px in source. The recorded phone view places even the first card's footer below the opening viewport.
- “NATIVE PERKS / OWNED” describes effective tiers, not necessarily explicit records. Native Tier I appears even for an unowned Survivor under current rules; the label invites the wrong interpretation.
- “Click a name or prestige badge to edit” is inaccurate: both open Overview. Blank card space and artwork are not navigation targets today.
- Page controls, when enabled, appear **before** the grid. Counts, ownership scopes and multiple toolbar controls occupy separate bands. The large header numerator is visually detached from its owned/total meaning.

Evidence reused for this review: [desktop roster](evidence/survivor-roster-1440.png) and [phone roster](evidence/survivor-roster-390.png), inspected alongside current source. These are earlier published-app audit captures, not redesigned mockups. No new live mutation, accessibility certification or populated-account test is claimed.

## Approved Direction

- Six Survivors per page; no All default.
- Desktop and suitable laptops: three columns, two rows. Tablet: two columns, three rows where readable card width is available. Phone: one column, six rows.
- Keep the six-item page size when the number of columns changes.
- Larger cards and portraits support recognition and readability, not additional fields.
- Identity leads; Prestige is unmistakable; Bloodweb belongs beside it; native-perk information is compact.
- Search is prominent, with organized Filters and Sort controls.
- Most card space opens the workspace; Favorite remains separately operable.
- Primary pagination follows the roster immediately.

Recommendations beyond these explicit decisions remain identified as such below. No screen implementation is authorized.

## Information Hierarchy

Page order:

1. Survivor heading with contextual catalog/ownership count.
2. Search, Filters, Sort; compact visible active restrictions.
3. Matching-results context and six-card roster.
4. Pagination and displayed range.

Card order:

1. Portrait and readable character name.
2. Prestige and Bloodweb as one progression group.
3. Compact native-perk block with an explicit scope label.
4. Visible “View character” navigation cue.
5. Secondary Favorite; ownership status stays legible near identity without becoming a competing action.

The same facts appear in the same order on every card. No nested panels or separate statistic tiles inside a card.

## Survivor Card Design

### Character Artwork

**Recommend a dedicated artwork region above the text**, rather than extending text over faded artwork. At typical desktop card widths of roughly 340–425px, explore an approximately 200–230px artwork region with the actual supplied assets. This is a starting proportion for later visual review, not an approved height token. Name/progression/perks must retain useful space; enlarging an empty image box is not the objective.

Use the existing role-correct Lore mapping. Favor contain positioning as today, adjusting the displayed scale/position within the region only when actual artwork requires it. Check recognizable faces and paired artwork such as Aestri Yazar & Baermar Uraz; do not apply an automatic cover crop that loses one figure. Names belong on a stable text surface below the art, with no new gradient, glow or ornamental frame required.

Reserve image space to avoid layout jumps. If mapping or loading fails, retain the name and normal navigation, with a restrained “Portrait unavailable” fallback. Never substitute another character's art or guess an asset path. Decorative images can retain empty alt text when the adjacent heading supplies identity; a fallback should not create repetitive screen-reader announcements.

### Character Identity

Use the canonical display name as the card heading, immediately below the portrait. Recommend approximately 18–20px at default desktop sizing, subject to shared typography review; supporting copy should remain around 13–14px rather than reproduce microtext. Let long names wrap naturally, including the paired Survivor name. Do not use ellipsis as the only access to the full name or reserve a giant blank name area across all cards.

Use consistent alignment within each row, allowing content to grow with text scaling. Favorite can sit beside the name if it leaves adequate text width. Do not place its target across a face or require hover to reveal it.

### Ownership

Keep quiet **Owned** / **Not owned** text near identity. Not owned should have an additional simple non-color distinction if useful, while remaining fully readable. The workspace remains available for unowned Survivors; the roster is a record, not a purchase gate.

On an all-owned account, the Owned label can stay understated without a full-width switch or badge. Do not mute the entire unowned card or hide progression that is legitimately in the save. Ownership and global perk access are separate facts; access may exist while the character is unowned.

**Recommend moving the direct ownership toggle into the existing character-management workflow.** This removes an accidental mutation target from broad card navigation. This is a proposed interaction change requiring review, not a current behavior or an already approved workspace redesign.

### Prestige

Keep P0, P1, P3, P100 and other valid stored values prominent and textual. Prestige should be second only to identity, with stronger weight/scale than Bloodweb and perks. A provisional 24–28px numerical anchor can be explored; it need not dwarf the name or occupy its own large tile.

Ensure a screen reader receives “Prestige 100,” not an unexplained standalone “P100.” Allow values to grow without truncation: model validation currently accepts non-negative integers, so the display must not impose an invented P100 cap. Do not make the badge a second focus stop to the same destination or imply that it directly edits progression.

### Bloodweb

Group **P1 · Bloodweb 37 / 50** on one progression line where possible, wrapping the Bloodweb group intact below Prestige at narrow widths. `bloodwebLevel` is an integer from 1 to 50. It is a recorded level within the present Prestige, not percentage completion to P100, an XP estimate, a spend estimate or automatic goal progress.

Recommend retaining a thin, subordinate level track only if it helps scanning after numbers become readable. It may mirror the current level/50 ratio, but label it as Bloodweb level; do not call that ratio linear progression effort. Adjacent text is the authoritative value. If redundant, hide the track from assistive technology as today; otherwise give it an appropriate name/value/range without duplicating announcements.

### Perk Summary

Minimum useful context is **the three native perk names and one clearly scoped state per perk**. No descriptions, personal inventory totals or extra columns are needed. Recommend three aligned text rows, readable names with wrapping, and short state text. Omit icons initially: the portrait already supplies recognition and tiny additional images would consume space without replacing names.

**Recommended scope for review: account-wide access to these native perks.** Use a group label such as “Native perks · Account access,” with each row showing “Not unlocked” or “Tier I / II / III” from `globalTier(save, perk)`. This helps assess account value when choosing a progression target. It includes the existing Prestige and per-perk overrides; it must not be calculated from character Prestige alone. Mixed access across a trio is possible, so do not compress all three into one tier badge unless all underlying states agree.

Scope explanation must remain available without hover: these are account unlock tiers, not manually recorded tiers on this Survivor. A short shared explanation near the roster controls can carry this rather than repeat a paragraph on every card. Do not label the rows “Owned.” A zero global tier does not mean the perk is absent on its source character: the model supplies native Tier I automatically. Historical naming/alias rules also remain unchanged; detailed provenance belongs in the workspace/perk library.

Alternative: retain effective personal tiers with an explicit “On this Survivor · Effective tier” label. That preserves today's fact but is less useful for evaluating account unlock value and still requires explaining automatic native Tier I on unowned characters. A names-only trio is simpler but omits useful account state. Recommend account access; **the scope choice is not approved yet** and connects to global question W05.

Recommend making these rows informational, moving perk-dialog access to the workspace. That gives the card one primary destination and avoids three additional controls competing with it. Do not remove the existing perk-reference capability from the application.

### Favorites

Retain an independent toggle with its existing roughly 44×44px hit target. The visible star may be smaller than its target; keep it less prominent than progression and the workspace action. Filled/outline state and `aria-pressed` supplement color. Use a consistent accessible name including the character, and provide a text tooltip on pointer hover and keyboard focus without making the tooltip the only label.

Activation toggles Favorite only. Preserve save failure/read-only feedback and writer protection; do not show a successful toggle when persistence fails. Restore focus to the same control after rerender. If Favorites filtering or Recently updated sorting removes/repositions that card, move focus predictably to the next remaining result or the results heading, and announce the change briefly. Favorite is independent of ownership, queues and Dashboard pins; do not infer any priority intent.

### Workspace Navigation

Recommend **one real anchor per card**, named by the character and “View character,” targeting the existing `#character/<id>/overview` route. Extend its pointer target across the portrait and non-control card area. Favorite remains a sibling button above that target, never nested inside the anchor. The visible “View character →” cue belongs to the same link rather than a duplicate tab stop.

Avoid a clickable article with a click handler, a button wrapping links, or multiple nested links. Real anchors preserve Enter activation, browser link menus and new-tab behavior. Space operates the Favorite button according to native button behavior; it should not be reassigned to activate an anchor. A click/tap anywhere on Favorite must not navigate, including its surrounding hit area.

Logical tab sequence within each card: workspace link, then Favorite. The link's focus indication should identify the whole navigation surface; Favorite needs its own distinct focus. Hover can reinforce the card boundary and action cue, but essential content and actions remain visible on touch and keyboard. Keep text readable/selectable where practical; exact target geometry needs later browser review for text selection and sibling hit testing.

No direct Edit label, inline progression fields or new section shortcuts are proposed. The roster opens Overview; selecting a workspace section remains the workspace's responsibility. Browser Back should return to the invoking roster context described under Pagination.

## Card Information Audit

| Current Information | Keep / Simplify / Move / Remove | Reason |
| --- | --- | --- |
| Lore portrait | KEEP; increase useful recognition area | Actual artwork supplies identity and richness. Separate it from overlaid text. |
| Character name link | KEEP; strengthen heading and broaden link target | Primary discovery/navigation fact; use one logical link. |
| Favorite star | KEEP; secondary independent button | Useful collection shortcut with existing filter support. |
| Owned/Locked full-width toggle | SIMPLIFY status; MOVE mutation to workspace (recommendation) | Ownership remains clear without a competing immediate edit. |
| Pn badge/link | KEEP value; SIMPLIFY duplicate link | Strong progression anchor; same card destination does not need another tab stop. |
| Bloodweb level /50 | KEEP; group with Prestige | Reliable stored progression fact. |
| Thin Bloodweb track | SIMPLIFY; optional subordinate reinforcement | Numbers communicate exact level; track must not imply effort percentage. |
| Three native-perk names | KEEP in a compact block | Smallest meaningful identity/account-value context. |
| Native effective inventory tiers headed OWNED | SIMPLIFY; recommend account-access scope, pending review | Current automatic tiers are easy to mistake for recorded ownership. Preserve model truth. |
| Native-perk dialog buttons | MOVE reference interaction to workspace | Reduce conflicting click destinations and tab stops. |
| Effective owned perks / role perk total | MOVE to workspace | Personal inventory completeness is secondary to recognition/progression. Counts include automatic tiers. |
| Tier III personal perk total | MOVE to workspace | Detailed inventory state duplicates the workspace job. |
| Items count | MOVE to Items & Add-ons/workspace summary | Counts distinct verified types with positive stock, not total copies. Not necessary for roster selection. |
| Add-ons count | MOVE to Items & Add-ons/workspace summary | Same type-count distinction; avoid an unlabelled miniature inventory dashboard. |
| Open workspace footer | KEEP discoverable cue; SIMPLIFY into the primary link | “View character” accurately promises Overview and avoids button-like competing hierarchy. |

Moving means removing the fact/action from this roster presentation while retaining existing access in the character workflow. It does not authorize deletion of selectors, data, dialogs or shared Killer functionality.

## Search / Filter / Sort

Recommend one organized control region: **[Search Survivors…] [Filters] [Sort: Name]**. Search takes the flexible width; Filters and a clearly labeled native sort select remain nearby. Remove the Show 5/10/All control from the proposed roster: a fixed six-item page fulfills the approved browsing direction, and no separate roster use requiring All has been demonstrated.

- Search operates over the full Survivor catalog, before slicing pages, with the current case-insensitive name matching. Do not imply that native perk names or descriptions are searched; they currently are not. Search remains visible with a clear action and a proper accessible label independent of placeholder text.
- Filters exposes the existing ownership choice (All / Owned / Not owned), Prestige (Any / P0 / P1 / P2 / P3+) and Favorites-only toggle. These dimensions combine with AND; ownership and Prestige each allow one choice. Do not add DLC, rarity, stock, queue or recommendation facets.
- Recommend one disclosure anchored beside search, expanding into an inline region below the control row. The same form can fit mobile without a new dialog/drawer system. It avoids overlay focus complexity for three small filter groups. Changes apply immediately; no separate Apply step or draft filter state is needed. Escape/collapse returns focus appropriately to the trigger without clearing choices.
- Retain supported sorts: Name, Prestige descending/ascending, Bloodweb descending, effective perks owned descending, Recently updated. Default Name; retain name as the tie-breaker. Clarify the perk sort label as “Effective perks owned ↓” while keeping its present calculation. Removing a card statistic does not require removing a useful discovery sort.
- Recently updated reflects saved edits, including Favorite/ownership changes through `commit`; it is not recently visited or played. Do not repurpose timestamps silently.
- Preserve input focus/caret during search rerenders. Sorting and filtering are immediate, with no staggered entrances or layout animation.

## Active Filter State

Below the controls, show only active restrictions, for example **Owned × · P0 × · Favorites ×**, plus **Reset filters**. Plain compact labels with removal controls are sufficient; no decorative pill system is required. Filters can show its active count, but closed controls must not hide why results are limited.

Removing a restriction resets that dimension only. Reset filters clears ownership/Prestige/Favorites, retaining the visible search and chosen sort. Search has its own Clear search action. In the zero-result state offer **Clear search and filters**, explicitly clearing both while retaining sort. This distinction prevents a reset from unexpectedly erasing a deliberate query. All these actions return to page one.

Keep current search visible and sort value readable even when no restriction labels appear. Result text distinguishes filtered matches from the catalog total. Do not expose irrelevant default-state badges or a redundant All label for every dimension.

## Pagination

- Page size is six results **after** filtering/sorting, at every breakpoint. With 54 current Survivors, an unrestricted view has nine pages. Counts come from the catalog; do not hardcode 54 or nine. The final page can contain fewer than six.
- Primary pagination sits immediately after the cards, with a compact range such as “Showing 7–12 of 54” and “Page 2 of 9.” For restrictions, use context such as “Showing 1–6 of 14 matches · 54 Survivors total.” Do not put another large pager above the roster.
- Desktop can show Previous, numbered pages with a bounded range/ellipsis, and Next. Mark the current page programmatically. At narrow widths, Previous / Page 2 of 9 / Next is enough; do not squeeze nine touch targets across a phone. No infinite scroll or automatic loading replaces explicit pages.
- Search, any filter, restriction removal/reset and sort changes start on page one. Resizing changes columns only, preserving page and order.
- Saved/external updates can shrink a result set: clamp to the last valid page and update the range. Zero matches shows “No Survivors match,” zero results and recovery actions; hide page navigation rather than show “1–0” or imply an empty page is the whole catalog. One page needs result context but no unnecessary enabled page buttons.
- Explicit page activation should reveal/focus the results heading at the start of the new six-card set and announce its page/range. Avoid leaving keyboard or touch users at the bottom after the grid above them changes. Search/filter updates keep focus on the initiating control; they must not repeatedly scroll or steal focus while typing.
- Recommend retaining search, filters, sort, page and invoking-card identity for **same-session workspace return / browser Back**. Restore focus to the invoking link and a useful scroll position when it still exists; otherwise use the results heading with a valid clamped page. A new session without remembered roster context starts at page one with Name sort and six items. Browser refresh/cross-device persistence is not required by this proposal.
- Keep Survivor context independent of Killer context. Browser-history and roster-return behavior are a navigation-state dependency; neither a new save field nor inventory-schema change is assumed here. Do not require every keystroke/page activation to create a history entry.

## Page Header / Survivor Count

Recommend **Survivors** with a contextual secondary line, for example **54 characters · 38 owned**. This expresses catalog size and account ownership together without a disconnected large numeral. Use real counts, including zero, and do not add a percentage, chart or progression panel.

Account ownership count is over the full Survivor catalog; matching-result counts belong near the roster and reflect current restrictions. Keep those scopes distinct. Final heading/type/count geometry belongs to shared page-header review, rather than locking a Survivor-only header style. Remove the inaccurate editing helper; a short navigation instruction is optional because the card cue and link affordance should explain the action.

## Desktop Layout

Use three columns maximum, even on ultrawide displays. Six peer cards naturally form two rows; this symmetry serves comparison. Use the existing canvas effectively, with controls and pager aligned to the roster. An initial roster-width exploration around **1200–1320px** bounds card growth to useful recognition/reading width; it is a task-specific proposal, not a change to the global `main` cap.

Start from a **minimum useful card width around 320px** and approximately 20px gaps, then review actual long names/perks and text enlargement. Three columns require about **1000px of inner roster width** (3 × 320 + 2 × 20); two require about **660px**. Below that use one. These are content-fit recommendations, not final CSS breakpoints.

| Example viewport with current shell | Approximate available inner width | Proposed grid implication |
| --- | --- | --- |
| 1366px: 220 sidebar + 72 main padding | 1074px | Three cards about 345px each; two rows. |
| 1440px: same shell | 1148px | Three cards about 369px each; two rows. |
| 1280px: same shell | 988px | Two columns until sufficient width is available; do not squeeze three unreadable cards. |
| 1920px: 220 sidebar + 88 padding | 1612px before task-width bounding | Keep three columns; explore the 1200–1320px roster bound rather than adding a fourth/fifth column. |

Calculations omit scrollbar/border variation. Under today's shell, roughly 1292px viewport width supplies the proposed three-column threshold. The usable-width rule should govern if global shell dimensions change. These numbers need later rendered confirmation, not production edits now.

Do not force both rows into every laptop's first viewport: header, controls, legible art and long names may require vertical scrolling. Prefer concise content and sensible image proportions over viewport-height tricks, tiny labels or fixed-height clipping.

## Tablet Layout

Target two columns and three rows while preserving six items. At 768px the **current** sidebar is 185px and main padding totals 56px, leaving only about 527px: two 320px cards will not fit. At 1100px the same shell leaves about 859px, which does fit two.

Therefore the preferred two-column portrait-tablet layout depends on the shared shell releasing sidebar width earlier than today's 760px threshold. With a compact shell and about 40px total gutters, a 768px viewport leaves approximately 728px, enough for two 354px cards. Recommend carrying that requirement into global shell review for the roughly 700–900px range. Do not introduce an isolated Survivor-only navigation shell. Until that shared decision is approved, use the content-fit rule rather than shrink text to promise two columns.

Filters can expand below the search row and sort can wrap in the same region. They should remain reachable without several permanently expanded control bands.

## Mobile Layout

- One column, six cards, same ordering and page number. No horizontal card carousel or mobile-specific page size.
- Search fills a dedicated row; Filters and the labeled sort select share the next row where they fit. Active restrictions wrap below. The expanded filter form uses full available width; choices and reset stay reachable.
- Preserve the portrait/name/progression/perk hierarchy. Start image-height exploration around 160–190px on phones to reduce six-card scrolling cost while retaining recognition. The final art scale must be compared with the desktop proposal using real images; do not repeat the current tall overlay card unchanged.
- Name and perk rows wrap; P100 and Bloodweb 50 / 50 must fit or wrap as groups. Keep favorite comfortably reachable and separate from card navigation.
- Bottom pagination remains directly after the last card, with large enough Previous/Next targets and a readable page/range. Explicit page changes bring the next set's start into view as described above.
- No sticky roster toolbar is justified yet: it would consume limited viewport height alongside the existing sticky global navigation. Review normal document flow first. The recorded obscured heading after route focus is a shared navigation/focus issue, not permission to add another fixed layer.

## Accessibility

- Represent the roster as a meaningful collection with character headings/articles, one real workspace link and an independent Favorite button per card. Avoid nesting interactive elements and duplicated identical link stops.
- Preserve native keyboard behavior, logical row-major DOM/focus order, visible focus, link context and new-tab support. Do not reorder cards visually without matching DOM order.
- Preserve the current 44px Favorite target; aim for similarly practical touch targets for filters, pagination and restriction removal. Existing 34px ownership and roughly 34–36px perk controls are usability concerns, not proof that every sub-44px desktop control violates WCAG.
- Use explicit text for ownership, Prestige, Bloodweb and perk state. Color, stars, portrait saturation and bars must not carry the meaning alone. Screen-reader labels explain abbreviated Prestige/tier values.
- Replace roster microtext with readable supporting text; allow text resizing and natural height growth. Confirm contrast for normal text (4.5:1), large text (3:1), and essential control/focus/state cues (3:1), against actual surfaces. No new palette or conformance claim is made here.
- Search has an actual label, a scoped clear action and accessible result feedback. Filter disclosure exposes expanded state and control association; choices have labels/group names. Keep filter focus stable on rerender. Avoid a live announcement for every field and card; use one concise results/page status.
- Pagination has a descriptive navigation label, named Previous/Next targets and current-page state; disabled ends cannot activate. Ellipses are not dead interactive elements. Focus/scroll behavior must work after results replace the page.
- Favorite retains pressed state and character-specific naming, including read-only and failed-save handling. Removal from a filtered set must not strand focus on the document body.
- Later review must cover keyboard-only traversal, screen-reader scope/announcements, 200% text enlargement, 400% reflow where applicable, 320px width, long names, image failure and sticky-shell focus obstruction. Existing screenshots/source are not a full accessibility test.

## Shared Survivor/Killer Opportunities

| Likely reusable contract | Boundary / later role review |
| --- | --- |
| Header/count scopes, search/filter/sort grouping, active restrictions | Confirm labels and priorities when reviewing Killers; do not approve their screen now. |
| Page slicing/reset/clamping, result ranges and return context | Keep state independent by role; any shared renderer must not force a new Survivor decision onto Killers prematurely. |
| Card navigation semantics, Favorite behavior and focus recovery | Same familiar operation can serve both roles without identical visual composition. |
| Portrait mapping/fallback, readable names, Prestige/Bloodweb grouping | Actual art crops, character naming and role-specific identity need separate review. |
| Content-fit grids and task-width policy | Shared responsive shell is a prerequisite; final Killer density/page size remains its screen decision. |
| Perk-state terminology and access versus effective records | The meaning can be consistent; what leads each role card still needs review. |

Survivor stock spans item families and compatible Add-ons; Killer identity can involve a unique Power and its Add-ons. Do not invent a Survivor Power equivalent or add stock panels for symmetry. This plan specifies Survivor card content only.

## Existing-Code Observations

Source inspected at the current repository baseline; paths identify responsibilities, not requested edits. The app uses vanilla JavaScript HTML-string rendering and event delegation, not a component framework.

| File / responsibility | Current facts and design dependency |
| --- | --- |
| `src/app.js`: `route`, `render`, `collection(role)` | `#survivors` renders `collection('survivor')`; `#killers` uses the same function. Header, search, selectors, scopes, result count, pager and grid are composed here. |
| `src/app.js`: `characterCollectionCard`, `collectionArtwork` | One shared card renderer for both roles. Name, Prestige and footer link to canonical Overview. Native-perk rows open a dialog; ownership and Favorite immediately commit. Survivor versus Killer stock content is conditional. |
| `src/app.js`: filter and paging state/events | `filters` includes search/status/prestige/favorite/sort. `collectionPageSize` defaults to `all`; zero-based `collectionPage` and `collectionPageRole` are separate runtime globals. Changing role resets page; changing query/status/Prestige/Favorite/sort or page size resets page. Render clamps the upper page limit. Only Prev/Next exists; it appears above cards when not All. |
| `src/perk-filters.js`: `getFilterContext`, `normalizeFilterState`, `createFilterRouteMemory` | Collection state is normalized and remembered by route in an in-memory Map. Search/filter/sort can return during the session, but page is not part of that snapshot or the URL/save. Page size is one shared runtime value across roles. This is a useful foundation, not complete per-role page/history restoration. |
| `src/app.js`: `characterMatches` and collection sort | Name substring search is case-insensitive; no roster perk-name search. Ownership/Prestige/Favorite combine with it. Sort uses name tie-breaks and applies before page slicing. Existing ownership scope counts consider other restrictions. |
| `src/app.js`: `commit`, `preserveRender`, navigation handlers | Favorite/ownership saves use writer guard and update both save and character `updatedAt`; Recently updated can reorder on Favorite. `preserveRender` restores an element by DOM ID, while Favorite currently has no unique ID. Page events explicitly refocus their buttons. General workspace navigation renders, scrolls to top and focuses main; origin-card scroll/focus restoration is not implemented by those helpers. |
| `src/model.js` | Schema v2 stores owned/favorite/prestige/bloodwebLevel, personal tiers, stock and timestamps. `inventoryTier` takes the maximum of recorded and automatic tiers; `automaticTier` includes native Tier I, even on an unowned source. `globalTier` uses source Prestige plus Shrine/Legacy/manual overrides. `characterStats` counts effective inventory, not explicit records. Preserve all calculations and validation. |
| `src/survivor-collection.js` | Despite its filename, supplies both Survivor stock counts and Killer Add-on counts. Counts known positive **types**, not copies; unknown IDs are excluded from these summaries. Removing a visible summary does not require deleting saved stock or selectors. |
| `src/character-workspace.js` | Supplies canonical hrefs/parser and same-role neighbors. Overview is the roster entry. Neighbors follow the full role catalog rather than the invoking filtered set. Filtered neighbor traversal remains question W03 for workspace review; roster return context need not change neighbor behavior. |
| `src/assets.js`, `data/asset-manifest.json`, `data/catalog.js` | Explicit Lore image mappings, stable character/native-perk IDs and display-name relationships already exist. `collectionPortraitPath` returns null for missing mappings; the present helper then omits the image. No generated replacement assets or research changes are needed. |
| `styles.css` | Shared base card/grid/heading rules plus late collection overrides near line 2462. Final grid uses auto-fill with a 250px minimum and 16px gaps. Hero 190px/contain; card content begins at 112px; name 16px; native heading 8px/row 11px; Favorite 44px; ownership minimum 34px; footer minimum 48px. Final phone card adjustments occur at 430px. |
| `styles.css`, `index.html` shell | Main maximum 1750px, padding 36px (44px at 1600+); sidebar 220px, 185px at 1100 and below; sidebar becomes horizontal navigation at 760px and below, main horizontal padding 20px there. Shared layout constrains the proposed 3/2/1 grid. Global focus and navigation layers affect this screen too. |
| `tests/collection-cards.test.js`, `tests/browser/collection-cards.mjs`, `package.json` | Read existing assertions, not executed. They encode Lore mappings, distinct stock types, old default All and 5/10 paging, native tiers, summary content, independent controls and card geometry. Later verification must distinguish intentional roster presentation changes from model/asset protections; both role renderers are affected by shared changes. Existing esbuild/vanilla stack is sufficient. |

### Dependencies for Later Design / Roadmap Review

- Review ownership-toggle removal and native-perk scope before treating this detailed card proposal as approved.
- Consolidate shared shell widths, page headers, typography, controls/focus and the tablet-width requirement after major screen reviews. Exact dimensions here remain exploration targets.
- Define same-session per-role page/return state and origin focus consistently with current browser navigation and dirty-workspace protections; no persistence/schema mechanism is prescribed now.
- Review the Survivor workspace as the destination for displaced inventory detail and ownership management. Existing functionality supplies access; this document does not redesign that destination or approve a new quick editor.
- Preserve writer locking, read-only presentation, save-failure feedback, canonical IDs, alias naming, imports/exports and unknown saved data. Browser navigation/filter changes must not mutate progression.
- Later implementation planning must account for shared Killer rendering/styles and existing browser expectations, including focus after Favorite removal, six-item pages, responsive fit and broken artwork. No tests or builds were run for this planning task.

## Skill-Assisted Findings

Superpowers brainstorming is the primary process: ground decisions in the existing flow, compare the meaningful alternatives, record settled direction separately from proposals, and stop at the written design review. The user's requested `plans/rev02` location and deferred implementation roadmap take precedence over the skill's default spec location/implementation handoff. No implementation-oriented skill or additional roadmap was invoked.

Relevant installed references were inspected during the preceding Rev02 audit and carried forward here; this is not a new full multi-agent critique or detector run. Only useful guidance is applied:

| Reference | Useful finding / application |
| --- | --- |
| Impeccable / Operate | Preserve familiar links, native controls, data truth and stable focus. Broad card navigation must not sacrifice independent control semantics. |
| Taste app-screen guidance | Peer cards and aligned three-column geometry are appropriate here. Portraits and DBD progression carry identity; avoid nested statistic boxes. A blanket ban on repeated cards would conflict with the approved roster direction. |
| UI UX Pro Max focused UX guidance | Keyboard operability, labels and usable targets support the actual task. The previous generic marketing design-system recipe remains rejected; no new palette/font/library is selected from it. |
| Emil design-engineering | Frequent searching, paging and Favorite changes should remain immediate; no delayed/staggered card entrances. The larger portrait is for recognition, not an animation opportunity. |
| Diagram Design | No separate artifact warranted: the 3×2 / 2×3 / 1×6 grid and content-width arithmetic are clear in Markdown. |

## Open Questions

1. **Native-perk meaning (W05):** approve account-wide native-perk access as recommended, or keep explicitly labeled effective personal tiers? Names plus one scoped state per perk is the proposed minimum; do not silently switch the meaning of OWNED.
2. **Ownership interaction:** approve replacing the roster switch with status and managing ownership in the existing workspace? Keeping a direct toggle preserves a shortcut but adds another mutation target that must be isolated from card navigation.
3. **Global layout dependency (G04/G07):** which shared shell treatment releases enough width for two readable portrait-tablet columns? The content-width thresholds and earlier compact-shell requirement are recommended; final viewport cutoffs await shared review.

Exact typography, artwork proportions and surface tokens need later visual review against long names, real art, populated accounts and zoom. These are validation details, not additional feature decisions. Same-session context restoration is recommended; persistence across refresh/export is not required here. W03 filtered workspace traversal stays deferred to that workspace review.

## Shared / Global Findings

- **Task width versus global width:** a 1750px main cap does not prevent too many auto-fill columns. Bound roster columns and useful card growth by task; do not widen every screen to solve internal hierarchy.
- **Tablet shell:** a sidebar retained until 760px competes with readable peer columns at 768–900px. Review shell behavior once for all screens, alongside the recorded sticky-navigation focus obstruction.
- **Header/count grammar:** keep account totals together with their meaning, separate from filtered-result counts. Survivor, Killer and account libraries can share that scope clarity without identical statistics.
- **Card links and independent actions:** a common semantic/focus contract can support roster and other navigation cards. Avoid duplicate tab stops, hidden actions and nested controls.
- **Typography:** current 8–11px supporting text is a readability concern. Increase useful hierarchy and remove lower-priority content before shrinking labels.
- **Data vocabulary:** character ownership, account perk access, effective personal tiers and explicit records are distinct. This roster proposes account access; other screens may legitimately need another fact, always with explicit scope.
- **Filter/result contracts:** visible restrictions, precise resets, no-results recovery, clamping and origin restoration should use consistent language and interaction across collections.
- **Artwork/fallbacks:** preserve recognition without text on unstable image backgrounds, guessed assets or unreadable unowned states. No ornamental gradient system is required.
- **Favorite timestamps/focus:** immediate saving and rerender can alter Recently updated order or remove a filtered card. Focus recovery and truthful feedback are shared interaction concerns.

These feed the later `11-shared-global-design.md`; no global design document or final roadmap is created now.

## Explicit Non-Goals

- No implementation or application behavior changes.
- No production source or CSS changes.
- No complete Survivor workspace redesign or new inline editor.
- No Killer roster redesign yet; no automatic application of these choices to Killers.
- No Dashboard analytics, recommendations, new queue/pin controls or activity panels added here.
- No speculative redesign of unreviewed screens.
- No changes to research datasets, perk rules, inventory schemas or saved-data meaning.
- No framework migration, component-library migration or new dependencies.
- No drag interactions, infinite scroll, new persistent density preferences or All browsing mode.
- No final global tokens, visual-system approval or final implementation roadmap.
