# Character Inventory Productionization Design

Status: APPROVED FOR IMPLEMENTATION PLANNING  
Date: 2026-10-11  
Scope: site-wide rollout design only. No product code or routes are changed by this document.

## Decision summary

The validated character inventory workflow should become the canonical character-level experience while preserving the existing local-first progression model and account-wide perk libraries.

The recommended cutover is:

- Reuse `#manage/<character-id>` as the permanent canonical character inventory route. Existing bookmarks and current collection links therefore continue to land on a character route.
- Add a separate canonical Update route, `#manage/<character-id>/update`, because the tested workflow is a distinct reconciliation job with useful browser-history and deep-link behavior.
- Keep the old manager temporarily at `#manage/<character-id>/legacy` during validation. It is not the normal navigation target.
- Keep `#experiment/<character-id>` and `#experiment/<character-id>/update` working as compatibility aliases during rollout, then redirect them to the canonical routes after stabilization.
- Promote the role-neutral experiment domain and card renderer into permanent character-inventory modules. Do not maintain a second production implementation.
- Keep `#survivor-perks` and `#killer-perks` as account-wide planning surfaces, including their existing Account Unlock editor.
- Keep setup as a separate onboarding/bulk-maintenance utility. The roster plus character inventory becomes the normal day-to-day maintenance flow after setup.

This gives the new UI the existing production URL, keeps a practical old-UI escape hatch during rollout, and does not require a save migration or a second save document.

## Audit basis and limitations

Inspected in the repository:

- `index.html` and `src/app.js` for the shell, hash router, render dispatch, collections, libraries, old manager, setup entry points, persistence events, and experiment integration.
- `src/character-inventory-experiment.js` for candidate/category/session/tier rules.
- `src/model.js` for `inventoryTier`, `automaticTier`, `recordedTier`, `bloodwebEligible`, `globalTier`, `isAvailable`, historical handling, canonical IDs, and account rules.
- `src/storage.js` for validated writes, backups, imports, exports, recovery, and localStorage keys.
- `src/setup.js` and `src/character-setup.js` for account setup, character setup, ownership, Prestige, Bloodweb, and special historical records.
- `data/catalog.js`, `src/assets.js`, `data/asset-manifest.json`, and the image tree for canonical perk/character artwork resolution.
- Existing Node and browser regression sources, including `tests/character-inventory-experiment.test.js` and `tests/browser/experimental.mjs`.
- The supplied audit save `data/dbd-tracker-2026-10-05-1502.json`.

The README is present and was read. It references `docs/plan.md` and `docs/roadmap.md`, but those two files are not present in this checkout. No assumptions about their contents are used here. This workspace is also not a Git checkout, so the audit did not rely on Git history or a branch diff.

The current Node suite was run before this spec was written: **174 tests, 174 passing, 0 failing, 0 skipped**. Existing project records report browser smoke coverage for the validated Killer and Survivor experiment; this design task does not modify or rerun browser behavior.

## Current architecture

### Shell and routing

This is a static, local-first browser application. `index.html` owns the shell, navigation, main content mount, dialogs, file import input, and the bundled `dist/app.js`. The same hash router works for `file://` and localhost because navigation is client-side and does not require server routes.

`src/app.js` currently has a small route dispatcher:

- `#dashboard` → dashboard.
- `#survivors` and `#killers` → role collection pages.
- `#survivor-perks` and `#killer-perks` → account-wide perk libraries.
- `#manage/<character-id>` → the existing character manager.
- `#data` → data, backup, import/export, and catalog information.
- `#experiment/<character-id>` → experimental normal inventory.
- `#experiment/<character-id>/update` → experimental Update Inventory.

`route()` currently returns the hash text. The dispatcher has special handling for the experimental parser and then checks `manage/` before the named top-level views. There is no server-side route table, so route compatibility can be handled entirely in the hash dispatcher.

### Progression and persistence boundaries

`src/model.js` remains the authority for progression semantics:

- `recordedTier(save, characterId, perkId)` reads the character’s personal record.
- `automaticTier(save, characterId, perk)` takes the maximum of the character’s native minimum and `globalTier`.
- `inventoryTier(save, characterId, perkId)` is the effective tier: recorded personal tier versus automatic minimum.
- `globalTier(save, perk)` takes the maximum of source Prestige, Shrine, Legacy, and the generic/unspecified account unlock.
- `isAvailable(save, perk)` means General or globally unlocked; General availability is not an automatic owned tier.
- `bloodwebEligible(save, characterId, perk)` adds role, effective-tier, availability/native, and historical-personal rules.

The normal character inventory must continue to use `inventoryTier > 0`. It must not reconstruct or write personal inventory records from automatic minima.

`src/storage.js` owns the durable boundary. `commit()` in `src/app.js` clones the current save, applies a mutator, calls `syncGlobalInventories`, updates timestamps, and adopts only the validated result returned by `TrackerStorage.save()`. Imports and restores validate and back up before replacement. LocalStorage keys, JSON export shape, backups, recovery entries, aliases, and schema version remain unchanged.

### Current Survivor and Killer collections

`collection(role)` renders `#survivors` or `#killers` with search, ownership status, Prestige filter, favorites, and sort controls. Each existing roster card already contains:

- portrait artwork with a fallback,
- character name action,
- favorite action,
- Owned/Locked toggle,
- Prestige,
- Bloodweb level,
- native-perk preview,
- owned/maxed summary,
- a `Manage perks` link to `#manage/<id>`.

Clicking the name or Prestige opens the existing progression dialog. For an owned character whose setup is incomplete, that dialog offers character setup. Ownership changes save immediately. The collection cards should be reused as the starting point for production navigation; they do not need a new role-specific renderer.

### Existing character manager

`manager(id)` renders the current `#manage/<id>` page. It currently presents the full same-role perk catalog, broad filtering, advanced Boolean filters, quick views, source/provenance data, a Detailed/Compact presentation switch, and the old tier-cycle interaction. It also contains a temporary entry link to the experiment.

This page is a catalog-management surface, not an effective character inventory. Its filters and table are valuable compatibility material during rollout but should not be carried into the normal production character view.

### Account-wide perk libraries

`library(role)` renders the existing account-wide pages. They use the shared filter domain and the old table/detail structure. `perkDetail()` now exposes:

- editable Shrine tier,
- editable Other account unlock tier,
- read-only Prestige provenance,
- read-only Legacy account unlock provenance,
- character-specific personal corrections.

The UI deliberately does not expose `manualTier` as a user-facing term. `globalTier()` remains authoritative. A successful account unlock edit changes candidate membership through the existing selectors; no special character-page integration is required.

### Setup

The dashboard’s `Account setup` entry opens the three-step `setupView()` flow: character ownership/Prestige, Survivor account unlocks, and Killer account unlocks. The top-bar `Run character setups` action opens `characterSetupView()` in sequence for owned characters whose setup is incomplete. Individual character dialogs also offer setup for owned characters.

Character setup records Bloodweb level and personal perk records through the existing model and backup/commit path. It supports special unlocks and historical/manual ownership without changing account unlocks for other characters. Setup is separate from both the account-wide library and the tested Update Inventory route.

## Experimental architecture

The experiment is already a thin additive path rather than a second save system.

### Reusable as-is

- The pure candidate/category/session logic in `src/character-inventory-experiment.js`.
- Canonical role scoping through `rolePerks(character.role)`.
- `nativePerkIds` as the exact Personal relationship.
- Existing selectors for effective, automatic, recorded, global, and Bloodweb semantics.
- Existing `correctPersonalPerkTier()` for ordinary direct correction.
- Existing `setHistoricalPerkTier()` and historical controls for manual-ownership records.
- The shared icon resolver in `src/assets.js` and generated `asset-manifest.json`.
- The single `experimentalPerkCard()` renderer used by normal inventory and Update mode.
- The selected-perk editor structure and its separate artwork sizing.
- The in-memory `changedPerkIds` session state.
- The localStorage-only card-size preference with Medium fallback.
- CSS-generated diamond fields and the existing mobile breakpoints.

## Component promotion

The permanent implementation should not retain “experiment” as its architectural name after cutover.

Recommended promotion:

| Current | Permanent role | Recommendation |
| --- | --- | --- |
| `src/character-inventory-experiment.js` | role-neutral candidate/session/domain module | Promote/rename to `src/character-inventory.js`; retain a temporary compatibility re-export only if tests or staged consumers need it. |
| `experimentalCandidatePool()` and related helpers | character inventory domain API | Keep the pure interfaces, rename the prefix to `characterInventory...` when the production route is enabled. |
| `experimentalInventory()` / `experimentalUpdate()` in `src/app.js` | character inventory views | Extract or promote to one character-inventory view module rather than copying them into a second renderer. |
| `experimentalPerkCard()` | reusable character perk card | Rename to a neutral `characterPerkCard()` or equivalent and keep one renderer for normal and Update contexts. |
| `experimentCardSize` state | character inventory UI preference | Preserve the existing localStorage value during transition; if the key is renamed, read the old key once as a fallback and write the new key. |
| `--experiment-*` CSS tokens | character inventory/card tokens | Rename during promotion only after selectors are covered; do not duplicate two competing style systems. |
| `.experiment-*` classes | production character-inventory classes | Rename in a contained CSS/renderer change, with temporary aliases only if needed for staged browser validation. |

Promotion must be a single implementation cutover. The old manager must not receive a copy of the new card renderer.

## Candidate and category contract

The production workflow must preserve the validated domain contract exactly.

For a canonical role perk in the current character’s role, the candidate predicate is:

```text
character.nativePerkIds includes perk.id
OR perk.general === true
OR globalTier(save, perk) > 0
OR inventoryTier(save, characterId, perk.id) > 0
```

The implementation must continue to derive this from canonical `rolePerks(character.role)` so that aliases are not separate candidates. It must not use source-character ownership as a candidate reason. A locked source character with recorded Prestige still contributes through `globalTier`; a source being marked Owned alone does not.

Each canonical perk appears once. Primary category precedence is:

1. `Personal` — the exact `nativePerkIds` relationship for this character, regardless of Prestige or account unlocks.
2. `General` — a role-appropriate current General perk that is not native to this character.
3. `Unlocked` — a non-General, non-native perk with `globalTier > 0`.
4. `Retained on this character` — a positive effective/tracked exception with no current native, General, or account-unlock explanation.

The retained category is an intentional exception. It is visible in `All` and labeled, but it is not forced into Personal, General, or Unlocked tabs. This avoids inventing a progression explanation that the save does not support.

Secondary provenance may include Personal, General, Prestige, Shrine, Legacy, Other account unlock, and retained context. A native perk that also has a Shrine or Prestige source remains one Personal card with a secondary unlock badge.

`Only unrecorded` means `inventoryTier(save, characterId, perk.id) === 0` after the candidate pool is built. It does not mean “no personal object key,” “globally locked,” or “not Bloodweb eligible.”

## Candidate audit from actual data

The audit used `data/dbd-tracker-2026-10-05-1502.json` and the current candidate helper, with canonical IDs and display-name aliases resolved through the current catalog.

### Doctor

| Category | Count |
| --- | ---: |
| Total candidates | 24 |
| Personal | 3 |
| General | 19 |
| Unlocked | 2 |
| Retained/exception | 0 |

The native Personal perks are Monitor & Abuse, Overcharge, and Overwhelming Presence. Overcharge is also Shrine-unlocked and tracked, but appears once under Personal. Hex: Ruin and Thanatophobia are Unlocked candidates with Shrine and tracked provenance. Monitor & Abuse and Overwhelming Presence are Personal plus tracked.

No clearly irrelevant cross-role perks were included, and no expected native or General candidates were absent under the current rules.

### Cenobite

| Category | Count |
| --- | ---: |
| Total candidates | 22 |
| Personal | 3 |
| General | 16 |
| Unlocked | 3 |
| Retained/exception | 0 |

The native Personal perks are Deadlock, Hex: Plaything, and Scourge Hook: Gift of Pain. The catalog marks all three as General because the licensed-name catalog treats those entries as current General-compatible aliases. They therefore have both Personal and General reasons, but Personal precedence keeps them in Personal exactly once.

Hex: Ruin, Overcharge, and Thanatophobia are Unlocked candidates with Shrine and tracked provenance.

This overlap is the primary data-model wrinkle. The three-category UI is still honest only because the native relationship wins and the secondary General provenance is retained. The production domain module should keep a regression asserting these exact rows and counts.

### Historical and alias observations

- The supplied audit save has no retained-only positive exception for either Doctor or Cenobite, so the retained count is zero there. Unit coverage confirms a positive historical/manual copy remains visible in `All` when current rules no longer explain it.
- An explicit historical zero and an unconfirmed historical record do not create an effective retained candidate by themselves. They remain distinguishable in historical controls and can become candidates if another valid reason applies.
- Former Stranger Things and former console-General perks are intentionally not treated as current General perks by the model. A positive personal copy without a current unlock is a retained exception; a Legacy/account unlock is an Unlocked reason. This is more honest than claiming current Bloodweb General availability.
- Canonical licensed aliases resolve through `perkAliases`; alias names are searchable/display-compatible but do not create extra cards or progression records.
- Source-less General perks are valid General candidates and must not require a source character.

## Recommended architecture

### One character workflow, two modes, one card renderer

The permanent character route should render the effective tracked inventory only:

```text
normal inventory = rolePerks(character.role)
  filtered to inventoryTier(save, character.id, perk.id) > 0
```

It should show character identity and only useful metadata: portrait, name, Owned/Locked state, Prestige, Bloodweb level, a tracked/maxed summary, and the primary `Update Inventory` action. It should not reintroduce catalog-wide missing counts, advanced filters, Detailed/Compact, or a role-sized “all perks” table.

The Update route should preserve the tested search, All/Personal/General/Unlocked scopes, Only unrecorded, deterministic name order, selected-perk editor, direct tier controls, provenance, and session-only change markers. It remains a reconciliation workspace, not a second progression model.

### Route strategy: reuse `#manage/<id>`

The current router makes route reuse the lowest-risk cutover. Existing collection cards, character dialogs, setup-related links, browser tests, and user bookmarks already use `#manage/<id>`. Reusing it means old links do not become dead links and direct `file://` support remains unchanged.

The cost is that the old manager cannot remain at the exact same route after cutover. The design resolves that explicitly with a temporary legacy route, rather than silently maintaining two meanings for one URL.

### Separate Update route versus in-page mode

| Option | Advantages | Costs |
| --- | --- | --- |
| Separate `.../update` route | Proven by the experiment; deep-linkable; browser Back returns to inventory; session markers naturally end when leaving the route; normal view stays simple. | Requires two route patterns and compatibility aliases. |
| In-page mode | Fewer visible URLs; possibly fewer hash transitions. | Makes Back behavior ambiguous, couples two jobs in one render state, weakens deep links, and makes session lifecycle less explicit. |

Recommend the separate route. The current experiment already proves the interaction and does not need a new state architecture.

## Permanent route design

### During staged rollout

| Route | Meaning during rollout |
| --- | --- |
| `#survivors` | Survivor roster; existing route and controls retained. |
| `#killers` | Killer roster; existing route and controls retained. |
| `#manage/<id>` | Canonical new character inventory. Existing bookmarks now reach the production workflow. |
| `#manage/<id>/update` | Canonical Update Inventory route. |
| `#manage/<id>/legacy` | Temporary old manager escape hatch for parity checks, support, and rollback. Not linked from normal navigation. |
| `#experiment/<id>` | Compatibility alias to the new character inventory. Keep working while experiment bookmarks exist. |
| `#experiment/<id>/update` | Compatibility alias to the new Update route. |
| `#survivor-perks` | Survivor account-wide perk library. |
| `#killer-perks` | Killer account-wide perk library. |
| `#dashboard`, `#data` | Existing surfaces, unchanged in this rollout. |

The temporary legacy route is exactly `#manage/<id>/legacy`; it must not collide with the canonical `#manage/<id>` and `#manage/<id>/update` patterns.

### After stabilization

- `#manage/<id>` and `#manage/<id>/update` remain canonical.
- `#experiment/<id>` and `#experiment/<id>/update` redirect to their canonical counterparts using hash replacement where possible, so old experiment bookmarks remain usable without adding permanent duplicate navigation paths.
- The temporary legacy route is removed or redirected to `#manage/<id>` only after the parity and release gates pass.
- A future implementation may keep a permanent legacy redirect for support, but the old table manager should not remain a second production surface indefinitely.

The router must parse the canonical subroutes before the broad `manage/` check. Invalid IDs and extra path segments must continue to fail safely rather than rendering arbitrary characters.

## Survivor flow

```text
Survivors (#survivors)
  → choose Survivor card
  → character inventory (#manage/<survivor-id>)
  → Update Inventory (#manage/<survivor-id>/update)
  → back to character inventory
```

The Survivor roster remains role-scoped. Account-wide Survivor unlock edits remain at `#survivor-perks`; they affect this flow through `globalTier()` and the existing candidate predicate.

## Killer flow

```text
Killers (#killers)
  → choose Killer card
  → character inventory (#manage/<killer-id>)
  → Update Inventory (#manage/<killer-id>/update)
  → back to character inventory
```

The Killer roster and candidate domain use the same role-neutral components and selectors. Only catalog role and character data differ.

## Roster findings

The current roster already has the artwork, ownership, Prestige, Bloodweb, favorite, native-perk, and summary data required to select a character. Throwing it away would create needless navigation and regression risk.

### Card approaches

### Approach 1: retain current cards unchanged

Keep the native-perk preview, old `Manage perks` label, ownership toggle, all summary fields, and only change the destination renderer.

- Pros: smallest visual change; maximum reuse; lowest browser regression risk.
- Cons: the native-perk preview and `owned / total` presentation still imply catalog management and duplicate information that now belongs on the character page.

### Approach 2: reuse the current shell with a focused selection summary — recommended

Keep the current card grid, portrait asset resolver, favorite/ownership actions, locked styling, and progress fields. Make the primary action `Inventory`. Show only:

- portrait and name,
- Owned/Locked state,
- Prestige and Bloodweb level,
- one tracked/maxed perk summary,
- optional favorite action.

Move the native-perk preview and old catalog-oriented “missing” emphasis out of the selection card. The card still provides enough information to choose the correct character quickly without competing with the inventory page.

- Pros: preserves the proven roster layout and data actions while aligning the card with the new information architecture.
- Cons: requires a modest roster-card content revision and corresponding browser assertions.

### Approach 3: compact roster rows/list

Replace cards with a dense portrait/name/status list and open inventory on row selection.

- Pros: fast scanning across 98 characters; less vertical space.
- Cons: discards the established portrait-card affordance, changes mobile behavior, and makes the rollout broader than necessary.

Approach 2 is recommended. The rollout should reuse the current roster component and artwork mapping, but remove only the catalog-management cues that no longer help character selection.

## Normal character page

The canonical page should contain:

- back link to the role roster,
- portrait, character name, and role,
- Owned/Locked state,
- Prestige and Bloodweb metadata,
- concise `X perks tracked · Y maxed` summary, with an optional upgrade count only when based on `bloodwebEligible()` and clearly useful,
- primary `Update Inventory` action with the tested helper text,
- one responsive card grid using the reusable character perk card.

The grid contains only effective inventory (`inventoryTier > 0`). It is not a filter view. It must not show the old “missing” count, role catalog size, advanced controls, Detailed/Compact, or a wall of unrecorded candidates.

The same card component serves normal and Update contexts. The context changes the row population and whether the card is clickable into the Update editor; the visual tier field, artwork, name, and responsive geometry remain shared.

## Update Inventory

The permanent Update route preserves:

- Search,
- All, Personal, General, and Unlocked scopes,
- Only unrecorded,
- deterministic alphabetical order,
- Small/Medium/Large desktop card preference,
- two-column mobile behavior and stacked editor,
- selected card and direct tier controls,
- secondary provenance badges,
- session-only “Changed this update” markers.

It does not receive account-wide Boolean filters, source-owned filters, global availability filters, tier walls, or Detailed/Compact modes.

### Tier behavior

Cards show `inventoryTier` as the effective state. The editor separately explains:

- effective tier,
- recorded personal tier,
- automatic minimum,
- why the perk is in the candidate pool.

For ordinary perks, direct selection calls the existing validated personal correction path. `Not recorded` removes the recorded personal copy where allowed; it does not lower an automatic minimum. Options below the automatic minimum are disabled and rejected by the domain helper.

Historical/manual-ownership perks keep the existing Not Confirmed / explicit zero / positive-tier distinction and downgrade protection. They must not be flattened into ordinary direct tier semantics.

All edits continue to save immediately through `commit()` and the existing writer/backup/storage rules. The changed marker is in-memory session state only and is not part of the save or export.

### Card size and responsive behavior

Small, Medium, and Large remain a presentation preference stored outside progression JSON, defaulting to Medium and falling back to Medium for invalid values. Desktop/wide layouts apply the selected preset. The existing narrow breakpoints override it, retain the two-column mobile grid, hide the selector when it would crowd controls, and remember the desktop selection for when the viewport widens again.

The CSS-only tier diamond remains the shared visual treatment: black outer frame, inset tier gradient, untouched transparent artwork, explicit Roman numeral, neutral perk-name text, selected rectangular-card border, and changed-session outline. The editor artwork remains independently sized.

## Perk library relationship

The three surfaces remain distinct:

| Surface | Answers | Controls |
| --- | --- | --- |
| Character inventory | What does this character effectively have? | Effective inventory cards and Update Inventory. |
| Update Inventory | What could reasonably appear on this character so I can reconcile it with DBD? | Purpose-built candidate scopes and direct personal correction. |
| Survivor/Killer Perk Library | What perks exist and what does the account have access to? | Existing search/advanced planning filters, perk detail, account unlock editing. |

Account unlock edits remain in the library detail surface. Shrine and Other account unlock are editable; Prestige and Legacy are read-only derived/historical sources. The character candidate pool reads `globalTier()` on the next render, so an account unlock naturally adds or changes a character candidate without a special synchronization table.

The libraries must not be replaced with character cards or inherit the Update scopes. Their current advanced planning behavior is intentionally out of this rollout.

## Locked/owned behavior

The current model and tests do not make target-character ownership a progression eligibility gate:

- Character routes can be opened for locked characters from the roster.
- `bloodwebEligible()` checks role, effective tier, availability/native status, and historical rules, not `save.characters[characterId].owned`.
- Direct personal corrections are validated by character/role and tier semantics, not by a new ownership rule.
- A locked source character’s recorded Prestige still contributes to `globalTier()` and can unlock perks for other characters.
- Character setup itself still requires an owned character, as enforced by `completeCharacterSetup()`.

Production should preserve those facts rather than invent a new rule. Locked roster cards should be visually distinct and may explain that the character is locked, but opening the character inventory must remain safe and consistent with current semantics. If product policy later wants locked-target editing blocked, that is a separate domain decision and must not be smuggled into this rollout.

## Setup relationship

Setup remains a separate utility:

- Account setup records the initial roster and account-level unlock knowledge.
- Run character setups bulk-processes owned characters whose setup is incomplete.
- Individual character setup remains available from the progression dialog for owned characters.
- The new character inventory does not require `setupComplete` to render; an uninitialized character can show an empty effective inventory and enter Update Inventory.
- The character page may retain a small “Edit progression/setup” action in its metadata area, but setup should not be duplicated inside the card grid.
- Setup’s existing automatic-minimum, historical, alias, backup, and commit behavior remains authoritative.

After onboarding, the roster and character inventory should be sufficient for normal maintenance. No setup redesign is required for cutover.

## State and persistence contract

The rollout must preserve all of the following exactly:

- schema version and migration behavior,
- `characters` and `perkOverrides` save shape,
- canonical character/perk IDs and alias consolidation,
- `commit()` and `TrackerStorage.save()` validation order,
- localStorage current save and backup keys,
- JSON import/export and warnings for unknown IDs,
- five local backups and recovery behavior,
- direct `file://` workflow,
- localhost workflow,
- localStorage separation between file and localhost origins.

The UI card-size preference remains outside the progression JSON. Session changed markers, selected perk, search, category, and Only unrecorded state remain transient UI state. There is no new save document, backend, cloud state, account, migration, or concurrency system in this rollout.

## Old manager retirement

The old manager should retire in stages, not disappear at the first route cutover.

### Stage A: canonical route cutover

- Make `#manage/<id>` render the promoted effective inventory.
- Make `#manage/<id>/update` render the promoted Update workflow.
- Keep the old renderer available at the temporary legacy route.
- Keep experiment aliases working.
- Change normal roster and character-dialog actions to point to canonical inventory.
- Keep the account libraries and setup unchanged.

### Stage B: parity and support window

- Run the domain, route, desktop, mobile, persistence, and cross-surface gates described below.
- Compare representative Doctor, Cenobite, Kate, native, General, Prestige, Shrine, Legacy, historical, alias, locked-source, and retained-copy cases against the old manager and saved outputs.
- Use the legacy route only for troubleshooting or parity checks; do not advertise it as the normal flow.

### Stage C: retirement

- Remove the old manager’s broad character-catalog UI and its Detailed/Compact presentation after the support window passes.
- Remove temporary experiment-only entry copy/classes/modules once aliases and compatibility tests no longer need them.
- Keep a lightweight route redirect from old legacy URLs to the canonical inventory if support value justifies it.

No old save fields are deleted. Retirement is a renderer and route cleanup only.

## Compatibility

### Bookmarks and routes

- Old `#manage/<id>` bookmarks remain valid because that exact route becomes canonical for the new inventory.
- Existing `#experiment/<id>` and `#experiment/<id>/update` bookmarks remain valid through aliases during and after stabilization.
- Existing setup and collection links are updated to canonical routes during cutover; no user action is required.
- Invalid IDs, unsafe segments, extra segments, and unknown routes retain safe empty/dashboard behavior.
- Hash routing continues to work identically for direct file and localhost use.

### Saves and imports

- Existing localStorage saves load through the same `TrackerStorage.load()` and migration boundary.
- Existing JSON exports import through the same validator and replacement path.
- Browser backups remain valid and are not rewritten merely because the route changes.
- No user needs to reset progression or export/reimport to use the new UI.
- Account unlock edits continue to use the current internal fields and user-facing provenance labels.

### UI preference compatibility

The existing card-size preference key is UI state, not progression. It should be read as-is during cutover. If permanent naming requires a new key, read the old key as a one-time fallback, normalize invalid values to Medium, and write only the new key thereafter. Do not put this migration into the save JSON.

## Mobile strategy

The current mobile implementation is a release boundary, not a redesign target.

Preserve:

- two-column cards at narrow widths,
- no horizontal page/card scrolling,
- readable artwork,
- stacked/full-width selected editor,
- wrapped search and scope controls,
- hidden card-size selector when controls would crowd,
- remembered desktop size preference that does not affect mobile geometry.

The production renderer must remain one card component and one CSS grid with breakpoint overrides. Do not add a bottom sheet, a separate mobile renderer, a one-column fallback solely because Large is selected, or mobile-specific progression logic. Navigation-shell changes must be tested at the same widths as the existing mobile acceptance boundary.

## Test and release strategy

The rollout should use layered verification, with the old route still available until all layers pass.

### Domain tests

Keep focused pure tests for:

- Killer and Survivor role scoping,
- native P0 candidates,
- native plus Shrine remaining Personal once,
- General never acquired and acquired General records,
- source-less General perks,
- P1/P2/P3 automatic minima,
- owned and locked source characters,
- Shrine I/II/III,
- Legacy and Other account unlocks,
- personal acquisition with no current global unlock,
- positive retained historical copies,
- explicit historical zero and unconfirmed history,
- former-General cases,
- licensed aliases/canonical IDs,
- exact Personal/General/Unlocked precedence,
- no duplicate candidate rows,
- Only unrecorded using effective tier zero,
- normal inventory using only effective tier greater than zero,
- direct tier selection and automatic-minimum rejection,
- preservation of historical correction behavior,
- transient changed state.

### Routing and renderer tests

Verify:

- Survivor roster → canonical Survivor inventory → Update → back.
- Killer roster → canonical Killer inventory → Update → back.
- Old `#manage/<id>` opens the new inventory.
- Temporary legacy route opens the old manager during the support window.
- Experiment routes remain functional aliases and do not create duplicate implementations.
- Account library routes retain advanced filters and Account Unlock editor.
- Invalid and extra-segment routes fail safely.

### Desktop checks

At wide desktop and wide-tablet sizes verify:

- Small, Medium, and Large presets affect canonical character inventory and Update Inventory cards only; they do not affect account-wide perk libraries or unrelated pages.
- Medium is the default and invalid UI preference falls back to Medium.
- Preference survives reload and applies to both normal and Update routes.
- Selected editor remains stable and separate from card art sizing.
- Direct tier correction persists immediately and leaves the changed marker transient.
- Account Shrine/Other edits change candidate membership through `globalTier()`.

### Mobile checks

For both a Survivor and a Killer at the established narrow widths verify:

- two-column grid remains,
- no horizontal overflow,
- artwork and tier state remain readable,
- editor stacks full width,
- controls wrap,
- card-size preference does not distort geometry,
- navigation shell does not cover or trap the editor,
- returning to desktop restores the remembered desktop size.

### Persistence and cross-surface checks

Verify edit → reload → export → import preserves the same progression. Include:

```text
Account perk unlock
  → globalTier
  → character Update candidate pool

Character personal tier
  → inventoryTier
  → normal character inventory

Source Prestige
  → globalTier
  → other characters' automatic minimums/candidates
```

Also verify backups, restore, recovery, explicit historical zero, missing historical record, alias import, and unknown-ID preservation remain unchanged.

### Release gate

Run the full Node suite, fresh build, staged browser smoke, and direct-file manual acceptance using the existing release process. The staged browser suite should exercise both canonical and compatibility routes before the old manager is removed.

## Rollback strategy

The first live cutover is reversible without touching progression data:

1. Keep the old manager renderer and its tests in the source tree.
2. Keep the temporary legacy route available.
3. Make route dispatch select the old renderer for `#manage/<id>` again, or temporarily redirect canonical routes to the legacy route, through a small route-rendering decision—not through save data.
4. Leave all new direct edits in the existing validated save fields; the old manager already understands the same personal/account/historical records.
5. Leave experiment aliases available until the new route is revalidated.

Rollback therefore changes only which renderer is selected. It does not migrate, reset, rewrite, or discard user progression. If a serious issue appears after old-code removal, restore the prior application bundle/source revision and the same save remains readable because the rollout has no schema change.

## Risks

Ranked highest to lowest:

1. **Route ambiguity during cutover.** Reusing `#manage/<id>` while retaining the old renderer requires a precise temporary legacy route and parser ordering. Mitigation: route table tests and an explicit support-window alias.
2. **Category/domain drift.** Licensed General overlaps and historical retained copies can be miscategorized or duplicated. Mitigation: preserve the pure candidate helper, exact Doctor/Cenobite fixtures, and retained-only `All` behavior.
3. **Accidental progression mutation.** A renderer cutover could accidentally fill records from automatic tiers or treat UI state as save data. Mitigation: keep selectors read-only, use `commit()` only, assert export shape/schema, and test reload/import/backups.
4. **Old manager behavior lost too early.** Mitigation: staged retirement, temporary legacy route, and rollback before deleting code.
5. **Mobile regression from production shell changes.** Mitigation: treat the existing two-column/stacked layout as a hard regression boundary and test both roles.
6. **Preference leakage.** Card-size state could accidentally affect account libraries or mobile geometry. Mitigation: scope classes and storage to character inventory, preserve the existing narrow overrides, and test route boundaries.
7. **Naming/alias regressions.** Renaming experiment modules or classes could break direct-file builds or old tests. Mitigation: promote in one controlled change with compatibility re-exports/aliases and fresh build verification.
8. **Locked-character expectation mismatch.** The current model permits more than a strict ownership-gated UI might imply. Mitigation: preserve model behavior and label state; treat any ownership policy change as separate design work.

## Things that felt wrong or need explicit product awareness

The three-category model is workable, but the real data exposes these nontrivial cases:

- Cenobite’s three native perks are also catalog-marked General. Personal precedence is correct, but the underlying catalog relationship is not a clean one-to-one notion of “native versus General.” The UI must expose only the primary Personal category and may show General as secondary provenance.
- A positive historical copy can be relevant even when current unlock rules say nothing about it. Retained-only display in `All` is honest, but the absence of a Retained top-level tab reduces discoverability. Adding a fourth user-facing tab would violate the validated simplicity goal, so retained exceptions should remain visibly badged in All and be covered by help text or editor explanation.
- Former General perks are historical/manual records rather than current General candidates. Treating them as current General would make the Update workflow claim a Bloodweb availability the model explicitly does not grant.
- “Unlocked” includes account-unlocked perks that may also be currently tracked. That is correct because the primary category explains why the candidate appears, while tracked is secondary provenance; it should not be described as “not owned.”
- Current source ownership is not itself an unlock reason. Users may expect owning a source character to unlock that character’s perks; the application’s actual authority is Prestige/global tier, so the production UI should continue to show the real source/provenance rather than infer ownership.

These are reasons to preserve the domain helper and its tests, not reasons to hide exceptions behind a polished UI.

## Scope audit

Deliberately excluded from this rollout:

- save-schema changes,
- migration or recovery redesign,
- backend, cloud sync, authentication, or concurrency work,
- Killer add-ons,
- Survivor items/add-ons,
- offerings,
- build planner,
- dashboard redesign,
- character portraits or artwork pipeline changes,
- account-wide library redesign,
- setup redesign,
- new Boolean/filter algebra,
- Detailed/Compact replacement modes,
- deletion of the old manager before validation,
- removal of the experimental routes before compatibility is no longer needed.

## Self-review

- **Contradictions:** The Cenobite native/General overlap is explicitly handled by Personal precedence; retained history is not forced into a false category.
- **Schema safety:** No route, UI preference, session marker, or renderer state is proposed for the progression JSON.
- **Route dead ends:** Existing `#manage` and `#experiment` bookmarks remain usable; the temporary legacy route provides an old-UI path during validation.
- **Duplicated implementations:** The proposed promotion is one shared domain module and one shared card renderer, not separate Killer/Survivor or old/new card systems.
- **Desktop/mobile divergence:** Desktop presets remain presentation-only; current mobile breakpoints override them and retain the two-column/stacked behavior.
- **Migration risk:** Route aliases and optional UI-key fallback avoid save migration. Existing imports/backups remain on the current validator.
- **Rollback:** Renderer selection can revert without altering saves.
- **Decision status:** The exact temporary legacy path is locked as `#manage/<id>/legacy`; no alternative legacy route naming is required.

## Design file

Written to:

`G:\Projects\dbd-tracker\docs\superpowers\specs\2026-10-11-character-inventory-productionization-design.md`

## Recommendation

**APPROVED FOR IMPLEMENTATION PLANNING**

This architectural design is approved as the basis for implementation planning. It intentionally does not modify product code, routes, save behavior, or the validated experiment.
