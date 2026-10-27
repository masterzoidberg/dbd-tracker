# Rev02 Killer Workspace Design

## Status

Full planning artifact · 2026-10-25 · Not implemented. Applies the user's consolidated decisions and shared contracts in [06](06-shared-global-design.md); remaining geometry/detail recommendations are identified as recommendations, not retrospective approval. Covers Overview, Perks, Power & Add-ons and contextual management. Standalone Killer perk library keeps its information architecture for Rev02 Core.

## Workspace Purpose

A Killer technical dossier for recognition, progression, personal records and rapid Add-on recording. **Power is identity, not metadata.** Archive when browsing; tool when editing. No meta ratings, difficulty classification, loadouts, fabricated statistics or decorative horror interface.

## Primary User Jobs

1. Recognize the Killer, Power, ownership and progression.
2. Update Prestige/Bloodweb, ownership, Favorite and notes safely.
3. Distinguish recorded perk tiers, automatic minimums, effective tiers and account access.
4. Reconcile perks deliberately, including historical/correction capabilities.
5. Find and update this Killer's Add-on quantities rapidly.
6. Read structured Power mechanics and contextual Add-on effects.
7. Move between Killers while retaining valid session working context.

## Current Workspace Assessment

### What Works

Canonical same-role routes/neighbors, three principal sections, shared progression/perk logic and writer-guarded storage already exist. Dedicated Power & Add-ons directly edits quantities; it has flat rarity sorting and on-demand reference. Runtime catalog supplies 44 Power names, summaries/full fields and owner-specific Add-ons. Shared parsers protect quantity values and pending input.

### UX Friction

Global Edit Character competes with the current tab. Normal perk clicks enter editing; browse controls are weaker than Update. Old Killer Edit displays inventory-unavailable copy because its stock editor is Survivor-only, despite functional direct Killer Add-on editing. Quantity sessions reset by owner; no search/In Stock toolbar exists for the Killer list. Rich Power Details recursively prints raw keys instead of a reading hierarchy. Setup's immediate P1 write and draft Finish have different cancellation semantics.

### Visual Friction

The 80px square identity portrait and large neighbor/Edit regions compete with Power identity. Tall media/card chrome pushes values down; repeating visible Quantity of X labels adds noise. Structured mechanics read as a long nested definition list. Shared sidebar and fixed detail-pane behavior constrain intermediate widths. Existing screenshots in `evidence/` substantiate prior baseline appearance, not a new rendered Rev02 design.

## Shared Workspace Shell

### Lore Portrait

Use the canonical Lore manifest mapping from `images/updated-images/Character Portraits/Killers/Lore`, matching roster policy. Current roster has 43/44; workspace currently uses older square portraits. The Slasher gets a **neutral named fallback**, no approved square exception. Also handle load/decode failure. Contain first; check Good Guy resolution, Singularity aspect and paired/weapon silhouettes non-destructively. Keep text readable independent of artwork.

### Killer Header

Back to Killers; compact named neighbors; meaningful portrait/name/Killer; Prestige/Bloodweb together; quiet Owned/Locked plus independent Favorite; principal sections. Overview may use more art than operating tabs, without a universal tall banner. One character H1. Ownership editing lives in Overview; no roster ownership mutation or global primary Edit Character.

### Power Identity

Keep the supplied Power name visible in the Killer identity/content hierarchy. Overview has a concise summary; Power & Add-ons has a compact reference introduction. Optional accepted icon supplements the name; seven missing and five REVIEW mappings do not remove text identity or license guessed assets. Lore portrait cannot substitute for Power art.

### Previous / Next Killer

Keep full-role canonical catalog order, named links, no wraparound, section preservation and deliberate Update-mode continuation for neighbors. Retain Killer-local perk search/filters/sort/density and Add-on filters/rarity direction where valid. Clear selected perk, quick picker, changed count, correction state and stale errors. Resolve all pending source edits/drafts before navigation. Roster return separately restores its own page/filter/origin context; no filtered neighbor traversal is required.

### Tabs

**Overview · Perks · Power & Add-ons**, canonical links with current-section semantics. Setup is temporary, not a fourth principal tab. Legacy/manage perk aliases continue resolving. After contextual parity, old `/edit` links resolve to Overview contextual management; no giant editor remains as a permanent fourth workspace. Mapping existing bookmarks and dirty Back/hash/history navigation is an engineering dependency.

### Content Width

Use shared task widths: readable Overview/reference measure, fluid operational grids. Do not force a wide side perk editor beside a narrow grid. Dense Add-on rows/tiles need readable names, adequate numeric width and error expansion, not tall empty media regions. No fixed height that clips content.

### Responsive Behavior

Use plan 06's one content-fit global shell. Desktop can combine art and concise facts; laptop height must expose the task promptly. Narrow laptop/tablet uses compact navigation and drops the perk side pane before results become a strip. Phone stacks identity/progression, keeps labeled sections and reflows step controls; usually one Add-on column, one/two perk columns only while readable. No Killer-specific shell breakpoint or permanent extra sticky toolbar.

## Contextual Editing

### Current Edit Character Audit

| Current capability | Source / finding | Required contextual home |
| --- | --- | --- |
| Owned, Favorite, notes | Typed draft in `character-edit.js` | Overview direct state controls and Save note / Cancel; escaped full plain text retained. |
| Prestige/Bloodweb | Strict whole numbers, non-negative safe Prestige, Bloodweb 1–50 | One atomic Overview progression draft with Save progression / Cancel; no invented P100 cap or automatic reset. |
| Normal personal tiers | `setCharacterPersonalTier`, same-role validation/floors | Explicit Perks Update, per-selection commit; None clears record, not minimum. |
| Historical records | Missing versus explicit zero, acquisition cannot downgrade | Separate historical control in Perks; preserve Not confirmed / Not owned / I–III and floor rules. |
| Deliberate correction | `correctPersonalPerkTier`, null/I–III, bypass normal record floor | Selected-perk correction disclosure with before/minimum/result and Apply correction. |
| Composite candidate | Whole-save fingerprint, final floor validation, no-op/unknown preservation | Scoped candidate validation/conflict/dirty/failure guards; intentional retirement of cross-task all-character Save. |
| Killer quantities | Old form does not render them; dedicated `killerPowerAddonsView` already does | Direct Power & Add-ons controls, retaining owner checks and unknown stock. Do not move them into another form. |
| Setup and batch setup | Separate helpers/routes, not dependent on Edit screen | Overview setup status/link plus focused setup; retain P1 immediate save, additive Finish, backup and batch continuation. |
| Migration/normalization | `model.js` / `storage.js`; alias sync in central commit | Preserve central boundaries; no migration logic belongs in the replacement view. |

### Capabilities to Preserve

Every field and exceptional path above survives before retiring the UI. Keep invalid raw values, same-role/owner validation, historical zero, untouched records below later floors, unknown IDs, aliases, no-op behavior, full-save conflict safety and retry. Do not weaken stale-save detection just because an editor has fewer fields: account/source Prestige can change derived minima elsewhere. No evidence requires a giant form for migration, reconciliation or special synchronization; alias sync consolidates records without manufacturing acquisitions.

### Save/Persistence Model

Prefer per-task atomic saves: progression pair, note, boolean state, one perk selection/correction, one quantity. Reuse the existing `commit` path: clone → apply → alias normalization → timestamp → writer-guarded validated storage → publish canonical state only on success. There is no collection-wide Save. No-op tasks should preserve timestamps. Keep setup's backup-before-Finish and replacement/migration backups; ordinary increments do not require new backups.

### Unsaved Changes

Progression, note, correction and setup drafts retain Save/Apply and real Cancel. One active explicit draft is recommended; an unrelated mutation resolves it before writing. Dirty tab/character/Back departure offers Save / Discard / Stay. Failed/invalid/stale saves retain input and block departure; external change or writer loss requires deliberate resolution. Quantities settle on Enter/blur/steps and before hiding/navigation; failures remain revealed. Successfully saved perk changes have no collection dirty state, and Done cannot undo them. An unresolved failed tier intent uses Retry / Discard failed selection / Stay. Reference stays inspectable without mutation.

## Overview

### Power Summary

After identity/progression, show supplied Power name, small optional icon, short summary and **Power Details**. Avoid copying the full mechanics here. Power & Add-ons remains the clear inventory destination; reference opening does not change quantities.

### Native Perks

Three recognizable perk entries with readable names, primary effective tier, secondary Recorded / Automatic minimum / Account facts. Native I can exist with no explicit record on an unowned Killer. General availability can coexist with global tier zero. Rich provenance/reference and Update record link go to Perks; no second native-tier editor on Overview.

### Perk Collection Summary

Effective positive perks / role total and effective Tier III count, from `characterStats` / effective helpers. UI says Effective perks, never an unexplained Owned count. These are neither manual-record completeness nor account unlock totals. Link View Perks; no new chart.

### Add-on Collection Summary

Show stocked known Add-on **types**, not total copies, beside catalog type count derived from this Killer's catalog. Preserve unknown/unresolved quantities in a separately labeled read-only list and exports; do not include them as verified types. Do not hardcode 20 despite current content having 20 per Killer. Link Power & Add-ons.

### Setup Status

Normal = quiet; incomplete owned setup = actionable. Unowned is an eligibility note, not an error blocking inspection/direct record access. Preserve P0/Bloodweb 1 skip, all-role special acquisitions, higher existing records, backup-before-Finish, batch skip/resume. Set P1 saves immediately; Cancel cannot reverse it. Add explicit dirty setup departure protection rather than assuming Edit's guard covers it.

### Notes

Escaped plain-text preview; Add/Edit notes with textarea, Save note / Cancel and local dirty/error state. Preserve full text/line breaks beyond preview, no rich text or silent truncation.

## Perks

### Browse Mode

Read/search/filter/reference without accidental editing. Lead with effective personal inventory; expose absent same-role/special candidates explicitly. Update Inventory is the deliberate entry. Reuse Survivor terminology and behavior, with independent Killer session context.

### Update Inventory Mode

Normal **Not recorded / I / II / III** picker with existing automatic-floor validation; each successful selection persists immediately. Historical acquisitions keep their own explicit-zero/non-downgrade control. Show saved/error locally, Done exits. No staged collection transaction or misleading Cancel. Character switch clears change count/selection after failure settlement; ordinary tab departure ends edit mode and retains safe filters.

### Search

Alias-aware `perkSearchText`, perk and source names, visible query and Clear search; stable caret. This extends current browse capability rather than claiming search already exists there.

### Filters

Native / General / Account unlocked / All, effective-tier choices where useful, explicit all-role/special access and retained historical copies. Relabel current Only unrecorded as No effective tier; true Not recorded must check map presence. Active restrictions remain visible with precise reset. Account library facets are not automatically appropriate here.

### Sort

Recommend Name default, effective tier high/low and source name, with deterministic name/ID tie-break. These additions reuse existing predicates where possible; current character grids are name-sorted. Keep order stable during a run; apply resort on explicit user action.

### Density

Preserve browser-local small/medium/large preference, optionally labeled Compact/Standard/Large. Keep control reachable on phones. Adjust art/spacing/columns before shrinking text; detail pane consumes usable grid width. No perk pagination inherited from six-character rosters.

### Personal Recorded Tier

Explicit `characters[id].perks`; absent Not recorded, historical absent Not confirmed and explicit zero Recorded: Not owned. Preserve own-property distinctions and records below later automatic floors. User-facing ordinary None clears only that explicit record.

### Account Minimum

Automatic character minimum = max(native I, global tier), same-role only. Global tier = max(Prestige up to III, Shrine, Legacy, manual). Native is character-only, General availability alone is not a positive minimum, and source ownership flag does not gate saved Prestige derivation.

### Effective Tier

`inventoryTier = max(recordedTier, automaticTier)`; primary label On this Killer · Effective Tier. Exports retain raw `perks` separately from derived `effectivePerks` and `perkInventorySummary`; import discards derived fields and recomputes. No UI simplification may materialize automatic minima as personal records.

### Correction Flow

Selected-perk secondary **Correct personal record** disclosure, current record/minimum/result preview, Apply correction / Cancel. Recommended explicit Apply is the guard; no equal-weight dangerous buttons on every card and no extra repeated confirmation. Preserve null/I–III correction even for historical records. Helper does not accept zero; historical explicit Not owned remains its separate acquisition state. Account unlock edits are separately labeled account-wide actions and cannot silently conflict with an active local draft.

## Power & Add-ons

### Power Section

Compact supplied name/summary/optional Power icon plus Details above operational content. Full mechanics are on demand. Canonical definitions are read-only. Avoid a large introductory wall pushing the first quantity down.

### Add-on Inventory

One flat owner-specific collection: **Killer → Power → Add-ons**. No Item Family, no Survivor Item selector, no rarity groups/collapsibles. Include zero quantities; count matches versus this Killer's total. Unknown imported stock remains separate and preserved, never guessed into editable catalog entries.

### Search / Filter / Sort

Recommendation: one lightweight Search Add-ons field (name/effect), In Stock toggle, optional rarity restriction and existing rarity direction; no family/type facet or full account-library filter system. Twenty entries are still useful to locate by name/effect during recording. These are explicit proposed additions to the current Killer view, not current parity. Active restrictions and Clear search/filters remain obvious. Filters apply only to this owner; settle pending/error rows before hiding them. Preserve session filters across Killer neighbors while deriving rows anew.

### Quantity Control

Shared **−1 | quantity | +1 | +5 | +10**, direct entry, zero minimum and safe-integer validation. Enter/blur commits, steps are additive and immediate, blank-on-blur normalizes according to existing interaction. Preserve raw/error text, writer-loss recovery and baseline only on success. Retain focus on repeated steps; do not reorder live targets after each commit. At zero In Stock can remove the row after success with predictable focus. Do not duplicate visible Quantity of X; keep the full accessible label.

### Rarity

Default high→low, optional inverse, text/color together, stable catalog tie order and additional/Event-last policy. Flat list only. Rarity affects sorting/recognition, never a new navigation hierarchy or mutation.

### Details

Quiet explicit Details button; smaller contextual dialog with art/name/rarity/effect, not Power-sized machinery. It reads canonical reference and does not edit counts. Preserve Escape, focus restoration, missing-art fallback and useful context after filtering.

## Power Details

### Summary

Name and concise supplied short summary orient the reader. Summary is not a substitute for full mechanics. Avoid duplicating large artwork/title blocks in the dialog.

### Full Mechanics

Render available `fullExplanation`, `mechanics`, `resources`, `survivorInteractions`, `powerStates`, `addonRelevantMechanics` and `complexRules` as clear sections; omit empty sections, preserve content and qualifications. No dataset rewrite or invented summary/mechanic. Escaped data remains text; no unsafe raw HTML from reference values.

### Components

Component name is a heading; component type is a subordinate label; description is prose. Use semantic lists for repeated components rather than repeated name/type/description key-value rows. Allow mixed nested structures without dropping fields; inspect longest records before choosing final renderer. Component structure differs by Power, so a single hardcoded short list is insufficient.

### Presentation Surface

Recommend a **large accessible dialog**, distinct from the smaller Add-on dialog, using current native dialog foundations. It is transient reference within the workspace; a new dedicated route would add return/resume complexity, while a narrow sheet would compress substantial mechanics. Bound prose measure, give the body sufficient height/internal scroll and clear close control. Long documents can use a compact section index within the dialog if actual content requires it; no mandatory extra navigation system.

### Mobile

Full-height/near-full-width dialog with readable padding, one coherent reading scroll region and accessible close. Section headings/components stack; no tiny nested multi-column table. Preserve scroll while inspecting within the same open reference; reopening need not persist reading history. Check landscape height, text enlargement and on-screen keyboard interactions from underlying pending quantity fields.

### Accessibility

Named dialog, logical heading order, entry focus, background inertness, keyboard scrolling, Escape and opener restoration. No scroll trap inside multiple nested reference boxes. Power name survives missing art; nonredundant images have meaningful alternatives, decorative duplicates have empty alt. No hover-only access to full mechanics.

## Shared Survivor/Killer Patterns

Share shell/neighbors/tabs, recorded/minimum/effective/account vocabulary, explicit Update/Done, scoped correction, progression/note drafts, quantity parsing/steps/pending safety, density, scoped toolbars, detail focus and local feedback. Reuse current helpers rather than duplicate rules. No identical page composition requirement.

## Killer-Specific Patterns

Lore identity, visible owning Power, structured substantial mechanics, flat owner-scoped Add-ons and no family/Item layer. Survivor Add-on quantity sharing across compatible Items does not become a Killer compatibility concept. No Add-ons on Killer roster; no decorative role-color theme or fabricated difficulty/meta facts.

## Existing-Code Observations

| Source | Reuse / constraint / change implication |
| --- | --- |
| `src/app.js` workspace/header/Overview and edit handlers | Shared HTML-string views/event delegation; old editor retirement affects both roles. Keep confirmed routes and dirty browser navigation. Killer direct stock is already outside the monolithic form. |
| `src/character-workspace.js` | Canonical parser/hrefs, role-valid sections and full-catalog neighbors; context retention and Edit-link compatibility require deliberate routing work, not new framework. |
| `src/character-edit.js` | Baseline/raw/errors, complete-save fingerprint, final floors, validated candidate/no-op. Reuse safeguards in scoped tasks without retaining the whole all-character transaction. |
| `src/model.js`, `src/character-inventory.js`, `src/historical-perks.js` | Same-role candidates/effective helpers, overrides, correction and historical rules; browser-local density and route-keyed Update session currently reset on character change. No perk schema change required. |
| `src/storage.js`, `src/editor.js`, central `commit` | Single-writer lock, validated canonical writes, migration/normalization, backups and failure atomicity. A failed save does not replace the in-memory canonical save. |
| `src/character-setup.js`, setup handlers/model completion | Owned eligibility, special acquisition, P1 immediate write, additive Finish with backup and batch continuation. Requires explicit scoped dirty-state coverage. |
| `src/inventory-interaction.js`, `src/inventory-quantities.js` | Direct raw/baseline/pending/error quantity flow, clamp/strict parsing, role/map/owner checks and flat sort. Use same primitives for both roles; preserve unknown valid records read-only. |
| `data/inventory-catalog.js`, `data/killer-runtime-catalog.json` | Existing `killerPowerByCharacterId`, structured reference and Add-on ownership. No new catalog service or user-editable Power data. |
| `src/assets.js`, `data/asset-manifest.json`, Lore directory | Current collection Lore versus separate square workspace lookup; adopt identity policy deliberately. Preserve release packaging and mapped asset qualifications. |
| `index.html`, `styles.css` | Global shell, detail dialog and appended shared rules; scoped later changes can affect account libraries and Survivor surfaces. No broad rewrite authorized. |
| Tests: character-edit, character-inventory, character-workspace, inventory-quantities/interaction, storage, export-effective-perks, killer-runtime-catalog; browser killer-power-addons | Existing behavioral contracts for floors, unknowns, aliases, writer failures, routes, pending edits and reference/stock. Later tests must separate intentional presentation changes from safety guarantees. No new UI verification claimed here. |

No new schema is needed for contextual character fields or quantity layout. Dashboard queues/pins do require persistence foundations (plan 01); Continue is browser-local. Browse search/sort, safe context retention, correction entry, scoped drafts, old Edit compatibility and Lore workspace mapping are real later changes rather than features already complete.

## Accessibility

Apply plan 06's AA target, text-backed states, useful targets, unobscured focus, coherent heading levels and programmatic errors. Preserve names/Power context at 320px and 200% text/400% reflow. Test zero/large quantities, long mechanics/names, unknown data, read-only/failed writes and real keyboard/touch. No certification from source/screenshot review.

## Motion

Immediate navigation, search/filter/sort, tiers and quantity steps; no stagger, animated counters or theatrical character transitions. Reduced-motion aware disclosure only when useful. No animation dependency.

## Open Questions

No Killer-workspace-specific product blocker remains. The approved D01/D02 queue semantics in the central register affect shared Dashboard state, not Power/Add-on geometry. Exact fit, longest-reference rendering, optional icon qualification, focus and numeric keyboard behavior are engineering/visual verification details. Recommendations here do not reopen explicit user decisions.

## Explicit Non-Goals

No implementation, schema migration, asset edits, CSS rewrite, framework/library/service additions or final roadmap. No fourth monolithic editing workspace, editable canonical Power, Survivor-style Item families, rarity accordions, roster Add-ons, loadout/trial consumption system or behavioral telemetry. Editor removal waits for verified capability parity.
