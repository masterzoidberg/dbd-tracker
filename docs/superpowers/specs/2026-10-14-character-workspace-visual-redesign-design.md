# Character Workspace Visual Redesign Design

Status: DRAFT FOR OWNER REVIEW  
Date: 2026-10-14  
Scope: Character Workspace presentation and interaction design only. No production code, routes, schema, persistence semantics, Dashboard behavior, queue behavior, or Killer inventory data are changed by this document.

## Decision summary

The Character Workspace remains one routed character experience with shared identity, shared navigation, and the existing persistence model. The redesign changes presentation, grouping, and visual hierarchy while preserving all settled data and editing behavior.

The approved direction is:

- Use one shared character header across Overview, Perks, and Items & Add-ons or Power & Add-ons.
- Keep the Perks card grid and its effective-inventory behavior as the visual benchmark rather than redesigning it for novelty.
- Make Survivor inventory family-first: family, then Items, then Add-ons.
- Within each Items or Add-ons subsection, order positive stock first, zero stock second, then canonical catalog order inside each stock group.
- Keep zero stock visible and editable by default.
- Make quantity the primary inventory-card interaction.
- Replace repeated card-level reference prose with a compact Details action and bounded dialog.
- Use verified rarity as a restrained visual accent with an always-visible text label.
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
- require +/- quantity buttons if they cannot be added without preserving raw input, commit, and focus semantics.

## 2. Current-state problem statement

The current Character Workspace is functionally correct but visually uneven.

The shared workspace header is structurally minimal. It compresses role, ownership, favorite state, Prestige, and Bloodweb into one sentence and does not yet give Edit Character a consistent workspace-level position. Overview presents most content as consecutive full-width bordered panels. Inventory presents all visible entities in one grid and repeats the same structural prose on every card: name, rarity/family text, a full quantity label, input, pending/error line, and a persistent Reference and compatibility disclosure. This creates a long, repetitive surface even though the underlying data already has meaningful family relationships.

The Perks page is the strongest internal reference because its cards use recognizable artwork, predictable rhythm, concise metadata, and a consistent grid. The redesign should reuse those principles without conflating perk tier styling with inventory rarity styling.

The existing code already has the right underlying boundaries:

- `src/character-workspace.js` owns canonical workspace route interpretation.
- `src/app.js` owns the current shared header, Overview, Perks, stock view, detail dialogs, and event wiring.
- `src/inventory-interaction.js` preserves raw quantity text, pending/error state, visible-entry filtering, regrouping, and focus destination logic.
- `src/inventory-quantities.js` validates non-negative whole safe integers and sparse positive persistence.
- `data/inventory-catalog.js` exposes verified `familyId`, `rarity`, compatibility, effect, provenance, and canonical entity order.
- `styles.css` already defines the Ledger shell, focus treatment, perk-card language, workspace selectors, and stock-card selectors.

The redesign should therefore reshape presentation around existing truth rather than add a new domain model.

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
- Inventory rarity uses a small text badge plus a thin card/accent treatment.
- Define inventory-specific tokens such as `--inventory-rarity-common`, `--inventory-rarity-uncommon`, and so on rather than reusing `--perk-tier-*` tokens.

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

The Survivor Items & Add-ons page becomes a family-first document rather than a flat stock grid.

### Page sequence

```text
Shared Character Header

Items & Add-ons
Short page-purpose line

[ Search................ ] [ In Stock ] [ Filters (n) ] [ Jump to family ]
[ Collapse all ] [ Expand all ]

FLASHLIGHTS
  Items
    [cards]
  Add-ons
    [cards]

MED-KITS
  Items
    [cards]
  Add-ons
    [cards]

...

Imported records not in current catalog
  [read-only rows]
```

The family list comes only from the verified runtime catalog. No visual subfamilies are invented from naming conventions, effects, or common DBD terminology.

The verified family order is the canonical `itemFamilies` source order. The redesign does not sort families alphabetically unless the verified catalog itself establishes that order.

## 6. Family section behavior

Each verified family is one semantic section with one family heading and up to two named subsections.

### Default state

- All families are expanded when the page is first entered.
- Collapse state is presentation-only UI state and is not written into schema v2.
- Collapse state should remain in memory for the active character/page session.
- It does not need account persistence or JSON export.

### Collapse controls

Each family heading includes an explicit expand/collapse control using a native button with `aria-expanded` and an associated region.

Secondary page controls provide:

- Collapse all
- Expand all

These apply only to verified family sections, not the unresolved imported-record region.

### Search and forced reveal

User collapse intent and forced visibility are separate concepts.

- A non-empty search may temporarily force open any family containing a match.
- Search-driven opening must not overwrite the remembered user-collapsed state.
- Clearing search restores the user's prior collapse choices where practical.
- An error target, validation summary action, focus restoration target, or Jump-to-family destination must be revealed before focus/scroll is moved to it.

### Families with no Add-ons

If a verified family has no compatible Add-ons in the catalog, render one truthful line under the Add-ons subsection:

> No compatible Add-ons in this catalog.

Do not render an empty grid.

In the unfiltered default view this applies to Firecrackers. The implementation must use catalog truth rather than a hardcoded family-name exception.

### Families with no matches after active filtering

- With no search/filter restrictions, all verified families remain visible.
- With search or secondary filters active, families with no matching verified entries may be omitted to reduce dead space.
- If the Type filter explicitly selects Add-ons, a family that genuinely has no Add-ons may still show the truthful empty line if the family remains part of the rendered family set.
- No-results messaging belongs at page level when no verified family has a visible result.

## 7. Item/Add-on subsection behavior

Within every family:

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

When In Stock is active, pending or invalid entries must remain visible until their edit is resolved. The UI must not make a field disappear while the user is fixing it.

## 8. Inventory card anatomy

Cards borrow the strengths of Perks cards: image-led identity, predictable rhythm, concise metadata, and limited prose.

### Visual anatomy

```text
┌──────────────────────────────┐
│          [ artwork ]         │
│                              │
│ Sport Flashlight             │
│ [RARE]                       │
│                              │
│ QUANTITY                     │
│ [ - ] [      3      ] [ + ] │
│                              │
│ Pending / error text         │
│                              │
│                  [ Details ] │
└──────────────────────────────┘
```

### Hierarchy

1. artwork;
2. entity name;
3. quantity interaction as the dominant control area;
4. rarity badge/accent;
5. Details action;
6. compact state/error metadata.

Rarity may appear visually above quantity, but quantity remains the primary interactive element.

### Artwork

- Increase inventory artwork materially from the current 64px treatment.
- Use a dedicated media area so cards align even when source artwork has different intrinsic dimensions.
- A practical target is roughly 84 to 112px depending on card width, with `object-fit: contain` behavior.
- Missing artwork continues to use the existing non-blocking fallback.
- Artwork is decorative when the entity name is already present, so empty `alt` or equivalent decorative semantics remain appropriate.

### Card geometry

- Use a practical minimum card width around 220px.
- Use `auto-fit`/`minmax` or an equivalent container-driven grid rather than fixed card counts.
- Positive and zero stock use identical card geometry.
- A quantity crossing zero cannot change card dimensions.
- The entire card is not a button or link.

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

### Optional compact stepper

The preferred visual control is:

```text
[-] [ editable numeric field ] [+]
```

The stepper is only implementation-complete if all of the following remain true:

- direct typing remains first-class;
- decrement is disabled at zero;
- increment is disabled at `Number.MAX_SAFE_INTEGER`;
- +/- never overwrites or normalizes invalid raw text;
- button activation cannot create a duplicate commit through the field's blur event;
- the same validation path is used as typed input;
- focus remains deterministic after a successful change;
- practical targets are about 44px.

If those conditions cannot be met cleanly in the implementation batch, ship the redesigned card with direct numeric typing only and defer +/- without blocking the visual redesign.

### Labeling

The visible card may use a compact `QUANTITY` label. The control's accessible name must still identify the entity, for example `Quantity of Sport Flashlight`.

### Read-only mode

If writer access is unavailable, quantity controls follow the existing editor-disable contract. Details remains usable because reference reading is not a write operation.

## 10. Rarity system

Use verified catalog rarity only.

### Conceptual mapping

| Rarity | Accent family |
| --- | --- |
| Common | brown/tan |
| Uncommon | yellow |
| Rare | green |
| Very Rare | purple |
| Ultra Rare | red |
| Event | gold/event |

### Treatment

Use rarity in restrained ways:

- small text badge;
- thin top/side border or inset accent;
- subtle artwork/media backing;
- optional tiny marker.

Do not fill the full card with saturated rarity color.

### Accessibility and distinction

- Rarity text is always visible.
- Color is supplemental.
- Text contrast must remain readable on the dark Ledger surface.
- Inventory rarity tokens are separate from perk tier tokens.
- Rarity badge geometry differs from perk tier badges so green/purple/gold do not imply perk Tier II/III/I.

### Qualified Banquet metadata

For the known Banquet records:

- displayed rarity remains Event;
- Event controls filter membership and presentation;
- optional inferred/underlying rarity may appear only in Details when the verified runtime metadata supports that qualification;
- inferred rarity never controls ordering, filtering, displayed rarity, or card accent.

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
- Opening Details does not commit, normalize, or clear quantity text.
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
- excluded from family Collapse all / Expand all behavior.

Do not silently discard, rename, infer family/rarity, or make unknown IDs editable.

Secondary verified filters do not assign metadata to unresolved records. The unresolved region remains discoverable even when verified catalog filters are active.

## 13. Search, filter, and family navigation behavior

### Immediately visible controls

Always visible near the top of the inventory page:

- Search;
- In Stock;
- Filters disclosure button;
- optional Jump to family control when useful;
- Collapse all / Expand all as secondary controls.

### Search

Preserve the current search basis unless implementation review finds an existing tested dependency that requires a narrower contract:

- case-insensitive entity name;
- case-insensitive verified effect text.

Search narrows verified cards without changing saved data or order.

### In Stock

In Stock is a Boolean presentation filter.

- Positive baseline stock passes.
- Pending/error rows remain visible so edits are not stranded.
- Zero stock remains visible when In Stock is off.

### Filters disclosure

Move secondary filters into a compact disclosure. The initial implementation should keep the useful existing axes without making the toolbar dominant:

- Type: All / Items / Add-ons;
- Rarity: All / one verified rarity.

Family is already the primary page structure. The old family dropdown should not be required in the normal redesign. If implementation evidence shows a family filter still materially helps, it may live in this disclosure, but it must not replace family sections.

The disclosure trigger should show an active-count summary such as `Filters (1)` when a secondary filter is active.

### Jump to family

Jump to family is approved but optional for the first implementation batch.

If implemented:

- it is navigation, not a filter;
- it lists verified family names;
- selecting a family opens it if needed and scrolls/focuses its heading;
- it does not clear search or filters;
- destinations that are not currently renderable because of active search/filter constraints should be disabled or omitted rather than silently clearing user state.

### Sticky behavior

Do not make the toolbar sticky in the first implementation. Revisit only after real testing shows a material benefit and confirms no harm at 200% zoom, short viewport heights, visible focus, and mobile widths.

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
- Collapse/Expand controls are secondary and may move below the primary controls.
- No horizontal page scroll is acceptable at the required widths.

### 200% zoom

The owner has already accepted the current application at genuine browser 200% zoom. The redesign must preserve that usability. Implementation verification must repeat actual browser zoom testing because new family headers, toolbars, and cards materially change density.

## 17. Accessibility requirements

The implementation must preserve or improve:

- one logical `h1` for the character identity/page context;
- semantic descending section headings;
- native buttons, inputs, checkboxes, selects, and details/dialog primitives where appropriate;
- `aria-current` for workspace navigation;
- `aria-expanded` for family collapse controls;
- accessible names for quantity inputs and optional +/- buttons;
- visible `:focus-visible` treatment using the Ledger gold focus language;
- non-color-only rarity, stock, error, and selected states;
- practical 44px interaction targets;
- error text associated with the relevant quantity input;
- keyboard reachability for Details, family controls, filters, and all quantity controls;
- deterministic focus restoration after dialog close, save/regroup, error navigation, and forced family reveal;
- no focus hidden under a future sticky toolbar, which is one reason stickiness is deferred.

Decorative artwork stays excluded from the accessibility tree when the adjacent text already names the entity.

## 18. Focus and keyboard behavior

### Family controls

- Enter/Space toggles a family button using native behavior.
- Collapse must never discard pending raw input state.
- If focus is inside a family and the user collapses it through that family's control, focus remains on the family toggle.

### Search

- Existing search keyboard behavior remains conventional.
- Search re-rendering must preserve the search field value and focus when input-driven rendering occurs.

### Quantity commit

Preserve the existing focus contract:

- Enter validates/commits and returns focus deterministically.
- Blur validates/commits without hijacking a legitimate next focus target.
- After regrouping, restore to the edited quantity field when still visible.
- If it is hidden by active filters, use the next deterministic visible destination or search control.
- If the containing family is collapsed by user state but focus must return inside it, temporarily reveal the family first.

### Error summary

Keep or improve the existing page-level error summary.

Selecting an error:

1. clears only the minimum presentation filters needed to reveal the bad field when required by existing behavior;
2. expands the containing family;
3. scrolls/focuses the quantity input;
4. preserves the raw invalid text.

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

Optional +/- buttons enter the same validation/commit path and are unavailable while raw text is invalid.

### Family collapse

```text
Expanded by default
  -> user collapses
User-collapsed
  -> search/error/focus requires entity
Temporarily forced open
  -> search/focus condition ends
Return to remembered user-collapsed state
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
Full verified family set
  -> search/filter
Narrowed family/subsection/card set
  -> clear controls
Return to full set with remembered family collapse state
```

No transition writes to schema v2 unless it is an existing quantity commit or an existing Edit Character save.

## 21. Data/model boundaries

### Presentation-only state

The following are presentation-only and must not enter the save document:

- family expanded/collapsed state;
- Collapse all / Expand all state;
- search query;
- In Stock filter;
- Type/Rarity filters;
- optional Jump-to-family selection;
- temporary forced-open families;
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

Expected presentation changes:

- evolve `characterWorkspaceHeader()` into the shared identity/header contract;
- recompose `characterOverview()`;
- simplify the normal `characterInventory()` Perks page intro while preserving its grid and routes;
- replace the flat `stockView()` renderer with family sections and compact cards;
- add Details-dialog rendering/action wiring using existing dialog infrastructure;
- add in-memory family collapse state and forced-open behavior;
- adapt stock filter controls;
- preserve existing stock input, commit, error, and focus behavior.

The implementation should consider extracting view helpers if `src/app.js` becomes harder to reason about, but unrelated refactoring is out of scope.

### `src/inventory-interaction.js`

The current interaction state globally orders positive stock before zero stock. The redesigned presentation needs family-local grouping without changing persistence semantics.

Prefer a pure presentation selector/helper that:

- groups visible resolved entities by verified family;
- separates Items and Add-ons;
- applies positive/zero/canonical ordering inside each subsection;
- preserves pending/error visibility and stable-edit behavior.

Do not make the save layer family-aware.

### `data/inventory-catalog.js`

No schema/domain change is required. Existing adapted fields already provide the required basis: `familyId`, `rarity`, `compatibleItemIds`, `effect`, `provenance`, canonical `order`, and verified source metadata.

### `styles.css`

Expected additions/refinements:

- shared workspace-header layout;
- header status/progress treatments;
- workspace navigation polish;
- Overview dashboard composition;
- family section and subsection styling;
- responsive inventory card grid;
- larger inventory artwork area;
- inventory-specific rarity tokens/classes;
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
- `tests/browser/inventory.mjs` for family sections, ordering, filters, zero stock, errors, Details, unresolved records, and focus;
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
- family headings and toolbars wrap cleanly;
- Overview stacks in correct order;
- dialog remains inside viewport;
- active focus is visible.

### Release verification

After eventual implementation, rerun the established automated release/regression path and direct-file/browser checks. Genuine browser 200% zoom must be manually rechecked because this redesign materially changes layout density.

This design-spec commit itself does not require production runtime verification because it changes documentation only.

## 24. Risks and edge cases

### Very long inventory page

Expanded-by-default families remain long. Family grouping, Collapse all, search, and In Stock address navigation without hiding zero stock by default. Sticky controls are deferred until evidence justifies them.

### Search versus collapse intent

Search could permanently destroy the user's collapse choices if the state model is naive. Keep user state and forced-open state separate.

### Quantity blur plus +/- click

A stepper can accidentally commit twice if blur fires before button handling. This is the primary reason +/- is conditional. Do not ship it without a tested single-commit path.

### Invalid raw value plus stepper

Never coerce invalid text just because +/- was pressed. Disable or ignore step actions while raw text is invalid.

### Focus after card regroup

A successful zero-to-positive or positive-to-zero save can move the card. The interaction must reveal its family and restore focus deterministically after render.

### In Stock filter plus zero commit

Committing zero while In Stock is active can make the card no longer qualify. Focus logic must move to a deterministic visible destination rather than disappear into the document.

### Firecracker empty Add-ons

Use catalog-derived emptiness, not family-name branching, so the behavior remains correct if the source changes.

### Rarity color collision with perk tiers

Use inventory-specific geometry/tokens and visible rarity text. Do not reuse tier badge classes.

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

- Verified families render as clear sections in canonical family order.
- Every family renders Items before Add-ons.
- Positive stock precedes zero stock inside each subsection.
- Canonical order is preserved inside positive and zero groups.
- Families are expanded by default and independently collapsible.
- Collapse all / Expand all work.
- Search can reveal matching content without permanently discarding collapse intent.
- Catalog-empty Add-ons subsections show a truthful line instead of an empty grid.

### Inventory cards

- Cards use materially larger artwork than the current 64px presentation.
- Quantity is the primary interaction.
- Zero and positive cards retain the same geometry.
- Zero cards are quieter but fully readable/editable.
- Rarity has a text label plus restrained accent.
- Inventory rarity styling is visually distinct from perk tier styling.
- Details replaces repeated persistent reference/compatibility blocks.
- Details is keyboard accessible, read-only, and restores focus.

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
- Optional +/- is either fully compliant with this spec or deferred.

### Toolbar and filtering

- Search and In Stock are directly visible.
- Secondary Type/Rarity filtering is compactly disclosed.
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
- No page-level horizontal overflow appears at those targets.
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
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Survivors                                                                 │
│                                                                             │
│ [portrait]  MEG THOMAS        [Owned] [Favorite]     [ Edit Character ]    │
│             Survivor                                                       │
│             PRESTIGE P3        BLOODWEB 27 / 50                            │
│                                                                             │
│ [ Overview ] [ Perks ] [ Items & Add-ons ]                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Items & Add-ons
Track the quantities currently recorded for this Survivor.

[ Search inventory............................. ] [✓ In Stock] [Filters (1)]
[Jump to family ▾]                    [Collapse all] [Expand all]

▼ FLASHLIGHTS
  Items
  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
  │    [ artwork ]   │ │    [ artwork ]   │ │    [ artwork ]   │
  │ Sport Flashlight │ │ Utility Flash... │ │ Flashlight       │
  │ [RARE]           │ │ [EVENT]          │ │ [COMMON]         │
  │ QUANTITY         │ │ QUANTITY         │ │ QUANTITY         │
  │ [-] [ 3 ] [+]    │ │ [-] [ 1 ] [+]    │ │ [-] [ 0 ] [+]    │
  │          Details │ │          Details │ │          Details │
  └──────────────────┘ └──────────────────┘ └──────────────────┘

  Add-ons
  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ...

▼ FIRECRACKERS
  Items
  [cards]
  Add-ons
  No compatible Add-ons in this catalog.

...

Imported records not in current catalog
──────────────────────────────────────────────────────────────────────────────
raw-id-name                                      quantity 2        read-only
```

### Narrow/mobile Inventory

```text
← Survivors

[portrait] MEG THOMAS
           Survivor
           [Owned] [Favorite]

PRESTIGE P3       BLOODWEB 27 / 50
[ Edit Character ]

[ Overview ] [ Perks ]
[ Items & Add-ons ]

Items & Add-ons

[ Search inventory............. ]
[✓ In Stock] [Filters (1)]
[Collapse all] [Expand all]

▼ FLASHLIGHTS
  Items
  ┌────────────────────────────┐
  │         [ artwork ]        │
  │ Sport Flashlight           │
  │ [RARE]                     │
  │ QUANTITY                   │
  │ [ - ] [      3      ] [ + ]│
  │                    Details │
  └────────────────────────────┘

  Add-ons
  [one-card column]
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
│          artwork             │
│                              │
│ Entity Name                  │
│ [RARITY]                     │
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
- family section grouping;
- family collapse UI;
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

### Placeholder scan

No implementation requirement is left as TBD/TODO. Optional features are explicitly identified as optional rather than unresolved: +/- steppers, Jump to family, and sticky toolbar. Sticky behavior is intentionally deferred.

### Internal consistency

No schema or persistence change is required. The only deliberate refinement of an earlier presentation rule is family-local positive/zero ordering, which is explicitly limited to rendering. Zero stock remains visible by default while In Stock remains an opt-in filter. Family collapse is presentation-only and cannot hide error/focus targets when they must be revealed.

### Scope check

This design is focused enough for one later implementation plan covering shared header, Overview presentation, Perks intro cleanup, and Survivor inventory presentation. Killer production inventory remains outside scope.

### Ambiguity check

The following choices are explicit:

- shared header status fields are display-only; Edit Character remains the editor;
- family order comes from the verified catalog;
- Item/Add-on order is family-local;
- search-driven family opening does not overwrite user collapse intent;
- family is primary structure, so Type/Rarity are the required secondary filters;
- unresolved records remain outside verified filters/families;
- +/- is not required if it threatens settled input/commit/focus semantics;
- toolbar stickiness is not part of the first implementation.

No material design question blocks implementation planning after owner approval.