# M03 — Runtime scope probe

Status: WEB LOCKS SELECTED. LOCALHOST EDGE/CHROME PASS;
FULL CHROME FILE CHECKLIST AND REMAINING EDGE CHECKLIST USER-REPORTED PASS.
The baseline source suite is 148/148. M03 implementation now follows this probe;
actual application acceptance was also user-approved on 2026-10-07.

The approved M03 plan requires: “Probe actual exclusion/storage scope on recorded
file/localhost browser versions; choose guaranteed primitive before implementation.”
Direct-file automation is unavailable here. Actual file results must be supplied
manually. Chrome scope evidence supported implementation; the user subsequently
approved the remaining Edge scope checks and offline application acceptance.

The user reported “it all passed,” then answered “Chrome and yes” when asked
whether this included different paths, file versus localhost, background/suspend/
resume and close/crash release. The full Chrome checklist is recorded as
user-reported PASS. Exact Chrome build was not supplied (the pasted UA reports
154.0.0.0); installed automated Chrome is 154.0.8037.98. The later response
“all good and approved” accepts the remaining Edge checklist. Exact manual Edge
build was not supplied; these results remain user-reported evidence.

## Isolated probe

Open `tests/probes/editor-scope-a.html` directly from disk. Its other-path variant
`editor-scope-b.html` contains identical bytes. The pages have no external requests
or dependencies. They read/write/remove only `dbdTrackerM03ProbeMarker` and request
only `dbdTracker-m03-scope-probe`. They never access tracker saves, backup or raw
recovery keys. The marker and document identifiers are synthetic diagnostic data,
not application revision/lease metadata. No fallback lock emulation is used.

Each page displays/copies its exact URL, browser user agent, secure-context status,
storage marker, API availability, lock result/error, and visibility. A held native
lock lasts until Release lock, document closure or renderer termination. Denied
windows only retry when the user clicks Try lock.

## Automated localhost evidence

Command: `node tests/browser/editor-probe.mjs`.
Detailed results: `release/m03-runtime-probe.json` (separate from accepted-release
verification; excluded from the runtime artifact).

- Microsoft Edge 154.0.4258.62: PASS.
- Google Chrome 154.0.8037.98: PASS.
- Same-origin duplicate URL and different HTTP paths share the marker; exactly
  one lock holder; second and third windows denied.
- Closing owner releases; denied contender does not acquire automatically;
  explicit retry acquires and still reads the prior marker.
- Simultaneous requests yield exactly one holder.
- Actual renderer crash via CDP releases; explicit retry acquires.
- Different localhost origins and separate disposable profiles have independent
  storage and locks.
- API absence/rejection injection is reported without false ownership.
- Only the synthetic marker key is created; actual tracker keys are untouched.

Bringing another headless page forward left the owner visible. Therefore this
does not prove actual background, operating-system suspend/resume or file-mode
behavior. Those checks remain manual. No file result is inferred from localhost.

## Manual file check — start with the duplicate URL pair

Use the same browser profile for A, B and C. Repeat in supported Edge and Chrome;
the reports include each browser version.

1. Double-click `tests/probes/editor-scope-a.html` to open A. Click Write marker,
   then Try lock. A must say Holding; if it reports Error/Unavailable, copy that
   report and stop this run.
2. In A, click Open this exact page in another tab to open B. Click Read marker
   in B. Record whether it is exactly A's marker. Then click Try lock in B while
   A remains Holding. If storage is shared, B must say Denied. If B acquires or
   errors despite shared storage, record the failure and stop implementation.
3. Copy A's report while Holding and B's report after the attempt. Keep the two
   full file URLs and browser strings in the evidence.
4. Open a third duplicate C. It must also read that marker and be denied while A
   holds. Bring B/C forward and background A; try again without releasing A.
   Switch back to A and confirm Holding. Repeat after real suspend/resume.
5. Close A. B/C must stay denied until explicitly retried. Click Try lock in B;
   it must now hold and still read the prior marker. C must remain denied.
6. Release/close all holders. Try lock in two duplicate windows in quick
   succession: only one may hold. Record the results.

## Distinct file paths and file versus localhost

1. Release all probe locks first. Open A and its linked other-path variant D
   (`editor-scope-b.html`) in the same profile. Write a fresh marker in A; Read
   marker in D; record whether storage is shared. Hold A's lock and Try lock in D.
   Shared storage requires denial. Independent storage should be independently
   usable; an unnecessarily shared lock scope also needs review before choosing
   the final lock name/policy. Copy both reports.
2. To compare file with localhost, run `node server.js` from the source folder
   and open `http://127.0.0.1:5173/tests/probes/editor-scope-a.html` in that same
   browser profile. Use another port/static server if 5173 is already occupied.
   Write fresh distinct markers in file and HTTP windows; read them again. They
   should retain separate markers. Both should be able to hold the native probe
   lock independently. Record both reports; Ctrl+C stops the temporary server.
3. For a browser process crash, use a disposable profile/process containing only
   probe windows. After terminating that isolated process, reopen the probe in
   the same profile and explicitly request the lock. It must acquire and retain
   the marker. The automatic localhost suite already checks renderer crashes;
   record actual file/background/crash behavior separately.
4. Clear only the probe marker using the provided button in each storage scope,
   and close all probe tabs when finished.

## Gate and next step

The current writer audit confirms the integration points for the next phase:

| Current path | Required M03 coverage |
|---|---|
| Startup `store.load()` and storage-event reload | Editor acquisition before migration writes; noneditor normalization must be write-free |
| `commit()` → `store.save()` | Live writer assertion before the current-key write; failed candidates remain unadopted |
| `finishCharacterSetup()` → backup then commit | Guard before the preparatory snapshot as well as final save; discard stale drafts on acquisition |
| JSON import and backup restore → `replace()` | Guard before ordinary snapshot or M04B raw preservation, and before current replacement |
| Reset → ordinary `replace()` | Same writer guard; existing corrupt-current refusal remains |
| Backup creation/deletion | Guard every backup collection mutation, including migration snapshots |
| Ordinary/original export, backup listing and original read | Remain readable under M04B validity/access rules; no writer requirement for pure reads |

The four durable write sites are all now in `src/storage.js`: current save,
snapshot collection, raw recovery copy and backup deletion. M04B already moved
the original UI recovery write into storage. Save validity and editor ownership
must remain separate in-memory states.

The formerly pending Edge rows (same file URL, distinct file paths, file versus
localhost, actual background/resume, and file close/crash release) are now
user-approved along with Chrome. No revision metadata, stale-base comparison, storage
lease, or unlocked fallback belongs to M03.

If native lock scopes cannot cover the shared file storage scopes, stop M03 and
present the concrete failure and smallest runtime/primitive alternatives. Retain
the accepted M04B build under its existing single-window limitation. If the
required matrix passes, proceed to failing writer-guard/adoption/two-window tests,
then the contained implementation in the approved M03 plan.
