# Rev02 UI/UX Redesign Strategy

## Status

**Audit and consolidated design direction · Planning only · Not implemented.** Audited 2026-10-21; reconciled 2026-10-25 at repository `351ca1c`. Archive when browsing / Tool when editing, contextual editing, perk semantics, Lore fallback and shared compact shell are settled in the user brief. Exact visual tokens remain subject to rendered verification; no schema/UI implementation or roadmap is authorized.

The user confirmed the operating brief: **a balanced mix of desktop browsing and editing; desktop is primary.** Browsing and planning prioritize clarity and hierarchy. Inventory and data entry use greater density for rapid repetitive work. Mobile remains fully usable and deliberately responsive, without determining desktop density.

### Authority and product context

Authority follows: explicit user decisions → approved Rev02 plans → confirmed product truth and functional requirements → shared/global Rev02 principles (plan 06) → Impeccable → Taste Skill → UI UX Pro Max → specialist guidance → generic preferences. Diagram tools explain decisions; a component library does not choose them.

`01-dashboard.md` remains the approved Dashboard record. This strategy and its sibling audit/questions documents are proposals beneath that approval. The historical audit remains evidence, while plans 02–06 now cover Rev02 Core. Explicit brief decisions outrank older pending recommendations; recommendations are not blanket visual approval.

Impeccable's context loader found no PRODUCT.md, DESIGN.md, or surface brief. Its product-truth separation is useful: facts below are distinct from proposed visual decisions. For this requested audit, capture that context in Rev02 rather than starting its full init/new-work implementation workflow or generating parallel root documents. A future PRODUCT.md could provide a short facts-only reference back here; a future DESIGN.md must remain consistent with consolidated shared decisions in plan 06. Neither should overrule approved Rev02 decisions. No such files were created in this pass.

## Product Purpose

The Ledger helps a player maintain a trustworthy personal record of Dead by Daylight character ownership, Prestige, Bloodweb progress, perk access and personal tiers, and item/Add-on quantities. It also supports planning progression and returning to work. It is a tool operated alongside the game, not an analytics service or a promotional site.

Confirmed product facts:

- A local-first static web application, with no account required. Browser-local saves and local snapshots are distinct from portable JSON exports.
- Survivor and Killer share progression/perk concepts, but Survivor stock has item families and compatibility, while Killer Add-ons belong to a particular Killer Power.
- Global perk availability, automatic tier minimums, and a character's explicit personal record are different facts. Historical/renamed perks have additional supported distinctions that presentation must preserve.
- Current schema v2 stores character progress, personal inventories, account perk overrides, and one global Prestige Queue. Playing queues and separate role Up Next pins require new persisted account state; Continue needs a small browser-local stable-location preference. These are planned capabilities, not implemented facts.
- Canonical IDs, current catalogs, unknown imported records, validation, backup/recovery, and the single-writer guard are functional constraints worth preserving.

Subject inventory for design specificity: named Survivor and Killer identities; recognizable portraits; P1/P2/P3 global perk milestones; Bloodweb level within Prestige; effective versus recorded perk tiers; historical perk provenance; seven Survivor item families and compatibility; Killer-specific Powers and Add-ons; rarity words and asset colors; manual priorities distinct from play interest; numerical stock records; a portable personal ledger. These should shape the structure, not merely decorate a generic shell.

## Primary User Workflows

| Job | Existing path / useful behavior | Cost or design implication |
| --- | --- | --- |
| Open and understand account state | Dashboard; owned totals, perk access, local-save status | Approved Snapshot → Up Next → Continue hierarchy should replace competing opening-page sections. |
| Find a Survivor or Killer | Role navigation → search / ownership / Prestige / Favorites / sort → character | One role click and one character click when visible; search adds focus and typing. Tall cards lengthen visual scanning. |
| Move between characters | Previous / next links preserve section and perk update mode | One navigation action; retain this strength. Order is catalog/name order rather than the filtered roster's subset. |
| Update Prestige / Bloodweb | Overview → Edit Character → fields → Save Character | From roster: open character, enter Edit, edit, save. Save is far below unrelated form sections. |
| View owned/unowned characters | Explicit role-roster scopes | Keep scopes clear; “Locked” character ownership must not blur into “globally locked perk.” |
| Review character perks | Workspace Perks → artwork and effective tiers | Good visual recognition; clarify that tracked/effective tiers need not be explicit personal records. |
| Record perk tiers | Perks → Update Inventory, or click a displayed perk → update view; select perk → tier | Update view already has inline quick pickers plus a persistent detail editor. Usually two activations per subsequent perk; do not invent a missing quick-edit feature. |
| Update Survivor Items / Add-ons | Items & Add-ons → family → item/compatible Add-ons → quantity | Direct input or one +1/+5/+10 activation; preserve family context and avoid burying quantities. |
| Review Power / update Killer Add-ons | Power & Add-ons → summary or Power Details; editable Add-on quantities | Same numerical control vocabulary is already present, but no Survivor-style search/In Stock toolbar. Determine whether parity serves the smaller fixed list. |
| Rapid quantity entry | Enter / leave field to commit; −1, +1, +5, +10 | Direct numeric entry scales better than repeated increments for large totals. Tab order includes intervening utility buttons; navigation/focus and stable ordering are part of speed. |
| Return to recent work | Dashboard lists recent edited characters → Overview | Does not restore the prior section. No visit history can be inferred from edit timestamps. |
| Maintain priorities | Current global Prestige Queue; future role-split Prestige / Playing queues and pins | Functional intent model requires separate design/persistence work. Styling cannot supply it. |
| Keep a portable copy / restore | Data & backups; global Export; validated confirmed replacement | Preserve predictable backups and explicit consequences. Put data actions ahead of provenance prose on their own screen. |

Costs are route/control counts from inspected UI and source, not timed user-study results. No data was entered to benchmark saving.

## Current UX Strengths

- Consistent role rosters and canonical workspace links; browser navigation and deep links are supported without a framework rewrite.
- Previous/next character links retain the section, which is particularly useful during repeated inventory work.
- Quantity fields have numeric input hints, named controls, direct entry, large steps, validation, and explicit errors. Existing code preserves pending input and manages focus around commits.
- Perk reconciliation supports search, scope, “Only unrecorded,” quick tier pickers, detailed provenance, and a session change count. These are valuable tools, not candidates for wholesale replacement.
- Local-save feedback, editor lock notices, retained failed input, confirmed replacement/reset, backups, and raw-data recovery support trust.
- Real game imagery supplies recognition. Survivor item-family grouping and compatibility, and Killer Power context, reflect actual domain structure.
- Native buttons, selects, dialogs and popovers; skip link, visible focus rules, current-navigation state, field labels, and live status regions provide a useful accessibility foundation.

## Current UX Friction

No Critical blocker or demonstrated data loss was found in this read-only audit. High means a frequent task or cross-screen comprehension is materially hindered; it is not an emergency release classification. Evidence labels: **R** rendered observation, **S** source observation, **H** hypothesis requiring user or later interaction validation.

| ID | Priority | Type | Finding and user impact | Evidence / next design question |
| --- | --- | --- | --- | --- |
| U01 | High | UX | Browsing geometry dominates repeated editing. Large workspace header, stacked tools, and tall stock tiles keep quantities out of the opening viewport. | R/S: first Survivor quantity at about document y=1108 at 1440×1000, y=1483 at 390×844; stock cards about 384px tall. Design a working density, not just smaller headings. |
| U02 | High | UX | A small progression update enters a long composite draft containing personal perks and Survivor stock, with Save only at the bottom. | R/S: empty Ace Edit page about 4084px tall at 1440; Save was approximately 3874px below the viewport top in the inspected state. Keep explicit-save safety while making the relevant work and commit action easy to reach. |
| U03 | High | UX / semantics | “Owned,” “effective,” “recorded,” “available,” and “automatic minimum” carry different meanings. An unowned character can correctly show native Tier I and “3 / 176 Perks,” which can look like a false personal record. | R/S: Ace roster, Overview and Perks. Clarify the displayed fact without altering model rules. |
| U04 | High | UX | Dashboard priorities and resume do not yet match the approved Rev02 jobs. A global Prestige queue cannot express separate role pins or Playing intent; recent edit links always lead to Overview. | R/S: `dashboard()`, `dashboard-selectors.js`, `prestige-queue.js`, current schema. Apply existing approval; do not reopen the hierarchy. |
| U05 | High | UX / responsive | Stacking preserves content but can push the active task far down. At 320px the quantity input contracts to 31px while four 44px step buttons remain. | R/S: measured mobile stock group. Prioritize the value, identity and essential adjustments before secondary increments. |
| U06 | Medium | UX / navigation | Roster helper says names/Prestige badges open editing; they open Overview. Character neighbors also ignore the roster's search/ownership subset. | R/S: `collection()` and `characterWorkspaceNeighbors()`. Correct expectation in a future screen plan; decide subset behavior, do not assume it. |
| U07 | Medium | UX | Data portability actions follow catalog research, setup and display settings. Detailed Power reference exposes raw keys such as “name,” “type,” and “description” repeatedly. | R/S: Data page and Power Details. Structure information around backup and mechanic lookup tasks; preserve research values. |
| U08 | Medium | UX | Save semantics vary legitimately: Character Edit is a draft; quantities and perk tiers save immediately. Global “Saved locally” can be mistaken for a statement about an unsaved draft. | R/S: form copy and `commit()` / edit session code. Provide local mode/status clarity rather than forcing one save model everywhere. |
| U09 | Medium | UX / responsive | Global perk libraries retain a roughly 941px comparison table inside a 333px mobile frame. Containment prevents page overflow, but cross-column comparison remains costly. | R/S: 390px Survivor library. Screen review should choose a small-screen summary/detail arrangement or a deliberately navigable retained table. |
| U10 | Low–Medium | UX / confidence | No immediate undo is evident for autosaved quantities/perk changes; backup snapshots are not an undo history. | S/H: validate whether correction by re-entry is sufficient before proposing new undo state. Do not add confirmations to every low-risk edit. |

## Current Visual-System Assessment

| Area | Existing evidence | Assessment |
| --- | --- | --- |
| Hierarchy | Dashboard repeatedly framed sections; two prominent red actions on character Perks; large identity block above every workspace | Importance does not consistently determine geometry. Edit Character can outshout the active inventory task. |
| Typography | Global 14px stack declares Inter, Segoe UI, Arial; H1 34px; extensive 8–11px uppercase/tracked metadata. No font package/import in entry files. | A workhorse face is appropriate. Uneven sizes and tiny labels create avoidable reading effort. Do not assume declared Inter is installed or a new display face will solve hierarchy. |
| Spacing | Main gutters 36/44px; 20–24px panel padding, plus screen-specific rules | Several spacing systems accumulate. Reduce repeated header/tool spacing for editing; keep browsing breathable. |
| Content width | `main` max-width 1750px; at 1920, observed main width 1685px beside a 220px sidebar | Wider max-width alone will not fix the Dashboard: at this viewport it already uses most available width. Empty interiors, repeated divisions and grouping matter more. Ultrawide limits remain a design choice. |
| Surfaces | `.panel`, `.summary-panel`, `.perk-summary`, nested native-perk cards and stock tiles; mostly 4–6px radii, some pills | The main issue is repeated enclosure, not excessive roundness. The app is already dark and restrained. Use boundaries to explain objects, editing or elevation. |
| Navigation | Labeled sidebar; top bar; previous/next strip; workspace tabs; family controls; mobile horizontal global nav | Labels and stable routes work. Multiple navigation layers consume vertical space; mobile hides the product brand and off-screen destinations require horizontal discovery. |
| Controls | Native selects and inputs, red primary, gold selection/focus, grey utility controls, shared quantity group | Useful basis, but control heights, selected-state treatments and action emphasis vary by feature generation. |
| Density | Tall roster cards and ~384px stock tiles versus compact global perk table | Density differs by implementation history rather than by browsing/editing task. |
| Responsive behavior | Sidebar shrinks to 185px below 1100, disappears at 760; `.two-column` stays paired until 760; stock fields remain five-part groups | At 768px main is only 568px wide, with about 502px after gutters; two action panels get roughly 241px each. At 390px large identity/control stacks remain. |
| Identity | Charcoal, restrained red/gold, portraits, colored game inventory art, explicit DBD terminology | Stronger than a generic dashboard, but data surfaces and control hierarchy need a coherent product-specific logic. |
| CSS organization | One ~2681-line stylesheet with initial globals and appended inventory, workspace, rarity, and collection sections; repeated selectors and hardcoded colors | Shared styling is an architectural dependency for later work. This audit does not authorize a CSS reorganization or introduce a token framework. |

## Design Specificity Assessment

The current UI is **partly authored for this tracker, partly interchangeable application chrome**. The roster and stock screens are unmistakably DBD through their actual subjects, compatibility groupings and tier logic. The unpopulated Dashboard is closer to a conventional dark dashboard: ownership totals, bars, boxed summaries, generic “Account overview” framing and a common sidebar shape.

Competitor substitution test: replace portraits and nouns with another game's characters and inventory. Much of the present shell and card geometry still works unchanged. That is acceptable for standard navigation and inputs, but insufficient as the whole identity. Product specificity should be earned by meaningful P1/P2/P3 access records, visible recorded/effective distinctions, item compatibility, Power ownership, and planning versus play intent. Do not invent new statistics or copy the game's menu to achieve distinction.

An interface's appearance cannot establish whether AI generated it. “Template-like” below describes interchangeable design patterns, not provenance.

## Generic / AI-Generated UI Risks

- **Present:** many similarly bordered rectangles, nested cards in Overview, repetitive small uppercase labels, oversized metrics relative to contextual text, equal-width arrangements applied to unlike jobs, and the same identity/header prominence on editing and browsing screens.
- **Present but defensible:** consistent portrait cards for peer characters; repeated quantity groups; a labeled sidebar. Repetition is useful when objects and operations truly are peers.
- **Largely absent:** blue/purple atmospheric page gradients, glass panels, huge rounded SaaS tiles, ornamental chart sparklines, fake growth metrics, decorative animation, and marketing hero sections. Do not diagnose patterns that are not there.
- **Potential redesign traps:** literal archive stamps and distressed type on every row; a decorative Bloodweb diagram as navigation; horror textures behind forms; full-screen cinematic transitions; replacing useful art with a generic icon library; removing all borders until fields lose their affordance.

## Design Identity Goals

Precise personal records of progress through the Fog: calm enough to operate repeatedly, distinctive through DBD subjects and relationships. Browsing should feel like opening a character's dossier. Editing should feel like adjusting a reliable instrument. Save state and numbers must be easier to read than atmosphere.

Retain the recognizable product name “The Ledger” unless separately changed by the user. Candidate direction names below are design concepts, not proposed product renames.

## Design Direction Exploration (Historical Alternatives)

### Direction A — Trials Archive

- **Central idea / product-specific device:** a personal record of characters, their Prestige-derived perk access and their recorded stock. A character dossier reveals progression and provenance in a readable hierarchy.
- **Personality and typography:** restrained charcoal/off-white surfaces, clear names, disciplined numerical columns, occasional compact or condensed section headings if they remain legible. Workhorse UI text and tabular figures; no distressed body type or decorative mono captions.
- **Surfaces and controls:** ruled sections and open summary bands; bounded peer character objects and actual editable regions. Compact rectangular utility controls and familiar native fields.
- **Artwork:** portraits give browsing its richness; perk/item imagery is evidence of identity, not a full-screen background.
- **Roles:** same grammar; Survivor dossier emphasizes shared item-family/compatibility context, Killer dossier emphasizes Power and its owner-bound Add-ons. Role text always explicit.
- **Density and interaction:** clear, moderate-density browsing. Editing must shed archival framing and use a tighter utility arrangement; no extra document-opening ceremony.
- **Advantages:** fits the existing name, local personal record, and approved Dashboard. Allows imagery without more decoration.
- **Disadvantages / generic risk:** “dark archive with rules” can become generic horror branding, and dossiers can be too spacious for data entry. Atmospheric texture could impair reading.
- **Substitution test / suitability:** the word Archive alone fits many trackers. It becomes specific only through DBD's global-versus-personal perk record, Prestige milestones and role-dependent stock structure. Best overall identity foundation if editing is deliberately different.

### Direction B — Bloodweb Terminal

- **Central idea / product-specific device:** a working register linking character Prestige/Bloodweb progression to effective perk access and numerical stock. “Terminal” means immediate operation, not simulated command-line UI.
- **Personality and typography:** high precision, compact aligned data, tabular figures, clear units and short labels. One readable UI family; mono reserved for IDs if exposed, not all prose.
- **Surfaces and controls:** flat working rows, shared dividers, stable quantity groups and tier selectors; compact context strip. Selected/focused/changed states must be distinct.
- **Artwork:** smaller stable icon slots next to names/values; Power details revealed on demand. No animated nodes or fake terminal output.
- **Roles:** same interaction geometry; contextual family controls versus Killer Power label carries difference, with existing rarity semantics retained.
- **Density and interaction:** densest option, optimized for scanning and repeated input, few transitions and no waiting.
- **Advantages:** strongest inventory efficiency, supports numerical precision and comparison, reduces repeated visual travel.
- **Disadvantages / generic risk:** can resemble any developer console; too little imagery weakens recognition and browsing appeal. Bloodweb naming may incorrectly suggest the tracker reproduces the game's progression network.
- **Substitution test / suitability:** a numeric table is interchangeable. The meaningful link between Prestige, automatic access and explicit records distinguishes it. Strong editing influence; too austere as the whole product identity.

### Direction C — Trial Preparation Bench

- **Central idea / product-specific device:** prepare which character to use next, inspect the relevant stock and Power, and reconcile available quantities. Family/item compatibility and Killer-specific equipment drive a side-by-side preparation layout.
- **Personality and typography:** practical equipment register; slightly stronger image presence and group labels, names and quantities on fixed alignment lines. Clear sans-serif labels and tabular values.
- **Surfaces and controls:** selected character and equipment groups, active working region clearly bounded; reference moves into disclosures. No arbitrary three-column inventory panels.
- **Artwork:** character and equipment imagery establishes relationships; no scene background, fake bloodpoints, or decorative inventory slots.
- **Roles:** Survivor families/items and compatible Add-ons versus Killer Power and its Add-ons, using the same control language.
- **Density and interaction:** medium-density recognition and grouping, with compact editing within each group. Priorities can lead into relevant inventory.
- **Advantages:** strongest equipment-recognition story and a natural bridge from Playing intent to stock.
- **Disadvantages / generic risk:** implies loadout building, consumption, trial sessions or an equipment selection model the tracker does not have. Can resemble a game inventory screen or copy the game's layout. Account progression/perk provenance become secondary.
- **Substitution test / suitability:** “preparation bench” fits many games; DBD compatibility/Power ownership narrows it, but the workflow promise currently exceeds confirmed functionality. Useful grouping influence, weakest fit as overall identity.

### Comparison

| Criterion | Trials Archive | Bloodweb Terminal | Trial Preparation Bench |
| --- | --- | --- | --- |
| Balanced browsing and planning | Strong | Weak–moderate | Moderate |
| Rapid stock and tier entry | Moderate without adaptation | Strong | Moderate–strong |
| Honest fit to existing capabilities | Strong | Strong if not a fake Bloodweb UI | Risk of implying loadout features |
| Artwork recognition | Strong | Must be protected | Strong |
| Risk | Decorative archive / generic horror | Generic console / compressed readability | Game UI imitation / feature invention |

## Consolidated Direction

**Settled direction: Archive when browsing. Tool when editing.** Trials Archive and Bloodweb Terminal describe the recognition/precision split. This is one product with two task-appropriate densities and the same navigation, type roles, control states, and save vocabulary. It is not two themes or a new mode switch requiring user management.

The user's confirmed browsing/editing split is the deciding factor. Archive-only would slow repetitive work; Terminal-only would underuse recognition and character context; Preparation Bench would imply features beyond the tracker. The hybrid lets the Dashboard keep its approved orientation hierarchy and lets inventories devote their geometry to names, quantities and tier changes.

The conceptual direction is settled by the consolidation brief. Exact fonts, colors, widths and screen geometry remain recommendations for rendered verification; texture is not a requirement. The governing concept is: **DBD's automatic perk access and personal records become the ledger's meaningful structure; rarity and artwork identify what is being recorded.**

## Proposed Design Principles

1. Fewer containers, stronger hierarchy. Boundaries should explain object identity, a working region, or an overlay.
2. Artwork carries visual richness. Keep controls and backgrounds quiet enough for actual game assets to be recognized.
3. Browsing and editing have different density, with one interaction language.
4. Survivor and Killer are related but distinguishable through content structure and explicit role, not blue-versus-red themes.
5. Keep numerical controls tactile through visible boundaries, immediate feedback, predictable focus and stable positions.
6. Let importance change geometry. A quantity entry task should not be subordinate to a large character banner.
7. Use symmetry for true peers, including approved role-balanced Dashboard summaries; use unequal emphasis when tasks differ. Asymmetry is not decoration.
8. Design responsive task order and editing controls, not only column stacking.
9. Provide keyboard, touch and single-pointer alternatives; never require color, hover or drag alone.
10. Repeated operations are immediate. Do not add theatrical transitions to quantities, tabs, search, filters, sorting or character navigation.
11. Every distinctive flourish must explain why it belongs in this tracker. Familiar input behavior needs no special aesthetic invention.

## Browsing vs Editing Modes

| Browsing / planning | Editing / reconciliation |
| --- | --- |
| Character recognition, concise progression and next intentions | Read the current number, enter a value, see reliable saved/error state |
| Moderate density and meaningful portrait emphasis | More entries per viewport by reducing artwork region, wrapper spacing and header repetition |
| Summary first, expandable provenance and detail | Direct fields and tier controls; details remain available without displacing the working context |
| Stable route labels and return paths | Stable edit order, visible save mode, keyboard sequence and no moving targets |

These are task classifications, not a proposed user-facing Browse/Edit toggle. An inventory screen can contain secondary reference content, but that content must not crowd its primary work. Exact row/card format belongs to the screen reviews. Dense must not mean tiny type or small hit areas.

## Survivor / Killer Relationship

Use the same header hierarchy, tabs, quantity controls, error presentation, detail disclosures, sorting vocabulary, focus behavior, and saved/draft feedback. Differentiate with role text, portraits, native imagery and domain structure. Survivor Items & Add-ons needs family/compatibility context; Killer Power & Add-ons needs the owning Power and its Add-ons. Equal button vocabulary does not require identical toolbars when the lists support different jobs.

Retain rarity and perk tier as their own semantic color systems. Do not reuse those colors as broad role themes. Explore an understated role marker only if it helps orientation beyond the always-visible role name.

## Typography Direction

Define roles before a font purchase or import. One system/workhorse sans may be enough; a condensed heading face is optional and should have one narrow role with a reliable fallback.

| Role | Proposed behavior |
| --- | --- |
| Page title | Compact, clearly first in heading order; no marketing-scale headline |
| Section label | Readable hierarchy; limited uppercase/tracking, never a sea of microtext |
| Character / item name | Recognition priority, enough width for long canonical names; intentional wrapping |
| Metadata / provenance | Secondary but readable; disclose detail instead of shrinking it below useful size |
| Numerical data | Tabular digits, aligned comparison columns, explicit tier/unit/context |
| Form control | Stable readable text, clear label and value; numeric keyboard hint where useful |

Provisional exploration: body/control text around 14–16px with supporting labels around 12–13px, and modest title steps. These are prototype candidates, not fixed tokens. Use rem-based sizing and examine zoom/reflow before approval. No proprietary font dependency is justified by this audit.

## Surface and Container Strategy

- **Cards can serve:** peer character objects with useful art; a cohesive bounded editing object when needed; a compact independent return action; dialog/popover elevation.
- **Open layout / rules can serve:** page sections, compact Progression Snapshot figures, metadata and summaries, toolbars with clear grouping, repeated inventory rows whose alignment already supplies structure.
- **Avoid:** card inside card inside section merely because each has a heading; separate tiles for each derived statistic; forcing unrelated blocks to equal heights; deleting control outlines in pursuit of minimalism.
- **Use borders intentionally:** distinguish structural dividers from actual input boundaries and selected/focus/error states. A quiet divider need not meet control-boundary contrast, but a border relied on to identify an input does.
- **Atmosphere:** if later approved, subtle static texture only in peripheral browsing areas; never beneath numerical entry, small text or error content. Default proposal is to validate the system without texture first.

## Interaction Language

| Element | Proposed contract for later screen plans |
| --- | --- |
| Primary action | Strongest action reflects the screen's current job; competing global Edit Character and Update Inventory need role-appropriate emphasis. |
| Secondary action | Lower visual emphasis with explicit text; no hidden essential action behind hover. |
| Destructive action | Explain consequence and preserve existing confirmation/backup protections for replacement, restore and reset. |
| Compact utility | Immediate response, stable dimensions, plain accessible name; no ornamental icon boxes. |
| Workspace tabs | Real navigation links with current-section semantics and browser behavior; do not adopt ARIA tabs unless the interaction actually follows that pattern. |
| Filters / sort | Clearly scoped to the visible collection, preserve meaningful context, expose active restrictions and recovery from no results. Global account and character-personal scopes stay distinct. |
| Quantity | Direct value plus useful steps; numeric input hint, explicit saved/pending/error feedback, zero/invalid behavior consistent between roles. At narrow sizes protect input width before less-used +5/+10. |
| Reorder | Named Move Up/Down or equivalent single-pointer action alongside any drag affordance; keyboard operation, focus retention and position announcement. |
| Saving | Distinguish autosaved workspace changes from scoped progression/note/correction/setup drafts locally; the giant editor retires after parity. Do not present the global stored-save timestamp as proof the draft is saved. |
| Dialog / detail | Preserve Escape and focus restoration. Reference details should be skimmable; repeated implementation keys do not belong in the visible reading hierarchy. |

Quantity and tier autosave behavior is existing functionality, not approval to change its semantics. Focused progression editing is settled in plans 03/05. New undo or custom shortcut systems remain deferred without demonstrated need. Preserve current validation floors and unknown-record handling.

## Artwork and Game Assets

Use existing role-correct portraits for recognition, with Killer Lore identity and neutral named fallback (The Slasher is currently missing; no square exception) and existing perk, item, Add-on and Power images for object recognition. Scale imagery by task: stronger on rosters, smaller beside numerical editing, selectively enlarged in reference details. Keep names legible and available independently of images; avoid reducing all stock identity to a generic glyph.

Keep rarity words and tier numerals alongside semantic color; distinguish a missing asset from an unknown saved record. The Animatronic Power currently shows a labelled fallback, while Add-on art renders. Preserve truthful fallback and leave research datasets unchanged.

Game-provided imagery may contain colored backgrounds or gradients; this is not a reason to remove it to satisfy a blanket anti-gradient rule. Avoid copying DBD's menu arrangement, Bloodweb navigation, graphical frames, or animated effects. The Ledger should own its layout and interaction logic.

## Responsive Philosophy

Desktop supports parallel recognition, comparison and editing. Laptop height matters as much as large-screen width. Tablet needs its own space allocation: collapse or reduce global chrome before shrinking the actual task into two narrow columns. Exact breakpoints follow content fit.

Mobile keeps character, section, active restrictions and essential editing actions reachable. Minimize duplicate identity/context blocks; use one task-oriented control region rather than stacking every desktop tool at full width. Permit horizontal scrolling inside a genuine comparison table or family strip only with clear affordance and a preserved useful identity context. Global navigation destinations and the product identity should remain discoverable.

Do not require every major block to fit the first viewport if that would squeeze text or distort the approved Dashboard hierarchy. Aim to expose the main action promptly; evaluate useful entries per screen and travel to the next value, not only absence of page overflow.

## Accessibility Baseline

Use WCAG 2.2 AA as the proposed baseline, as consolidated in plan 06: keyboard access; meaningful names, roles and state; visible, unobscured focus; normal text at least 4.5:1, large text 3:1; essential non-text control/state cues 3:1; text resize and reflow; no color-only or hover-only meaning; single-pointer alternatives to drag. Treat 44×44px as a practical touch target goal for frequent controls, distinct from the WCAG 2.2 24px minimum/spacing exceptions.

Native controls and dialogs are useful foundations, not proof of conformance. Progress bars need semantic values if they convey information beyond adjacent text. Quantity errors should stay associated with the field, preserve input, and be recoverable without reading unrelated content. Save confirmations must not overwhelm screen readers during hundreds of edits.

Later verification should include keyboard-only operation, screen-reader announcements, 200% text/zoom and 400% reflow where applicable, touch keyboards, long names, large quantities, missing art, read-only state, save failure, and invalid input. This audit did not certify accessibility.

## Animation / Motion Philosophy

Frequently repeated operations prioritize immediacy over spectacle. Quantities, keyboard tier changes, character navigation, tabs, search, filters and sort must not wait for transitions, staggered cards or animated counters. Keep input focus and value stable while feedback changes.

An occasional detail disclosure may use brief functional motion to explain appearance, with reduced-motion alternatives and immediate interaction. Exact durations are not design tokens yet. Do not add a motion library or animate merely to make the tracker seem “modern.”

Specialist comparison, expressed as current versus proposed principle rather than code edits:

| Current / candidate | Proposed treatment | Why |
| --- | --- | --- |
| Immediate quantity/tier operation | Preserve immediate operation and add clear local state only where needed | The operation repeats many times; feedback must not become ceremony. |
| Potential universal button scale or blurred crossfade | Prefer stable-bound feedback for dense utility controls | Scaling/blur can reduce numeral readability and create repetitive distraction. |
| Potential staggered inventory entrances | Reject | Repeated filter and navigation operations should expose all usable results immediately. |

## Global Opportunities

1. A shared content-width and density policy based on task, with readable prose measures separate from editing canvases.
2. Consistent page/character context, navigation and local action hierarchy, including a deliberately compact editing header treatment for review.
3. Unified label, scope and save-status vocabulary for account access, effective tier, personal record, stock, autosaved changes and drafts.
4. Shared quantity/tier control and focus/error patterns across role workspaces, retaining current functional protections.
5. A surface/typography/spacing/color-state vocabulary consolidated in plan 06; no dependency or framework change implied.
6. Responsive shell and control priorities that free tablet width and preserve mobile numerical input usability.
7. A repeatable later validation set using realistic populated accounts, long names, zero/unknown quantities, lock states and storage failures. Existing tests are evidence of intended contracts, not a substitute for new rendered review.

## Screen-Specific Concerns

| Screen / family | Decide in its individual plan |
| --- | --- |
| Dashboard | Keep approved Snapshot, role-separated Up Next and Continue; resolve queue/pin/resume questions without expanding analytics. |
| Role rosters | Minimum facts needed to choose a character, artwork density, truthful link copy, filtered navigation context. |
| Character workspace / Edit | Summary versus operating header, quick progression path, Save reachability, drafts and return behavior. |
| Character Perks / Update | Recognition versus reconciliation density, quick picker discovery, scope and tier semantics, mobile detail placement. |
| Account perk libraries | Comparison columns and labels, availability versus personal ownership, active filters, mobile representation. |
| Survivor stock | Family-scoped search, item compatibility, shared Add-on quantity identity, keyboard sequence and compact layout. |
| Killer Power / Add-ons | Power summary/reference hierarchy, skimmable structured data, stock density and justified filter parity. |
| Data / Backups | Backup/export/import task order, setup/settings relationship, catalog provenance, trust and recovery copy. |

### Existing Rev02 tensions

- **No change recommended to the three Dashboard jobs, role separation, caps or manual ranking.** Balanced role summaries are true peers; generic advice to avoid symmetry does not supersede them.
- **Width evidence qualifies the earlier diagnosis:** `01-dashboard.md` discusses unused horizontal space. At observed 1920px the shell already uses most available width; the stronger problem is ineffective interior grouping and empty framed areas. The Dashboard plan now records that measured clarification without changing its approved three jobs.
- **Compact Continue remains valid:** calling it a “card” should not require a bordered panel if the approved global surface strategy later achieves the same compact actionable unit.
- **Shared actions remain a review boundary:** the approved Dashboard document explicitly leaves the top bar unchanged. The current consolidation explicitly approves global responsive adaptation; plan 06 preserves these capabilities while allowing labeled Menu/Actions disclosures where width requires it.
- The Dashboard's “no full-site redesign yet” non-goal described that earlier screen-only task. The current user explicitly authorizes this site-wide audit; it still authorizes no production redesign or speculative final screen plans.

## Skill-Assisted Findings

| Recommendation | Source | Decision | Reason |
| --- | --- | --- | --- |
| Architectural exploration with alternatives and review before implementation | Superpowers brainstorming | ACCEPTED | Historical alternatives remain recorded; the current user brief selects Archive browsing / Tool editing. Consolidation stops before roadmap/implementation. |
| Dependency-aware implementation planning | Superpowers writing-plans, discovered in installed catalog | DEFERRED; NOT INVOKED | The user explicitly reserves this stage until the major screen plans are complete and reviewed. |
| Operate-mode precision, familiar affordances, data truth separate from visual choices | Impeccable / Operate and init references | ACCEPTED | The tracker is repeatedly operated; conceptual novelty must not disrupt values or save safety. |
| Compare independent design judgment with detector evidence | Impeccable critique | ACCEPTED | Separate assessments were completed; scanner warnings are evaluated in context. See audit matrix methodology for limitations. |
| Root PRODUCT.md, new visual-world artifacts and a full concept/build workflow | Impeccable init/new-work | ADAPTED / DEFERRED | Product context is recorded in Rev02 for the requested audit. Do not create a competing authority or claim a selected world before review. |
| Subject inventory, product-specific signature and competitor substitution | Taste Skill app-screen guidance | ACCEPTED | DBD tier provenance, compatibility and Power ownership supply meaningful distinction. |
| True-black-flat and data-terminal styles | Taste Skill app-style draw | ADAPTED | Two dark candidates were returned. Surface restraint and numerical precision inform the three authored directions; generated tokens do not select identity. No full style was selected or persisted. |
| Ban all violet/indigo, accent chrome, gradients and uppercase | Taste Skill house rules | REJECTED AS ABSOLUTES | Preserve rarity/tier meanings and existing art; bounded labels and clear active navigation can be valid. A style preference is not a usability finding. |
| Equal bottom edges and all brief blocks in first viewport | Taste Skill app-screen guidance | ADAPTED | Avoid accidental voids, but never fabricate content, stretch empty cards or squeeze the approved hierarchy to satisfy symmetry. |
| Feature-Rich Showcase, repeated CTAs, hero/social-proof sequence; generated slate/green and corporate font recipes | UI UX Pro Max design-system query and narrower retry | REJECTED | Both results were landing-page/corporate-biased despite an operational inventory brief. No verified product-specific system was found. |
| Keyboard access, numeric keyboard hints, button alternative to drag | UI UX Pro Max focused UX searches | ACCEPTED | Relevant web interaction guidance; preserve existing numeric input hints and approved Move Up/Down alternatives. |
| Bulk edit as the answer to repeated entry | UI UX Pro Max UX search | ADAPTED / DEFERRED | Repeated stock entry does not necessarily mean applying one number to many records. Prove the task before adding bulk controls or selection state. |
| Decide motion from operation frequency; no delay on repeated keyboard actions | Emil design-engineering | ACCEPTED | Quantity and tier reconciliation are high-frequency workflows. |
| Scale every button, blur crossfades, add stagger | Emil design-engineering | REJECTED AS DEFAULTS | Conflicts with immediacy and readable stable numbers; no functional need established. |
| New component library / stack-specific recipes | shadcn skill applicability check | NOT APPLICABLE | Existing stack is vanilla JS/HTML/CSS, no React, Tailwind or components.json. No shadcn commands or migration. |
| Illustrated diagrams for every flow | Diagram Design applicability check | DEFERRED | Current route/workflow and queue relationships are clearer in compact tables; no branded diagram artifact justified. |

Skill conflicts are resolved by product needs: Taste's one-color preference yields to semantic rarity; its compact control measurements yield to touch usability; Emil's broad motion examples yield to its own frequency rule and Impeccable Operate restraint; UI UX Pro Max's generated landing-page structure is rejected. These references are design aids, not evidence of user approval or usability-study results.

## Non-Goals

- No implementation yet, CSS restyle, behavior change, dataset change, inventory-schema change, build or deployment.
- No wholesale framework rewrite or unnecessary dependencies.
- No redesign merely for novelty, generic AI-dashboard styling, or copy of DBD's game UI.
- No component-library migration merely because a skill supports it.
- No fabricated progression metrics, automatic queue intent, completion history, loadout system or trial-consumption model.
- Full Core planning is covered in plans 01–06; no task-by-task implementation roadmap or production layouts are created in this pass.
- No final global token/font/palette decision or DESIGN.md before review.

The dependency-aware implementation roadmap is in [07-implementation-roadmap.md](07-implementation-roadmap.md). D01/D02 were explicit pre-schema gates at planning time and were approved on 2026-10-27. Standalone perk libraries and Data & Backups keep existing information architecture initially, with functional shell/schema compatibility.
