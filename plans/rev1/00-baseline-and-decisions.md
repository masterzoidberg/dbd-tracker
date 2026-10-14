# M00 — Baseline and frozen decision reference

## Goal

Retain the evidence-backed baseline and approved product/runtime policies. M00 is a reference, not an implementation milestone.

## Why now

Product choices are frozen by convergence. The M03-specific exclusion/runtime probe remains later; it does not block core UX work under the documented single-window policy.

## Dependencies

None. Previous baseline evidence is historical; recheck relevant files before implementation. No fresh test/build or runtime probe results are claimed by this rewrite.

## Current behavior

- `package.json`: Node test runner, esbuild only; build targets ES2022. `npm start` rebuilds, `npm test` does not.
- `index.html` loads only styles and regular dist script. `server.js` serves localhost:5173. README says Node 22+, any static server, and direct-file launch; it specifies no supported browser versions.
- Previous review baseline: 47 tests passed and dist equalled a write-free rebuild; not rerun in this rewrite. No Git repository exists in this checkout, so use explicit file snapshots/hashes before implementation rather than assuming branches/commits.
- `TrackerStorage.load()` can write: parse -> clone -> account rules -> aliases -> backup -> save. Initial absent save is not written unless normalization changes it. Storage-event loads also use this path.
- Owner rules affect every old schema-1 save lacking `accountRulesVersion`, irrespective of `accountCorrectionApplied`; `replace` also calls them.
- `src/app.js:render` resets filters whenever route changes. Search selection and elements with IDs survive HTML replacement; most filter buttons lack IDs. Existing tier handler explicitly restores focus.
- Catalog metadata matches now: both role JSONs report patch `10.1.2a`, date `2026-10-05`; combined metadata trusts Survivor only.

## Desired behavior

Use the master README's approved personal-first policy, quick views, groups, route memory and view contracts. Record exact tested Chrome/Edge versions before releases. Retain both file:// and localhost. Do not claim Web Locks exclusion from feature presence alone.

## Scope

Frozen decisions in this directory; baseline source/build/test record and catalog/asset evidence. Disposable runtime probes belong to their respective implementation/release gates.

## Non-goals

Product implementation, personal data import, live-game/catalog research, new infrastructure, browser dependency installation merely to complete the plan.

## Files/components likely affected

`plans/rev1/README.md`, this file, `asset-review.md`, `asset-audit.json`. Later implementation can update project `README.md` with agreed runtime support. Inspect `src/storage.js:load/save/replace`, `src/model.js:applyAccountRules`, `package.json`, `index.html`, `server.js`.

## Proposed implementation approach

Use the master README frozen decisions. Before M03 only, probe Web Locks as a candidate for guaranteed exclusion among supported cooperating clients. Use disposable storage/profiles: same exact file URL in two windows, same localhost origin, different file paths and file vs localhost. Establish that every supported pair sharing dbdTrackerData also shares exclusion. Test acquisition, denial, close/crash/retry and hidden/resumed/frozen writers, not only typeof navigator.locks. Record actual versions and storage/lock scope.

If scopes fail, stop M03 for a concrete runtime/primitive decision; do not substitute an unlocked check or localStorage lease, silently drop direct-file support, or claim safety. Earlier core releases remain shippable with the single-window limitation. Generic migration separation is conditional before third-party legacy support; core personal rules remain untouched.

References reviewed 2026-10-06: [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts). These establish native API properties, **not** observed file-mode support. No runtime browser capability probes were performed in this review.

## Data model / persistence impact

None. Probe fixtures must not use the user's active app/profile saves.

## Backwards compatibility

All existing behavior stays until implementation milestones. Direct-file and localhost are separate data contexts; moving a file remains a storage change requiring JSON transfer.

## UI/UX behavior

Product defaults are approved; publish the single-window limitation before M03 and retain the personal-legacy limitation. No UI changes in this reference.

## Error/failure behavior

Failed exclusion probes block M03 only. Core migration stays personal; M04A remains conditional. Earlier cuts retain file support with documented single-window editing.

## Tests first

- Existing `npm test` establishes 47 passing tests and intentional progression semantics.
- Write-free esbuild equality confirms generated bundle is current without overwriting dist.
- In-memory invalid-save and stale-writer fixtures reproduce the two P1 gaps without user data access.
- Later M03 owns disposable concurrent-context tests and runtime exclusion probe; not a pre-M01 baseline gate.

## Implementation steps

- [ ] Use approved master contracts; no repeat convergence approval required.
- [ ] Record actual browser versions and file/localhost release results, including Popover API behavior with Filtering.
- [ ] Perform exclusion-scope probe only before later M03; record supported cooperating-client guarantee.
- [ ] Save a local source snapshot or initialize version control only if requested/appropriate; preserve personal exports separately, never distribute them.
- [ ] Rerun baseline tests and compare build bytes before M01; differences since this review require targeted reinspection.

## Acceptance criteria

Personal-first architecture and all UI policies are explicit. M01 can start with relevant baseline reinspection. Each release records its file/localhost/browser checks; only M03 requires proven shared-storage exclusion.

## Manual verification

During later M03 use disposable concurrent contexts and record storage/exclusion/close/retry. Core UX milestones inspect 500/700/900 plus desktop, including shell/topbar; no new layout/probe claim is made here.

## Rollback strategy

Remove/update planning notes only. Delete only deliberately created disposable probe fixtures; no product rollback required.

## Risks

Browser-specific file origin/storage behavior; unsupported assumptions from modern syntax or API presence; personal-only requirements may legitimately retain owner rules.

## Exit gate

Baseline reference and frozen decisions accepted. M01 is ready. Browser exclusion scope is a later M03 gate; generic migration is conditional M04A. Neither blocks Filtering or first/second UX releases.
