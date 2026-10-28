# The Ledger · Dead by Daylight tracker

A dark, local-first progression ledger for Survivors, Killers, Prestige, Bloodweb levels, personal perk inventories, and account-wide Prestige/Shrine unlocks. No accounts, backend, database, cloud requests, or runtime dependencies. esbuild is used only to build the browser script.

## Save version compatibility

The canonical write/export format is complete schema v2: Prestige Queue plus per-character inventory quantity maps. The dashboard manages the queue; character workspaces edit Survivor stock and Killer Add-on quantities.

Valid v1 saves are read and structurally converted with an empty queue and empty quantity maps, preserving existing supported progression and character timestamps. Existing account-rule normalization remains separate. Writable load backs up a validated v1 predecessor first; read-only load shows compatible state without a write or backup.

Import/restore replaces rather than merges. A v1 replacement therefore clears current goals and recorded stock after confirmation. Complete v2 saves retain unknown supported IDs through save/export/backup/restore. Malformed state is rejected without silently dropping records. Older v1-only application versions reject v2; no downgrade serializer is provided. Keep the newer application with v2 exports.

## Run

**Double-click `index.html` to use the tracker directly.** Keep `index.html`, `styles.css`, `dist/app.js`, and the staged `images/` folder together. The included bundle contains the code, catalog, and icon manifest; opening the app requires no server, terminal, Node.js, or internet connection.

You can also use the localhost version. With Node.js 22 or later, from `G:\Projects\dbd-tracker`:

```powershell
npm start
```

Open **http://localhost:5173**. Keep this terminal running; Ctrl+C stops it. Any static HTTP server also works. `npm start` rebuilds the bundle before starting the server.

The file and localhost versions have separate browser storage. To switch, export JSON from the version holding your progress, then import it in the other version. For direct-file use, keep the same file path and browser: storage for `file:` addresses is browser-dependent and can change when you move or rename the folder. Regular JSON exports remain important.

After modifying JavaScript, a catalog JSON source, or referenced artwork, rebuild once and reload the page:

```powershell
npm install
npm run build
```

The bundle is included so ordinary direct-file use does not require these commands.

## Release staging (developers)

Run `npm run release` from the source checkout. It runs all Node tests and the
Survivor/Killer patch/date agreement check, removes the old bundle, runs the
normal fresh build (which generates the Killer runtime catalog, then the asset
manifest before bundling), recreates `release/runtime`, verifies its allowlist,
local references, artwork dimensions and hashes, and tests the STAGED app's
persistence, Filtering, Killer workspace and artwork on a free localhost port with disposable browser storage.

The browser runner uses the development-only `playwright-core` package and an
already installed Microsoft Edge. It downloads no browsers. Run
`npm run test:browser -- --chrome` to additionally test installed Google Chrome
against the same stage. Missing browsers or failed smoke checks fail the command.

The canonical artifact is `release/runtime/`, containing only `index.html`,
`styles.css`, `dist/app.js`, an authored runtime `README.md`, and only the usable
referenced perk, portrait, Survivor inventory and Killer Power/Add-on images under
`images/`. Runtime catalogs and the manifest are embedded in the
bundle; source, personal exports, unreferenced artwork, background images, placeholder art,
archives, development servers and package manifests do not ship. `npm start` remains a source workflow.
Any suitable static server can serve the runtime directory; no server machinery
is bundled into the runtime.

`release/verification.json` records AUTOMATED PASS, browser version, catalog
revision and bundle SHA-256 outside the runtime. DIRECT FILE remains **MANUAL
ACCEPTANCE REQUIRED** after each run: open staged `index.html` offline in a
disposable profile, edit Meg's Bloodweb/favorite, reload, close/reopen the exact
path and confirm both persist. Record browser version, bundle hash, date and
PASS/FAIL. Exact steps and a localhost server example are in the runtime README.
Successful automation prepares staging for manual acceptance; it does not claim
full release acceptance. A failed manual check blocks distribution. Save this
record separately; a rerun requires a new check and overwrites the automated
report. File and localhost storage remain distinct/browser-dependent.

The generated `release/artwork-file-check.html` sits outside the runtime artifact.
Open it directly offline to check all staged images; it should report **1428/1428**
decoded (321 perks, 98 portraits, 92 Survivor inventory images, 880 Killer Add-ons
and 37 Powers), with **7 intentional Power fallbacks** for the current supplied image tree.
It does not access saves. Complete the app's direct-file checks separately.

Tests/generation/build/copy/reference/browser failures exit nonzero, mark verification
FAILED and remove unverified runtime staging. Keep any prior verified artifact
separately before rerunning. No ZIP or source archive is created.

Perk artwork uses canonical IDs and catalog aliases, independent of display names.
The supplied tree now covers all 321 perks. The 42 additional icons were supplied
as WebP files with PNG filenames in `images/missing-perks`; authorized PNG copies
were created in each role's `supplied/` directory with identical decoded pixels and dimensions.
The supplied originals and original Cenobite placeholders remain unchanged; the
three authentic replacements take precedence over those excluded placeholders.
The later `images/no-background` delivery replaces 281 active icons with transparent
artwork (260 PNGs copied intact and 21 WebP copies converted without pixel changes).
Seven question-mark variants are excluded; the proper Hex: Plaything icon stays.
The transparent delivery also replaces the Deadlock and Gift of Pain PNG copies.
Delivery folders remain unchanged and are not included in runtime staging.
Missing or failed artwork still uses a diamond and never blocks editing.
`npm test` generates manifests directly from
current inputs and isolated fixtures; it never consumes workspace-generated JSON.
`npm run build` first projects `data/dbd-killers-live-10.2.1.json` into the compact
`data/killer-runtime-catalog.json`, then regenerates `data/asset-manifest.json`
before esbuild. The research master stays out of the bundle. Release stages only
explicit manifest references from that build. No manifest/catalog JSON is fetched at runtime.

Character portraits cover all 98 characters. Collection cards use a 64px slot;
details and character managers use 80px, with CSS containment and a silhouette
fallback. The 86 PNG files are used directly; 12 WebP files named `.png` receive
byte-identical `.webp` copies under `images/portrait-runtime` during every build.
Source portrait files stay unchanged. Tests scan source inputs, and release uses
the same freshly generated manifest to stage and verify all referenced portraits.
`node tests/browser/portraits.mjs` checks mapping, full decode, MIME, editing,
fallbacks and 500/700/900/1440 layouts in disposable storage.

Killer artwork uses the explicit canonical paths under `images/Powers and Add-ons/`:
843 EXACT and 74 REVIEW mappings resolve normally; seven null Power mappings use
an accessible fallback. Invalid explicit mappings fail generation. Artwork browser
checks decode all 880 Add-ons and 37 mapped Powers and compare manifest dimensions.

## Use

Open a Killer's **Power & Add-ons** workspace to read its Power summary and all
20 Add-ons, grouped by Common, Uncommon, Rare, Very Rare and Ultra Rare. All groups
stay expanded, including zero stock. Power Details and Add-on Details open the
gameplay explanation and effects. Quantities save on valid Enter/blur or +/−;
zero removes the stored key, and invalid or failed edits retain their text.
Reader windows can open Details while quantities remain disabled. The 44-Killer,
880-Add-on patch 10.2.1 catalog and artwork are bundled for offline use. Layout
checks cover 320/500/760/1100/1440/1600px, with 44px quantity/action targets.

Click an owned character’s name or Prestige badge to be offered initial character setup. Enter its Bloodweb level, then record personal acquisitions and upgrades. Native perks start automatically at I, while Prestige, Legacy, and Shrine unlocks provide account-wide minimums. General perks start unselected unless personally acquired. Selecting one defaults to Tier I. Finish saves additions/upgrades and completion for that character; subsequent clicks open its normal details without asking again. Edit Bloodweb setup lets you revisit it.

Character setup saves Bloodweb progress and personal perks when you finish, with a backup first. The Bloodweb step shows saved Prestige and offers **Set Prestige 1** for P0 characters; this shortcut saves immediately and preserves your entered Bloodweb level. Existing P1 or higher Prestige is shown and preserved. Existing personal tiers and unknown imported records remain intact; setup never downgrades them. It lists general perks, native perks, account-unlocked perks, and historically acquired perks. Automatic minimums are checked and cannot be unchecked. Import/export preserves each character’s completion status. **Account setup** remains an optional way to record ownership, Prestige, and global availability.

At Bloodweb level 1 and Prestige 0, Continue completes character setup immediately and skips perk selection. Prestiged characters still go to perk setup at level 1, and their personal perk selections are saved normally. Automatic minimums and existing personal records remain intact. Levels 2–50 also continue to perk setup.

In Step 2, **Add special unlocks · Show all perks** lets you record any same-role perk and its tier for that character, including perks without an account unlock. New selections start at Tier I. Selected exceptions remain visible when you switch back to available perks only. Finish saves them as personal records without changing account unlocks or other characters.

**Legacy General Perks:** Borrowed Time, Unbreakable, and Left Behind carry informational `historicalAvailability` catalog metadata. They appear in every Survivor's setup and inventory with a short historical badge and personal ownership selector. Open perk details for the full historical explanation. Missing records mean **Not Confirmed**; a saved numeric `0` means **Not Owned**; `1`–`3` record that character's personal tier. Existing positive tiers are already confirmed and cannot be downgraded by these controls. Normal native and account-wide minimums still apply independently. The marker never grants tiers, account unlocks, or current Bloodweb availability. A retained historical copy alone cannot receive Bloodweb upgrades; native, General, or account unlock availability is still required. Tier III is maxed. Schema 1 and numeric inventories remain unchanged; JSON import/export and backups preserve explicit zeroes and missing records. No migration or historical-ownership guessing is performed.

**Run character setups** in the top bar steps through every owned character whose setup is incomplete, Survivors first and then Killers. It opens the Bloodweb step directly and advances after each successful save. Progress shows the current character and total. Skip leaves that character incomplete; close or Escape exits. Run again to resume unfinished characters. Completed characters are omitted automatically.

Nancy, Steve, and The Demogorgon's nine perks use the same **Legacy General Perk** marker and manual personal ownership controls as Bill's former console General perks. They stay associated with their current source characters and are not currently General. Search and import also accept Situational Awareness, Self-Aware, Inner Healing, Guardian, Kinship, Renewal, Jolt, Claustrophobia, and Fearmonger. Former names merge into the original canonical IDs, preserving higher tiers without creating duplicate inventory slots or account unlocks. The UI keeps the original names and compact badge; perk details display the historical catalog note.

- Start on the dashboard; the tracker assumes no ownership or progression.
- On Survivors/Killers, toggle Owned, favorite a character, or click its name/Prestige badge to edit. Valid edits save automatically.
- Manage perks shows source character/Prestige, global auto-owned tier/source, effective owned tier/source, and next Bloodweb tier. Click an eligible tier to record the next upgrade; Tier III is maxed. Use `/` to focus search.
- Quick views combine with search and advanced filters. Options within a group add together; different groups narrow results. Changing quick view clears advanced groups and retains search/sort. Filters(n) counts active groups; summary × removes its whole group. Facet counts retain search, quick view and other groups, ignoring selections in their own group. Filters stay in memory per character/role route until reload and are never saved with progression.
- Effective owned tier is the maximum of the personal Bloodweb record, native Tier I, source Prestige capped at III, Legacy, Shrine, and unspecified account tiers. These values are calculated without filling or rewriting personal inventory records.
- General means available in the Bloodweb, with no automatic tier. Historical personal acquisitions remain Bloodweb-eligible even without a current global unlock.
- Open a perk in either library to edit separate Legacy Teachable, Shrine, and Unspecified tiers (None/I/II/III). The effective global tier uses the highest account tier; the source label identifies the strongest contributor(s). Counts include owned characters only.
- Existing saves are backed up once before adopting the corrected rules. The stated Legacy unlocks are added at I for Bond, Prove Thyself, Leader, Empathy, Botany Knowledge, Self-Care, and Technician, and at II for Calm Spirit. Old manual values formerly stored under Shrine are retained as Unspecified because their provenance was not recorded. Personal tiers are never erased by this migration. Reset creates a blank account; importing a current export preserves its account unlocks.
- Original Halloween and Hellraiser names are displayed for owned licensed source characters. Display settings apply to unowned sources; searches and imports accept either version. Aliases share one progression record and merge using the higher recorded tier.
- Prestige accepts non-negative safe integers without a game-specific cap; Bloodweb stays 1–50 and never changes Prestige automatically.

## Saves and backups

To correct an accidental personal perk tier, click the perk name to open its details,
then use that character's **Personal record** selector. Choose Tier I–III to correct
the recorded tier, or **None (clear record)** to remove the personal acquisition.
Corrections save automatically and affect only that character. Native and account
unlock minimums still determine the effective tier. Clearing a historical perk's
record returns its historical ownership to Not Confirmed. Account unlock tiers
remain editable separately at the top of perk details.

Progress autosaves to `localStorage.dbdTrackerData`; snapshots use `dbdTrackerBackups`. The last five snapshots are kept. Import, reset, restore, character setup, and account-rule migration create a backup before changing data. Failed backup writes prevent these actions.

**Export JSON** downloads a UTF-8, pretty-printed schema v2 save named `dbd-tracker-YYYY-MM-DD-HHmm.json`, including personal progression, Prestige Queue, inventory quantities, Legacy/Shrine/Unspecified tiers, timestamps, and preserved unknown IDs. Static catalog definitions and transient UI state are not duplicated in exports. Export filenames use your local time.

**Data & backups → Import JSON** validates the entire file, then asks for confirmation before replacement. Malformed structures, unsupported schemas, wrong-role perks, and out-of-range fields are rejected without altering the current save. Missing current catalog characters get defaults. Unknown IDs are reported and preserved, but remain uneditable until their definitions are added. Restore and reset also require confirmation.

If an existing save is unreadable, it is preserved and editing is disabled. The Data view can export the original raw data. Importing a valid save recovers the app and first preserves the unreadable original in a `dbdTrackerRecovery-<timestamp>` localStorage entry.

**Browser localStorage is not an external backup.** Clearing browser data, private browsing, switching origins, or losing the device can erase both saves and local snapshots. Export regularly and keep JSON files elsewhere. Storage failures are shown explicitly and failed edits are not applied.

One window can edit each shared browser storage domain using a native lifetime
Web Lock. Other windows are read-only; navigation, search and export remain
available. Close the editor, then choose **Enable editing** in another window to
reload latest progress and discard open drafts. Missing/rejected Web Locks disables
editing. Before switching versions, close all old tracker windows, since older
clients do not honor this protection. M03 offline acceptance was user-approved on 2026-10-07.

Legacy saves without `accountRulesVersion: 1` are interpreted using this tracker’s existing personal-account migration rules. Arbitrary third-party legacy exports are unsupported. Older local saves and backup restores may also receive those rules.

Recovery (M04B): when stored progress cannot be loaded, Data & backups disables
ordinary JSON export and offers **Export original stored data** for the exact
readable text. Validated import or a readable backup preserves that text in a
unique `dbdTrackerRecovery-` entry before replacing the current save. Failed
preservation/replacement leaves current data unchanged; fallback memory is never
snapshotted as the predecessor. Corrupt backup collections remain untouched and
obstruct ordinary snapshot/restore operations; blocked-current recovery import
does not depend on reading them. Existing migration rules and five snapshots stay.
`node --test tests/recovery.test.js` and `node tests/browser/recovery.mjs` cover
recovery and failures; the full staged browser gate includes these cases. Manual
offline recovery acceptance instructions are in the runtime README.

## Catalog coverage

The tracker loads the supplied patch **10.1.2a** JSON catalogs dated **2026-10-05**: **176 Survivor perks and 145 distinct Killer perks**, with **54 Survivor records and 44 Killer records**. The six duplicate Halloween/Hellraiser killer name variants share records. Character definitions are derived from perk sources. Catalog patch/date labels describe the supplied files; the app does not independently verify live game data.

Catalog source definitions are `data/dbd-survivor-perks-live-10.1.2a-2026-10-05-corrected.json` and `data/killer-perks-audited-10.1.2a-2026-10-05.json`. Update those files to change catalog data; `data/catalog.js` adapts their fields to the tracker model. Run `npm run build` after catalog changes to include them in `dist/app.js`. The browser loads a regular script with the catalog embedded, avoiding module imports and JSON fetches under `file:` URLs.

Killer Power/Add-on research has its own patch version, **10.2.1**, in the canonical
`data/dbd-killers-live-10.2.1.json`. Update that master and rebuild to refresh its
generated runtime projection; research sources, verification notes and patch history
are excluded from the runtime workspace.

Compatibility mappings preserve existing tracker IDs for Bill, Yun-Jin, Barbecue & Chilli, Monitor & Abuse, and Laurie's renamed perks. Licensed name variants share one perk record and general Bloodweb availability. Laurie, The Shape, and The Cenobite own their native perks at I; their recorded Prestige can raise global automatic tiers. Display preferences only change names.

Display names include William "Bill" Overbeck, Lee Yun-Jin, and the shared Aestri Yazar & Baermar Uraz entry. Display-name mappings leave the original character IDs and progression records intact.

Keep existing internal IDs stable when updating names or slugs. New characters get default progression when a save is loaded; existing character progress, inventories, notes, and Shrine overrides are retained. A catalog update can make a formerly unknown imported ID visible without losing its progression. No manual save reset or JSON progression import is needed to update the catalog.

Dashboard collection and Prestige metrics use owned characters; global availability still considers recorded Prestige on locked sources. Suggested P1 targets rank owned characters by locked native-perk count, then current Bloodweb level; there is no invented meta score.

## Files

```text
index.html           Accessible shell and native dialogs
styles.css           Responsive dark interface
data/*.json          Perk/Survivor catalogs, Killer master and generated runtime data
data/catalog.js      Catalog adapter and stable-ID compatibility mappings
src/model.js         Progression selectors, schema validation, migration boundary
src/storage.js       Autosave and backup/replacement operations
src/app.js           Views, filtering, editing, and JSON file workflows
src/setup.js         Three-step character and global perk setup
src/character-setup.js Per-character Bloodweb setup dialog
dist/app.js          Included browser bundle; enables direct HTML opening
server.js            Dependency-free loopback static server
tests/model.test.js  Correctness-critical logic and persistence tests
```

Run tests with `npm test`. Future schemas must be supported explicitly in `migrateData`; schema 1 accepts optional character setup flags and the Bloodweb inventory-policy marker. This is a manual personal tracker, with no game-account integration.

## Verification

Optional Google Drive import/export setup and manual acceptance are documented in
[docs/google-drive.md](docs/google-drive.md). Local saves remain authoritative;
unconfigured/offline builds retain all local JSON and recovery tools.

Character managers offer Detailed/Compact using the same filters and progression
actions. Compact shows perk names/icons, effective tiers, next-tier availability
and the existing historical record selectors. The presentation choice lasts only
for this session across managers; reload defaults to Detailed. It is never saved
or exported. `node tests/browser/compact.mjs` runs the focused staged workflow;
the canonical release also includes it, with 500/700/900/1440 width checks.

The Node tests cover native ownership, General availability, Prestige/Legacy/Shrine minimums, personal-tier preservation, Bloodweb eligibility and next tiers, licensed aliases, account migration, setup completion, validation, JSON round trips, unknown-ID preservation, backups, reset, and failed storage writes.

M02 adds allowlist/recreation, path-safety, required-reference, patch/date and
release-failure regressions. Automated staged localhost smoke passed in Edge
154.0.4258.53 and Chrome 154.0.8037.98. Direct-file acceptance must be recorded
separately for each staged release; these HTTP results do not establish it.

Browser checks exercised all six sections, Survivor/Killer editing, favorites, locked progression retention, perk cycling, Shrine edits, search/filtering, reload persistence, an actual JSON download and file-picker import, malformed/future-schema rejection, backup restore/delete, reset, and Escape cancellation. Layouts were checked at 320, 768, 1024, and 1440 pixels; narrow perk tables scroll within their panel. No console errors were observed. Temporary test progress and snapshots were cleared afterward.
