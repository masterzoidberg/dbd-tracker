# Rev02 Survivor Workspace Design

## Status

**Full Survivor workspace design-direction plan · Planning only · Not implemented · 2026-10-22.** Covers the shared shell, Overview, character Perks, Items & Add-ons, and redistribution of Edit Character capabilities for every Survivor. It does not redesign the standalone account perk library or any Killer screen.

Authority: explicit user direction and approved decisions first, then the [Dashboard plan](01-dashboard.md), [Survivor roster plan](02-survivor-roster.md), [global strategy](00-ui-ux-redesign-strategy.md), [audit](00a-ux-audit-matrix.md), and [questions register](00b-open-design-questions.md). The roster document distinguishes settled direction from recommendations; its open choices are not silently approved here.

**Settled in this brief:** three principal tabs; meaningful character artwork; compact contextual neighbors preserving the section; character fields edited in Overview; perk records edited in Perks; quantities edited directly in Items & Add-ons; six-item roster paging does not extend to perks; family → Item → compatible Add-ons; flat rarity-sorted Add-ons; immediate quantity steps. Detailed geometry and save-model recommendations below remain for review. No implementation phases, coding checklist, or final roadmap are included.

## Workspace Purpose

**The personal record for one Survivor: understand and manage one character.**

The roster compares and finds characters. This workspace explains progression, account access, personal records and stock, and provides a natural place to change each. It should be calm while browsing and precise during repeated entry. Archive-like organization and tool-like editing are design guidance, not new product names, themes or modes the user must configure.

## Primary User Jobs

1. Recognize the current Survivor and their ownership/Favorite state.
2. Read or update Prestige and Bloodweb accurately.
3. Distinguish what native perks unlock account-wide from what is effectively available on this Survivor and what is explicitly recorded.
4. Browse and reconcile personal perk inventory against the game.
5. Find an Item, select its compatibility context and enter Item/Add-on quantities quickly.
6. Review setup or write notes without entering a long unrelated form.
7. Move to another Survivor in the same working section, and return to the invoking roster without losing useful context.

## Current Workspace Assessment

### What Works

- Canonical character/section routes and three principal navigation links already exist. Previous/next uses role catalog order and preserves supported sections and perk-update mode.
- The same shell and neutral perk/quantity helpers support both roles; no framework migration is needed.
- Effective inventory, recorded tier, automatic minimum and account provenance are separately calculable. Existing data rules support truthful labels without rewriting saves.
- Perk reconciliation already has inline quick tier pickers, a detail editor, search, categories, all-role candidates, density preferences and saved-change feedback.
- Stock supports family navigation, a selected-Item dropdown, compatibility filtering, flat Add-ons, rarity direction, direct numeric entry and −1/+1/+5/+10 steps.
- Validation, dirty-draft protection, failed-save retention, writer locking, backups for setup/data replacement and unknown-record preservation are meaningful strengths.

### Current UX Friction

- The red Edit Character action competes with every tab's task and repeats fields that already have operational homes. A small progression change requires traversing a composite form with Save at the end.
- Browse perk cards unexpectedly enter Update Inventory; the transition should be an explicit choice. Browse has no search/filter toolbar today; those controls live in update or legacy/library paths.
- Native “effective I” can coexist with “Personal record: None.” That is valid data with weak explanatory hierarchy, not a reason to rewrite native records.
- Setup mixes a directly saved Set Prestige 1 action with draft Bloodweb/perk selection and Finish. Cancel does not undo the previously saved Prestige action.
- Changing Survivor resets the stock session to the first family; perk-update search/category/selection resets when its canonical update route changes. Preserving a section currently does not preserve its working filters.
- Item selection is a dropdown below the Item grid; the cards themselves do not identify/select the compatibility context. Filtering may hide the selected Item without changing that context.
- Quantity entry errors/pending edits need to remain discoverable while filters, selection or navigation change. Current helpers handle many cases; their existence must survive layout changes.

### Current Visual Friction

- The header uses an 80px portrait beside large, nearly full-width previous/next boxes; portrait and progression have less presence than navigation chrome.
- Every tab repeats a large context/action area. Perk Update adds another title/back/intro/control stack; stock adds another page heading and provenance before quantities.
- Overview nests bordered native-perk objects inside a bordered section and gives normal setup substantial area. Stock summaries mix catalog size, patch and saved entries in prose.
- Stock cards use a 144px media region and minimum 330px card height; Add-ons receive the same geometry as Items. In the prior audit the first stock input began around document y=1108 desktop and y=1483 phone.
- The current phone quantity layout can leave a 31px input beside four 44px buttons. The problem is insufficient space for the number, not lack of buttons.

Evidence: existing [Overview](evidence/survivor-overview-1440.png), [Edit Character](evidence/character-edit-1440.png), [Perk Update](evidence/perk-update-1440.png), [stock controls](evidence/survivor-stock-controls-1440.png), and [phone stock](evidence/survivor-stock-390.png), read with current source. Published/development equivalence is not assumed; no new live edits, test runs or screen-reader certification were performed for this plan.

## Shared Workspace Shell

### Character Header

Use one recognizable hierarchy throughout:

**Back to Survivors / compact neighbors → portrait + name + Survivor → Prestige/Bloodweb → ownership/Favorite and contextual actions → section navigation → content.**

Give the artwork more useful area without enlarging every wrapper. Explore a roughly 144–176px portrait on desktop Overview and a still recognizable 112–128px portrait on operational tabs, versus today's 80px. These are review candidates, not final tokens. Use the same placement/type roles/status positions across tabs; reduce repeated explanation and space on operational tabs. This reconciles stronger character presence with the need to reach editing controls promptly.

Prefer contain positioning for existing portraits with actual crop review; do not stretch, cut off faces, or assume roster Lore art and workspace portrait mappings are interchangeable. Use explicit existing mappings and a named textual fallback. Keep the name on a stable background, naturally wrapped for long/paired identities. No decorative gradient, texture behind text, giant banner or new asset generation is required.

The name is the H1. Prestige is the strongest numeric anchor; Bloodweb is adjacent and subordinate. Ownership is quiet readable text with contextual access in Overview. Favorite can remain one small, independent, labeled toggle with a practical target; show its saved state consistently on all tabs. Remove the global red Edit Character action from the proposed shell once its capabilities have approved destinations. A low-emphasis “Edit progression” link from another tab can navigate to the Overview editor rather than create a second editor.

Use natural spacing and a rule before section navigation; do not turn portrait, P value, Bloodweb, Owned and Favorite into separate equal cards. Header metrics are the Overview progression summary, so the body need not repeat them as another dashboard panel.

### Previous / Next Survivor

Keep real links with adjacent names, for example **‹ Ace Visconti** and **Adam Francis ›**, integrated into a compact navigation line. Visual compactness must retain usable hit areas and wrapping for long names. At catalog ends show a quiet disabled/absent direction with an understandable label; do not invent wraparound.

Retain current canonical same-role name/catalog ordering and section preservation: Perks → next Survivor's Perks; Update Inventory → next Survivor's Update Inventory; stock → next Survivor's Items & Add-ons. Do not navigate to Overview unexpectedly. Overview-specific drafts must resolve before moving; do not carry unsaved values to the next character.

Recommend preserving search/category/density for repeated perk reconciliation and family/search/stock filters for repeated stock work **within the same browsing session**. Selected Item may carry over because Survivor Items share a catalog; validate compatibility, clear stale selected-perk IDs, and show zero quantities for the new Survivor rather than copy records. Completed edits/change counts remain scoped to each character/session. This is proposed context retention, not current behavior or an export requirement. See SW04.

Back to Survivors should honor the roster's proposed invoking context. Filtered-roster neighbor traversal remains W03; recommend catalog neighbors for predictable direct links, without claiming they are filtered results. A scoped neighbor feature is not added here.

### Workspace Tabs

Keep **Overview · Perks · Items & Add-ons** as the backbone. These are route links, not an ARIA tab-widget unless its full keyboard model is intentionally adopted later. Retain `aria-current="page"`, with an underline/rule or weight/shape change in addition to color. Ordinary Tab/Enter navigation and browser history work naturally.

Editing/update/setup are subordinate states of their parent tab, not fourth/fifth principal tabs. Current `/edit` and `/setup` routes do not highlight one of the three tabs; the proposed replacements should identify Overview as their parent. Perks Update continues to show Perks active. Preserve canonical deep-link compatibility; a later route decision should land old edit links at the appropriate Overview management entry, not a missing page or the Dashboard. No exact routing edits are prescribed.

### Content Width

Use one coherent outer canvas, with task-specific inner measures. Initial desktop exploration:

| Surface | Useful width direction | Reason |
| --- | --- | --- |
| Shell | Align to the shared working canvas and current character | Stable identity and navigation across tab changes. |
| Overview | Roughly 1000–1150px; notes/reference prose about 60–75 characters per line | Native trio and compact summaries, without stretching prose. |
| Perks | Use available working width, exploring roughly 1200–1440px on wide screens | Continuous recognition grid; room for a detail editor only when useful. |
| Items & Add-ons | Widest practical task area within the shell | More numerical records visible; allocate width to inputs and names. |

These are bounded exploration ranges, not a new site-wide max-width. At 1440px today's sidebar/padding leaves about 1148px; no tab can assume a 1440px content region there. The current 1750px main cap is already generous. Purposeful internal grouping, smaller utility wrappers and task-sized images matter more than stretching every line to that cap. Shared G04 decides final widths.

### Responsive Behavior

Retain identity, current section, working selection and save mode at every width. Collapse parallel areas when they no longer fit readable content; do not preserve the present 300px perk detail sidebar at tablet widths just because the shell breakpoint is 760px. Default to normal document flow; a new sticky header is not assumed. A larger opening portrait must not become a permanent tall obstruction during entry.

## Character Editing Philosophy

### Current Edit Character Assessment

The current editor is an in-memory draft of the selected character, with a baseline and a fingerprint of the entire save. It previews changes without writing; its Save validates a candidate and commits the character once. It is more than a visual wrapper around the direct editors.

| Capability / behavior today | Audit finding | Proposed home / preservation requirement |
| --- | --- | --- |
| Prestige + Bloodweb | Strict whole-number parsing; Prestige non-negative safe integer, Bloodweb 1–50; invalid raw text remains dirty | Overview progression editor; keep the pair in one explicit validated commit. Do not invent a P100 input cap or automatic Bloodweb reset. |
| Owned, Favorite, notes | Typed draft fields persisted on Save | Ownership/Favorite contextual state controls; notes editor in Overview. Preserve plain-text escaping, stored text and retry on failure. |
| Normal personal perk records | Same-role validation; automatic minimum floors; clearing a record does not remove a derived minimum | Perks Update controls with clear recorded/effective meanings. |
| Historical acquisitions | Distinguishes absent/unconfirmed, explicit zero/Not Owned and positive tiers; normal acquisition cannot downgrade | Keep historical controls separate from generic None/I/II/III. |
| Deliberate personal correction | Separate disclosure invokes `correctPersonalPerkTier`; can lower/clear records, including historical records, without changing derived floors | Required Perks correction path with explicit scope and feedback. Ordinary Update controls alone do not expose all of this capability today. |
| Final-state validation | Checks newly changed normal personal tiers against automatic floors after the draft's final Prestige; untouched lower records remain records | Preserve record-versus-effective distinction and relevant final-state validation. Never rewrite untouched records just to equal a derived minimum. |
| Item/Add-on quantities | Reuses quantity interaction in draft mode; zero deletes known stock entries; unknown stock preserved | Direct stock editor remains the natural home, with the same validators and preservation rules. |
| Multi-field Save | One candidate commit can atomically change progression, metadata, perks and stock; no-op Save does not update timestamps | Scoped transactions preserve their own atomicity. Losing the cross-task all-character transaction is an explicit trade-off, SW03, not an assumed equivalence. |
| Conflicts / dirty state | Any underlying save change invalidates the full-save fingerprint; storage event marks conflict; raw errors keep session dirty | Scoped editors must detect stale data, retain drafts and prevent overwrite. Do not casually weaken conflict checks to a single field while account floors can change elsewhere. |
| Navigation / failures | Save/Discard/Stay for dirty navigation; `beforeunload` warning; failed Save keeps draft; error focuses/reveals relevant control | Preserve equivalent protection for each remaining draft and pending input, including browser Back, character/tab change and attempted unrelated mutation. |
| Setup / migrations | Initial setup is a separate route/helper, not performed by Save Character. Account-rule normalization and schema migration happen at storage/model boundaries | Keep separate setup capability and central normalization. Removing the editor must not delete or relocate migration into a tab-render function. |

Save Character calls `buildCharacterEditCandidate`, then `commit` for the selected character. `commit` checks the writer, clones the save, synchronizes canonical perk aliases, updates timestamps and invokes validated storage. It has no editor-specific migration engine, no automatic full-save backup for every edit, and no special automatic account-unlock write beyond the effects derived from saved Prestige. Candidate validation does not mean replacing the whole live save with the candidate: the selected character is committed and shared normalization still runs.

### Capabilities That Must Be Preserved

Retain every field, deliberate correction, historical zero/unconfirmed semantics, automatic minimum, alias rule, unknown imported record, numeric validation, setup access, save failure recovery, stale-save protection and writer guard. Preserve atomicity for fields that form one task and do not claim a failed write succeeded. No-op saves should remain no-ops.

There is no evidence that the old monolithic **screen** itself is required for migration or setup. Recommend retiring it as the primary interface once replacements cover the audit table. The unresolved cross-task transaction expectation must be reviewed before retiring that behavior; visual dislike is insufficient reason to discard it.

### Contextual Editing Model

| Information | Recommended interaction | Commit boundary |
| --- | --- | --- |
| Prestige / Bloodweb | Overview “Edit progression”; pair of labeled inputs with Save progression / Cancel | One explicit atomic progression save; live preview must be marked unsaved. |
| Ownership | Overview contextual boolean control with a clear label | Immediate validated save; becoming unowned does not erase notes, inventory or progress. |
| Favorite | Secondary independent toggle, consistent in header and Overview | Immediate validated save; not a queue/pin instruction. |
| Notes | Overview Add note / Edit notes | Save note / Cancel; preserve unsaved text on failure. |
| Initial setup / review | Overview actionable status, existing focused setup flow | Preserve current explicit Finish and backup; explain its separately committed P1 action. |
| Personal perks / corrections | Explicit Perks Update mode and scoped correction action | Recommend preserving current per-selection autosave; SW01 records the draft alternative. |
| Item / Add-on quantities | Direct field and step controls in their compatibility context | Existing Enter/field-exit commits and immediate steps. |

### Edit Details Scope

**Recommend no additional Edit Details dialog initially.** Ownership and Favorite already have small natural controls; progression and notes have contextual editors. A metadata drawer would duplicate those homes without another established field to manage. If later approved for a concrete reason, its scope must stay true character metadata; it must not absorb progression, notes, perks or stock.

### Save / Cancel / Unsaved Changes

Use task-specific wording and locally visible states. Global “Saved locally” describes persisted data, not unsaved progression/notes inputs.

- Explicit drafts show Save [task] / Cancel, unsaved status and associated errors; Cancel affects only that draft. Dirty departure offers Save / Discard / Stay. Invalid or failed Save keeps the editor and draft, focuses the error and blocks departure. Preserve an unload warning where supported; do not promise browser-crash recovery.
- Recommend one active explicit draft per workspace at a time. An unrelated mutation, account-unlock change or setup entry must resolve that draft first; simply switching tabs must not discard it. Reference inspection can remain read-only while drafting. This avoids surprising fingerprint conflicts caused by Favorite or account edits in the same UI.
- Autosaved Perks uses **Done / Back to Perks**, “Saved automatically,” and accurate saved-change feedback. Do not offer Cancel implying reversal of saved selections. A staged alternative requires real Cancel/Save and conflict handling; it is SW01, not a cosmetic button rename.
- Quantities retain raw/pending/error state until committed successfully. Before hiding a field through family/Item changes, filtering or route departure, settle valid pending input or keep/reveal the invalid/failed field. Do not silently accept a failed save, reset it to baseline or abandon it behind a filter.
- Setup must accurately explain that Set Prestige 1 saves immediately and Cancel/Exit will not undo it; Bloodweb/perk setup remains draft until Finish. Recommend warning on departure if those setup values have changed. Current general dirty guard is for Edit Character, not equivalent protection for every setup draft.
- External changes or loss of writer capability retain draft/pending text, show conflict/read-only state and require deliberate reload/discard/retry. Preserve current conservative full-save conflict protection until architecture review can prove a narrower merge safe.

## Overview Tab

### Purpose

Read one Survivor's record and perform occasional character-level management. It is not another analytics Dashboard or a second inventory editor.

### Information Hierarchy

1. Progression in the shared identity header, with its contextual edit action.
2. Native perks, using recognizable artwork and unambiguous personal/account facts.
3. Compact links and collection summaries for Perks and Items & Add-ons.
4. Quiet setup status, elevated only when attention is required.
5. Notes preview and contextual editing.

Use open sections, ruled summaries and alignment where sufficient; peer native perks can be grouped without another border inside every badge. An actionable setup warning may rise beside progression because it is an exception; completed setup should not compete with native perks.

### Progression

Use the header's P value and Bloodweb n / 50 as the summary. “Edit progression” opens a focused editor in this Overview region. No duplicate numerical panel is needed below. Preserve stored values, including P0 and large valid Prestige values. Any Bloodweb track represents recorded level only, not linear XP, resource spend or percentage to P100.

Before Save, explain that Prestige changes affect derived account tiers for the source perks and effective inventory elsewhere. Do not change explicit records to match that preview. Lowering Prestige is a correction to the record, not a destructive clearing of personally acquired perks. Notes/state remain outside this progression transaction unless SW03 establishes a concrete need.

### Character State

Owned/Not owned and Favorite have legible text plus compact controls. Favorite stays independent of ownership. No blanket disabling of the character record when unowned: its saved data and native effective minima still exist. Initial setup eligibility remains ownership-dependent. Ownership changes must not implicitly run setup or clear inventories.

### Native Perks

Use the three actual perk images at a readable scale (explore roughly 64–80px) beside names and structured facts. Desktop may place three peer entries across when each supports its name and facts; use stacked entries when they do not fit. Suggested hierarchy:

**Perk artwork + name → On this Survivor: effective Tier I → Recorded: Not recorded → Account: Not unlocked / available tier and source.**

Account provenance is secondary explanatory text, not a row of equal chips. For a native effective I with no recorded copy, say that its native minimum explains the tier. Open richer reference/provenance on deliberate inspection; route “Update record” to the Perks editor for that perk. Do not create an additional native-tier editor on Overview.

### Setup Status

**Normal = quiet; attention = actionable.** Completed setup gets “Setup complete” and secondary Review setup. Owned/incomplete setup gets an actionable Start setup notice explaining that starting records need attention, without claiming ordinary stock or perk editing is prohibited. Unowned gets a quiet eligibility note rather than an alarming false error.

Setup reviews are additive: `completeCharacterSetup` uses maximum existing/selected tiers, saves Bloodweb and marks setup complete. It does not clear/downgrade records or serve as the deliberate correction workflow. Preserve backup-before-Finish, special-acquisition access and the P0/Bloodweb 1 skip rule; current P1 action is a separate immediate commit. Keep these details in the focused flow rather than expand a permanent Overview setup panel.

### Perk Collection Summary

Show **effective owned / same-role total** and **effective Tier III**, with View Perks. `characterStats` reliably calculates these. Label them as effective inventory, not manual reconciliation completeness or account unlock count. No extra charts or completion score. If space is limited, one concise line with the link suffices.

### Items & Add-ons Summary

Use compact labeled figures. Distinguish:

- **Catalog:** current verified Item/Add-on counts (currently 38 and 54), computed from catalog definitions rather than presented as personal ownership.
- **This Survivor:** stocked Item types and Add-on types with known positive quantities, using the roster selectors' meaning. Count types, not copies. A combined stocked-entry total is optional and redundant if both type counts are shown.
- **Unresolved records:** separate concise warning/count with access to the preserved read-only list; do not include unresolved entries in verified-stock totals.

Recommend stocked Item/Add-on type counts as the personal summary, with small catalog context if useful. Do not repeat patch/research prose here. Link View Items & Add-ons directly. The current Overview counts known stored entries and hardcodes catalog counts; the proposed summary must use positive known quantities and explicit scope, not carry over that wording blindly.

### Notes

Empty: “No notes yet” and Add note. Populated: a concise escaped plain-text preview with Read more when needed and Edit notes. The editor opens locally with a textarea and Save note / Cancel. Preserve full saved text and line breaks; do not silently truncate notes to the preview or introduce rich text. Keep errors and unsaved-state feedback adjacent.

## Perks Tab

### Purpose

Support recognition in browse mode and rapid reconciliation in Update mode. Personal character inventory is the primary scope; account facts explain the effective state. No pagination by default.

### Browse Mode

Provide one toolbar: Search perks, scoped Filters, Sort and Compact / Standard / Large density, with a clear Update Inventory action. Count matched versus effective tracked perks. The normal view starts from currently effective inventory as today; an explicit All same-role / special acquisitions scope can expose absent candidates when needed. Name that scope clearly instead of treating an absent candidate as owned.

Browse cards open reference/state inspection, not silently enter editing. Update Inventory enters a clearly labeled operational state within Perks. Carry the query/density and a relevant inspected perk into that transition; no records change just by entering. This is a behavior recommendation, not existing browse behavior.

### Editing Mode

Retain rapid tier picking through the current quick picker or a comparably reachable selected-perk control group. A compact `Not recorded | I | II | III` group is appropriate for ordinary perks; historical records need their separate options and acquisition floors. Do not add four persistent buttons to every browse card or make a card click cycle its tier.

The selected editor should show effective tier, explicit record, automatic minimum and provenance in a short, aligned facts block. Desktop can show it alongside results only when width supports both. On smaller screens place the editor near the selected object or in an accessible disclosure; avoid sending the user to a large editor above a long grid on every selection.

**Required capability:** move the old editor's deliberate correction workflow here. It must be explicitly labeled “Correct recorded tier,” distinct from ordinary acquisition/reconciliation controls. It can lower/clear a record while derived minima remain effective. Historical acquisition cannot downgrade, but the old editor's deliberate correction can. Preserve that exception deliberately, with before/result explanation; do not universally disable all corrections below the automatic minimum or collapse historical explicit zero into absence. The exact correction guard is SW02.

### Search

Use the existing canonical/alias-aware `perkSearchText` so “Windows” finds Windows of Opportunity and source names/alternate licensed names work. State that search covers perks and source characters; it does not search stock or notes. Keep search focus/caret stable and clear/reset recovery obvious. Search is not currently available in normal browse and will need a shared scoped control contract later.

### Filters

Start with useful existing character concepts: Native (currently category `personal`), General, Account unlocked and All; current Only unrecorded actually means **effective tier zero**, so relabel it “No effective tier” if retained. It is not “no explicit personal record.” The proposed Native label should not imply that every native row has a manually recorded copy.

Tier I/II/III and present/absent effective-tier choices are justified by scanning/reconciliation and can reuse existing model predicates/legacy filtering concepts. They are proposed additions to the current normal/update toolbar, not controls already implemented there. Avoid importing every standalone library facet. Preserve retained personal/historical copies in All even when current account unlock rules do not explain them; those are not corrupt records.

Keep an explicit All same-role / special acquisitions route to exceptional records outside the default union. State the scope, combine filters predictably, show active restrictions and offer reset. A zero-match result must not imply an empty entire inventory. Do not filter on “explicitly recorded” using the helper that only checks effective tier zero.

### Sort

Recommend Name by default, effective tier high/low, and source name for scanning. Current new character grids sort by displayed name only; legacy/shared library has tier/source/global sorting primitives. Any new grid sort is a presentation behavior change to review, not evidence of existing parity. Resolve equal values by displayed name/canonical ID. Keep order stable during a run of tier entry; resort on explicit request rather than move the just-edited object under the pointer.

### Density

Retain the existing three-value preference, optionally labeled Compact / Standard / Large. It is a meaningful exception to the strategy's caution against speculative density switches: the feature exists and this user explicitly values it. Density adjusts art/spacing/columns before shrinking readable names and state text.

At roughly 1200px usable grid width, explore compact minima around 150–165px, standard 190–210px and large 250–280px, with 10–16px gaps: approximately 7, 5–6 and 4 columns respectively. Eight compact columns need about 1270px or more before any side editor; a detail pane reduces the available grid width. These are arithmetic candidates, not promised fixed counts. Do not force the user's exploratory 7–8 across at a laptop width that cannot fit it.

### Perk Card Hierarchy

**Diamond artwork → full readable name → personal effective tier/state → quiet account access/source.** Use one object boundary where needed; avoid stacked badge borders and another frame around the diamond. Keep state text consistent even if rarity/tier imagery already contains color. Display a selected/focus marker without hiding the tier. Show a concise changed/saved marker only when relevant.

### Personal Tier vs Account Access

The model supports a truthful separation:

| Fact | Existing source | Correct interpretation |
| --- | --- | --- |
| Explicit record | Own-property presence in `characters[id].perks`, plus stored value | Missing = not recorded. Historical 0 = explicitly not owned. A helper returning 0 alone cannot distinguish them. |
| Automatic character minimum | `automaticTier` | Native minimum and account-derived tiers; not a manually entered record. |
| Effective personal tier | `inventoryTier` = max(recorded, automatic) | What the tracker shows as usable/tracked on this character under its current rules. |
| Account availability | `isAvailable` | General or globally unlocked; not evidence that this Survivor has acquired a personal copy. |
| Account guaranteed tier | `globalTier` | Highest source Prestige/Legacy/Shrine/manual override. General availability can exist with global tier 0. |
| Provenance | `ownedUnlockSource`, `unlockSource`, candidate facts | Native/Prestige/account override/recorded acquisition explain different dimensions; Native is not itself an account-wide unlock. |

Use **“On this Survivor · Effective Tier II”** as the primary browsing state and reveal **“Recorded: I · Automatic minimum: II”** in the selected editor/details. Zero effective tier is “Not owned / no effective tier” only in that scope; an absent record with a nonzero minimum must never be shown simply as “Not owned.” Source ownership is separate from access, and saved Prestige currently derives tiers regardless of the source's owned flag. Preserve that rule.

### Native Perk State

Native perks can show effective I without any explicit record, including on an unowned Survivor. Explain this once in-context rather than label it an acquisition error. Some native/historical definitions are also General; `globalTier === 0` does **not** universally mean unavailable. Render General availability with no guaranteed global tier when appropriate. Do not overwrite canonical licensed aliases or original/generic naming preferences to simplify the display.

### Save Behavior

**Recommend explicit entry into Update mode while retaining per-selection autosave.** It builds on the existing fast workflow and avoids a second large personal-perk draft system. Successful selections get immediate saved feedback; Done exits. Selection, search, category changes and density do not write inventory. Failed saves retain intended state/retry feedback; read-only mode permits inspection.

Alternative for review: a staged Perks-only transaction with Cancel / Save changes. This provides cancellation across several tier edits, but would change today's persistence, require dirty/conflict handling and accurate candidate previews, and cannot share the “changes saved” wording. Do not mix staged ordinary tiers with immediately saved historical/account edits under one misleading Cancel. This choice is SW01; no new persistence model is approved by this plan.

Account unlock edits remain a clearly separate account-wide action inside reference/provenance access, with explicit scope and immediate validation. They are not personal tier edits. Existing perk dialogs already expose Shrine/Other account controls, with derived Prestige/Legacy facts read-only. Preserve access without making those controls the default reconciliation action; resolve any active explicit draft first.

### Responsive Grid

Use content-fit columns, retain density choice access in a compact menu rather than hiding it unconditionally as today. Two phone columns are acceptable only when names/states remain readable; otherwise one. At zoom, fall back to one without clipping. The tier picker and historical select need room even when art fits in a smaller grid. Continuous scanning and search replace paging; no infinite-loading feature is required.

## Items & Add-ons Tab

### Purpose

Fast, trustworthy stock recording in the explicit hierarchy **Item Family → selected Item → compatible Add-ons**. It is an operational surface, using the widest practical working area and denser Add-on presentation than primary Items.

### Item Family Navigation

Keep Keys, Firecrackers, Flashlights, Fog Vials, Maps, Med-Kits and Toolboxes in their catalog order. A selected family has text plus a shape/weight/underline cue. On narrow screens use a discoverable horizontal strip with selected/focused entries brought into view; do not let later categories become unreachable. Standard labeled buttons are sufficient; no drag navigation.

### Search / Filter / Sort

Place family navigation before one coherent utility region: **Search [family] · In Stock · Filters · Rarity order**. The current helpers search entity name and effect, then restrict the displayed family; they do not search all Survivor inventory globally. In the proposed labels explain **“Search Items and Add-ons in Flashlights; Add-ons shown for the selected Item.”**

Keep In Stock and secondary Type (All / Items / Add-ons) and Rarity filters; show active restrictions and reset. Preserve the selected Item even if its card is excluded by a search, In Stock, rarity or Add-ons-only filter. A persistent context label/dropdown must still identify it, with “Selected Item hidden by filters” when useful. Do not silently switch to a different compatibility context merely because a quantity becomes zero.

Search and filters apply to Items and to the selected Item's compatible Add-ons, not to a global mixed Add-on list. A matching Add-on compatible with another Item in the family must not appear under the current Item. State that another Item may need selecting; the full current-family dropdown remains available even when its Item cards are filtered. Do not fabricate a broad match count that implies hidden incompatible results are displayed.

Retain high-to-low / low-to-high rarity direction for the compatible Add-on list, with name or stable catalog order as a documented tie-break. Current helper puts Event/other rarities after the standard five in both directions; recommend preserving that explicit Event-last treatment until a global rarity-order decision changes it. Never infer Event's rank from its artwork color. Item ordering can stay catalog-based initially rather than invent a second unrelated sort control.

Before filtering hides pending/invalid input, commit valid changes or retain/reveal an actionable error. Search itself must preserve focus; do not jump to a stock input on every keystroke. State settlement and filtering need to work together.

### Item Cards

Use a compact but more prominent primary-object treatment: recognizable image, name, rarity, quantity controls, low-emphasis Details. Explore roughly 72–96px Item art rather than the current 144px media region. Use available width for the name and number rather than a tall empty background. No fixed card height that clips wrapped names/errors.

Provide a real **Select Item** action through the art/name/selection area, separate from quantity and Details controls. The card article is not a button containing buttons. Blank selection-area clicks may select; any quantity interaction must only edit quantity. Selecting an Item does not consume, equip or transfer it and does not change saved quantities.

### Quantity Controls

Retain **−1 | quantity | +1 | +5 | +10** with direct entry, zero minimum and non-negative safe-integer validation. Existing steps clamp at zero/maximum and validate pending text before applying the step. Enter and field exit commit valid input; blank-on-blur normalizes to zero as today. Invalid negative, fractional, malformed or unsafe values remain visible with an associated error. A decrement at zero is disabled or a clear no-op; it never makes negative stock.

Use a short visible “Quantity” label or clear consistent alignment; keep the full accessible name, such as “Quantity of Sport Flashlight.” Every step name identifies the object and amount. Inputs need enough width for real numbers, numeric keyboard hints and stable text selection. Do not silently truncate or hide a large valid value.

At narrow widths prioritize **−1 [wide quantity] +1** on one line and **+5 +10** below, retaining all actions. With four 44px buttons, 24px total gaps and a useful 72–96px field, a single-row control already needs roughly 272–296px before card padding; two phone stock columns cannot safely fit that row. Reflow controls or reduce columns, never squeeze the field to 31px.

Steps save directly and feel immediate. Repeated operations must retain focus and avoid unexpected item movement. Recommend freezing entry order during an editing run, applying reordering on an explicit sort/filter/context change; today's successful regroup can move positive stock ahead. In Stock may remove a committed zero row, with focus moving to a sensible remaining input. Keep pending/error rows discoverable regardless of zero baseline. This stability proposal is not already implemented in every path.

### Selected Item State

Make the selected Item explicit with a non-color marker/text and an appropriate pressed/selection state on its control. Default to a valid first Item on a fresh family entry; keep that choice until the user changes it or it becomes unavailable. Retain a labeled **Item for Add-ons** dropdown as a compact alternate and keyboard path; it and card selection always reflect the same state.

After selection, update the named compatible section and announce its Item/count without automatically scrolling keyboard users away from the selector. A separate “Go to Add-ons” link may help long Item lists if later visual review demonstrates need; no sticky/jump feature is assumed. Pending quantities must settle before replacing context, with failure keeping/revealing the affected field.

### Compatible Add-ons

Heading: **Sport Flashlight Add-ons**, with a context-specific compatible count and filtered count where needed. The count must come from `compatibleItemIds`, not the family total alone. All displayed Add-ons must both belong to the selected family and include the selected Item's canonical ID.

The same Add-on may be compatible with several Items. Its quantity is **one record per Survivor/Add-on ID**, not separate stock per selected Item. Selecting another compatible Item exposes the same stock. Preserve this relationship; do not clone quantities or imply equipment attachment/consumption.

### Add-on Cards

Use a denser art-plus-name/rarity/quantity arrangement than Items, exploring roughly 48–64px art and compact readable rows/tiles. Quantity remains at least as easy to operate as on Items. Do not put a thin frame around every icon and state. Details is secondary. Let errors expand locally without shifting unrelated controls unpredictably.

### Rarity

Keep Common, Uncommon, Rare, Very Rare, Ultra Rare and Event as text alongside actual artwork/semantic color. Show a **flat** list sorted within the selected compatible set, never grouped/collapsible rarity panels. Never globally mix Med-Kit, Toolbox or unrelated Add-ons for an apparent rarity sequence. No research rarity assignment changes are authorized.

### Details

Keep a quiet labeled **Details** button/link-like button, opening the existing dialog. It contains useful effect text, family, rarity, compatible Item names for Add-ons, qualification notes and research links. This is useful reference, not a competing primary action or information to delete.

Keep Item art/name dedicated to selection; Details remains explicit to avoid one target performing both selection and reference opening. Add-ons can use the same predictable Details affordance. Preserve dialog heading, Escape, focus restoration to the initiating object, truthful missing-art fallback and external-source link semantics. Quantities do not change when inspecting reference.

### Empty States

Distinguish **no compatible Add-ons in the catalog** from **no matches under current search/filters**. Chinese Firecracker-like no-Add-on cases need a small “This Item does not use Add-ons” line, not a giant empty panel. Do not use the current empty filtered Add-on list as proof of no catalog compatibility. Clear filters stays available; selected Item context remains visible.

No stock is zero, not an error. Missing catalog/art is unavailable reference, not zero saved stock. Unknown imported records remain preserved/read-only in a separate labeled section and export; no guessed editable mapping.

### Catalog Metadata

Keep patch/research/source qualification accessible in a secondary “Catalog details” disclosure or footer/reference region. Do not repeat it beside the main quantity heading or confuse catalog version with save version. Attention-worthy unresolved records remain visible enough to discover; ordinary provenance can stay quiet. Do not change datasets or mark qualified research verified through UI copy.

### Long-Page Orientation

Repeat the selected family/Item in the Add-on heading and retain a compact selector there. This provides context in normal flow before adding sticky chrome. A sticky context line is optional only after later review demonstrates benefit and validates viewport height, zoom, focus obstruction and the existing sticky global navigation. It would show identity/context, not a second editable quantity field with a competing value.

## Shared Interaction Patterns

| Pattern | Workspace contract |
| --- | --- |
| Character/section navigation | Real links, explicit current section, stable canonical IDs, pending-state protection, meaningful destination names. |
| Contextual editor | Read state first; named edit action; task label, Save/Cancel only for genuine drafts; error and retry adjacent. |
| Utility toolbar | Search first, small set of scoped controls, visible active restrictions/counts and reset; consistent semantics, not necessarily identical options. |
| Immediate record action | Writer-guarded validated commit; honest saved/error state; no fake Cancel, no silent failure or focus loss. |
| Selection | Separate from mutation/reference/navigation; text and programmatic state; no nested controls. |
| Quantity | Direct number + useful steps; stable target, validation, associated error, pending-input retention. |
| Reference | Quiet explicit Details/inspect action; semantic dialog and return focus; rich facts available without crowding entry. |
| Empty/unavailable | State the scope and recovery action; distinguish zero, no match, no compatibility, missing art/catalog and unknown saved records. |

## Accessibility

- One character H1 and coherent section heading levels; avoid using current stock H5 styling as the document hierarchy. Native artwork with adjacent names can have empty alt text; fallback identity must remain available in text.
- Route navigation uses links/current-page state, keyboard focus and a non-color active marker. Neighbors identify direction, role and name; touch target size remains practical even as their boxes shrink.
- Favorite uses a consistent character-specific accessible name, pressed state, visible focus and roughly 44px target. Ownership has an explicit label/state; unowned text remains readable.
- Progression/notes editors have labels, units, range guidance, local dirty/save status, error associations and focus recovery. Save/Discard/Stay dialog has clear consequences and returns focus; leaving invalid input never silently discards it.
- Perk cards identify effective tier and selection. Recorded versus derived/account facts need text, not tinted artwork alone. Historical unconfirmed/explicit zero is accessible, not represented by identical None labels. Quick pickers and Details support Escape and focus restoration.
- Search/filter/sort/density have real labels, selected/expanded states, clear scope and reset. Announce one concise results change, not every badge and card on each keystroke.
- Item selection is a sibling control to quantities/Details. Expose selected Item by text and programmatic state; the dropdown and cards agree. Horizontal family navigation is keyboard discoverable and brings focus into view without a drag requirement.
- Quantity inputs retain descriptive accessible names, numeric input hints, usable width, text selection and associated pending/errors. Step buttons identify object and increment; provide practical 44px targets without shrinking the number. Native Tab order stays predictable; no custom shortcuts are required to complete entry.
- Rarity/ownership/access and save status are never color-only. Target WCAG 2.2 AA contrast (4.5:1 normal text, 3:1 large text and essential control/state cues); actual palette measurements remain a later review task.
- Reflow at 320px/400% and enlarge text to 200% without clipping, hidden controls or obscured focus. A two-column phone perk grid is conditional, not a forced rule. Review physical keyboard/touch behavior and long numeric values later.
- Avoid repeated assertive global messages on each quantity step. Keep concise local saved feedback with an appropriately scoped status region, preserving errors and useful announcements. No accessibility conformance is claimed from source inspection alone.

## Motion Principles

Search, filters, tier picking, quantity changes, contextual edits, tabs and neighbors are immediately usable. No staggered entrances, animated counters, blur/scale feedback around numbers or theatrical character transitions. Optional rare disclosure transitions must not delay interaction and must respect reduced motion. No animation dependency is justified.

## Desktop / Tablet / Mobile

| Area | Desktop | Tablet | Phone / enlarged text |
| --- | --- | --- | --- |
| Identity/navigation | Meaningful portrait, name/progression group, compact named neighbors | Reflow groups before compressing text; shared shell must release useful width | Smaller but recognizable portrait/name, wrapped progression/status; labeled tabs remain reachable. |
| Overview | Native peers and concise collection summaries; readable notes measure | Stack when facts no longer fit | Reading order preserved, one section at a time; contextual Save remains near inputs. |
| Perks | Wider continuous grid, optional useful side editor | Drop side editor before the grid becomes a narrow strip | One/two readable columns; selected editor near object; density access remains available. |
| Stock | Multiple primary Item columns, denser Add-on rows/tiles | Fewer columns, preserved selected Item and input width | Usually one stock column; two only with readable controls after reflow. −1/quantity/+1 prioritized, +5/+10 retained below if needed. |

Use content-fit breakpoints and the roster's shared-shell finding rather than device names alone. Do not duplicate the tall header/intro inside each tab, add a default sticky action layer or stretch narrow prose to fill desktop gaps.

## Existing-Code Observations

| Files / logic inspected | Current responsibilities and dependencies |
| --- | --- |
| `src/app.js`: `characterWorkspaceView`, header/navigation, `characterOverview` | Shared Survivor/Killer shell wraps all sections and dispatches routes. Header portrait requested at 80px; independent large neighbor region and global Edit action. Overview derives native states, setup and summaries. |
| `src/character-workspace.js` | Canonical href/parser, legacy/manage aliases and role-compatible sections; neighbors preserve section/mode in full role catalog order. Invalid recognized routes remain unavailable rather than guessing a screen. |
| `src/app.js`: `characterInventory`, `characterInventoryUpdate`, quick picker/editor, tier/historical handlers | Normal browse renders only effective tracked perks, name-sorted; clicking enters Update. Update owns search/category/all-role/Only unrecorded and immediately saves tier selections. Changed IDs are saved-session markers, not a draft. |
| `src/character-inventory.js` | Candidate union of native, General, account-unlocked and retained effective copies; category precedence Native → General → unlocked → retained. Normal inventory, filters, floors, route/session identity and three density values. Density preference is browser-local with legacy key fallback; session resets on update-route change. |
| `src/app.js`: `perkControls`, `perkList`, `legacyManager`, `perkDetail`; `src/perk-filters.js` | Standalone account/legacy views have richer filters/sort and route memory. New normal/update grids do not use that entire filter UI. Shared perk reference also exposes account unlock controls, so its scope and writes must remain explicit. |
| `src/character-edit.js`; app edit view/save/navigation handlers | Draft/baseline/raw input/errors, whole-save fingerprint, personal/historical/correction modes, final automatic-floor check, validated candidate, single character commit, no-op behavior, retained failed draft, Save/Discard/Stay, hash/history and beforeunload protection. |
| `src/character-setup.js`; app setup functions; `completeCharacterSetup` | Separate owned-character setup, not monolithic Save behavior. P1 saves immediately; P0/level 1 may skip perk selection; Finish backs up then adds/upgrades records, saves Bloodweb/setup completion and supports batch continuation. General edit dirty protection does not automatically cover this draft. |
| `src/model.js` | Effective/recorded/automatic/global tiers, availability and provenance; historical acquisition versus deliberate correction; alias normalization, validation and schema migration. Prestige derives account floors; source owned flag does not gate those calculations. Unknown records and historical zero are intentional data distinctions. |
| `src/storage.js`, `src/editor.js`, app `commit`/storage-event handling | Central validated persistence, single-writer capability, model normalization and migration/replacement backups, retained recovery state. Failed commit does not replace in-memory save; external changes may conflict with active drafts. No automatic backup for every ordinary edit. |
| `src/app.js`: `stockView`, stock input/step/accept/context functions | Detail mode commits quantities; edit mode feeds the monolithic draft. Filters/search apply within selected family; selected Item currently chosen by dropdown. Pending/errors are settled on family/Item/route transitions. Successful regroup can reorder stocked entries and restores pending sibling edits/focus. |
| `src/inventory-interaction.js`, `src/inventory-quantities.js` | Shared quantity parsing, safe integer/clamping, baseline/raw/pending/error state, filtering/grouping, focus destination, explicit compatibility and flat rarity sorting. Survivor and Killer share primitives even where view markup/events differ. Unknown stock is validated/preserved but not editable. |
| `data/inventory-catalog.js`, `data/survivor-inventory-verified.json` | Family/Item/Add-on definitions and explicit compatibility IDs. An Add-on without narrower source-item restrictions maps to Items in its family; exceptions use `compatibleSourceItemIds`. Saved stock is by character/entity, not by selected Item. Patch/research metadata is catalog provenance. |
| `src/survivor-collection.js`, `src/assets.js`, asset manifest | Reliable positive known stock-type counts, mapped artwork, fallbacks and canonical alias lookup. Reuse semantic selectors without assuming their current UI location must remain. |
| `styles.css`, `index.html` | Shared canvas/sidebar, header/neighbors/tabs, Overview grids, perk card-size minima (160/190/220px desktop), 280–360px selected-perk pane (300px tablet), mobile pane moved above grid, forced two phone columns and hidden density control. Stock uses 320px minima, large media and fixed 44px step columns. Shared cascade changes could affect Killers/account views. |
| Existing unit/browser coverage | Read relevant `tests/character-edit.test.js`, `tests/character-inventory.test.js`, `tests/character-workspace.test.js`, `tests/inventory-interaction.test.js` and existing audit's browser evidence. Assertions protect historical corrections/floors, raw invalid text, no-op/unknown preservation, conflicts, route aliases, quantity boundaries and compatibility. Read as contracts; not executed in this planning pass. |

### Reconciliation and Migration Boundary

“Reconcile” currently means the user compares/records inventory; there is no automatic game import/sync. `syncGlobalInventories` consolidates aliases without lowering records; it is not a tier-acquisition routine. Storage load/replacement performs account normalization and v1→v2 handling. Setup adds/upgrades; ordinary Update sets a personal record within floors; deliberate correction is a separate exception. These must not become one generic Save operation with silently changed rules.

Likely dependencies for later architecture review: route compatibility/parent navigation, scoped draft/conflict lifetimes, account-wide derived floors, pending quantity settlement and selection/focus, shared filter contracts, unknown-data preservation, asset mappings, editor locking and shared responsive styles. This is a dependency record, not an implementation sequence.

## Shared Survivor/Killer Opportunities

Share the shell grammar, named neighbors, section links, contextual Save vocabulary, perk facts/tiers/corrections, density controls, utility toolbar language, quantity primitives, Details/focus/error patterns and content-fit behavior. Account libraries can share state vocabulary/search primitives without adopting a character-personal scope.

Do not assume identical content: Survivors require family → Item → compatible Add-ons; Killers have an owning Power and its fixed Add-on collection. No new Killer controls/layout are approved. Retiring a shared Edit route for Survivors must not inadvertently remove Killer capabilities before that screen's review.

## Skill-Assisted Findings

Superpowers brainstorming provides the primary bounded design-review process: inspect the existing flow, compare consequential options, document a coherent proposal and stop before implementation. The user's explicit request for a full planning artifact determines its location and depth; no writing-plans skill, default implementation handoff or coding checklist is invoked.

Relevant installed guidance was inspected during the Rev02 audit and reused selectively, not mechanically rerun as a full critique or detector pass.

| Recommendation | Source | Decision | Reason |
| --- | --- | --- | --- |
| Separate product truth and visual choice; stable familiar operations | Impeccable Operate | APPLY | Effective/recorded/account states and saved/draft wording affect trust. |
| Artwork and domain relationships carry identity; cards only for meaningful peers/objects | Taste app-screen guidance | APPLY | Portrait/native diamonds and compatibility explain the record; an arbitrary metrics grid does not. |
| Keyboard access, labels and practical target dimensions | UI UX Pro Max focused UX guidance | APPLY | Preserve direct input and clear state; generic marketing recipes remain inapplicable. |
| Frequency determines motion | Emil design-engineering | APPLY | Repeated tier/quantity/navigation actions should not wait for animation. |
| Simplify means fewer fields everywhere | Generic minimalism | REJECT | Workspace editing needs personal/derived provenance, correction and failure states that a roster can omit. |
| Default spec → implementation planning | Brainstorming default handoff | DEFER | User explicitly reserves the final roadmap until screen reviews complete. |
| Separate illustrated flow artifact | Diagram Design applicability | OMIT | The contextual-home/save table and family → Item → Add-ons notation convey the relationships directly. |

Specificity check: portraits alone could decorate any game's tracker. This proposal's structure also depends on Prestige-derived native unlocks, Bloodweb level, native/recorded/effective tiers, historical acquisition exceptions and shared compatible Add-on records. Those relationships make it a DBD record rather than a relabeled SaaS asset manager. Retain them without copying DBD's official menu or adding fake Bloodpoints, loadouts, trial sessions or cinematic horror effects.

## Open Questions

These are material approvals, recorded in the central questions file as SW01–SW04:

1. **SW01 — Perks save model:** approve retaining immediate saved selections inside explicit Update mode (recommended), or stage all Perks edits with real Cancel / Save changes? This affects historical/account controls, dirty state and conflict handling.
2. **SW02 — Deliberate correction access:** approve a scoped Perks correction disclosure with an explicit before/result explanation (recommended), or require an additional confirmation for lowering/clearing recorded tiers? Preserve the capability, including historical records, whichever guard is chosen.
3. **SW03 — Transaction scope:** is per-task atomic saving sufficient when retiring the composite editor, or does a real workflow require one all-character transaction spanning progression, metadata, perks and stock? Recommend per-task saves; cross-task cancellation would need a separately approved capability, not an accidental re-created fourth workspace.
4. **SW04 — Between-Survivor context:** approve session-local query/category/family/selected-Item retention for repeated work (recommended), or reset some controls per character? Recommend clearing stale selected perks/change counts, validating retained Item context and never carrying quantities/drafts across characters.

Existing W03 (catalog versus filtered neighbors), W05 (which perk fact leads each surface) and G04/G07 (width/mobile shell) remain shared review questions. This plan recommends catalog neighbors, effective personal tier in the workspace with recorded/account facts explicit, and task-based widths. It does not retroactively approve global policy.

### Earlier Rev02 Records to Revisit at Approval

- The roster's proposed native account-access label cannot use global tier zero alone to mean unavailable: General native/historical definitions can still be available. Its open perk-scope decision needs this qualification. Keep the roster plan unchanged pending review.
- The roster's proposed ownership-toggle removal has a concrete contextual destination here, but neither proposal should be called implemented/approved prematurely.
- The global audit's large repeated-header concern and this brief's larger artwork are compatible if art gains emphasis while duplicate headings, neighbor boxes and editing chrome shrink. A universal taller header would conflict with editing speed.
- W02 progression-edit reachability now has a concrete scoped proposal. W04 context retention has SW04. W05 needs the effective/recorded/account distinction above, including historical zero and General availability.
- Dashboard Continue should resume stable sections and useful context according to its existing open decisions; no timestamps can restore an unsaved draft. This workspace does not reopen the three Dashboard jobs or queues.
- The index's Survivor Perks entry needs a scope note: character Perks and stock are covered here; the standalone account perk library remains unreviewed. Avoid duplicate competing character-tab plans.

## Shared / Global Findings

- **One shell, different task measures:** larger useful identity artwork can coexist with smaller editing chrome. Global page width alone does not solve grouping or repeated headers.
- **Save vocabulary is functional:** Done means autosaved exit; Cancel means a real draft can be discarded. A global stored timestamp must not imply local draft persistence.
- **Conflict scope crosses characters:** source Prestige/account overrides can change other characters' effective floors. Narrow field merges need architectural evidence, not a visual-design assumption.
- **Correction versus acquisition:** normal tier selection and deliberate correction are different supported operations; historical records introduce explicit zero and non-downgrade rules.
- **Selection versus mutation:** Item selection, quantity entry and reference opening need separate real controls and stable focus. A whole-card pattern cannot be blindly reused from navigation cards.
- **Stable repetitive entry:** filtering/resorting/commit replacement must not move the next input unexpectedly or conceal failed values. Preserve named context and quantity width before decoration.
- **Empty-state truth:** no compatible catalog entries, zero stock and no filtered matches are distinct; their labels need a shared contract.
- **Semantic labels without visual redundancy:** full accessible quantity names can coexist with concise visible labels; rarity/state text remains necessary despite colored art.
- **Density is task-specific:** existing perk density control is useful; operational stock can use denser Add-ons than primary Items; neither justifies a global density preference feature.
- **Responsive shell/focus:** existing sidebar pressure, sticky focus obstruction, fixed tablet editor pane and tiny mobile quantity input require shared review. Do not solve each with a separate sticky layer.

These findings feed the eventual shared/global plan. No `11-shared-global-design.md`, final tokens, code or roadmap is created here.

## Explicit Non-Goals

- No implementation, behavior change, production source/CSS edits or final component code.
- No framework/component-library migration, dependency additions or new services.
- No Killer workspace, Killer perk/Add-on or standalone account library redesign yet.
- No changes to research datasets, compatibility mappings, rarity assignments, model rules, aliases or inventory schemas.
- No speculative new analytics, trial/loadout system, automatic game synchronization or queue controls.
- No DBD official-UI imitation, gratuitous motion or added drag interactions.
- No separate redesign of the old monolithic editor as a fourth principal workspace without a compelling approved requirement.
- No final implementation roadmap, implementation phases, coding task checklists, tests/builds or deployment.
