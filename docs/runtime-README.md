# The Ledger · Dead by Daylight tracker

Google Drive is an optional online JSON backup transport on HTTP/HTTPS builds
configured by the publisher. It is unavailable when opened directly from disk.
Browser-local data remains the primary save; local import/export and recovery
work offline. Drive authorization lasts only for the current page session and
may expire; reconnect explicitly when needed. No automatic upload or sync occurs.

Open `index.html` directly in a current Chrome or Edge browser. Keep this README,
`index.html`, `styles.css`, `dist/app.js`, and the `images/` folder together. No Node.js, server, network,
or installation is needed for direct-file use. The regular script embeds the
catalogs and icon manifest; the browser does not fetch catalog/manifest JSON files.
Perk, character and collection artwork load from explicit local manifests in the
staged `images/` folder. The three former Cenobite placeholders use authentic
replacement icons. Missing or failed perk icons use a fixed neutral diamond;
missing or failed portraits use a silhouette or named neutral fallback. Images fit
their fixed slots without cropping, and artwork does not affect your save. The
generated release report and artwork check show the current asset totals and
intentional fallbacks for each build.
The bundled Killer Power & Add-ons workspace includes the catalog for patch 10.2.1.
Each Killer page shows its Power summary and a flat Add-on list with rarity sorting
and filters. Details opens the full gameplay explanation or effect.
Quantities save on valid Enter/blur or +/−; zero removes the stored key, and invalid
or failed edits retain their text. Reader windows retain Details access.
All mapped Add-on and Power artwork is local. Unavailable Power artwork has a
named accessible fallback. Everything remains available offline.

The same directory can be served over localhost by any appropriate static HTTP
server. This runtime is not a Node/npm development project and does not contain
package manifests, development scripts, or a server. `npm start` belongs to the
source checkout. If Python is already available, one example is:

```powershell
cd <this-runtime-directory>
python -m http.server 5173 --bind 127.0.0.1
```

Open `http://127.0.0.1:5173/`; Ctrl+C stops that server.

File and localhost storage are distinct/browser-dependent. Do not expect the
same progress in both. Export JSON from the old location and import it into the
new one when transferring progress. Keep regular external JSON backups.

One tracker window can edit each shared browser storage domain. Other windows are
read-only: navigation, search and export remain available, but progression,
imports, recovery and backups require the editor. Close the editing window, then
choose **Enable editing** in another window. That retry reloads the latest saved
progress and discards open setup drafts. Missing or rejected Web Locks leaves
editing unavailable; no unlocked fallback is used. Before switching versions,
close **all old tracker windows**: older versions do not honor editor protection.

Legacy saves without `accountRulesVersion: 1` are interpreted using this tracker’s existing personal-account migration rules. Arbitrary third-party legacy exports are unsupported. Older local saves and backup restores may also receive those rules.

If stored progress cannot be loaded, editing and ordinary Export JSON are blocked.
On Data & backups, **Export original stored data** downloads the exact readable
stored text as `.txt`, even when it is invalid JSON. Keep this external copy before
recovering through a valid JSON import or readable backup. Recovery first preserves
the original text separately in this browser, then writes validated progress.
Read/preservation/write failure leaves the original current save unchanged. These
raw recovery copies are separate from the five normal snapshots and are not
automatically deleted. No fallback/default account is exported or backed up as
your original progress. Corrupt backups are left untouched: they obstruct restore
and ordinary snapshot operations, but do not prevent recovery import while current
progress is blocked. No automatic backup repair is provided.

## Manual direct-file acceptance — required for each new staging run

The automated release gate tests localhost. The separate disposable workspace-file
suite also verifies direct-file browsing and writer-capable Save/reopen where
supported. Those automated results do not replace genuine 200% zoom/manual
release acceptance below.
Use a disposable browser profile and synthetic progress for this check:

1. Close other tracker windows. Disconnect from the network and double-click this
   directory's `index.html`. Confirm the dashboard starts without an error.
2. Open Survivors, search Meg, open Meg Thomas, set Bloodweb to 25 and Favorite on.
   Confirm “Saved locally”.
3. Reload, search Meg again, and reopen her details. Confirm Bloodweb 25 and Favorite.
4. Close the tracker, reopen this exact `index.html` path in the same profile, and
   confirm both values again.
5. Record the browser name/version, staged bundle SHA-256 (from the developer's
   `release/verification.json`), date, and PASS/FAIL. A failure blocks distribution.

For character Perks acceptance, open Meg's workspace and choose Perks. Choose Bloodweb Available,
then use Filters to select Effective Tier I/II and Source Character Owned.
Compare the results and option counts; reopen a summary and remove its whole
group with ×. Clear advanced filters and confirm quick view, search and sort stay.
Check Escape/Close, checkbox keyboard focus, typing/search caret, Skip to content,
perk historical explanations and route away/back. Reload resets filters, while
progress persists. At 500/700/900 pixels and desktop, confirm the filter panel,
close button and top-bar controls remain reachable. The panel uses the browser's
native nonmodal Popover API; verify it in direct-file mode for the recorded browser.

For artwork acceptance, confirm Detective's Hunch has an icon in the Survivor
library and its details. Original/generic licensed names must retain the same icon.
In the Killer library, Deadlock / No Holds Barred, Hex: Plaything / Hex: Fortune's
Fool, and Scourge Hook: Gift of Pain / Scourge Hook: Weeping Wounds now have their
supplied replacement icons. A Place for Us also has its supplied icon. At
500/700/900 pixels and desktop, names and tier actions must remain usable.
In a disposable copy only, temporarily rename a usable PNG and reload its perk:
confirm a diamond replaces the failed image and editing still works; restore the
filename afterward. Record the browser/version and PASS/FAIL for offline file use.

For artwork acceptance, open the generated `release/artwork-file-check.html` offline.
Confirm it reports PASS and that its total and fallback count match the current
`release/verification.json`; these generated values change with the catalogs. The
check covers Perks, workspace portraits, collection portraits, Survivor inventory,
Killer Add-ons and Powers. Release checks only explicit manifest references and
verify their dimensions and hashes; browser checks decode every mapped image.
Check Survivor/Killer cards,
character details and manager headings, especially Bill, Aestri/Baermar, Yun-Jin,
The Onryō, Ghost Face and Zarina. At 500/700/900 pixels and desktop, names and
Favorite/Owned/edit controls must remain reachable in both Detailed and Compact.
In a disposable copy, rename one PNG and one WebP portrait and confirm a stable
silhouette, working edits and no broken-image icon; restore their filenames.

Repeat startup/edit/reload through a static server serving THIS directory; use
different synthetic values and confirm they persist. File-mode progress need
not appear over localhost. Each release must have AUTOMATED PASS for localhost
and a separately recorded MANUAL PASS for direct file before distribution.

For Recovery acceptance, use only a disposable profile with synthetic progress.
Export a valid synthetic save first. In that profile's browser console, run
`localStorage.setItem('dbdTrackerData', ' \r\n{broken')`, then reload Data & backups.
Confirm both Export JSON buttons are disabled and Export original stored data
downloads exactly that original text. Import the synthetic save, confirm recovery,
and check its values after reload and ordinary export. Repeat with a readable
backup selected instead of import. In another disposable run, corrupt the backup
collection with `localStorage.setItem('dbdTrackerBackups', '{broken backups')` too:
restore must be obstructed with guidance, while valid recovery import succeeds
without changing that collection. Inspect a `dbdTrackerRecovery-` storage entry
to confirm exact predecessor preservation. Never inject these fixtures into a
real account. Repeat offline/direct-file and record browser/version and PASS/FAIL.

For Compact acceptance, open a character workspace's Perks section and choose Compact.
Detailed remains the default after reload; the choice is shared across character
managers during the current session and does not change saved progress or filters.
At 500/700/900 pixels and desktop, confirm names, icons/diamonds, tier buttons and
top-bar controls remain readable and reachable without horizontal page scrolling.
Use Missing to acquire an eligible General perk at I and Needs Upgrade to advance
II to III. Check keyboard activation and focus after the upgraded row disappears.
Tier III is Maxed; retained historical tiers without an unlock are Not available.
Historical selectors keep Not Confirmed, Not Owned and recorded positive tiers
separate from effective automatic tiers. Inspect a recorded zero with automatic I
and a retained II without an unlock. Toggle modes, navigate away/back, then reload:
progress persists while the presentation returns to Detailed. In a disposable copy,
check missing-image fallbacks and a browser storage-write rejection independently.
Record the browser/version and PASS/FAIL; deferred artwork acceptance still remains
required before distribution.

## Schema v3 portability

This build reads valid schema v1, v2 and v3 saves, and writes/exports schema v3.
Planning state is portable JSON: role-separated Prestige and Playing Queues plus
role-separated Up Next pins with one explicit Prestige or Play intent per pin.
The older global Prestige Queue is split by canonical character role during v2 to
v3 migration. Playing Queues and Up Next start empty; unresolved valid records are
preserved without guessing a role. Unknown supported character, perk and inventory
IDs remain in the save. The current schema is shown on Data & backups and in export.

Survivor inventory is a separately versioned 10.2.0 research catalog alongside the
10.1.2a Perk catalog. Killer Power/Add-on data comes from the canonical 10.2.1
master; the build generates a compact runtime catalog before the artwork manifest
and bundle. The research master is excluded from the runtime.

Writable schema migration backs up the validated predecessor before conversion.
Read-only loading does not write or back up; structural conversion does not
fabricate character edit times. Existing account-rule normalization retains its
established behavior. Unsupported future versions and malformed declared-v3 data
are rejected without replacing the stored save.

V1 imports pass through the v1-to-v2-to-v3 migration; v2 imports migrate directly
to v3. Import previews disclose replacement defaults. Backup restore follows the
same supported migrations. Export/import, local backup, restore and reset preserve
or deliberately replace the planning state. There is no lossless downgrade path;
older app versions do not preserve schema-v3 planning data.

Continue is a browser-local workspace shortcut. It is not saved in account JSON or
backups. Successful import, restore and reset clear it; cancellation leaves it.

V1 import/restore is replacement: the legacy Prestige Queue is empty by default,
and stock maps are empty because schema v1 had no inventory. A v2 Prestige Queue
migrates into the role lanes; new Playing Queues and Up Next pins remain empty.
Reset backs up first and clears progression, inventory, queues and pins.

## Workspace and inventory acceptance

Character identity links open Overview. Old manage/experiment bookmarks retain Perks meaning, and older `/edit` bookmarks open Overview. Initial Setup is separate from focused Overview edits: progression and Notes each use their own in-memory draft with explicit Save/Cancel, and dirty navigation offers Save/Discard/Stay. Detailed Survivor quantities save on valid Enter/blur; zero entries remain visible by default and are removed from sparse storage. Invalid/failed edits retain text. Unknown stock is preserved.

For Killer acceptance, open Power & Add-ons at 320/500/760/1100/1440/1600px.
Confirm the Power panel stacks at narrow widths, artwork keeps its slot, all five
rarity headings and 20 Add-ons remain visible, and quantity/Details actions remain
reachable without horizontal page scrolling. Check a mapped Power and The Dark
Lord's accessible artwork fallback. Edit a quantity with Enter, blur and +/−;
reload and reopen the same file to confirm persistence. Open both Details dialogs
with the keyboard and confirm focus returns. Record browser/version and PASS/FAIL.

Automated disposable direct-file tests cover routes, browsing, writer gating and native writer-capable Save/reopen. For release acceptance, still record genuine browser 200% zoom and manual keyboard/file checks in a disposable profile at 320/500/760/1100/1440/1600 widths. CSS zoom/deviceScaleFactor is not browser zoom. Confirm labels, large quantities, focus after errors/regroup/filter removal and Save/Cancel visibility. Never use an active account for this verification.

The Dashboard shows a high-level Progression Snapshot, separate Survivor and Killer
Up Next lanes, and an optional Continue shortcut. Each Up Next lane holds up to five
manually ordered pins; every pin has one explicit primary intent. A character can
also belong to both longer-term queues, or be pinned without either membership.
Queue edits do not add, remove, reorder or retarget pins. Prestige goals, including
complete or unavailable goals, remain until you edit or remove them. Manage Queues
is subordinate to the Dashboard's Up Next lanes. Continue resumes a stable character
workspace and is not portable account state. The local responsive suite covers
320/500/760/1100/1440/1600px. Genuine browser 200% zoom acceptance remains
OUTSTANDING; viewport emulation is not zoom acceptance.
