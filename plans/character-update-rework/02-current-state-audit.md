# Character Workspace current-state audit

Date: 2026-10-13. Scope: read-only source discovery for a design-document update. No application code, catalog, saves, builds or tests were changed or run. No active account was opened. This directory retains `01-survivor-items-addons-quantity-requirements.md`; documents 02–05 complete the design without renaming that existing reference.

## Evidence and authority

Source paths below are relative to `G:\Projects\dbd-tracker`. Current source is authoritative for implemented behavior. The approved Dashboard design is `../frontpage-character-update-rework/03-dashboard-rework-design.md`. The human's Character Workspace decisions supersede the older character-landing decisions in `docs/superpowers/specs/2026-10-11-character-inventory-productionization-design.md`; its implemented perk semantics and useful controls remain relevant. Historical verification reports are not current test results. There is no Git repository in this workspace.

## Actual route and navigation path

`src/app.js` uses `route()` (hash text or `dashboard`) and `render()`, with `parseCharacterInventoryRoute()` from `src/character-inventory.js`. Exact recognized character routes:

| Current hash | Actual meaning |
| --- | --- |
| `#manage/<id>` | Effective character perk inventory, only effective tier >0 |
| `#manage/<id>/update` | Perk reconciliation candidate grid and selected-perk editor; individual edits autosave |
| `#manage/<id>/legacy` | Catalog-wide legacy manager, advanced filters, Detailed/Compact view |
| `#experiment/<id>` | Parser alias rendering the same normal inventory; canonical descriptor names `#manage/<id>` |
| `#experiment/<id>/update` | Parser alias rendering the same reconciliation workflow |

The parser anchors complete routes and requires `Object.hasOwn(characterById, id)`. It does not recognize `/experiment/<id>/legacy`, standalone update routes, Overview, items, Power, edit or setup hashes. Invalid routes currently fall through to Dashboard. Existing aliases render without changing the hash.

Dashboard targets/recent/Favorites and collection name/Prestige controls use `data-action="character"` → `handleClick()` → `openDetail('character', id)`. They open a native dialog. Collection Inventory links bypass it via `#manage/<id>`. Perk buttons use the same dialog shell with `perkDetail()`; removing the character popup does not remove perk details or confirmation dialogs.

Account Setup is `setupOpen/setupStep` view state, not a distinct hash route. Per-character setup and batch setup are dialog state (`characterSetup`, `setupQueue`), not saved routes. Hash changes close dialogs and account setup. Future canonical and compatibility behavior is defined in [04-routing-and-compatibility.md](04-routing-and-compatibility.md).

## Popup capability migration ledger

`characterDetail()`, `openDetail()`, `refreshDetail()`, `saveCharacterField()`, character-setup actions, and `src/character-setup.js` collectively provide these functions. Hidden setup behavior is part of the audit, not just the visible progression form.

| Existing capability | Current behavior | Future deliberate destination |
| --- | --- | --- |
| Portrait, name, role | Dialog header | Overview header, shared workspace identity |
| Owned / Favorite | Checkbox change saves immediately | Header status plus Edit Character fields; retain collection quick toggles |
| Prestige | Valid numeric input saves during input; safe integer >=0 | Edit Character Progression |
| Bloodweb | Valid input saves during input; integer 1–50 | Edit Character Progression on every update session |
| Notes | Input autosaves | Overview text/summary; Edit Character textarea, same existing field |
| Native owned perks and source | Effective tiers and source labels; perk-detail buttons | Compact Overview native-perk section, Perks detail and existing perk details |
| Automatic minima explanation | Native/Prestige/Legacy/Shrine vs personal | Overview progression context and Perks/Edit provenance |
| Inventory link | `#manage/<id>` | Canonical Perks link; normal character identity actions instead go to Overview |
| Owned incomplete setup offer | `openDetail()` substitutes setup offer for progression content when writable | Non-blocking Overview setup notice with an explicit setup link; no automatic modal |
| Start / Not now | Offer starts setup or returns to progression popup | Explicit Setup page / return to Overview, flag stays incomplete if skipped |
| Set Prestige 1 during setup | Immediate character commit; never decreases Prestige | Preserve labeled immediate action in Setup, with its existing semantics |
| Bloodweb setup steps | P0/BW1 finishes without perk selection; otherwise next step | Setup workspace state; preserve branch and completion behavior |
| Personal perk onboarding | Add/upgrade records, preserve higher tiers | Setup page, sharing selectors/controls with normal editing |
| Add special unlocks / all same-role perks | Personal-only acquisition without global unlock | Setup retains control; Edit Character and Perks expose explicit all same-role/correction scope |
| Historical ownership | Not Confirmed / explicit Not Owned / I–III, existing floor | Shared historical controls in Setup, Perks and Edit Character |
| Review completed Bloodweb setup | Owned-character action reopens two-step setup | Secondary Overview “Review initial setup” link; clearly separate from Edit Character |
| Finish setup | Backup first, `completeCharacterSetup`, BW + additive perks + flag | Setup completion uses existing protected backup/commit model |
| Batch position / skip / close / resume | Owned incomplete list, Survivors first; skips keep flags incomplete | Run character setups navigates Setup pages with transient batch context; completed entries stay complete |
| Dialog close / return | Close popup without reverting already saved fields | Workspace navigation; draft cancel/back contract documented in 05 |

No popup-only Legacy account-tier editor exists. Legacy provenance is read-only in perk details; Shrine and Other account unlock editors remain there/account libraries. Personal corrections in `perkDetail()` remain available and are not retired with the character popup. Data & backups copy mentions clearing a character's perks, but no corresponding clear-character-perks action was found in current source; do not invent that capability or add a new destructive action from this stale copy.

## Perk rules and controls

`src/model.js`: `globalTier` is maximum Prestige-derived (capped at III), Shrine, Legacy and manual override. `isAvailable` includes General. `automaticTier` is same-role global minimum or native I. `inventoryTier` is max(personal record, automatic minimum). General availability alone is not ownership. `bloodwebEligible` adds acquisition, upgrade and historical rules. Inventory display currently says effective inventory, not merely personal records.

`src/character-inventory.js` provides a role-neutral candidate pool: native (“Personal” category currently means native), General, globally unlocked, or already tracked. Retained tracked-only rows remain in All. Search includes aliases/source names; candidates sort by displayed name then ID. Update has All/Personal/General/Unlocked scopes, Only unrecorded, selected detail, quick tier picker, session change count and Small/Medium/Large cards. Card size is a UI preference under `dbdTrackerUi.characterCardSize`, with an old experiment-key fallback. Normal inventory only lists effective owned perks. Legacy alone has the broad advanced-filter and Detailed/Compact table surface.

`setCharacterPersonalTier()` accepts null (delete personal record) or I–III, prohibits a non-null tier below the automatic floor, and delegates to `correctPersonalPerkTier()`. Clearing does not remove automatic ownership. Historical helpers preserve absent versus explicit zero and disallow downgrade through their normal workflow. Existing lower-level correction controls allow separate record correction; do not silently unify these into an unrestricted historical tier picker.

## Setup and writes

`src/setup.js`: three account steps (Owned/Prestige, Survivor global unlocks, Killer global unlocks), individual autosave, Finish sets account `setupComplete`. Character setup uses separate character `setupComplete`. `completeCharacterSetup()` requires Owned, accepts BW1–50, adds/upgrades personal tiers with max(existing, submitted), preserves minima and marks character complete. Finishing backs up first. Setup P1 saves immediately even if later canceled. Routine editing must not set either setup flag merely because data exists.

`src/app.js`, `commit()` asserts writer, clones the current save, mutates, consolidates aliases, stamps account/optional character, calls `TrackerStorage.save()` and adopts only its returned canonical save. Failure retains prior memory. `src/storage.js` validates before storage write; replace validates, normalizes at established entry points, backs up first (or preserves original bytes for recovery), then saves. Existing writer protection is `src/editor.js`/Web Locks. Read-only load can normalize in memory without writes/backups. Full HTML replacement uses `preserveRender()` with limited focus restoration, so new drafts and regrouping need explicit identity/focus handling.

## Save and catalog boundaries

Current `SCHEMA_VERSION = 1`. `freshProgress()` has owned, prestige, bloodwebLevel, setupComplete, favorite, notes, perks and updatedAt; no item/add-on quantities. `validateSave()` reconstructs supported fields, so unrecognized additions are stripped. `safeId` is lowercase alphanumeric hyphen-separated tokens, excludes `constructor` and `prototype`; quantities must not motivate broadening it to slash IDs. Existing tiers support 0–3; unknown well-formed character/perk IDs survive validation with warnings and known wrong-role perks reject the candidate. Known missing characters get fresh records. Queue IDs must not cause creation of unknown character records.

Storage keys stay `dbdTrackerData` and `dbdTrackerBackups`; recovery has existing separate raw-byte entries. Export includes canonical save + `exportedAt`. Backups clone complete saves, with at most five. Current load detects normalization by comparing canonical parsed state with normalized state; a parse-time version conversion needs explicit raw-version signaling. Account-rule normalization and alias consolidation are separate from structural migration. Complete v2 design is in 05; the human approved combining queue and quantities in one v2 release during this pass.

## Available inventory/reference assets

`data/catalog.js` currently imports only the 10.1.2a Survivor/Killer perk research JSONs, builds canonical character/perk IDs and aliases, and is bundled by `scripts/build.mjs`. There is no runtime Survivor item/add-on or structured Killer Power/add-on catalog.

`images/survivor-items-addons/survivor-items-addons-image-manifest.json`, its path report and export report document 38 items + 54 add-ons based on a reported canonical 10.2.0 source. Observed families in manifest order: Key (3/5), Firecracker (3/0), Flashlight (7/14), Fog Vial (3/5), Map (4/5), Med-Kit (8/14), Toolbox (10/11), counts Item/Add-on. Manifest fields are entityType, slash ID, name, itemTypeId, image paths and verification metadata. No rarity/effect definitions are present. The underlying complete 10.2.0 research dataset is not present among the inspected project JSONs. Its absence is a data ingestion/verification dependency, not permission to invent descriptions or change the existing perk catalog version.

`images/updated-images/_inventory/dbd-image-assets-inventory-report.md` and raw `Powers and Add-ons` tree contain many duplicates/background variants, retired, unknown, unused and limited-use buckets. Filenames and folder counts are not canonical definitions or verified Power mechanics. No finalized structured Killer Power or add-on dataset was found. Build a verified character-linked add-on catalog before exposing quantity editors; Power can show a truthful data-unavailable state until verified sections exist. Raw limited/retired Survivor artwork does not automatically expand the seven-family canonical manifest.

## Layout evidence and verification limits

`styles.css` uses shell breakpoints <=1100/<=760 and >=1600, plus inventory rules <=430 and other component-specific 600/900/1000 thresholds. Existing inventory grids and selected editor stack at <=760; <=430 currently forces two perk columns. That rule must not be copied blindly to labeled numeric inventory cards at 320px. Use existing panels, spacing, focus styling and portraits; check 320/500/760/1100/1440/1600 and 200% zoom during implementation. This pass inspects CSS only and makes no claim of rendered viewport verification.
