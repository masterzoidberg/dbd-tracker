# Filtering — phase 2 (M06): popover, summaries and facets

## Goal and dependencies

Perform the single visible Filtering cutover from the existing flat UI to the complete approved experience. M05 provides nonvisual definitions/predicates/transitions/groups, pure facet calculations and route-state model; M02 provides staged tests. M03/M04 are not prerequisites. M05 ships no interim UI or new live matching semantics; M06 switches controls, event wiring and matching together. Approved choices need no new design debate.

## Current behavior and scope

Perk buttons wrap extensively; counts ignore other selections. preserveRender replaces #main and restores IDs/search selection, but many controls lack stable IDs. library-panel clips overflow. Existing detail is native dialog; historical detail has badge without explanation. Skip link #main competes with hash routing.

Likely implementation files: src/app.js perkControls/collection/preserveRender/handleClick/perkDetail/render, src/perk-filters.js facets, index.html stable host/minimal reproduced skip fix, styles.css and focused domain/browser tests. Preserve collection predicates; adjust presentation only where needed. No renderer rewrite, Apply, unrelated cleanup or helper consolidation.

## One nonmodal surface

Introduce the native quick-view segmented control, Filters trigger, grouped checkboxes, active group summaries, Filters(n), UI facet counts and all event/route-state wiring in this phase. Use M05's tested pure contract; complete any live Map hookup deferred to avoid an interim cutover. No temporary visual phase precedes this one.

One native popover="auto" outside routinely replaced #main and clipped panel descendants. Desktop compact bounded panel positioned from Filters trigger bounding rect, clamped to viewport. At narrow widths, same primitive styled as bounded sheet with internal scroll/visible close. No separate mobile modal, modal advanced-filter dialog or CSS anchor-positioning dependency.

Native fieldsets/legends/labelled checkboxes, live results/facets/summaries, no Apply. Preserve stable host/control DOM; update count spans/checked state without replacing focused checkbox. Stable IDs by context/group/option where needed. Keep panel scroll and search caret; stable Filters trigger with appropriate expanded/control relationships.

Close before route/detail/setup/full-context changes, retain route selections. Escape/explicit close returns focus to Filters where appropriate; native light-dismiss follows tested behavior without stealing focus from clicked destination. Nonmodal keyboard navigation is not trapped. Simple resize/scroll positioning, no new dependency. Record/test Popover API browser baseline on file/localhost rather than assuming compatibility.

## Group summaries and facet counts

Quick choices visible. One summary per active advanced logical group, e.g. “Effective Tier: I, II”. Label opens/focuses group; separate labelled native × clears entire group, focus next summary/Filters if removed. Filters(n) counts active groups only; quick/search/sort excluded. Clear advanced filters clears groups only, retaining quick/search/sort. No option-level chip wall or quick predicate chip. No quick-view counts.

Option x in group G: count distinct context/role perks matching search, selected quick view, other selected groups and x; ignore all selections in G. Sort irrelevant. Counts are option populations, not exact toggle-result predictions; overlaps need not sum to result count. Zero selected choices remain removable; don't disable solely due to count. Simple iteration, no cache/service.

Result count visible with restrained status announcement. Empty results explain context and offer clear advanced where useful, without silently clearing quick/search. No-owned cohort uses M05 help/empty state.

## Contained accessibility and history work

Render escaped historicalAvailability.note in existing detail after badge; row/setup badges short, model/confirmation/eligibility unchanged. Missing note omits paragraph. Correct documentation claiming setup already showed full explanation.

Reproduce skip-link/hash interaction on manager/library routes. If activation changes route/context, smallest fix focuses/scrolls main without changing app-route hash. Own browser regression: route/results/state unchanged and main focused. No router rewrite.

Establish Filtering's tier-action fallback here: after a successful upgrade retain the action if present/enabled; if row disappears or action becomes disabled, focus next actionable row where sensible, otherwise results heading/appropriate stable control. Avoid removed/disabled focus and page-start jumps; failed commits preserve saved display/usable focus. Compact later reuses it. Focused popover checkbox survives result changes. Preserve collection search/Prestige/Favorites/sort/ownership semantics and role memory. Don't add collection filter machinery unless demonstrated layout need.

## Milestone-owned tests and implementation steps

- [ ] Wire/render M05's tested facet calculation; browser-displayed counts match the pure results for search/quick/other-group changes, overlaps and source-less cases.
- [ ] Completed quick-view segmented control and event wiring exercise exact predicates/transitions; route away/back/reload proves live Map behavior without progression writes.
- [ ] Filters(n), one group summary, whole-group ×, label reopen/focus, clear advanced transitions.
- [ ] Native nonmodal open/change/close/Escape/light-dismiss; checkbox focus/panel scroll/caret remain stable.
- [ ] Route/detail/setup/full-context closure; selections retained; summary/tier disappearing-control fallback.
- [ ] Escaped visible historical note, unchanged raw confirmation/history semantics.
- [ ] Reproduce/minimally fix skip link if needed and add route/state/main-focus regression.
- [ ] 500/700/900 plus desktop: bounded sheet/panel, reachable controls, no clipping. Inspect shell/topbar too; fix demonstrated overflow/collision only. Collection combinations remain unchanged.
- [ ] Cut over controls/live matching/events/route memory together; render tested facets and stable popover/summaries/note/skip work. Run completed Filtering browser interaction coverage and existing M05 pure/state regressions, then canonical stage on file/localhost.

## Acceptance, verification and rollback

Both phases pass together; every advanced group visible/removable, facets match formula, caret/checkbox/action focus usable. Native nonmodal lifecycle fits widths; historical note readable; skip preserves route. No UI state persisted; direct file and localhost supported.

Manually use Bloodweb Available + tier I/II + source owned, compare counts, summary reopen/remove, clear advanced retaining quick/search/sort, keyboard/caret/skip/detail/away-back. Risks: host replacement/focus theft/misleading counts. If rollback is needed, revert the visible controls, live matching and event wiring together to the prior UI/semantics; the M05 nonvisual foundation may remain. Never leave new semantics behind the old flat controls. Exit: complete Filtering and applicable M09 gate pass; proceed M07A.
