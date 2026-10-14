# Dashboard rework design

Date: 2026-10-13. Status: **Dashboard design approved by the human on 2026-10-13** after review of this complete report. Option B and the remaining Dashboard recommendations are approved product decisions. Character Workspace structure and canonical Overview routing are now finalized in `../character-update-rework/03-character-workspace-design.md` and `04-routing-and-compatibility.md`. The human also approved combining queue and quantities in one complete v2 release; persistence detail is authoritative in `05-inventory-and-editing-design.md`. This report is not a detailed implementation plan; this documentation update authorizes no application implementation.

## Goal

Make The Ledger's home screen answer “What character am I working on next?” and “Where did I leave off?” within seconds, while preserving useful account and collection information. Recommend Option B: action-first Dashboard with Current Focus integrated into the manual queue and recent edits near the top.

## Non-goals

No application changes, routes, UI components, migrations or save writes in this task. No framework, dependency, backend, cloud, catalog update or unrelated refactor. Character Workspace architecture is owned by its separate finalized design; this report consumes its navigation and combined-v2 contracts without expanding Dashboard scope.

## Design principles

- User order is authoritative. Recommendations never mutate it.
- Current account state determines completion and eligibility; do not invent history.
- Separate personal plans, P1 suggestions, collection information and administration.
- Reuse existing HTML/CSS helpers and local-first protections.
- Store user intent only; derive role, progress, benefit, completion and focus.
- Retain useful statistics with quieter presentation rather than erasing data.
- Use canonical IDs and preserve unavailable goals through load/import.

## Dashboard information hierarchy

```text
Account overview                        quiet catalog version/details
Account setup prompt                    only while incomplete

My Prestige Queue                 | Continue where you left off
  Current Focus                   |   up to five recent edits
  global-order preview            |
  Manage queue                    |

Suggested P1 targets
Survivors / Killers collection progress
Survivor / Killer perk access
Prestige distribution
Favorite shortcuts (compact secondary disclosure)
```

This challenges the initial sample: a separate large focus section duplicates the queue, and putting resume work after distribution weakens the second core goal. On smaller screens queue precedes resume, followed by suggestions and statistics. Keep the existing Account overview title but use concise task-oriented subtitle copy. Avoid a second prominent local-account badge duplicating the global status.

| Section/action | Classification | Treatment |
| --- | --- | --- |
| Current Focus and queue | Actionable | Primary personal-work region |
| Continue where you left off | Actionable | Early navigation, honest recent-edit wording |
| Suggested P1 targets | Actionable | Independent secondary advice |
| Collection progress | Informational with collection links | Compact paired summaries |
| Perk access | Informational with library links | Compact paired summaries |
| Distribution | Informational | Lower, familiar bars |
| Favorites | Actionable shortcuts | Secondary, separate from progression goals |
| Setup and catalog | Administrative | Conditional setup, quiet catalog/details |
| Export and save/writer status | Administrative/status | Preserve global availability and prominence appropriate to safety |

## Current Focus

Resolve across the complete global array, ignoring viewing filters:

1. Character ID resolves in the catalog and has a saved character record.
2. Character is owned.
3. Current Prestige is less than target Prestige.
4. Select the first entry meeting all three conditions.

Display its global position, character name, textual side, current Prestige, Bloodweb level, target, truthful benefit explanation and a “Continue with <character>” Overview link. Focus is a derived highlight within the queue panel. No persistent pin, active-character flag, or separate Favorite behavior.

Completed/unowned/unknown entries do not block focus. Corrected Prestige or restored ownership can make an earlier entry eligible again. The focus can change; array order does not. Side filtering never creates a side-specific focus.

## Prestige Queue

### Minimum useful V1

One array, one entry per canonical character, global order represented solely by array position. Only owned, catalog-resolved characters may be newly added. Append new goals; never auto-promote recommended candidates. Each row shows global position, side, current Prestige, target, Bloodweb and status. Show actual marginal native-perk value where relevant, not an unconditional “3 perks.”

Provide add, target edit, remove, Move Up and Move Down. Remove deletes only the goal, not character progression. A completed row offers raising the target or removal. Existing unavailable rows remain removable. Existing goals can be edited when catalog/current character state resolves, including an unowned character, provided the new target exceeds recorded current Prestige; editing never adds a new unowned entry. Unknown rows support removal/reordering but cannot safely offer target editing or navigation until resolved.

Keep existing incomplete targets unless the user explicitly changes them. Do not create duplicates to represent multiple stages; raise the existing target. Favorites retain their current independent meaning and data.

### Preview and management

The default compact view exposes the first three global positions and the focus position if outside them. Show the focus's detailed content once; a preview marker can identify that same position without duplicating its full card. Completed/unavailable rows remain represented, not silently hidden. “Manage queue” expands the full ordered list within the same panel; no new queue route is needed.

Management may have All / Survivors / Killers filters, stored only in view memory. Keep global position labels. Unknown entries appear in All with an unavailable warning because their side cannot be resolved. Enable reordering only in All and explain “Show All to change global order.” This avoids ambiguous moves over hidden opposite-side entries. Filtered lists do not create separate queues.

### Empty states

| Condition | Copy/action |
| --- | --- |
| No entries | “Choose the characters you want to work on next.” / Add character |
| No owned candidates | “Mark a character owned to add a goal.” / collection or incomplete setup link |
| All known entries complete and no unavailable entries | “All queue targets are complete.” / Manage targets |
| No focus, with unavailable entries | “No available unfinished goals.” / Manage queue, explain blocked entries |
| Role filter has no entries | “No Survivor/Killer goals.” / Show All |

Never claim the whole queue is complete when unknown entries cannot be evaluated. Do not auto-fill an empty queue from suggestions.

## Prestige target behavior

New/edited target must be a positive safe integer greater than that character's current Prestige. P1/P3/P6/P9 shortcuts are conveniences; disable shortcuts already reached. Use the existing model's safe-integer limits rather than silently inventing a game maximum. Higher real-game constraints can be considered only through an explicit future domain decision.

Stored existing targets remain valid at or below current Prestige: they describe completed goals. Import/load validation must not apply the greater-than-current creation rule, nor require ownership/catalog resolution.

Completion is `currentPrestige >= targetPrestige` where the character resolves. No flag or date. A corrected lower Prestige reverses completion automatically. For unowned known characters show unavailable status and, if applicable, completion separately; ownership still blocks focus.

Perk explanation uses current `globalTier`, `isAvailable`, source IDs and native IDs. P1 grants up to Tier I, P2 up to Tier II, P3 up to Tier III; count only native perks whose availability/tier would actually improve given existing overrides/General status. Targets above P3 are personal progression goals and never imply a new global perk tier. A higher target may mention an intervening P1/P2/P3 benefit only explicitly as an earlier milestone on the way, not as a benefit of P4/P6/P9. If there is no marginal benefit, do not show a fabricated unlock count.

## Suggested targets

Retain `src/app.js`, `dashboard()`'s algorithm: owned characters, count globally locked native perks, exclude zero, sort missing descending/Bloodweb descending/name ascending, top five. Name the section “Suggested P1 targets” to make its scope clear. Higher goals belong to the manual queue; no generalized recommendation engine in V1.

Keep recommendations visible independently even when the queue exists. Mark existing goals “In queue”; new candidates offer Add to queue, which opens target selection with valid P1 preselected. Confirming appends. Opening a suggestion navigates to Overview. Changing the queue never silently changes ranking rules, and ranking never changes queue order. Do not repeat a “best next unlock” callout on perk cards.

No candidates: distinguish no owned characters from no remaining native P1 access targets. Use “No remaining P1 unlock suggestions” rather than claiming all possible progression is finished.

## Collection progress

Preserve paired Survivor/Killer cards with owned / catalog total, locked, P1+ and P3+. Use compact numbers and View collection links. Counts remain owned-only. Zero locked: show 0 or “All characters owned,” with no acquisition prompt.

Keep total Prestige, average Prestige and owned Favorite count available in a small native details disclosure within summaries; they do not earn primary visual weight. This retains the existing calculations without introducing a Statistics page. It does not delete any data. Favorite shortcuts remain independent and secondary, including explicit “Not owned” labels when appropriate. No new active/pinned concept.

## Perk progress

Compact role cards: available / total, locked, global Tier III, library link and one access bar. Optional access percentage is derived from the same count, not a second visual dashboard gauge. Label clearly as account access. General availability does not mean every character personally owns that perk. Global Tier III is worth retaining but should be secondary to access counts. Do not confuse this with personal inventory completion.

## Prestige distribution

Retain P0/P1/P2/P3+ buckets, owned-only counts and simple bars. Place lower. Keep concise P1 -> I / P2 -> II / P3+ -> III explanation. No new chart library, additional Prestige buckets or animated charts. No owned characters: show a brief empty state rather than interpreting zero bars as account progress.

## Continue where you left off

Use the existing character `updatedAt` values; no schema extension. Up to five catalog-resolved characters sorted by parsed timestamp descending with a deterministic name tie-break. Preserve stored timestamp bytes. Display current Prestige, Bloodweb and edit time, with “Recently edited characters” supporting text. Retain unowned recent records with a label; they may open Overview but do not become progression focus.

All links open Overview. No claim of returning to a session, task or previous tab. Viewing alone does not update activity. Queue-only edits should update account time without updating the character timestamp, avoiding artificial resume activity. No activity: “Recently edited characters will appear here.” A relative timestamp should expose its absolute time through a semantic time element or accessible detail; avoid a timer subsystem solely for this copy.

## Recently completed

Not recommended as a separate V1 area. Completion markers inside the queue provide useful state, but there is no reliable completion time/history. Current Prestige and latest edit cannot establish a milestone event; backups are not an event log. Do not persist dates or use latest edit time as a fabricated completion date.

## Account Setup behavior

Recommend a restrained Account setup prompt while account `setupComplete` is false. Hide that front-page prompt once complete, but retain an explicit “Review account setup” entry on Data & backups using the existing workflow. Do not infer completion merely from owning characters, or clear per-character setup flags when reviewing it.

This is distinct from “Run character setups,” which operates on owned characters with incomplete personal Bloodweb setup. Keep the persisted account completion field and existing three-step semantics. No new settings route or setup model.

## Catalog/version presentation

Replace the large repeated banner with a quiet line using actual `catalogInfo`: “Catalog: DBD 10.1.2a · Verified Oct 5, 2026” and About your data link. Do not claim a newer patch. Full counts, provenance, catalog/save separation and alias rules remain on the existing Data & backups page and footer link. Catalog provenance stays discoverable; it need not compete with the first action.

## Global actions

Keep Saved locally/read-only/recovery status in the global header. Keep Export JSON globally accessible: local-first portability is a functional need across views. Retain Run character setups as the existing global batch action; it supports onboarding across characters and should not move merely for Dashboard aesthetics.

On narrow widths allow header actions to wrap into an additional row with readable labels; do not hide error/writer status or compress actions below usable sizes. Continue existing error handling, disabled export during blocked storage, and writer gating. No new menu subsystem solely for cosmetic consolidation.

## Navigation into character workspaces

Human-approved contract: every Dashboard character action -> `#character/<canonical-id>/overview`, including Current Focus, Prestige Queue, Suggested P1 targets, Favorite shortcuts and recent edits. Use real links so open-in-new-tab and deep linking work. Queue controls remain buttons. Consume the shared route contract in `../character-update-rework/04-routing-and-compatibility.md`; no last-tab memory or intermediate character popup.

Approved workspace navigation is Survivor Overview / Perks / Items & Add-ons and Killer Overview / Perks / Power & Add-ons. Overview supplies status, Notes and Edit Character entry. Existing `#manage/<id>` remains a parser compatibility alias to Perks; `/update` maps to focused perk reconciliation and `/legacy` retains the old manager. Dashboard uses Overview, never a legacy inventory URL as a substitute. Implement the destination before switching character action producers; this is an implementation dependency, not an unresolved product decision.

## State model

Dashboard-owned schema field (complete v2 also includes the separately designed per-character quantity maps):

```json
{
  "schemaVersion": 2,
  "prestigeQueue": [
    { "characterId": "zarina-kassir", "targetPrestige": 1 },
    { "characterId": "the-artist", "targetPrestige": 4 }
  ]
}
```

Illustrative IDs above follow catalog slug conventions; implementation must resolve actual `characterById` entries rather than accept names/examples as identifiers. Other supported save fields remain present unchanged.

No `side`, stored rank, current Prestige, Bloodweb, native-perk count, note, completion flag, focus flag, completion timestamp or metadata. Role and name come from the catalog; order comes from the array. Omit queue notes in V1: existing character notes already capture personal reasons. Show model-generated benefit text where truthful, and provide Overview access to notes. No selected-perk-goal subsystem.

### Deterministic validation contract

- V2 requires a `prestigeQueue` array, including `[]`; a missing/malformed v2 field is an invalid save. V1 gets an empty array through migration.
- Each entry is an object with a character ID using the existing `safeId` rules and a positive safe-integer target.
- Duplicate character IDs invalidate the candidate; do not guess which target/order the user intended.
- Malformed IDs, negative/zero/fractional/unsafe targets and non-array shapes fail the entire candidate with an entry-index/field explanation. No partial salvage or silent dropping.
- Unknown well-formed IDs are valid, retained exactly with their position/target and warned about. Do not require that their catalog or progression record exists; do not manufacture a record merely to validate a goal.
- Known unowned/completed goals are valid stored data. Creation/edit rules are separate from import rules.
- Do not persist unsupported entry metadata. Unsupported future schema versions remain rejected; queue fields of known v2 are canonicalized according to their explicit contract.
- Failed import/current-save validation leaves existing stored bytes and in-memory state unchanged. Recovery remains explicit, using current original-data preservation behavior.

## Persistence

Use the existing progression document and storage key, not a second queue store. Extend `freshSave`, canonical validation and version dispatch in `src/model.js`; `src/storage.js` continues to validate every write. Queue mutations follow `src/app.js`, `commit()` and the existing `src/editor.js` writer capability. Queue editing controls/actions must be included in editor gating; read-only users may inspect/navigate but cannot mutate goals.

No write on rendering just to mark completion or move focus. Queue management filters/disclosure are ephemeral. Reset progression clears the queue only as part of the existing explicit backed-up reset; ownership changes never clear it.

### Schema migration versus account normalization

The human approved separate concerns:

```text
raw valid v1 input
 -> current v1 field validation/defaults
 -> existing account-rule normalization where the current load/replace path applies it
 -> existing alias consolidation where applicable
 -> structural v2 conversion: schemaVersion 2, prestigeQueue [], empty inventory.items/addons on character records
 -> explicit v2 validation/canonical state
```

Preserve existing semantics and entry-point behavior for `applyAccountRules` and `syncGlobalInventories`. Do not spread account-rule mutations to parse-only or normal-save paths that do not currently apply them. `accountRulesVersion: 1` saves retain supported values through structural conversion; historical behavior for missing markers is unchanged. Existing import/replace correction markers remain existing behavior, not a new queue migration feature.

Structural conversion does not recalculate character progression, change Bloodweb/settings/Favorites/ownership/overrides, reinterpret personal perks, or clean up unrelated data. Following the human's combined-v2 decision, it also adds empty per-character quantity maps without inferred quantities or character activity. Existing canonical defaults and alias behavior must be distinguished from new schema conversion in tests and documentation. Full quantity validation/unknown-ID handling is specified in `../character-update-rework/05-inventory-and-editing-design.md`; queue validation above is unchanged.

Track whether raw schema was v1 explicitly. Current `TrackerStorage.load()` comparison of normalized versus parsed state alone cannot detect a conversion already performed during parsing. Read-only load may show v2-compatible state and a pending-migration notice, without saving/backing up. Writable persistence follows the existing protected migration/backup pattern, preserving a valid predecessor before replacement. Structural-only conversion should not fabricate recent character activity; leave character timestamps untouched. Existing normalization may update account time as it already does.

## Import/export

Updated app accepts valid v1 and complete v2 input. Explicit v1 import runs the established replace normalization/correction semantics and receives an empty queue and empty quantity maps; import replaces rather than merges, so it retains neither an unrelated current queue nor current stock. Confirmation should make those replacement consequences clear. Complete v2 import/export preserves queue IDs, targets, order, unavailable entries and supported quantity state.

`exportSave()` exports complete schema v2 canonical state including queue and quantity maps, with existing `exportedAt`. A read-only export can serialize normalized in-memory state without a storage write. Local snapshots include both automatically as part of the save. Restore validates/migrates the selected snapshot; v1 snapshots restore an empty queue and quantity maps. Reset takes the existing backup first and starts with `[]` and empty maps.

Touchpoints: `src/model.js` version/default/validation/serialization functions; `src/storage.js` load/migration signaling and protected backup/save/replace paths; `src/app.js` queue commit actions, import/restore/reset, Data & backups schema label and copy; `README.md` version portability. `index.html` retains export/import infrastructure. No new backup system.

## Backward compatibility

Classification: **SMALL BACKWARD-COMPATIBLE EXTENSION for the updated application**. The updated app reads v1; writes/exports complete v2. Older v1-only apps intentionally reject v2 instead of accepting it and stripping goals or stock. The human approved extending the planned queue-only v2 to include inventory during Character Workspace design; no queue-only v2 release or immediate quantity-only v3. This supersedes the schema-1 constraint in `plans/rev1/README.md` only as explicitly approved by the human. No downgrade serializer or merge migration in V1.

Existing progression, unknown supported IDs, backup/recovery and file/localhost behavior stay intact. Direct-file and localhost storage remain separate; JSON portability is still essential. Future versions remain an explicit validation boundary.

## Responsive behavior

- Wide desktop: bounded content width using existing shell; queue/resume pair, suggestions below, paired role summaries. Do not stretch queue into a many-column table.
- Desktop/tablet at <=1100px: work regions stack in DOM order; existing summary pairing may remain where it fits.
- Narrow/mobile <=760px: single-column summaries and queue; actions wrap beneath name/goal; header may grow to fit actions. Distribution charts may stack where their labels cannot fit.
- Long names, unknown IDs, large target values, 200% zoom and narrow 320px width must not create page-level horizontal scrolling. Navigation's existing horizontal strip is a separate shell convention.
- Queue management remains an ordered list on every width. No horizontal table or pointer-only interaction.

## Accessibility

- Use headings, native ordered-list semantics, real character links and independent button controls; avoid nested links/buttons or a clickable entire row containing controls.
- Textual Survivor/Killer, Complete, Not owned and Unknown labels accompany icons/colors.
- Move buttons include character names, preserve stable focus across `preserveRender`, disable array boundaries and politely announce “<name> moved to position <n> of <total>.” Filtered position numbers are global.
- After removal, focus a neighboring management control or Add character; after target editing/add, preserve a predictable control. Focus changes must not occur merely because derived Current Focus changes.
- Keep keyboard access and adequate touch targets; visible focus uses existing conventions. Respect reduced motion.
- Progress bars have accessible names/values and adjacent text counts, or are decorative when equivalent text already communicates the metric. Do not rely on color alone.
- Native dialogs may be reused for bounded add/edit selection with labeled target inputs, inline validation and proper focus return. Do not add a custom dialog primitive.
- Drag-and-drop is deferred; Move Up/Down is sufficient and accessible for V1.

## Component architecture

Preserve string-rendered views, hash routing and event delegation. Keep `dashboard()` as composition. Extract only the small queue-specific domain/view responsibilities needed to avoid duplicating logic; this is a conceptual boundary, not a mandated new file structure or implementation sequence.

Queue derivation should be independently testable: input save/catalog -> ordered row states, marginal benefit, focus. Creation/target editing validation must remain distinct from persisted record validation. Do not refactor unrelated filters, inventories or character-detail logic.

## Existing components to reuse

`src/app.js`: headings, section titles, empty states, `characterArtwork`, role/perk summaries, distribution, `preserveRender`, commit/error/dialog patterns. `src/model.js`: role/global/availability rules and safe validation conventions. `src/assets.js` / `data/asset-manifest.json`: portraits/fallbacks. `styles.css`: panels, grids, typography, tags and focus styles. `index.html`: main/status/dialog shell. `src/editor.js` / `src/storage.js`: writer safety and canonical persistence.

## Proposed components

Conceptual view functions only, none added by this task:

- Prestige queue panel with integrated focus, preview and expanded management.
- Reusable queue row for status, link and management controls.
- Bounded add/edit target form using native dialog conventions.
- Refined suggested-target rows and recent-edit cards using existing patterns.

No independent focus component with separate state, queue route, statistics page, or new component library.

## Testing strategy

No implementation tests/builds were run for this design-only task. During later approved implementation, extend meaningful existing coverage:

- `tests/model.test.js`: v1/v2 acceptance, exact queue round trips, strict invalid records/duplicates, unknown preservation, creation versus completed import rules; legacy normalization separately from structural conversion.
- `tests/storage.test.js`: migration signaling even after parsing, no-write read-only loads, backed-up writable transition, invalid candidate/write failure retaining bytes and memory; restore/import/reset with queues.
- `tests/editor.test.js`, `tests/recovery.test.js`: writer-gated goals/migrations and recovery preservation.
- Queue domain checks: first eligible focus, completed/unowned/unknown skips, corrected Prestige/ownership reactivation, array-order stability, side filters not affecting focus, marginal perk benefits and higher-target wording.
- `tests/browser/smoke.mjs`, `tests/browser/data-flows.mjs`, `tests/browser/editor.mjs`, `tests/browser/recovery.mjs`: reload/import/export/restore, disabled mutations in read-only state, keyboard add/edit/remove/reorder, focus/announcements, Overview links after its route is approved, existing setup/export behavior.
- Disposable browser profiles for 320/500/760/1100/1440/1600 widths, long labels, zoom and keyboard access. Direct-file acceptance remains separate from localhost checks. Do not use the user's active save for verification.

Use the existing Node/Playwright tooling. No dependency additions. Routine release/build commands can generate files and must wait for implementation authorization.

## Risks

1. **Data loss:** canonical validator strips unrecognized fields unless extended; schema v2 and strict round-trip tests are essential.
2. **Undetected pending migration:** parser normalization can hide structural changes from load comparison; explicit raw-version signaling is required.
3. **Legacy interpretation:** schema migration must not broaden historical normalization or apply it at new entry points.
4. **Navigation implementation dependency:** Overview is finalized at `#character/<id>/overview` but not yet implemented; no substitute inventory route should silently ship.
5. **Changing focus:** corrections/imports may reactivate earlier goals; explain derived behavior without moving their order.
6. **Accessibility:** full HTML replacement can lose reorder-control focus; stable IDs and purposeful restoration are required.
7. **Misleading domain copy:** General/overridden perks reduce unlock value; P4+ does not grant a new global tier.
8. **Unverified visual assumptions:** source review supports hierarchy decisions but does not prove the final layout; later disposable browser review is required.

## Future compatibility

Character Overview owns progression context; Dashboard consumes `#character/<id>/overview` through the finalized route contract. No competing character-tab model is defined here.

Shared inventory quantity requirements are recorded in `../character-update-rework/01-survivor-items-addons-quantity-requirements.md` (the original filename is retained). Initially Survivor-only, the human extended the pattern to Killer Add-ons on 2026-10-13. The finalized Character Workspace documents 03–05 now define structure, routes and quantity persistence. Direct numeric entry, whole numbers >=0, positive-first/muted-visible-zero groups, stable catalog order and commit-before-resort apply to all three inventory types. Catalog/reference verification remains an implementation data dependency.

Do not reserve Dashboard inventory panels or add item/add-on totals. Per-character inventory uses canonical IDs and sparse positive quantity maps under the complete v2 design; neither quantity fields nor metadata belong in the Prestige Queue. Dashboard hierarchy and queue semantics remain unchanged.

## Explicitly deferred features

Drag-and-drop; pinned/active characters; queue-specific notes; selected-perk goals; completion history/archive/dates; auto-removal; last-used-tab/visit tracking; locked-character acquisition planning; bloodpoint budgeting/estimates; streaks/achievements/daily or weekly goals; additional charts; new statistics route; inventory summaries; Survivor/Killer inventory implementation; broader recommendation optimization; schema downgrade export.

## Recorded product questions

### 1. Queue scope
**QUESTION:** One combined queue or separate role queues?

**DECISION:** Combined global manually ordered queue with role labels; optional filters do not split storage. Suggestions never reorder it.

**DESIGN CONSEQUENCE:** One array and one global focus; filtered views retain global positions.

### 2. Target Prestige
**QUESTION:** Arbitrary targets, preset milestones or P1 only?

**DECISION:** Any whole-number target greater than current Prestige when assigned, with P1/P3/P6/P9 shortcuts. P1/P2/P3 may explain real perk significance; higher targets are personal goals.

**DESIGN CONSEQUENCE:** Store one integer; no perk-only goal schema or fabricated higher-tier benefits.

### 3. Completion
**QUESTION:** Remove, archive or retain completed goals?

**DECISION:** Retain; derive `current >= target`; allow removal/raising target. Corrections reverse completion. Focus skips complete entries.

**DESIGN CONSEQUENCE:** No persisted completion flag/date/archive; completed targets remain valid stored records.

### 4. Character destination
**QUESTION:** Overview or last-used tab?

**DECISION:** All Dashboard character actions open Overview. No tab tracking. The subsequent Character Workspace decision approves the role-specific section structure.

**DESIGN CONSEQUENCE:** Consume authoritative `#character/<id>/overview`; no tab-history state. The route product dependency is resolved.

### 5. Ownership eligibility
**QUESTION:** Owned-only additions or allow locked acquisition plans?

**DECISION:** Owned-only additions. Preserve later unowned and unknown entries/targets/positions; skip them for focus; ownership restoration restores eligibility.

**DESIGN CONSEQUENCE:** Mutation eligibility differs from persisted validity; unknown IDs survive import/export and remain removable.

### 6. Save version
**QUESTION:** V2 or optional v1 field?

**DECISION:** V2 with automatic v1 support/empty queue. The human subsequently approved the complete v2 release including empty per-character quantity maps. Older apps reject v2 rather than silently stripping goals or stock. Invalid queue records still need deterministic handling.

**DESIGN CONSEQUENCE:** Explicit version boundary, structural migration, strict fail-without-replacement validation, v2 round-trip retention.

### 7. Legacy normalization
**QUESTION:** Retain existing legacy rules or preserve raw legacy fields without them?

**DECISION:** Retain established rules unchanged; apply structural conversion to normalized v1 state. The original queue approval adds version/empty queue; the subsequently approved combined-v2 contract also adds empty inventory maps without altering existing state.

**DESIGN CONSEQUENCE:** Separate schema migration from account interpretation and preserve current entry-point behavior.

## Design approval and remaining dependencies

The human reviewed and approved the complete Option B Dashboard design on 2026-10-13. No unresolved Dashboard product decisions remain. Approval explicitly includes:

- Prestige Queue with integrated Current Focus as the primary work area, with Continue where you left off near the top.
- Independent Suggested P1 targets without recommendation-driven queue reordering.
- Account Setup prompt only while incomplete; Review account setup available through Data & backups afterward.
- Total Prestige, average Prestige and Favorite count in compact details/disclosures rather than primary metrics.
- Preview of the first three global queue positions plus Current Focus when outside them; Manage Queue expands the full ordered list.
- No queue-specific notes in V1; existing character notes are sufficient.
- Move Up / Move Down ordering in V1; drag-and-drop remains deferred.
- Previously approved schema v2, migration, queue, recommendation, accessibility and persistence decisions.

The Character Workspace structure and canonical route contract are finalized in `../character-update-rework/03-character-workspace-design.md` and `04-routing-and-compatibility.md`. Complete v2 quantities and editing are defined in `05-inventory-and-editing-design.md`. Implement Overview before switching Dashboard links; implement the complete queue/inventory v2 boundary before persistent writes. Verified inventory/reference catalogs remain workspace data dependencies, not new Dashboard scope.

**Review gate: APPROVED.** Dashboard Option B remains approved; its Character Overview product dependency is resolved. This documentation-only update creates no implementation plan and changes no application code. Stop here as requested.
