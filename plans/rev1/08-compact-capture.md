# M08 — Compact second-screen capture

## Goal

At 500/700/900px, recognize a perk, record one legitimate upgrade and return attention to DBD with minimal scrolling or metadata scanning.

## Why now

The quick views, focused controls and icon component now support a compact presentation without new domain logic.

## Dependencies

Complete Filtering (M05/M06) and M07A perk icons. Approved session-global view choice and monotonic upgrade behavior are frozen. M07B portraits, M04B recovery, M03 exclusion and M04A are not prerequisites. This is implementation milestone 5 and completes the strong second-screen cut.

## Current behavior

Character manager uses a five-column detailed table (perk, source, global tier, owned tier, next Bloodweb tier) inside horizontal scroll. `tierButton`/cycle already advances effective tier once, respects bloodwebEligible, stops at III and writes only the next explicit personal record. Native/global automatic tiers remain derived. HistoricalOwnershipControl tracks raw unconfirmed/absent/positive entries and prevents downgrades. At <=760px CSS replaces sidebar with horizontal navigation; at 900px a sidebar still consumes 185px. Topbar has status/export/run-setups controls, and detailed metadata can dominate narrow windows.

## Desired behavior

Visible Detailed/Compact choice on character manager, Detailed default, one session-global in-memory preference shared across manager routes. No automatic width-based mode switching. Compact rows expose icon/name/effective tier plus the same next-tier action; full metadata lives in existing detail dialog. Detailed remains available. No reset-to-zero cycling or impossible effective tier.

## Scope

Alternate compact row rendering using existing list/filter/action logic, responsive toolbar/header/topbar adjustments only needed for capture, accessible focus behavior and narrow-width tests.

## Non-goals

Separate app mode, compact model, tier decrement/removal feature, persistent view setting, new saved builds, all-route redesign, custom controls, whole-app breakpoint rewrite. Historical correction/downward personal-tier editing is a known future enhancement, outside M08.

## Files/components likely affected

`src/app.js:manager/perkTable/tierButton/perkControls/preserveRender/handleClick`, `styles.css` compact rows and relevant media/topbar rules, focused browser compact tests. `src/historical-perks.js` reused unchanged where possible. No model/storage edits expected.

## Proposed implementation approach

Keep one computed `perkList` and render function choice; compact rows remain native buttons/HTML, not a separately stateful component. Use 44px icon slot and stable name detail-button, effective-tier upgrade button with accessible action text, and short unavailable/maxed indicator. Names wrap/truncate sensibly with full accessible name; do not rely on hover for reading. Row action target >=32px and preferably 40px height for quick clicks. Search, quick views, active group summaries, Filters button, result count and sort use the same state as Detailed. Source/global columns may be omitted in Compact rows; required historical controls remain available.

Maintain existing monotonic upgrade semantics: current effective tier E, automatic floor A, raw recorded R; eligible click records **E+1**, leaving A derived. At E=III or ineligible, disable and explain why. Do not write automatic minima into every inventory. Example raw 0/global II -> one click records personal III. Raising/reducing source Prestige still derives correctly with retained personal records. Locked character owned flag does not introduce a new eligibility gate (M05 contract).

Historical case: compact row uses same effective-tier action, plus existing native raw ownership select (Not Confirmed/Not Owned/I/II/III) when needed. Put selector in a short subordinate line or reveal it with one labelled native details/disclosure; if hiding it needs extra clicks for a common historical-capture task, keep the small select visible. Raw Not Owned is never labelled effective None when automatic I+ applies; show “Recorded: Not Owned · Effective: I.” Unknown remains unknown even with an automatic minimum. Existing positive raw floor remains nondecreasing. Selected ownership record must not imply changing other characters/global tier. **No III -> zero cycle**: it conflicts with current no-downgrade history and automatic floors. Perk detail remains the route to account unlock context.

Session view preference is one in-memory variable separate from route filters and save; navigating managers retains it, reload returns Detailed. Native radio group Compact/Detailed avoids additive buttons. Mode switch preserves filters/sort/search and same recognizable tier control focus where present. Reuse Filtering's established tier-action fallback: if upgrade removes a row or disables the current action, focus the next actionable row where sensible, otherwise results heading/appropriate stable control. Mode switching preserves action focus where available; no independent fallback design.

Target width behavior: 500px compact has no document-level horizontal overflow and readable name/tier action; 700px uses same compact flow with more name space; 900px account sidebar leaves less content space. Inspect the whole shell/topbar at both 700px and 900px, as well as rows. Only fix demonstrated overflow/collision; choose the smallest contained CSS correction. First try current breakpoints plus compact rows; do not invent permanent new navigation. Topbar actions may wrap/collapse secondary export/setup text but status remains visible; no mutating control disappears behind overflow. Detailed can retain bounded horizontal table scroll. Prefer CSS layout changes over auto-switching user mode.

## Data model / persistence impact

Transient UI only. Reuses exact progression mutations and historical controls. No Compact property in save/export/sessionStorage.

## Backwards compatibility

Detailed table and existing data semantics stay. Current native buttons/selects, keyboard tier handler and file operation preserved. No artwork availability prerequisite for editing.

## UI/UX behavior

Glance -> icon/name -> click effective tier once -> visible new tier/status. Secondary metadata in existing detail. No extra confirmation for ordinary eligible upgrade; persistence rejection/errors follow M01; simultaneous editing remains unsupported until M03. Missing artwork does not alter interaction geometry.

## Error/failure behavior

Ineligible historical retained perk remains owned but disabled upgrade with concise explanation. Invalid/quota/access failure leaves displayed saved tier unchanged. If later M03 is included, denied-editor state also rejects actions. Failed image uses same fixed fallback. Empty filtered list offers Clear advanced filters where appropriate, preserving selected quick/search/sort; no stranded focus after last row disappears.

## Tests first

- Compact and Detailed display same ordered IDs/effective tiers and filters; mode switch writes no progression.
- raw 0/global II click -> personal III, reload retained; native I -> II; III disabled; historical retained II without path disabled; adding unlock restores eligibility.
- Historical unknown vs explicit zero vs raw positive vs automatic tier remains distinct in compact selector/labels.
- Eligible upgrade at Needs Upgrade tier II removes row and focus goes to next action/results without jumping; keyboard operation works.
- 500/700/900px plus normal desktop: required controls visible/clickable, Compact no document overflow/table-scroll dependency; Detailed table scroll bounded. At 700/900 inspect whole shell/topbar for collision/overflow, not just rows.
- Mode persists across manager routes, resets on reload; missing-image rows identical interaction footprint.

## Implementation steps

- [ ] Use frozen preference/action contracts; add milestone-owned compact workflow/floor/history/focus browser cases.
- [ ] Add native toggle and minimal row presentation using same list/actions.
- [ ] Reuse icon fallback and monotonic upgrade; preserve raw historical select meanings.
- [ ] Reuse Filtering focus fallback for disappearing/disabled actions and test mode switch.
- [ ] Adjust only necessary width/topbar/spacing CSS after checking current breakpoints.
- [ ] Exercise game-adjacent workflow, keyboard, normal desktop and staged file:// and localhost release tests.

## Acceptance criteria

One click records eligible next tier from effective floor and reload survives. No downward cycle or raw-history loss. Compact captures at all target widths without document overflow or mandatory metadata scrolling. Same filter/result state across modes; no persisted preference.

## Manual verification

Place tracker beside DBD at each target width. Use Missing to acquire eligible General I; Needs Upgrade to advance II -> III; inspect historical raw zero with global I and retained locked II. Click/type entirely via keyboard and inspect focus after row disappears. Toggle modes, navigate away/back, reload and confirm preference lifecycle. Disconnect artwork and storage separately to check visible fallbacks/rejection.

## Rollback strategy

Remove compact renderer/toggle/CSS while retaining Detailed/filter/icons. Save mutations identical, so no data conversion. Retain useful focus fix if independently tested.

## Risks

Compact UI may hide why tier is disabled or conflate raw confirmation/effective tier; keep historical labels and detail access. Excessive responsive navigation changes widen scope; test current layout first.

## Exit gate

M08-owned results/state/advancement/disabled/history/focus/width cases pass. Run applicable recurring M09 gate for strong second-screen release; M04B/M03 remain later, portraits optional, downward editing deferred.
