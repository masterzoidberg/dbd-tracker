# M03 — Single-Editor Protection (later, runtime-gated)

## Goal

Prevent silent whole-document and backup-collection overwrites while keeping the personal app simple: one active editing window per shared storage domain.

## Why now

Validated writes can still erase each other, but simultaneous editing remains unsupported through the first and second UX cuts. M03 is implementation milestone 7, later after M04B. It adds real exclusion for all supported cooperating clients, including recovery; it does not block Filtering or earlier releases.

## Dependencies

M01 write contract, M02 browser harness, M04B recovery integration in the approved sequence, and M03-specific runtime/primitive probe. M00 is reference only. Web Locks remains a candidate until shared storage/exclusion scopes are proven on direct file:// and localhost.

## Current behavior

Two `TrackerStorage` instances overwrite one key independently. The reproduced A.favorite/B.owned example loses favorite. App storage events reload after writes. Backup add/delete use array read/modify/write, also unguarded. `load` can write migrations, and `finishCharacterSetup` creates its own snapshot before commit. Raw recovery writes occur directly in the import handler. All these are writers, including apparently read-only startup.

## Desired behavior

If the M03 probe proves Web Locks suitable, the first window acquiring a named exclusive lifetime lock is the editor. Other same-storage windows can read/search/export but reject progression, import, reset, restore, backup deletion and hidden migration writes visibly. No automatic overwrite/takeover. After editor closes, another window explicitly requests editing, acquires the lock and reloads latest data before enabling controls. No persisted revision or writer lease.

## Scope

Small writer guard in existing storage module (or one small separately testable helper if needed), initialization ordering, read-only presentation and ownership transition. Guaranteed exclusion comes from the proven primitive, not an unlocked stale-base check.

## Non-goals

Multiple concurrent editors, automatic merges, Web Locks per keystroke, lock stealing, localStorage lock emulation, expiry heartbeat, tab messaging bus, autosaved edit retry.

## Files/components likely affected

`src/storage.js` all mutating methods plus read-only loading; `src/app.js` initialization/commit/storage listener/import/setup/restore/reset/delete handlers; `index.html` or generated topbar notice and `styles.css`; storage tests and `tests/browser/`.

## Proposed implementation approach

If the runtime probe confirms Web Locks, prefer a lifetime editor lock. The app needs one quick-capture window; a lifetime lock permits synchronous localStorage writes and minimizes event-handler churn. Per-write asynchronous coordination adds queued edit/draft handling without benefit to this approved one-editor policy. The following is the candidate approach, not an already-proven file-mode capability.

At startup render a neutral loading/read-only state, request `navigator.locks.request('dbdTracker-editor', { ifAvailable: true }, callback)`. A granted callback waits on a deliberate unresolved promise for the lifetime of editing. Initialize authoritative save/migrations only after ownership. A denied callback completes and leaves read-only state; ordinary load for this window must not perform migration backups or save. A browser document closure releases the native lock; provide no steal button. Explicit “Enable editing” retry requests anew, reloads latest current/backups and discards/reopens stale setup drafts before enabling. Optionally expose “Release editing” only if it stays a small addition; closing current editor is sufficient.

`TrackerStorage` requires a live writer capability for every mutation, including migration-triggered save/backup, current raw recovery, and M04B predecessor preservation. Unit tests inject a small guard, not a production bypass. Keep pure reading/normalization distinct from persisted migration; read-only windows may show normalized preview with a notice but cannot claim it was saved. One lock protects both save and backups; no nested locks.

Do not add a partial stale-base mechanism to M01 or rely on read/compare/write for exclusion. The supported M03 guarantee covers cooperating clients participating in the proven primitive; older clients and arbitrary external writes are not coordinated. Require all old tracker windows closed before switching versions. No persisted revision, timestamp check or localStorage lease replaces actual exclusion.

A corrupted current save requires writer ownership before recovery, but lock ownership and save validity are different flags. Use separate reasons for load failure, other editor and storage denial. Neither API absence nor failed file probe may silently fall back to unlocked writes. If supported scopes cannot be satisfied, stop M03 for a concrete runtime/primitive decision. Do not silently remove file support or claim unlocked safety. Earlier UX releases remain shippable under the documented single-window limitation.

## Data model / persistence impact

None; writer state is in memory. Same schema and keys. No revision in progression JSON or lock key in localStorage.

## Backwards compatibility

Existing current saves/exports need no migration. Old running clients do not honor locks; instruct users to close them and reload the new release. File support must satisfy the agreed matrix, not just hostname support.

## UI/UX behavior

Visible “Read-only: another tracker window is editing” and editing retry. Search, navigation, filters and details work; export follows M04B's valid-current/original-data distinction. Mutating controls disabled with explanation, but storage guard remains authoritative against programmatic events. Unsaved setup drafts are not silently committed after editor transition. Do not label a read-only normalized view “Saved locally.”

## Error/failure behavior

Denied lock -> zero writes. Capability missing/rejected -> explicit unavailable state under the agreed runtime policy. Access denied -> accurate export guidance. Valid read-only state may export normal data; corrupt-current state follows M04B's disabled ordinary export and clearly named original-data export. Denied ownership means zero current/backup/recovery writes. Every backup/recovery preparation asserts ownership before mutation.

## Tests first

- Two revised windows share localStorage; first editor changes Meg, second tries Trapper. **Invariant:** second cannot write; Meg stays saved, visible read-only feedback.
- Simultaneous startup yields exactly one editor; read-only load of unmarked legacy save creates no snapshots/writes.
- Close editor -> retry other -> reload latest -> edit succeeds; stale setup draft not applied.
- Direct-file duplicate windows sharing storage also contend for lock; separate storage contexts are independently usable.
- Missing/rejected exclusion primitive never uses an unsafe writer fallback.
- Backup add/delete, M04B predecessor preservation/import recovery and hidden load writes are guarded, not merely visible buttons.
- Existing source/storage tests updated to inject deterministic writer guard; no new domain behavior.

## Implementation steps

- [ ] Probe actual exclusion/storage scope on recorded file/localhost browser versions; choose guaranteed primitive before implementation. Test same file URL, localhost same origin, distinct file paths, file vs localhost, background/resume and close/crash release.
- [ ] Write guard/ownership and two-window browser tests before implementation.
- [ ] Separate read-only load from editor migration persistence; acquire before any mutation.
- [ ] Guard every mutation, including M04B raw predecessor/current replacement, and adopt latest validated state after acquisition/retry.
- [ ] Add clear read-only/retry UI and stale-draft handling.
- [ ] Test simultaneous startup, close/crash/retry and storage-event refresh on approved runtimes.

## Acceptance criteria

Exactly one revised editor for every supported shared storage domain. Noneditor current/backup/recovery bytes never change. Retry after release starts from latest bytes. File lock/storage matrix passes. No schema/revision/lease additions.

## Manual verification

Open A/B at same file URL in a disposable profile, and repeat localhost. A edits; B reads then attempts edit/import/delete and receives rejection. Close A, retry B, verify A's values before B edits. Reload both. Suspend/resume or background A to confirm B never steals; test third window. At 500/700/900 px ensure state/error and retry remain visible.

## Rollback strategy

No save migration to undo. Close all windows before reverting guard/init/UI together. Reverting reintroduces stale overwrite risk; retain verified release and exports.

## Risks

Highest-risk milestone: file-origin lock/storage mismatch, lifetime-lock callback initialization, hidden load writers, stale drafts and mixed old/new releases. Native locks only protect participating clients. A single-editor policy is approved; the concrete runtime guarantee still requires the M03 probe.

## Exit gate

Two-window and file-mode invariants pass on the agreed matrix; no unlocked fallback; every storage mutation is covered. M04B already exists in the approved sequence; its writes are now covered by exclusion. No earlier release is retroactively claimed protected.
