# Character Workspace Visual Redesign Design

Status: APPROVED DIRECTION — REVISED SPEC FOR OWNER CHECKPOINT REVIEW
Date: 2026-10-14
Scope: Character Workspace presentation and interaction design only. No production code, routes, schema, persistence semantics, Dashboard behavior, queue behavior, or Killer inventory data are changed by this document.

## Revision checkpoint

Tasks 1–5 are implemented; Task 5 is complete at `e0f4a728d39acefe70bea2dcc53491c75d9e835b`. The approved artwork baseline is `5d5d7e43749acd5cfc448e33eb08365a97d1c2ea`: all 92 supported Survivor inventory entities resolve to verified background artwork. Do not reopen that mapping absent a concrete defect.

This revision supersedes the earlier multi-family inventory document with selected-family navigation and artwork-led cards. It changes only Survivor Items & Add-ons presentation, including that surface inside Edit Character; Overview, Perks and all Task 5 quantity contracts retain their existing approved direction. Task 5A implementation and Task 6 remain paused pending owner review of these documents. No production change is part of this revision.

## Decision summary

The Character Workspace remains one routed character experience with shared identity, shared navigation, and the existing persistence model. The redesign changes presentation, grouping, and visual hierarchy while preserving all settled data and editing behavior.

The approved direction is:

- Use one shared character header across Overview, Perks, and Items & Add-ons or Power & Add-ons.
- Keep the Perks card grid and its effective-inventory behavior as the visual benchmark rather than redesigning it for novelty.
- Display exactly one verified Survivor Item family at a time, selected through a compact native-button family switcher in canonical catalog order; render Items before Add-ons within that family.
- Within each Items or Add-ons subsection, order positive stock first, zero stock second, then canonical catalog order inside each stock group.
- Keep zero stock visible and editable by default.
- Make quantity the primary inventory-card interaction.
- Replace repeated card-level reference prose with a compact Details action and bounded dialog.
- Make the canonical background artwork visually prominent; retain catalog-authoritative text such as `Common · Item` and reduce redundant borders/badges and repeated card-level family labels.
- Move unresolved imported inventory IDs into a dedicated read-only region outside verified families.
- Recompose Overview as a compact character dashboard using native perk imagery, setup context, truthful collection summaries, and Notes.
- Preserve existing routes, schema v2, save identity, sparse quantity persistence, raw invalid input behavior, writer locking, Edit Character draft semantics, compatibility routes, and Killer data deferral.

The previous flat inventory presentation rule of globally placing all positive stock before all zero stock is explicitly superseded for presentation by the family-local rule in this document. This is not a persistence or schema change.

## 1. Goals and non-goals

### Goals

1. Make Overview, Perks, and inventory feel like one coherent Character Workspace.
2. Improve scanability without reducing the amount of truthful state the user can reach.
3. Let imagery and concise metadata identify entities faster than repeated prose.
4. Make Survivor inventory navigable as a collection of recognizable Item families rather than one long database-like grid.
5. Make quantity entry visibly primary while preserving the existing validated interaction contract.
6. Make rarity meaningful without turning the interface into a field of saturated color.
7. Keep the Perks experience familiar and functionally stable.
8. Improve keyboard, focus, zoom, and narrow-width behavior while redesigning the surfaces.
9. Keep the design implementable inside the current static local-first architecture.

### Non-goals

This design does not:

- change schema v2;
- introduce schema v3;
- change localStorage keys, save identity, JSON import/export, backup, recovery, or migration behavior;
- change character timestamps or no-op save rules;
- change Prestige Queue behavior or Dashboard design;
- change canonical or compatibility routes;
- start P3.5 or invent Killer Power/Add-on data;
- redesign the global shell, sidebar, top bar, Dashboard, collections, setup flows, or Data view;
- change perk candidate logic, effective-owned logic, automatic minima, historical behavior, or tier semantics;
- create new completion percentages, scores, inferred stock, or other unsupported analytics;
- make the entire inventory card clickable;
- require a sticky inventory toolbar;
- change the completed Task 5 +/- controls or their raw input, commit and focus semantics.

## 2. Current-state problem statement

Tasks 1–5 established the shared header, Overview composition, family-local ordering, Details dialog and focus-safe quantity controls. The present inventory implementation still renders seven verified families in one tall document. Its manual section controls add presentation/focus state without making navigation concise.

The canonical artwork now includes the game's colored background presentation. Current card artwork remains approximately 96px and is visually secondary to repeated text and strong rarity decoration. This refinement makes one selected family the content scope and gives the artwork more of the card's useful space.

The existing boundaries remain appropriate: `src/app.js` owns rendering and UI state; `src/inventory-interaction.js` owns raw/pending/error snapshots, grouping, stepping and focus helpers; quantity validation, schema, persistence, routing and verified catalog relationships retain their existing authorities. No new domain model or asset mapping is needed.

## 3. Shared Character Workspace visual system

### Ledger identity

The Character Workspace keeps the existing Ledger visual character:

- dark charcoal background and surfaces;
- warm off-white primary text;
- restrained gray borders;
- red primary actions;
- gold navigation/focus emphasis;
- compact typography with small uppercase or tracked metadata where already established.

### Workspace-level consistency

Overview, Perks, and inventory must share:

- the same header geometry;
- the same workspace navigation row;
- the same horizontal content edges inside the existing global `main` container;
- the same section heading rhythm;
- the same radius and border-weight family;
- the same button and link hierarchy;
- the same focus-visible treatment;
- the same muted/empty/error language patterns.

The global `main` width remains authoritative. The redesign should not create a new narrow content column that causes Overview, Perks, and inventory to align to different left/right edges.

### Surface hierarchy

Use three surface strengths:

1. **Page background** for broad grouping and breathing room.
2. **Section surface** for content that benefits from containment, such as a family section, a contextual notice, or a compact summary block.
3. **Entity card surface** for perks, Items, and Add-ons.

Do not wrap every heading and paragraph in a bordered panel. Spacing, alignment, typography, and subtle separators should do more of the grouping work.

### Inventory rarity versus perk tier

Inventory rarity and perk tier may share broad color families, but they must not share the same component language.

- Perk tier remains expressed through the existing tier/diamond treatment.
- Inventory cards use visible catalog rarity/type text and canonical background artwork. Strong rarity borders and repeated badge decoration are unnecessary.
- Any optional secondary accent remains restrained and inventory-specific; do not reuse `--perk-tier-*` tokens or infer catalog rarity from artwork color.

## 4. Shared character header design

The header is the single identity block for all normal Character Workspace pages.

### Content

The header contains:

- one collection back/breadcrumb link;
- character portrait;
- character name;
- role;
- Owned or Not owned state;
- Favorite or Not favorite state where applicable;
- Prestige as a distinct labeled value;
- Bloodweb as a distinct labeled value;
- one Edit Character action;
- one workspace navigation row.

Owned and Favorite are status presentation in this header, not new autosaving toggles. Editing those fields continues through the existing Edit Character contract.

### Desktop structure

```text
← Survivors

[ 80px portrait ]  MEG THOMAS                         [ Edit Character ]
                   Survivor
                   [Owned] [Favorite]

                   PRESTIGE        BLOODWEB
                   P3              27 / 50

[ Overview ] [ Perks ] [ Items & Add-ons ]
```

The character name is the strongest text element. Role and status badges are secondary. Prestige and Bloodweb are discrete labeled values instead of one dot-separated sentence.

### Narrow structure

```text
← Survivors

[ portrait ]  MEG THOMAS
              Survivor
              [Owned] [Favorite]

PRESTIGE         BLOODWEB
P3               27 / 50

[ Edit Character ]

[ Overview ] [ Perks ]
[ Items & Add-ons      ]
```

The DOM order must remain logical without relying on visual CSS reordering: breadcrumb, identity, status/progress, Edit Character, navigation.

### Navigation

- Preserve the current route names and href generation.
- Use `aria-current="page"` for the active section.
- The active tab receives gold emphasis plus a shape/border state, not color alone.
- Tabs retain practical 44px minimum targets.
- Navigation may wrap naturally at narrow widths.
- Do not duplicate the portrait, character name, back link, Prestige, Bloodweb, or identity block inside page bodies.

## 5. Inventory page architecture

The Survivor inventory is one selected-family workspace. Do not render other verified families beneath it or create navigation from artwork folders.

### Page sequence

```text
Shared Character Header
Items & Add-ons
[ Search selected family........ ] [ In Stock ] [ Filters (n) ]
[ Keys ] [ Firecrackers ] [ Flashlights* ] [ Fog Vials ]
[ Maps ] [ Med-Kits ] [ Toolboxes ]

FLASHLIGHTS
7 Items · 14 Add-ons
Items
[cards]
Add-ons
[cards]

Imported records not in current catalog
[read-only rows, when present]
```

The selected family heading supplies card context. Heading counts are verified catalog totals for that family, not owned quantities or filtered matches; label them accordingly. Changing family replaces this single content region. The unresolved region remains separate and discoverable regardless of the selected family or verified filters.

## 6. Selected-family behavior

### State and default

- Use a simple `selectedFamilyId` in session/page-local UI state, separate from the save document.
- Default to `survivorInventorySource.itemFamilies[0].id`; no hardcoded family name or artwork-directory-derived family.
- Navigation order comes directly from verified `itemFamilies` order. Currently: Keys, Firecrackers, Flashlights, Fog Vials, Maps, Med-Kits, Toolboxes.
- Reset selection when the character/page session key changes. Rerenders and quantity commits retain it. Resolve an invalid selection to the first verified family.
- The interaction snapshot still retains resolved entities' raw/pending/error state across family visits. Changing the selected family must not recreate that snapshot or discard hidden edits.
- Family selection has no durable save, URL, schema-v2 or export representation.

### Navigation control

Use `<nav aria-label="Item families">` with native `button type="button"` controls and exactly one `aria-pressed="true"`. Selection uses shape/border/emphasis as well as color. Maintain visible focus and approximately 44px targets. Do not use tablist/tab/tabpanel roles or imply arrow-key tab behavior; ordinary Tab, Shift+Tab, Enter and Space are sufficient.

After activation, focus remains on the selected family button. Keep a keyboard-focused button visible within the navigation strip without creating page overflow. No jump-to-family control or Family filter is needed.

### Switching with an edit in progress

On the detailed page, resolve the active pending quantity using the existing Task 5 validation/commit path before hiding its family. A valid edit may autosave because the quantity editor was left; selecting a family by itself never changes storage. Invalid input or a save failure blocks the switch, retains the current family/raw value, shows the existing error and focuses the editable quantity field. Do not add a second commit or timestamp through navigation/blur sequencing.

Inside Edit Character, family switches retain draft values, raw invalid text and errors in memory without saving. Errors remain reachable through the page-level summary, including errors outside the selected family. Save Character remains the only persistence boundary. Read-only users may navigate families and open Details while quantity editing stays disabled.

### Catalog-empty Add-ons

When the selected family has no compatible Add-ons in the verified catalog, show its Add-ons subsection with:

> No compatible Add-ons in this catalog.

No empty grid is rendered. In the unfiltered Firecrackers view, show Items followed by this Add-ons line. With Type=Add-ons the truthful catalog-empty line remains available; Type=Items may hide Add-ons. Derive this from catalog truth, never a family-name exception.

### Local no-results state

Keep the selected family heading/navigation present even when filters yield no cards. Show a truthful empty state such as `No matches in Flashlights.`; do not automatically switch families, hide navigation choices or render other families. Distinguish catalog-empty Add-ons from Add-ons excluded by filters. Clearing Search restores the selected family's search scope while any other active filters remain in effect.

## 7. Item/Add-on subsection behavior

Within the selected family:

1. Items subsection
2. Add-ons subsection

Within each subsection:

1. quantity greater than zero;
2. quantity zero;
3. canonical entity order within each stock group.

This is the authoritative presentation order.

Rarity does not change ordering. Search/filtering narrows the list but does not introduce a new sort order.

### Editing stability

The page must preserve the existing rule that cards do not jump while the user is actively editing raw quantity text.

- Typing updates raw/pending state only.
- Invalid raw text remains in the field.
- A card stays in its current rendered position while input is pending or invalid.
- After a successful stable commit, regrouping may move that card between positive and zero groups inside its current family/subsection.
- Focus restoration occurs after regrouping and must target the edited field or a deterministic visible fallback.

### In Stock filter exception for active edits

When In Stock is active, pending or invalid entries in the selected family remain visible until resolved. Deliberate family navigation preserves their interaction state; the page-level error summary keeps hidden-family errors discoverable. In Stock itself must not remove a field while the user is fixing it.

## 8. Inventory card anatomy

Cards are artwork-led, with predictable geometry and concise metadata. Quantity remains their primary interaction; Details stays secondary.

```text
┌──────────────────────────────┐
│                              │
│       [ large game art ]     │
│                              │
│ Broken Key                   │
│ Common · Item                │
│ QUANTITY                     │
│ [ - ] [      0      ] [ + ]   │
│ pending/error status         │
│                    Details   │
└──────────────────────────────┘

Add-on example: Blood Amber / Ultra Rare · Add-on
```

### Artwork

- Use the canonical verified background artwork from the approved asset baseline. Do not replace/reclassify assets in this refinement.
- Determine sizing from the existing card/container geometry. Normal desktop cards should move materially beyond the current 96px thumbnail toward the upper end of roughly 96–128px, where space permits.
- Use a predictable media area and `object-fit: contain`; display the complete icon square without cropping. Scale gracefully on narrow cards.
- Let the artwork earn its space; do not enlarge cards solely through empty vertical padding.
- Preserve the non-blocking missing/broken-art fallback. Artwork remains decorative with empty alt text when the nearby name identifies the entity.

### Metadata and geometry

- Show the entity name and visible catalog rarity plus kind: `Common · Item`, `Very Rare · Add-on`, `Event · Item`.
- Do not prominently repeat the selected family's name on every card; retain family context in Details.
- Use a practical minimum card width around 220px with container-driven `auto-fit/minmax` sizing and one usable column where space is limited.
- Positive and zero stock retain identical geometry and readable content. Crossing zero must not change card dimensions.
- Preserve the existing labeled text input, +/- controls, dedicated pending/error region and explicit Details button. The entire card is not clickable.

## 9. Quantity interaction design

Quantity behavior is a settled domain contract. The redesign may restyle or wrap it but must not redefine it.

### Required behavior

Preserve:

- direct numeric typing;
- a text-style input that can retain invalid raw text;
- non-negative whole safe integers only;
- `Number.MAX_SAFE_INTEGER` as the upper bound;
- Enter/blur commit on the detailed inventory page;
- sparse positive persistence;
- quantity zero canonicalizing away from the stored sparse map;
- failed raw input retention;
- detailed-page autosave semantics;
- draft-only quantity behavior inside comprehensive Edit Character;
- no persistence before Save Character in Edit Character;
- read-only unresolved imported IDs.

### Completed Task 5 compact stepper

The completed control, preserved by this refinement, is:

```text
[-] [ editable numeric field ] [+]
```

Task 5 is complete; all of the following remain required regression contracts:

- direct typing remains first-class;
- decrement is disabled at zero;
- increment is disabled at `Number.MAX_SAFE_INTEGER`;
- +/- never overwrites or normalizes invalid raw text;
- button activation cannot create a duplicate commit through the field's blur event;
- the same validation path is used as typed input;
- focus remains deterministic after a successful change;
- practical targets are about 44px.

Preserve the completed composite-control rule: focus moving between the field and its same-entity step buttons defers blur; activation consumes the pending raw value and commits once; leaving the composite commits normally. Clear consumed pending blur state. Enter/Space and pointer activation retain their tested behavior. Do not remove +/- or reopen its optional status during this refinement.

### Labeling

The visible card may use a compact `QUANTITY` label. The control's accessible name must still identify the entity, for example `Quantity of Sport Flashlight`.

### Read-only mode

If writer access is unavailable, quantity controls follow the existing editor-disable contract. Details remains usable because reference reading is not a write operation.

## 10. Rarity system

Catalog rarity remains authoritative. The game's colored background artwork is supplemental and may differ from the project's retained presentation bucket; never derive rarity, filter membership, order or compatibility from its color.

### Treatment

Every card retains visible text such as `Rare · Add-on` or `Event · Item`. Simplify the current badges/strong colored card border; prefer a neutral card surface with the artwork providing the visual signal. A restrained secondary accent is optional, not required. Do not introduce another saturated artwork backing or full-card rarity treatment.

Text contrast remains readable; color is never the only indicator. Any remaining inventory accent tokens/geometry stay distinct from Perks tier styling, which is unchanged.

### Qualified Banquet metadata

- Displayed rarity remains Event, including cards whose game artwork uses another background color.
- Event controls filter membership and visible text.
- Underlying-rarity qualifications appear only in Details when supported by verified runtime metadata.
- No artwork refresh or UI refinement changes catalog rarity or uses underlying rarity to order/filter cards.

## 11. Details and progressive disclosure

Remove persistent `Reference and compatibility` disclosure blocks from every card.

Each card gets one explicit Details button.

### Interaction model

Use the application's existing bounded dialog pattern where practical.

The dialog can display only metadata already supported by the runtime catalog, including:

- entity name and artwork;
- displayed rarity;
- family;
- full effect summary;
- exact compatible Item names for Add-ons;
- qualification/verification notes;
- source/provenance links;
- additional verified metadata already present in the adapted entity.

Do not invent lore, compatibility, effect interpretation, rarity, or unverified classification.

### Dialog behavior

- Opening Details does not require writer access.
- Details itself does not commit, normalize or clear quantity text. Moving focus from an active quantity into the dialog still follows Task 5's ordinary blur validation/commit rule once; no separate Details write is introduced, and invalid raw text remains intact.
- The quantity field is not moved into the dialog.
- Escape/close follows the existing dialog convention.
- Closing restores focus to the exact originating Details control when it still exists.
- If filtering or navigation removes the origin, restore to the nearest deterministic page-level control.
- External provenance links remain explicit and safe (`noopener noreferrer` behavior preserved).

## 12. Unknown imported record handling

Unknown imported inventory IDs remain durable data but are not promoted into verified families.

Render a final dedicated section:

> Imported records not in current catalog

Each row should show only known facts, such as:

- raw inventory ID;
- saved map/type if known from the stored namespace;
- saved positive quantity.

The region is:

- read-only;
- visually separate from verified family content;
- outside rarity/family claims;
- visible whenever unresolved records exist;
- displayed after selected-family content and unaffected by family selection or verified search/filter restrictions.

Do not silently discard, rename, infer family/rarity, or make unknown IDs editable.

Secondary verified filters do not assign metadata to unresolved records. The unresolved region remains discoverable even when verified catalog filters are active.

## 13. Search, filter, and family navigation behavior

Search and In Stock are directly visible; Type/Rarity remain in a compact Filters disclosure with active-count summary. Place the family switcher below these controls. Family is navigation and must not reappear inside Filters.

### Selected-family Search

Search is case-insensitive over verified entity name and effect text, only within `selectedFamilyId`. Use a label/nearby scope cue that makes the selected-family scope clear. Never render all-family search results or change selection because another family matches.

Retain Search text, In Stock, Type and Rarity when changing family. This makes the rule consistent across controls; a new family can truthfully have no results. Clearing Search restores that family's search scope, without clearing other filters. A future global-search feature is outside this revision.

### Filters and ordering

- In Stock passes positive baseline quantities and the existing pending/error exception in the selected family.
- Type: All / Items / Add-ons; Rarity: All / one verified catalog rarity.
- Neither filtering nor Search hides family navigation buttons or changes their canonical order.
- Render Items before Add-ons; inside each subsection preserve positive → zero → canonical order. Rarity never controls order.
- Selection/filter/search state is UI-only and never written into schema v2.
- The unresolved-import region stays visible when records exist, independently of these verified scopes.

### Sticky behavior

Keep the toolbar non-sticky. No sticky controls or global search are part of this refinement.

## 14. Overview composition

Overview becomes a compact character dashboard, not a stack of prettier full-width boxes.

### Desktop composition

```text
Shared Character Header

┌──────────────────────────────┬──────────────────────────┐
│ Native Perks                 │ Progress / setup         │
│ [perk] [perk] [perk]         │ setup notice/status      │
│                              │ supporting context       │
├──────────────────────────────┼──────────────────────────┤
│ Perks summary                │ Items & Add-ons summary  │
│ tracked / Tier III           │ recorded stock / status  │
└──────────────────────────────┴──────────────────────────┘

Notes
──────────────────────────────────────────────────────────
Saved notes text...
```

The exact grid can use one broad top row and one summary row, but sections should align by meaning rather than force all blocks to equal height.

### Native Perks

Show the character's verified native perks using compact image-led entities.

Each native perk includes:

- perk artwork;
- perk name;
- effective tier badge;
- concise provenance/personal-record text near the perk.

Do not spread name, tier, and provenance across a wide table row.

A practical desktop presentation is a three-card grid because native perk count is three in the current catalog model. The implementation should still be data-driven rather than hardcode three children.

### Progress / setup context

Edit Character is not repeated here because it lives in the shared header.

For owned characters:

- setup incomplete: show a compact contextual notice with Start initial setup;
- setup complete: offer Review initial setup as a quieter action/status.

For unowned characters, do not imply setup is required.

The explanatory distinction between personal records and Native/Prestige/Shrine/Legacy automatic minima may remain as subdued helper text where useful, but it should not dominate the page.

### Perks summary

Use existing trustworthy character stats only, such as:

- effective tracked/owned perk count;
- Tier III count;
- existing route to Perks.

Do not add a completion percentage or denominator unless already defined by existing domain semantics.

### Items & Add-ons summary

For Survivors with the verified catalog:

- state the current verified catalog context concisely;
- show the number of recorded positive stock entries when there are any;
- if none exist, use `No quantities recorded yet.`;
- if unresolved imported records exist, show a separate unresolved count/message;
- link to Items & Add-ons.

Do not say `No stock` merely because the sparse quantity maps are empty.

For Killers while data remains deferred:

- keep the truthful unavailable messaging;
- do not infer Power/Add-on coverage;
- do not start P3.5.

### Notes

Notes use a full-width quiet section after the summary composition.

- Preserve whitespace and wrapping.
- Empty text may show `No notes recorded.`.
- Notes remain edited through Edit Character, not inline Overview editing.

## 15. Perks limited refinements

The Perks page is not a redesign target beyond workspace consistency.

### Preserve

Preserve:

- the existing perk card grid;
- card-size preference and legacy fallback behavior;
- effective-inventory selection;
- Update Inventory route and candidate logic;
- category/scoping logic;
- Only unrecorded behavior;
- selected editor behavior;
- quick picker behavior;
- tier distinctions;
- historical controls;
- account/provenance semantics;
- autosave behavior in the detailed reconciliation workspace;
- compatibility routes.

### Change

On the normal Perks page:

- remove the duplicate back link, portrait, character title, and page-level identity block because the shared header supplies them;
- use a simple `Perks` page heading/introduction;
- keep one clear Update Inventory action;
- consolidate the existing explanatory paragraph and helper link into one concise reconciliation message;
- retain count/status information that is actually useful for the character;
- keep the card-size control without letting it compete with the primary Update Inventory action.

The Update Inventory task route may keep a task-specific heading because it is a focused workflow rather than a normal workspace section, but it must not create a second full character identity header.

## 16. Responsive layouts

Required design widths:

- 320px;
- 500px;
- 760px;
- 1100px;
- 1440px;
- 1600px.

### Inventory grid

Use container-driven card sizing around a practical 220px minimum.

- At 320px, use one usable inventory card column.
- At 500px, one or two columns are acceptable only if quantity controls and names remain comfortably usable.
- At 760px and above, let the grid naturally add columns according to available section width.
- Do not hardcode a fixed number of columns solely by viewport breakpoint.

### Overview

- Desktop can use two columns for meaningful paired sections.
- Narrow layouts stack in semantic DOM order: Native Perks, Progress/setup, Perks summary, Inventory/Power summary, Notes.
- Native perk mini-cards may wrap from multiple columns to one column without truncating names/provenance.

### Toolbar

- Search should take the largest share of horizontal space.
- In Stock remains directly reachable.
- Filters can wrap to another row.
- Desktop family buttons may wrap as one compact navigation area; at 760px controls/navigation may wrap without forcing narrow cards.
- At 500px and 320px use a single-row horizontally scrollable family strip with full-size native controls. Its internal scroll is acceptable; page-level horizontal overflow is not.
- Keep selected/focused family buttons visible within the strip, with usable pointer/touch scrolling and a visible scroll affordance. Do not default to a dropdown or seven undersized controls.
- No horizontal page scroll is acceptable at the required widths.

### 200% zoom

The owner has already accepted the current application at genuine browser 200% zoom. The redesign must preserve that usability. Implementation verification must repeat actual browser zoom testing because new family headers, toolbars, and cards materially change density.

## 17. Accessibility requirements

The implementation must preserve or improve:

- one logical `h1` for the character identity/page context;
- semantic descending section headings;
- native buttons, inputs, checkboxes, selects, and details/dialog primitives where appropriate;
- `aria-current` for workspace navigation;
- a labeled Item families navigation with one native `aria-pressed="true"` button;
- accessible names for quantity inputs and the completed +/- buttons;
- visible `:focus-visible` treatment using the Ledger gold focus language;
- non-color-only rarity, stock, error, and selected states;
- practical 44px interaction targets;
- error text associated with the relevant quantity input;
- keyboard reachability for Details, family controls, filters, and all quantity controls;
- deterministic focus restoration after dialog close, save/regroup, error navigation, and deliberate selected-family changes;
- no focus hidden under a future sticky toolbar, which is one reason stickiness is deferred.

Decorative artwork stays excluded from the accessibility tree when the adjacent text already names the entity.

## 18. Focus and keyboard behavior

### Family controls

- Use native Tab/Shift+Tab navigation and Enter/Space activation. Keep focus on the activated selected-family button and scroll it into the navigation strip's visible area.
- Do not introduce tab roles without the full expected keyboard model; the initial model is native buttons in a labeled nav.
- Detailed-page switching resolves the active pending quantity once before replacing content; invalid/save-failed edits block switching and focus their retained field.
- Edit Character switching retains hidden raw draft state without autosaving. Read-only navigation remains available.

### Search

- Existing search keyboard behavior remains conventional.
- Search re-rendering must preserve the search field value and focus when input-driven rendering occurs.

### Quantity commit

Preserve the existing focus contract:

- Enter validates/commits and returns focus deterministically.
- Blur validates/commits without hijacking a legitimate next focus target.
- After regrouping, restore to the edited quantity field when still visible.
- If it is hidden by active filters, use the next deterministic visible destination or search control.
- Ordinary regroup/fallback stays within the selected family; if its last visible card disappears, focus Search. Explicit error/validation navigation first selects the target family, then renders and focuses the quantity field.

### Error summary

Keep the existing page-level error summary outside the selected-family region. It includes known errors across the interaction snapshot, including hidden-family draft errors.

Selecting an error:

1. clears only the minimum presentation filters needed to reveal the bad field when required by existing behavior;
2. selects the verified family containing the error;
3. scrolls/focuses the quantity input;
4. preserves the raw invalid text.

This explicit correction action may select an error's family even when another retained invalid field exists; it preserves all raw/error state and never treats navigation as an invalid-value commit. The ordinary family-button switch guard must not make cross-family errors unreachable.

### Details dialog

- Opening stores the exact opener.
- Closing restores to that opener when possible.
- Reading Details never requires writer access.

## 19. Error, pending, and save-state presentation

### Detailed inventory page

Each quantity card has a small dedicated status region that does not change card height unpredictably.

States:

- idle: no status text or reserved quiet space;
- pending raw edit: `Pending change` or equivalent concise copy;
- invalid: visible error text and `aria-invalid` association;
- successful commit: global/page save confirmation may be used; do not permanently stamp every card `Saved`.

The current global save status remains authoritative for application-level writer/storage health.

### Edit Character draft

Inside Edit Character inventory:

- quantity changes remain draft-only;
- card status should say `Unsaved draft` or equivalent instead of implying autosave;
- Save Character remains the only persistence boundary for the comprehensive edit session;
- conflict and validation behavior remains unchanged.

### Storage/writer failures

- Existing read-only writer messaging remains authoritative.
- Storage failure never visually pretends a quantity committed.
- Failed save keeps the attempted state according to the existing interaction contract and shows the existing recovery-oriented error path.

## 20. Interaction state transitions

### Inventory quantity

```text
Idle
  -> type raw value
Pending
  -> valid Enter/blur
Commit attempt
  -> success
Regroup within family/subsection
Idle at persisted value

Pending
  -> invalid Enter/blur
Invalid
  -> raw text retained
  -> edit again
Pending
```

The completed +/- buttons enter the same validation/commit path and are unavailable while raw text is invalid.

### Family selection

```text
First verified family (session entry)
  -> activate another verified family button
Resolve active detailed edit once
  -> invalid/save failure: retain family and raw field, focus error
  -> success/no pending edit: replace selected-family content
Retain Search / In Stock / Type / Rarity
  -> matching selected-family cards or truthful local empty state

Edit Character family change
  -> preserve raw draft/errors in memory; no persistence
Explicit error-summary action
  -> select target family, minimally reveal field, render/focus
```

### Details

```text
Card Details button
  -> bounded dialog opens
  -> read/reference only
Close/Escape
  -> focus restored to opener
```

### Search/filter

```text
Selected family's verified entries
  -> Search / In Stock / Type / Rarity
Narrowed selected-family subsection/card set
  -> clear Search
Selected family's entries under remaining active filters
```

No presentation transition writes to schema v2. Only an existing quantity commit or Save Character writes durable data; navigation itself does not.

## 21. Data/model boundaries

### Presentation-only state

The following are presentation-only and must not enter the save document:

- selectedFamilyId and the family strip scroll position;
- search query;
- In Stock filter;
- Type/Rarity filters;
- Details dialog open state;
- visual rarity tokens/classes.

### Existing durable state that remains unchanged

- character Owned/Favorite/Prestige/Bloodweb/Notes;
- personal perk tiers, including historical zero semantics;
- account unlock semantics;
- schema-v2 `inventory.items` and `inventory.addons` sparse quantity maps;
- unknown imported inventory IDs;
- Prestige Queue;
- character/account timestamps under existing save rules.

### Catalog authority

Inventory family, rarity, compatibility, effect, provenance, and canonical entity order come from the verified runtime catalog adapter.

Do not infer:

- family from item names;
- subfamily from effects;
- rarity from color/artwork;
- compatible Items beyond `compatibleItemIds`;
- Killer data while registry status is unavailable.

## 22. Implementation impact

This section identifies likely implementation areas without constituting an implementation plan.

### `src/app.js`

Task 5A presentation changes and preserved boundaries:

- retain the completed `characterWorkspaceHeader()` and `characterOverview()` without redesign;
- leave the approved limited `characterInventory()` Perks intro cleanup to Task 6;
- refine the existing `stockView()` renderer to one selected-family content region and artwork-led cards;
- preserve the existing bounded Details-dialog rendering/action wiring;
- replace accordion-only presentation state/actions with session-local selectedFamilyId and native family navigation;
- adapt stock filter controls;
- preserve existing stock input, commit, error, and focus behavior.

The implementation should consider extracting view helpers if `src/app.js` becomes harder to reason about, but unrelated refactoring is out of scope.

### `src/inventory-interaction.js`

Task 1 already supplies family grouping and stepping helpers; Task 5 already adapts focus to rendered family/subsection order. Reuse these and restrict visibility/focus candidates to the selected family without changing their raw/pending/error or persistence contracts.

Reuse the completed pure presentation selector/helper that:

- groups visible resolved entities by verified family;
- separates Items and Add-ons;
- applies positive/zero/canonical ordering inside each subsection;
- preserves pending/error visibility and stable-edit behavior.

Do not make the save layer family-aware.

### `data/inventory-catalog.js`

No schema/domain change is required. Existing adapted fields already provide the required basis: `familyId`, `rarity`, `compatibleItemIds`, `effect`, `provenance`, canonical `order`, and verified source metadata.

### `styles.css`

Task 5A additions/refinements (existing header/Overview styles remain unchanged):

- selected-family navigation/section and subsection styling;
- responsive inventory card grid;
- larger inventory artwork area;
- simpler visible rarity/type metadata and reduced redundant rarity decoration;
- compact quantity-control layout;
- zero-stock visual quieting;
- Details action/dialog content styling;
- responsive/focus/error states.

Do not alter the global shell unless a Character Workspace selector currently leaks and must be scoped.

### Files expected to remain semantically unchanged

- `src/character-workspace.js` routing contract;
- `src/model.js` progression rules;
- `src/storage.js` persistence/recovery contract;
- `src/inventory-quantities.js` quantity validation/canonicalization contract;
- `src/prestige-queue.js`;
- Dashboard selectors and behavior;
- Killer registry status until P3.5 resumes.

## 23. Test impact

Implementation must use disposable/synthetic browser state and must not access the owner's active save.

### Pure/domain tests

Add or update focused tests for:

- family grouping uses verified family order;
- Items precede Add-ons inside each family;
- positive precedes zero inside each subsection;
- canonical order is preserved inside each stock group;
- pending/error entries remain visible under In Stock when needed;
- no persistence semantics change in quantity parsing/canonicalization;
- Banquet Event display/filter rarity remains Event;
- unresolved IDs remain outside resolved family grouping.

Likely suites include `tests/inventory-interaction.test.js`, `tests/inventory-catalog.test.js`, and any new pure presentation helper tests.

### Browser tests

Update or extend:

- `tests/browser/character-workspace.mjs` for the shared header and route-local navigation;
- `tests/browser/inventory.mjs` for exactly one family, canonical native-button navigation, selected-family search/filters, local empty states, image prominence, concise rarity/type text, zero stock, error-directed selection, Details, unresolved records and focus;
- `tests/browser/character-inventory.mjs` only where the shared header/Perks intro changes selectors or expected structure;
- `tests/browser/character-edit.mjs` to ensure draft quantity semantics remain intact;
- artwork/portrait coverage where selectors change.

### Responsive verification

Verify at:

- 320;
- 500;
- 760;
- 1100;
- 1440;
- 1600.

Check:

- no horizontal page overflow;
- quantity controls remain usable;
- desktop navigation/toolbars wrap cleanly; the 500px/320px family strip scrolls internally while selected/focused controls remain visible;
- Overview stacks in correct order;
- dialog remains inside viewport;
- active focus is visible.

### Release verification

After eventual implementation, rerun the established automated release/regression path and direct-file/browser checks. Genuine browser 200% zoom must be manually rechecked because this redesign materially changes layout density.

This design-spec commit itself does not require production runtime verification because it changes documentation only.

## 24. Risks and edge cases

### Family switch with a pending edit

Hiding the active field before its blur path resolves can lose raw input or commit twice. Preserve Task 5 composite-control handling; gate detailed family switching on its single existing commit result. Invalid/save-failed edits keep the current family. Draft switching never persists and retains hidden raw/errors.

### Search retained across family visits

Retained Search may produce a local empty view in a new family. Scope the Search label clearly, keep navigation/heading visible, and allow clearing Search without silently switching family or clearing other filters.

### Narrow family-strip focus

Horizontal navigation can conceal focused buttons or widen the page. Keep the strip a bounded scroll container with full-size controls, native keyboard access and visible focus; verify 320px and genuine zoom.

### Quantity blur plus +/- click

A stepper can accidentally commit twice if blur fires before button handling. Task 5 already has the tested single-commit path. Family navigation and new card markup must preserve it, including pending typed values and pointer/Enter/Space activation.

### Invalid raw value plus stepper

Never coerce invalid text just because +/- was pressed. Disable or ignore step actions while raw text is invalid.

### Focus after card regroup

A successful zero-to-positive or positive-to-zero save can move the card. Ordinary commits retain the selected family and restore its edited input or a deterministic visible same-family fallback after render. Explicit error navigation selects the target family before focus.

### In Stock filter plus zero commit

Committing zero while In Stock is active can make the card no longer qualify. Focus logic must move to a deterministic visible destination rather than disappear into the document.

### Firecracker empty Add-ons

Use catalog-derived emptiness, not family-name branching, so the behavior remains correct if the source changes.

### Rarity color collision with perk tiers

Keep visible catalog rarity/type text; background artwork is supplemental and any optional accent remains inventory-specific. Do not reuse tier badge classes.

### Event/qualified rarity

Do not let optional underlying-rarity metadata leak into Event presentation, filters, or ordering.

### Unknown imported records

Unknown IDs lack verified family/rarity/compatibility metadata. Keep them separate and read-only instead of forcing them into the new visual system.

### Unowned characters

The shared header can display Not owned without implying the user must run setup. Existing route availability remains unchanged.

### Killer workspace

Shared header and Overview polish may apply to Killers, but Power/Add-ons must remain a truthful unavailable surface until verified production data exists.

### Large names and translated/future content

Use wrapping and flexible card/header layouts. Do not size cards around current English names only.

### 200% zoom and short viewports

Toolbar stickiness, oversized artwork, and dialogs can consume too much vertical space. Keep stickiness out of the first batch, use bounded media sizing, and test the real zoomed browser.

## 25. Acceptance criteria

The visual redesign is ready for owner acceptance when all of the following are true.

### Shared workspace

- Overview, Perks, and inventory use one shared character identity/header.
- Portrait, name, role, Owned/Favorite state, Prestige, Bloodweb, Edit Character, and workspace navigation are present without duplicate body identity blocks.
- Routes and compatibility routes are unchanged.

### Inventory structure

- Exactly one verified family is rendered, with a selected heading and catalog-total counts.
- All verified family choices remain in canonical order; default is the first catalog family, with one native aria-pressed selection.
- No per-family accordion controls/state or multi-family vertical document remains.
- Items precede Add-ons; positive precedes zero and canonical order is retained within each subgroup.
- Search/filters scope only the selected family, retain values across family visits and leave navigation present on no results.
- Catalog-empty Add-ons show the truthful line without an empty grid.
- Unresolved imports remain separate, read-only and discoverable under any family/filter selection.

### Inventory cards

- Canonical background artwork is prominent and materially larger than the current 96px desktop thumbnail where geometry permits, approximately 96–128px with normal cards toward the upper end.
- Media is predictable, uncropped and contain-scaled; extra empty padding does not substitute for image prominence.
- Quantity remains the primary interaction; positive/zero cards retain the same geometry.
- Visible catalog rarity/kind text remains; prominent repeated family labels and strong rarity borders are reduced.
- Banquet remains Event regardless of its artwork color or qualified underlying rarity.
- Details stays bounded, keyboard accessible, read-only and restores focus or Search if its opener is absent.

### Quantity semantics

- Direct raw numeric typing works.
- Invalid raw text is retained.
- Non-negative safe integer validation is unchanged.
- Enter/blur detailed-page commit semantics are unchanged.
- Zero sparse canonicalization is unchanged.
- Cards do not reorder during active raw editing.
- Regroup occurs only after successful stable commit.
- Edit Character remains draft-only until Save Character.
- Unresolved imported IDs remain read-only.
- Completed Task 5 +/- controls and writer/boundary/invalid disabling remain intact, with no duplicate commit.
- Family switches preserve active edit resolution, hidden draft state and deterministic focus as specified in section 6.

### Toolbar and filtering

- Search and In Stock are directly visible.
- Secondary Type/Rarity filtering is compactly disclosed and scoped to the selected family; Family is never added to this disclosure.
- No required sticky toolbar is introduced.
- No filter state is persisted into schema v2.

### Overview

- Overview reads as a compact dashboard rather than a stack of equally heavy full-width panels.
- Native perks use artwork, names, effective tiers, and nearby provenance.
- Setup context is concise and truthful.
- Perks summary uses existing stats only.
- Survivor inventory summary says `No quantities recorded yet` when appropriate rather than claiming no stock.
- Unresolved stock is distinguishable.
- Killer Power/Add-ons remains truthfully unavailable.
- Notes are preserved and readable.

### Perks

- Existing Perks grid and behavior remain intact.
- Duplicate character identity content is removed.
- Update Inventory remains primary and route semantics stay unchanged.
- Reconciliation helper copy is consolidated without deleting required meaning.

### Accessibility and responsive behavior

- Semantic headings and native controls are preserved/improved.
- Focus is visibly rendered and deterministically restored.
- Rarity/status are not color-only.
- Quantity controls have entity-specific accessible labels.
- Practical interaction targets remain about 44px.
- Layout is usable at 320, 500, 760, 1100, 1440, and 1600.
- No page-level horizontal overflow appears at those targets; the bounded family strip may scroll horizontally at 500/320px.
- Genuine browser 200% zoom remains usable.

### Data boundaries

- Schema remains v2.
- No migration is added.
- No save identity changes.
- No Prestige Queue changes.
- No Dashboard redesign.
- No P3.5 work.
- No owner's active save is accessed during implementation or verification.

## Wireframes

### Desktop Inventory

```text
[Shared character header / workspace navigation]
Items & Add-ons
[ Search selected family................ ] [ In Stock ] [ Filters (1) ]
[ Keys ] [ Firecrackers ] [ Flashlights* ] [ Fog Vials ] [ Maps ]
[ Med-Kits ] [ Toolboxes ]

FLASHLIGHTS
7 Items · 14 Add-ons (catalog totals)
Items
┌─────────────────────┐ ┌─────────────────────┐
│   [large game art]  │ │   [large game art]  │
│ Sport Flashlight    │ │ Utility Flashlight  │
│ Rare · Item         │ │ Very Rare · Item    │
│ QUANTITY            │ │ QUANTITY            │
│ [-] [ 3 ] [+]       │ │ [-] [ 0 ] [+]       │
│             Details │ │             Details │
└─────────────────────┘ └─────────────────────┘
Add-ons
[Flashlight Add-on cards]

Imported records not in current catalog
raw-id                       Quantity 2   Read-only

* selected button has shape/border state plus aria-pressed=true
Selecting Med-Kits replaces this content; no other family follows it.
```

### Narrow/mobile Inventory

```text
[Shared character header]
Items & Add-ons
[ Search selected family..... ]
[ In Stock ] [ Filters (1) ]
┌ bounded horizontal scroll strip ┐
│ [Keys*] [Firecrackers] [Flash…] →│
└────────────────────────────────┘
KEYS
3 Items · 5 Add-ons (catalog totals)
Items
┌──────────────────────────────┐
│       [large game art]       │
│ Broken Key                   │
│ Common · Item                │
│ QUANTITY                     │
│ [ - ] [      0      ] [ + ]   │
│                    Details   │
└──────────────────────────────┘
Add-ons
[one-column Key Add-on cards]
[Unresolved imported records, if present]
```

### Desktop Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Shared character header + workspace navigation                             │
└─────────────────────────────────────────────────────────────────────────────┘

Overview

┌───────────────────────────────────┬───────────────────────────────────────┐
│ Native Perks                      │ Progress / setup                      │
│                                   │                                       │
│ [art] Quick & Quiet  [III]        │ Setup complete                        │
│       personal/provenance         │ [Review initial setup]                │
│                                   │                                       │
│ [art] Sprint Burst   [II]         │ Personal records and automatic        │
│       personal/provenance         │ minimums remain distinct.             │
│                                   │                                       │
│ [art] Adrenaline      [I]         │                                       │
│       personal/provenance         │                                       │
├───────────────────────────────────┼───────────────────────────────────────┤
│ Perks                             │ Items & Add-ons                       │
│ 42 effective owned               │ 7 stocked entries recorded            │
│ 21 Tier III                      │ Survivor inventory 10.x                │
│ [View Perks]                     │ [View Items & Add-ons]                 │
└───────────────────────────────────┴───────────────────────────────────────┘

Notes
──────────────────────────────────────────────────────────────────────────────
Saved character notes appear here without another heavy panel.
```

### Narrow/mobile Overview

```text
[Shared character header]

Overview

Native Perks
[perk mini-card]
[perk mini-card]
[perk mini-card]

Progress / setup
[compact contextual notice]

Perks
42 effective owned · 21 Tier III
[View Perks]

Items & Add-ons
No quantities recorded yet.
[View Items & Add-ons]

Notes
Saved notes text...
```

### Shared character header

```text
DESKTOP
← collection
[portrait] NAME                     [ Edit Character ]
           Role
           [Owned] [Favorite]
           PRESTIGE P#   BLOODWEB ## / 50
[ Overview ] [ Perks ] [ Inventory/Power ]

NARROW
← collection
[portrait] NAME
           Role
           [Owned] [Favorite]
PRESTIGE P#      BLOODWEB ## / 50
[ Edit Character ]
[ Overview ] [ Perks ]
[ Inventory/Power ]
```

### Inventory card

```text
┌──────────────────────────────┐
│       large game artwork     │
│                              │
│ Entity Name                  │
│ Catalog rarity · Item/Add-on │
│                              │
│ QUANTITY                     │
│ [ - ] [ raw text field ] [ + ]
│ pending/error status         │
│                              │
│                    Details   │
└──────────────────────────────┘
```

## Presentation-only versus unchanged behavior

### Presentation-only changes

- header layout and badges;
- Overview composition;
- one selected-family content region;
- native family-switcher navigation and session-local selection;
- family-local rendering order;
- inventory card visual hierarchy;
- rarity visual tokens;
- Details progressive disclosure;
- toolbar layout and disclosure;
- zero-stock muting;
- responsive layout;
- explanatory copy consolidation.

### Existing behavior that must remain unchanged

- schema v2 and save shape;
- canonical and compatibility routes;
- effective perk inventory semantics;
- perk candidate/reconciliation logic;
- account/native/historical tier rules;
- quantity validation and sparse persistence;
- raw invalid quantity retention;
- detailed Enter/blur commit behavior;
- Edit Character single-draft/single-save contract;
- writer lock/read-only behavior;
- error/save failure semantics;
- unknown imported ID preservation;
- import/export/backup/recovery behavior;
- Prestige Queue behavior;
- Killer data deferral.

## Self-review

### Scope and authority

Tasks 1–5 and the 92-entity artwork mapping remain completed history. This revision specifies Task 5A's presentation change only; Overview/Perks keep their approved direction and Task 6 remains paused. No production code was changed by this document.

### Internal consistency

Selected-family state, strip scrolling and search/filters remain presentation-only. One family supplies both Item and Add-on context; search never creates an all-family document. Catalog rarity stays authoritative; artwork color is supplemental, including Banquet. Existing schema, routes, persistence, quantity and draft boundaries are unchanged.

### Explicit rulings

- Default/reset uses the first catalog family and the current character/page session key.
- Search, In Stock, Type and Rarity retain their values across family changes; no-result states remain local.
- Detailed switching resolves an active quantity once, blocking on invalid input or save failure; draft switching preserves raw state without persistence.
- Explicit error navigation selects the target family and clears only the filters needed to reveal its field.
- Native buttons in a labeled nav provide ordinary keyboard behavior; narrow strips scroll internally with full-size controls.
- Existing canonical artwork is enlarged based on card geometry; catalog rarity/type text remains while strong duplicate decoration and repeated family metadata are reduced.
- Unknown IDs remain outside family classification and visible when present.
- No global search, dropdown fallback, sticky toolbar, new artwork mapping or new runtime family is introduced.

No contradiction remains between selected-family scope and Task 5's quantity contract. Owner review of this revised checkpoint is required before implementation.

No material design question blocks implementation planning after owner approval.
