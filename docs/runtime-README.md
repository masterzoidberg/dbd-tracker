# The Ledger · Dead by Daylight tracker

Open `index.html` directly in a current Chrome or Edge browser. Keep this README,
`index.html`, `styles.css`, `dist/app.js`, and the `images/` folder together. No Node.js, server, network,
or installation is needed for direct-file use. The regular script embeds the
catalogs and icon manifest; the browser does not fetch catalog/manifest JSON files.
Perk PNGs load locally from the staged `images/` folder. All 321 perks currently have
artwork, including authentic replacements for the three Cenobite placeholders.
Missing or failed icons use a fixed neutral diamond. Artwork does not affect your save.
All 98 characters have portraits in collection cards, character details and Manage
perks. PNG/WebP files are local; a missing or failed portrait uses a silhouette.
Images fit their fixed slots without cropping; source artwork is preserved.
The bundled Killer Power & Add-ons workspace covers all 44 Killers and 880 Add-ons
from patch 10.2.1. Each page shows the Power summary and all 20 Add-ons in five
expanded rarity groups. Details opens the full gameplay explanation or effect.
Quantities save on valid Enter/blur or +/−; zero removes the stored key, and invalid
or failed edits retain their text. Reader windows retain Details access.
All 880 Add-ons and 37 Powers use explicit local artwork; seven Powers have an
accessible fallback. Everything remains available offline.

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
supported. Those automated results do not replace the genuine200% zoom/manual
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

For Filtering acceptance, open Meg's Manage perks. Choose Bloodweb Available,
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

For portrait acceptance, open the sibling `artwork-file-check.html` offline:
expect 1428/1428 images (321 perks, 98 portraits, 92 Survivor inventory images,
880 Killer Add-ons and 37 Powers), with seven intentional Power fallbacks. The
release checks only explicit manifest references and verifies their dimensions
and hashes; browser checks decode every mapped Killer image. Check Survivor/Killer cards,
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

For Compact acceptance, open a character's Manage perks and choose Compact.
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

## Schema v2 portability

This build reads valid v1 and complete v2 saves and writes/exports complete v2 with Prestige Queue and per-character inventory quantity maps. Survivor inventory is a separately versioned 10.2.0 research catalog (38 Items/54 Add-ons/7 families), alongside the existing 10.1.2a Perk catalog. Killer Power/Add-on data comes from the canonical 10.2.1 master; the build generates a compact runtime catalog before the artwork manifest and bundle. The research master is excluded from the runtime. Unknown supported IDs are preserved and discoverable as read-only records.

Writable v1 loading backs up the validated v1 predecessor before structural conversion. Read-only loading does not write or back up; structural conversion does not fabricate character edit times. Existing account-rule normalization retains its established behavior.

V1 import/restore is replacement: it produces an empty Prestige Queue and empty quantity maps, so the confirmation warns that current goals and stock will be replaced. Reset backs up first and clears both. V1-only old builds reject v2 rather than stripping these fields; there is no downgrade export.

## Workspace and inventory acceptance

Character identity links open Overview. Old manage/experiment bookmarks retain Perks meaning. Initial Setup is separate from comprehensive Edit Character. Edit is a memory-only draft with explicit Save Character and Save/Discard/Stay exits. Detailed Survivor quantities save on valid Enter/blur; zero entries remain visible by default and are removed from sparse storage. Invalid/failed edits retain text. Unknown stock is preserved.

For Killer acceptance, open Power & Add-ons at 320/500/760/1100/1440/1600px.
Confirm the Power panel stacks at narrow widths, artwork keeps its slot, all five
rarity headings and 20 Add-ons remain visible, and quantity/Details actions remain
reachable without horizontal page scrolling. Check a mapped Power and The Dark
Lord's accessible artwork fallback. Edit a quantity with Enter, blur and +/−;
reload and reopen the same file to confirm persistence. Open both Details dialogs
with the keyboard and confirm focus returns. Record browser/version and PASS/FAIL.

Automated disposable direct-file tests cover routes, browsing, writer gating and native writer-capable Save/reopen. For release acceptance, still record genuine browser200% zoom and manual keyboard/file checks in a disposable profile at320/500/760/1100/1440/1600 widths. CSS zoom/deviceScaleFactor is not browser zoom. Confirm labels, large quantities, focus after errors/regroup/filter removal and Save/Cancel visibility. Never use an active account for this verification.

Dashboard uses one manually ordered Prestige Queue. Recommendations never reorder it.
Queue goals, including complete or unavailable goals, remain until you edit/remove them.
Dashboard links open Character Overview. Queue-only edits leave character activity unchanged.
Plan 4 automated layout checks cover 320/500/760/1100/1440/1600px.
Genuine browser 200% zoom acceptance remains OUTSTANDING; viewport emulation is not zoom acceptance.
