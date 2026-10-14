# Filtering — phase 1 (M05): domain contract and route memory

## Goal and dependencies

Define exact quick views, logical groups, pure facet calculations and transient state as the nonvisual foundation for one Filtering deliverable completed by M06. M01/M02 precede it; M00 is the approved reference. M03/M04 are not blockers. M05 is independently reviewable/testable, but Filtering becomes user-visible only when M06 completes its single cutover.

## Current behavior and scope

src/perk-filters.js mixes category OR and availability/tier shortcuts; app resets filters on route change. Keep model inventoryTier effective personal/automatic maximum, bloodwebEligible and historical semantics. M05 adds explicit definitions, pure matching/transitions/facet calculations and the route-keyed state model only; no save/model/schema, URL persistence or sessionStorage. Do not switch live matching to the new contract while the old flat UI would misrepresent it. No new visible quick controls or interim visual filter arrangement.

Likely implementation files: src/perk-filters.js and tests/perk-filters.test.js; src/app.js only for isolated route-state logic that can be introduced without changing visible filters or live matching semantics. Preserve collection predicates/sorting and former-name search. New event/control wiring and completed Filtering browser coverage belong to M06.

## Quick views

Character context: same-role perks, existing effective tier, no new target-character owned-flag gate.

| View | Predicate |
|---|---|
| All | No quick restriction |
| Bloodweb Available | bloodwebEligible(save, characterId, perk) |
| Owned | effective inventory tier > 0 |
| Missing | effective inventory tier == 0 |
| Needs Upgrade | effective tier I or II AND bloodwebEligible() |

Bloodweb Available help: “Eligible to appear for the next tier. Bloodweb appearances are random.” Owned alone does not imply eligibility; maxed III excluded from Bloodweb Available. Missing includes historical unknown and explicitly absent at effective zero, without asserting verified absence. Automatic floors may make raw zero effectively owned.

Account: All; Globally Available = isAvailable(); Owned by My Characters = at least one owned character of perk's role has effective inventory tier >0; Globally Locked = !isAvailable(). No account-wide Missing. Visible help: “Perks present on at least one character you own. Counts include owned characters of the same role.” No owned same-role cohort: useful empty state (“You do not own any [role] characters yet”) with collection link.

## Advanced taxonomy and matching

| Logical group | Options / context |
|---|---|
| Global Availability | Available / Locked |
| Effective Tier | None / I / II / III; character only |
| Perk Origin | Native to this character (character only) / General / Legacy General |
| Account Unlock Record | Shrine / Legacy account |
| Source Character | Owned / Locked |
| Global Automatic Tier | I / II / III; account only |

OR within group; AND between groups. Entire result = context/role AND search AND quick view AND every active advanced group. Native uses nativePerkIds. General can have real source/overlap Native; grants availability but no automatic tier alone. Unlock records match positive recorded fields, not only highest displayed source. Source-less General matches neither Source Owned nor Source Locked, even with both selected. Historical origin does not imply ownership or availability.

Keep context-allowed groups explicit; sanitize invalid option IDs/routes deliberately. Do not normalize whole selected groups away merely because their options cover all current records: selected groups must stay visible/countable/removable. Both source options remain sourced-only.

## Transitions and route memory

Store one selected quick view separately from groups/search/sort. Quick selection clears all advanced groups and retains search/sort. Advanced choices afterward refine selected quick; it stays selected, including All. No Custom preset reconstruction or hidden quick predicate chip. Clear advanced filters clears groups only and retains quick/search/sort.

Filters(n) counts active advanced logical groups only, excluding quick/search/sort. M06 provides one summary per group; × clears whole group and label reopens/focuses it.

Use ordinary in-memory Map keyed by validated canonical routes: survivors, killers, survivor-perks, killer-perks, manage/<canonical-character-id>. Clone snapshots on switch; defaults only for unseen valid routes. Each manager retains search/quick/groups/sort; collections/libraries role-specific. Dashboard/Data do not erase stored entries. Invalid routes use existing fallback, not arbitrary Map keys. Save mutations recompute results without resetting filters. Reload resets; no progression/sessionStorage writes. M08 preference is separate session-global memory. Integrate route-memory logic in M05 only where existing visible controls/matching remain unchanged; otherwise implement/test the state model here and defer live hookup to M06.

## Pure facet calculation contract

For option x in group G, count distinct context/role perks matching search, selected quick view, other active advanced groups and x, ignoring all selections in G. Sort has no effect. Counts are option populations; overlaps need not sum to result count. M05 owns this pure calculation and its tests. No quick-view counts. M06 renders/wires the facets and group summaries.

## Single visible cutover in M06

M06 introduces the quick-view segmented control, Filters trigger/nonmodal popover, grouped checkboxes, active group summaries, Filters(n), facet display and event wiring together. M06 also owns focus/caret/popover lifecycle, tier-action fallback, historical note, reproduced skip-link fix, responsive presentation and completed Filtering browser interaction coverage. M05 introduces no temporary UI or independently shipped new filter experience.

## Milestone-owned tests and steps

- [ ] Exact ID-set truth tables: eligible missing General Bloodweb Available/Missing; maxed III Owned but not eligible; retained historical II Owned but not Needs Upgrade without path; unlock enables upgrade; historical unknown/zero/positive distinct.
- [ ] Account cohort: owned same-role only, automatic minima included; no cohort empty; locked/foreign-role excluded.
- [ ] OR within/AND between, Native/General overlap, origin AND Shrine, source-less exclusions, global zero.
- [ ] Quick clears groups, retains search/sort; groups refine selected quick; clear advanced retains quick; selected groups explicit.
- [ ] Two managers and role-specific collection/library Map state; invalid routes; reload reset; filters write no save.
- [ ] Pure facet fixtures retain search/quick/other groups and ignore own group, including overlapping origins/provenance and source-less exclusions.
- [ ] Add new-contract pure/state regression tests, retaining alias/former-name/role/history invariants. Keep coverage of existing live behavior until M06 switches the UI and matching together.
- [ ] Implement/test definitions, pure contract/transitions/facets/Map; integrate route memory only without visible or live-semantic cutover. Pass phase 1 tests before M06.

## Acceptance, verification and rollback

Exact predicates/transitions/facet calculations and route-state model tests pass; no cross-group OR, historical inference or progression-model change. Independent route snapshots restore/reset correctly in state tests. Existing visible filter experience and its live matching remain intact; no interim UI ships. Zero-result state is legitimate and is never silently repaired.

Verify retained II before/after source unlock, automatic III, eligible zero, absent cohort and independent route snapshots through pure/state fixtures. If route memory is integrated, verify existing controls and matching remain unchanged. Keyboard/width/new-UI verification belongs to M06. Risks: premature live-semantic cutover and raw/effective confusion; isolated contracts and ID-set tests address them. Revert foundation/state integration together; no save migration. Exit: nonvisual checkpoint passes, then M06 performs the one visible cutover before first UX release.
