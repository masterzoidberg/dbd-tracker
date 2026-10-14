# Dashboard current-state audit

Date: 2026-10-13. Status: historical read-only architectural discovery. No implementation authorization. Subsequent Character Workspace design resolves the product dependency described below; current contract is `../character-update-rework/03-character-workspace-design.md` and `04-routing-and-compatibility.md`. Discovery-time statements about missing plans are retained as historical evidence.

## Evidence and scope

Repository root: `G:\Projects\dbd-tracker`. All paths below are relative to that root unless absolute. Findings come from source and existing documentation, not observation of the user's live account. No application launch, production storage access, build, release, or test run was performed. Loading the application can write compatibility updates; source inspection avoids that side effect. Visual hierarchy conclusions are grounded in DOM order and CSS, not fresh screenshots or measured usability studies. No Git repository is present.

`plans/character-update-rework` does not exist. The only existing planning family found is `plans/rev1`; its README records approved decisions from 2026-10-06. Its historical test counts and planned milestones are not evidence of current verification. Current source takes precedence when describing implemented behavior.

## Current route

- Framework: vanilla JavaScript static SPA; no React or component framework. `package.json` uses ES modules, esbuild, Node's test runner, and development-only Playwright Core.
- Router: `src/app.js`, `route()` and `render()`. Empty hash selects Dashboard; explicit route is `#dashboard`. Unknown view names fall back to Dashboard, although the setup launcher appears only for literal `dashboard`.
- Entry/shell: `index.html`; loads `styles.css` and `dist/app.js`. `scripts/build.mjs` bundles source/catalogs. `server.js` serves the development localhost app. Direct-file launch remains supported by `README.md`.
- Current character inventory routes: `#manage/<canonical-id>`, `/update`, `/legacy`; compatibility `#experiment/<id>` routes are recognized by `src/character-inventory.js`, `parseCharacterInventoryRoute()`.
- Dashboard character buttons use `data-action="character"`; `src/app.js`, `handleClick()` calls `openDetail()`, opening a dialog rather than a character Overview route.

## Components

All Dashboard rendering currently lives in `src/app.js`:

| Function | Responsibility |
| --- | --- |
| `dashboard()` | Heading, catalog banner, recommendation/recent/favorite selection, section composition |
| `roleSummary(role)` | Ownership and Prestige statistics |
| `perkSummary(role)` | Account perk access and global Tier III counts |
| `prestigeChart(role)` | Owned-character P0/P1/P2/P3+ distribution |
| `pageHeading()`, `sectionTitle()`, `empty()` | Shared string-rendered presentation helpers |
| `render()`, `preserveRender()` | View dispatch, DOM replacement, some focus/selection/scroll restoration |

There are no separate Dashboard selector or component files. These are functions returning HTML, not framework components.

## Data flow

```text
localStorage dbdTrackerData / explicit imported JSON / selected backup
  -> src/model.js parseSave -> migrateData -> validateSave
  -> src/storage.js TrackerStorage.load or replace
  -> existing applyAccountRules + syncGlobalInventories as applicable
  -> canonical in-memory save in src/app.js
  -> roleCharacters / rolePerks / isAvailable / globalTier
     + inline Dashboard filtering, counting, sorting
  -> dashboard / roleSummary / perkSummary / prestigeChart
  -> render -> #main
```

`src/app.js`, `commit()` clones the save, applies a mutator, consolidates perk aliases, updates the account timestamp and optionally one character timestamp, then adopts the canonical result from `TrackerStorage.save()`. Validation/storage failure does not adopt the attempted edit. Character timestamps change only when the caller supplies a character ID. Global-only edits need not enter the recent-character list.

Catalog definitions are separate from saves. `data/catalog.js` adapts:

- `data/dbd-survivor-perks-live-10.1.2a-2026-10-05-corrected.json`
- `data/killer-perks-audited-10.1.2a-2026-10-05.json`

It builds canonical `characters`, `characterById`, `perks`, `perkById`, native perk IDs, licensed aliases and `catalogInfo`. Characters are sorted by name. The supplied catalog contains 54 Survivors, 44 Killers and 321 canonical perks. Catalog patch/date are 10.1.2a / 2026-10-05; examples in the task are not a catalog-update instruction. Metadata displayed by `catalogInfo` reads the Survivor source; release checks cover role agreement. No catalog JSON is fetched at runtime.

## Derived statistics

Everything in this table is recomputed on rendering; none is a persisted aggregate or separately cached metric. Catalog lookup maps are built once at module initialization. The in-memory save is the current state, not a metrics cache.

| Value | Exact source/definition |
| --- | --- |
| Owned | `roleSummary`: same-role catalog characters whose `save.characters[id].owned` is true |
| Locked characters | Catalog role total minus owned count; means recorded as not owned |
| P1+ / P3+ | Owned characters at Prestige >=1 / >=3 |
| Total Prestige | Sum of Prestige across owned same-role characters |
| Average Prestige | Total / owned count, one decimal; zero if none owned |
| Favorites count | Owned same-role characters with `favorite` true |
| Favorite shortcuts | `dashboard()` selects all catalog characters with `favorite`, including unowned; differs from summary counts |
| Globally available perks | `perkSummary`: role perks where `isAvailable(save, perk)` is true |
| Global Tier III | Role perks where `globalTier(save, perk) === 3` |
| Locked perks | Role total minus globally available count |
| Distribution | Owned same-role characters grouped by `min(3, prestige)` |
| Suggested targets | Inline selection in `dashboard()`, described below |
| Recently updated | Inline character timestamp selection, described below |

`src/model.js`: `prestigeTier` clamps Prestige to 0–3 for perk benefits. `globalTier` is the maximum of source-character Prestige tier and Shrine/Legacy/manual overrides. `isAvailable` also considers General perks available even when global tier is zero. Ownership is not an additional gate in `globalTier`; clearing ownership alone does not erase Prestige-derived access.

Availability means account access/Bloodweb eligibility, not personal acquisition on every character. `automaticTier`, `recordedTier`, `inventoryTier`, `bloodwebEligible` and `bloodwebNextTier` distinguish native/global automatic minima from personal records. General perks may be globally available with no automatically owned tier. Historical/licensed mappings make blanket “unlocks 3” claims unsafe: use actual marginal benefits.

## Recommendation logic

`src/app.js`, `dashboard()`:

1. Consider owned catalog characters across both roles.
2. Count native perks for which `isAvailable` is false.
3. Exclude candidates with zero missing native perks.
4. Sort by missing count descending, Bloodweb level descending, then character name ascending.
5. Show the first five.

These are P1 access recommendations, not an arbitrary-target optimization engine. Current Prestige is not an explicit sort term; Prestige normally makes native perks available through model rules. No bloodpoint costs, estimates or machine-learning recommendations exist. Already available General/override perks correctly reduce recommendation value. The label names only the primary sorting criterion; a short explanation could disclose the Bloodweb tie-breaker.

## Recently updated logic

`src/app.js`, `dashboard()` filters catalog characters with non-null `updatedAt`, sorts timestamp strings descending with `localeCompare`, and takes five. No owned-only restriction exists. Import/restore can supply these timestamps. Current validation accepts parseable timestamps, not exclusively normalized ISO strings; lexical order is therefore not guaranteed chronological for all valid imported timestamps. A future chronological selector should compare parsed instants, without rewriting saved timestamps.

The list records latest edits, including notes/Favorite/ownership updates, rather than visits, sessions, tasks, or Prestige transitions. Clicking a character does not itself record a visit. Relative-time wording can be derived without new state, with an absolute timestamp available. Renaming to “Continue where you left off” needs supporting copy such as “Recently edited characters”; do not promise last-tab or last-task restoration.

There is no event log. Current Prestige plus one latest-edit timestamp cannot prove when a milestone was reached. Five occasional backup snapshots are recovery data, not reliable completion history.

## Save model

`src/model.js`: `SCHEMA_VERSION = 1`, `freshSave()`, `freshProgress()`, `migrateData()`, `validateSave()`, `parseSave()`, `exportSave()`.

Stored account fields include schema/account-rules versions, inventory policy, setup/correction markers, naming preferences, account timestamp, `characters`, and `perkOverrides`. Character records include owned, Prestige, Bloodweb 1–50, setup completion, Favorite, notes, personal perk tiers, and latest-edit timestamp. There is no Prestige Queue, active-character pin, tab history or milestone history. `setupQueue` in `src/app.js` is a transient batch-setup workflow and must not be confused with progression goals.

Validation reconstructs supported fields; unknown top-level additions disappear. Unknown well-formed character/perk IDs are preserved with warnings. Prestige accepts nonnegative safe integers without an explicit game-specific maximum. Native names and role resolve through canonical catalog IDs.

`migrateData()` currently rejects any schema other than 1. `applyAccountRules()` is a separate existing account-interpretation process: missing `accountRulesVersion: 1` causes historical changes to overrides/preferences. `syncGlobalInventories()` consolidates aliases. These behaviors must stay separate from the new structural schema migration.

## Import/export touchpoints

- `src/storage.js`: `TrackerStorage.load/save/backup/replace/backups/deleteBackup/original`; keys `dbdTrackerData` and `dbdTrackerBackups`; at most five snapshots.
- `src/model.js`: all parse/validation/version boundaries and JSON serialization.
- `src/app.js`: `commit`, `enableEditing`, `exportFile`, import-file change handler, `restore`, `reset`, `dataPage`, storage-event handling and schema badge/copy.
- `src/editor.js`: live writer capability; saves, replacements and migrations require it. Read-only loads use `persistMigration: false`.
- `index.html`: import file input, export controls, status/recovery shell.
- `README.md`: local-only/direct-file/export portability explanation.
- Relevant regression coverage: `tests/model.test.js`, `tests/storage.test.js`, `tests/recovery.test.js`, `tests/editor.test.js`; browser `tests/browser/data-flows.mjs`, `tests/browser/recovery.mjs`, `tests/browser/editor.mjs`, `tests/browser/smoke.mjs`.

Load currently compares post-normalization state with the parsed canonical save to detect pending migration. A version conversion performed during parsing alone would disappear from that comparison; v2 design must carry an explicit structural-migration signal from the raw input version. Export spreads the save plus `exportedAt`; queue retention depends on canonical validation, not only serialization.

## Setup flow

`src/setup.js` renders three steps: character ownership/Prestige, Survivor global unlocks, Killer global unlocks. Edits autosave; finishing sets account `setupComplete = true` in `src/app.js`. `render()` prepends “Account setup” on Dashboard regardless of completion. Setup does not automatically launch on first run in current source.

`src/character-setup.js` handles separate per-character Bloodweb/personal perk setup. `src/app.js`, `openDetail()` offers it when an owned character is incomplete and the editor is writable. “Run character setups” iterates owned incomplete characters, permits skipping, and resumes via per-character completion state. Once none remain, the action reports that all owned characters are complete. Account setup completion is not equivalent to every character completing setup.

## Existing reusable components

- `src/app.js`: heading/section/empty helpers, portrait rendering and fallback, role/perk summaries, distribution bars, dialogs/confirmation, select/filter controls, `preserveRender`, export/status/error handling.
- `src/assets.js`, `data/asset-manifest.json`: canonical portrait/perk asset lookup. Queue saves must not store asset URLs.
- `styles.css`: `.panel`, `.two-column`, `.section-title`, `.progress-track`, `.target-row`, `.recent-grid`, `.favorite-links`, `.tag`, `.muted`, button/link/focus styles.
- `index.html`: native dialogs, skip link, main focus target, live status regions.

Reuse existing visual conventions and small view functions. There is no need for a design-system replacement or a framework/dependency change.

## Current responsive behavior

`styles.css`: two-column summaries; `.dashboard-lower` uses 1.15fr/1fr. At >=1600px main padding grows and lower panels become 1.35fr/1fr. At <=1100px lower panels stack, main/sidebar spacing shrinks, catalog/perk information wraps and local-account heading badge disappears. At <=760px navigation becomes a horizontal scrolling strip, main padding shrinks, summaries stack, while distribution charts remain two columns. `.recent-grid` auto-fits columns with a 220px minimum.

These rules favor information panels over a linear work list. Narrow header action crowding, long names and the two distribution charts need browser verification later; CSS inspection alone does not establish clipping or touch usability. A queue should use stacked list rows, not a horizontally scrolling table.

## Current accessibility behavior

Native buttons/links, labeled fields, dialog titles, main skip link, `aria-current` navigation and `role=status` save/error notices provide useful foundations. `styles.css` has visible gold focus outlines. Icons/portraits are generally decorative alongside text. Distribution bars include textual bucket labels/counts, so color is not the only signal.

Ownership/perk progress tracks are styled divs without programmatic progress values. Repeated HTML replacement only restores identified controls; future reorder controls need stable IDs, deliberate focus restoration and an announcement. Current Dashboard character navigation is a dialog-opening button, not a deep link. No queue or reorder accessibility exists yet. No fresh keyboard/screen-reader audit was performed.

## Strengths

- Honest local-first status and portable JSON backup access.
- Owned-only role summaries and distribution avoid misleading locked-character progression.
- Existing suggestions use real marginal unlock value rather than assuming every source unlocks three perks.
- Recent edits and Favorite shortcuts already support returning to characters.
- P1/P2/P3 explanations and separate personal/global perk models preserve important domain distinctions.
- Catalog provenance is explicit and already has a Data & backups details destination.

## Problems

1. Passive statistics dominate: heading, catalog banner, 44px ownership totals, six metrics per role and perk panels precede next actions. Recommendations share space with distribution, and at <=1100px come after it. The most useful work navigation is not visually dominant.
2. There is no persisted personal priority. Suggestions answer “best P1 unlock,” not “my next character.”
3. “Recently updated” means edited, not worked on or completed; timestamp sorting has an import edge case.
4. Setup remains prominent after account completion. Catalog text duplicates a substantial details destination.
5. Favorites are valuable shortcuts but should not be treated as active progression goals; count/list ownership semantics currently differ.
6. Global availability and owned inventory need careful wording; an access percentage is not a personal inventory-completion percentage.

Move personal work and recent work higher; quiet catalog/setup administration and aggregate statistics. Nothing requires deleting progression data. Average/total Prestige can remain in a compact details disclosure; omit separate completion decoration and redundant focus panels.

## Character-workspace integration points

No approved character-workspace design was found. Current interfaces are `src/app.js`, `characterDetail`, `openDetail`, `characterInventory`, `characterInventoryUpdate`, `legacyManager`; route parser lives in `src/character-inventory.js`.

Finalized human-approved contract: Dashboard character action -> `#character/<id>/overview`. No last-tab persistence or character popup. Survivor Overview/Perks/Items & Add-ons and Killer Overview/Perks/Power & Add-ons are now approved architecture. Implement workspace availability before switching Dashboard links; the product dependency is resolved. Existing `#manage/<id>` remains a Perks compatibility alias, never Overview. Do not invent competing Dashboard routes.

Existing Rev1 specifies schema 1. The human explicitly approved superseding that version constraint for queue persistence with schema 2 plus v1 support, while retaining existing legacy account rules. Other Rev1 architecture choices remain intact.
