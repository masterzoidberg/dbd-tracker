# Character Workspace design

Date: 2026-10-13. Status: finalized for implementation planning; approved product direction and source-grounded architecture recorded. The human confirmed combined queue/inventory v2 and explicit Save Character with one draft commit during this pass. No remaining human product decision is pending. Documentation only, no implementation authorization. Route authority: [04-routing-and-compatibility.md](04-routing-and-compatibility.md). Editing/state authority: [05-inventory-and-editing-design.md](05-inventory-and-editing-design.md). Evidence/capability ledger: [02-current-state-audit.md](02-current-state-audit.md).

## Purpose and approved structure

Every ordinary character identity action lands on Overview. Dashboard Current Focus, Prestige Queue, Suggested P1 targets, Continue where you left off, Favorites and collection character actions use that same contract. There is no last-tab memory or mandatory character popup. Explicit area links and setup/edit actions may target their named task directly.

| Role | Workspace navigation |
| --- | --- |
| Survivor | Overview / Perks / Items & Add-ons |
| Killer | Overview / Perks / Power & Add-ons |

These are approved concepts, superseding earlier hypothesis language. Edit Character and initial Setup are task pages within the workspace, not fourth/fifth browsing tabs. Retain vanilla string-rendered views, event delegation, native controls, existing hash routing, writer protection and one canonical save. No framework/router replacement or unrelated refactor.

Overview answers “What is the current state of this character, and where can I go next?” Edit Character answers “What changed?” and uses an in-memory draft followed by one explicit Save Character. The area pages answer “Show me everything about this area.” Their clearly labeled individual autosave does not persist any changes from an unsaved comprehensive edit session.

## Overview composition

One h1 and a shared identity header: portrait with existing fallback, full character name, textual Survivor/Killer, Owned/Not owned and Favorite/Not favorite, current Prestige and BW /50. Show an accessible Edit Character link prominently near progression. Unowned characters may be browsed and corrected; normal editing is writer-gated, not dependent on Owned. Owned remains a requirement for initial setup. Browsing never updates activity.

Below the header, keep compact panels in this order:

1. Progression context: Prestige/Bloodweb and accurate account unlock implications, plus a non-blocking incomplete-setup notice when appropriate. Native marginal value uses existing global overrides; do not promise three new unlocks unconditionally.
2. Native perks: canonical three source perks where available, effective tier and provenance, links to existing perk detail. Explicitly separate recorded personal tier from automatic tier.
3. Perk summary: effective owned/maxed and upgrade opportunities derived from existing selectors, labeled as such; link to Perks. Do not label effective counts “personal records.”
4. Survivor inventory summary: compact item/add-on stock summary and Items & Add-ons link. Killer: compact Power summary/link plus separate add-on stock summary to Power & Add-ons. These summaries stay character-local; no Dashboard inventory metrics. Empty default maps mean no stock recorded, not inferred in-game absence. Show “No quantities recorded yet” rather than a completion claim.
5. Existing character Notes: readable text or bounded preview with expansion; Edit Character link. No queue-specific notes field.

Overview has no full perk/catalog/inventory grid and no large description blocks. Quantity summaries derive from save maps + catalog, never new persisted aggregates. Where reference data is unavailable, say so without making a zero catalog denominator or fabricated Power description. Persisted unresolved quantities remain discoverable through a warning/details count.

Owned and Favorite are small character fields inside Edit Character; retain existing immediate collection quick toggles for convenience. Overview shows status instead of introducing extra large sections or tiny dialogs. Changing Owned never deletes progression, quantity records or queue entries. Derived queue focus/eligibility responds on commit. Favorite is independent of queue membership. Notes edits update the same `characters[id].notes` used by queue context.

## Perks for both roles

Reuse the same character perk selectors, cards and canonical personal records for Survivor and Killer; scope to the character's role. Perks defaults to effective owned inventory, preserving `inventoryTier >0`. Provide an explicit reconciliation/candidates mode at `/perks/update` and maintain the legacy compatibility view during rollout. Area browsing may contain rich descriptions, aliases, provenance and unlock information. Edit Character exposes streamlined versions of the same controls with draft-backed writes; never a second perk state model.

Retain Small/Medium/Large and its existing UI preference/fallback. Retain reconciliation search, All/General/Unlocked/Only unrecorded, retained tracked records and selected details. Rename the displayed native “Personal” scope to “Native perks” to avoid confusing native origin with acquired personal records; preserve its predicate. Use ordinary labeled buttons/radios for scope filters rather than incomplete ARIA tabs. Do not import the legacy manager's full advanced-filter panel into the normal inventory. Preserve that panel and Detailed/Compact in the explicit legacy compatibility view until parity is reviewed; no silent retirement of correction capability.

Each relevant card/editor distinguishes recorded personal tier, effective tier, automatic minimum, global availability/source, native/General status and next Bloodweb tier. General does not grant automatic ownership. Display Shrine/Legacy/Other provenance where relevant. Personal correction never writes global overrides. Ordinary “Not recorded” removes a personal record and retains automatic minima; allowed non-null tiers respect the current floor. Historical controls retain absent/Not Confirmed versus explicit zero/Not Owned and existing no-downgrade behavior. Existing deliberate lower-level correction remains available with explanatory copy. Account unlock changes remain existing perk-detail/account-library tasks, not new Character Edit fields.

Expose an explicit all same-role/special-acquisition scope for personal correction, preserving initial setup's ability to record a locally acquired perk without globally unlocking it. Default reconciliation still uses the current candidate pool. Draft Prestige previews recompute automatic minima/eligibility without writing those minima to personal records.

## Survivor Items & Add-ons

Inventory management and reference browsing share one section. Use a compact family selector/disclosure, Item/Add-on type choice, search, optional rarity/compatibility filters from verified catalog data and an optional In Stock filter off by default. Default All uses positive-first then zero grouping over the displayed inventory set; inside each group use catalog order. Family/type views apply the same grouping to their displayed set. Do not produce family buckets that put zero entries ahead of positive entries in the same visible All grid.

Initial family order comes from the existing canonical asset manifest: Key, Firecracker, Flashlight, Fog Vial, Map, Med-Kit, Toolbox. Generate choices from the ingested catalog, not hard-coded prompt examples. Preserve catalog array order as canonical order unless verified research supplies a deliberate order. Firecracker has no add-ons in this manifest: show a truthful family empty state, not a placeholder entity. Raw retired/limited/mystery artwork is not automatically current stock catalog.

Cards show name, Item/Add-on label, family/compatibility, verified rarity, artwork/fallback, and a clearly labeled quantity input. Compact effect text and an explicit details disclosure keep numeric editing prominent; long descriptions never displace the input. Reference metadata needs the absent verified research dataset before complete content can ship. Use the stable mapping in 05 to bind the image manifest to save IDs without changing source images or manifest IDs.

## Killer Power & Add-ons

Power and inventory have separate headings/regions. Power is read-only domain content: name/icon, verified mechanics and optional structured abilities/attacks/interactions/locomotion/states/resources/cooldowns/restrictions/counterplay/numerical sections only when provided by verified data. Never create user-editable mechanics fields. An unavailable-data notice is acceptable before structured Power ingestion; it does not block Overview, Perks or the route architecture.

Add-ons show only this Killer's verified catalog entries, with rarity, effect, compatibility/context, art and editable current quantities. Apply the same entry/grouping/filter/focus contract as Survivor inventory. Do not browse other Killers' add-ons here. Raw artwork lacks verified identity/role linkage and effects; canonical add-on ingestion is a prerequisite for quantity UI, rather than inferring inventory from filenames. Unknown imported IDs remain preserved in save state and presented as unavailable records, not editable invented cards.

## Setup relationship and popup retirement

Keep Account Setup's three steps, autosave and account completion marker. Approved Dashboard keeps its prompt only while incomplete and provides Review account setup on Data & backups afterward. Keep global Run character setups with existing owned/incomplete selection, Survivor-first batch order, skipping and completion flags; its transient batch context is unrelated to Prestige Queue.

Individual Setup moves out of the character dialog to `/setup` within the workspace. Overview offers Start initial setup or Review initial setup for Owned characters. Ordinary character navigation always opens Overview even when setup is incomplete. Setup retains immediate P1 (explicitly labeled as saving immediately), BW/perk draft steps, P0/BW1 shortcut, special acquisitions, historical controls, additive/no-downgrade finish, pre-finish backup and explicit character completion. Batch can enter Setup directly and return to its initiating page or Overview after completion; reload loses transient batch context but saved completion flags allow Run character setups to resume.

Edit Character is ongoing snapshot correction and never forces setup or marks setup complete. Preserve the old setup route/state semantics rather than merging its additive behavior into normal correction. No setup screen is declared redundant or deleted in this design. The popup may be removed only after every entry in the audit ledger has a working destination. Perk detail/confirmation dialogs remain valid bounded tools.

## Accessibility and responsive requirements

Workspace sections are real hash links with `aria-current="page"`, not ARIA tab widgets. Shared h1 identity, h2 task/area headings and h3 subgroups give a coherent hierarchy. Separate identity links from Favorite/Owned actions; no nested controls or clickable cards containing active inputs. Native numeric fields/buttons/selects have visible labels naming their entity and character where needed. Stock/ownership/tier information has text/numbers, not color alone. Muted zero cards retain readable contrast and focus outlines. Use native disclosures for long reference text. Aim for 44px touch controls, wrapping actions and visible focus; no drag requirement.

| Representative width | Required composition/acceptance |
| --- | --- |
| 320px | Header and actions wrap; inventory input row and edit form single column; allow one inventory card column rather than forced two; no page-level overflow |
| 500px | One task column, optional fitting card columns; descriptions disclose; numeric inputs stay legible |
| 760px | At existing <=760 breakpoint, selected details/forms stack, quantity controls remain in cards, navigation wraps locally |
| 1100px | Existing shell/panel breakpoint; identity and task sections fit available main width, not raw viewport width |
| 1440px | Bounded main width, flexible grids, optional selected reference pane without hiding task controls |
| 1600px | Existing wide-shell padding; avoid stretched labels/inputs and excessive empty columns |

At every width verify long names, safe-integer-sized Prestige/counts, Owned/Favorite text, 200% zoom, visible focus, and no horizontal main inventory tables. Existing shell nav scrolling is distinct from unwanted page overflow. Edit uses local section anchors, search/filter and compact cards to handle many records; Save/Cancel remains discoverable without obscuring focused fields. Filter changes never discard off-screen draft changes. Routes focus h1/main; saves and regrouping follow 05. This is a source-based layout specification; viewport verification awaits implementation.

## Dashboard dependency and scope

Option B remains approved without hierarchy, recommendation, queue or presentation redesign. Dashboard consumes the authoritative Overview route builder from 04, including current focus, queue, suggestions, recent edits and Favorites. Unknown unresolved goals retain their current unavailable/no-link behavior. No popup detour, tab history or navigation activity tracking. Queue-only edits affect account time; successful character editing affects one character time. Existing Notes suffice for queue reasons.

Deferred: drag/drop, visit/session tracking, completion history, cost estimation, synchronization, framework replacement, queue notes, Dashboard inventory panels, achievements, selected-perk goals and unrelated statistics/refactoring. See 05 for implementation touchpoints, future tests and readiness.
