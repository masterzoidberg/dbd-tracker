# Canonical character routing and compatibility

Date: 2026-10-13. Status: finalized route recommendation grounded in the current exact hash parser. Documentation only. This document owns actual future character URLs; Dashboard and collection consumers use this contract.

## Canonical model

Use one new `character` hash prefix with existing catalog character slugs; keep the existing router architecture and direct-file support. Explicit section names make bookmarks readable and avoid overloading the old perk-only `manage` meaning.

| Task | Canonical hash | Role/behavior |
| --- | --- | --- |
| Overview | `#character/<id>/overview` | Both; universal normal destination |
| Perks | `#character/<id>/perks` | Both; effective inventory browsing |
| Perk reconciliation | `#character/<id>/perks/update` | Both; focused candidate/detail management |
| Survivor Items & Add-ons | `#character/<id>/items-addons` | Survivor only |
| Killer Power & Add-ons | `#character/<id>/power-addons` | Killer only |
| Edit Character | `#character/<id>/edit` | Both; comprehensive update task, not a browsing tab |
| Initial/review character setup | `#character/<id>/setup` | Both; Owned/writer required to perform setup |
| Legacy perk manager compatibility | `#character/<id>/perks/legacy` | Both; retained old broad manager during rollout |

`#character/<id>` is a convenience alias for `/overview`; canonical producers always include `/overview`. No route stores last-used tab, draft state, filter choices or selected perk. Explicit Perks/Setup/Edit links are exceptions by task semantics, not different defaults based on entry source. Existing top-level Dashboard, collections, account libraries and Data routes remain.

Use a small shared route parser/builder responsibility alongside the existing character parser, not a new router framework. Character route producers take canonical `characterById` IDs, not display names or inferred image-folder names. Parse complete anchored paths, use own-property catalog lookup, reject extra segments and role-inappropriate sections. Distinguish a malformed/unresolved character route from an unrelated top-level route. All workspace routes activate the appropriate Survivor/Killer shell navigation and expose local current section; Edit/Setup labels indicate a task rather than falsely marking Perks selected.

## Existing route mappings

Prefer parser aliases rendering the shared canonical view, matching the current `#experiment` strategy. Return a canonical descriptor without mandatory hash redirects; the loaded bookmark remains stable, and all newly rendered links use canonical URLs. This avoids extra history entries and redirect loops. Canonical URL replacement could be considered later, but is not required for compatibility or this implementation plan.

| Existing valid route | Canonical rendered destination | Meaning preserved |
| --- | --- | --- |
| `#manage/<id>` | `#character/<id>/perks` | Effective perk inventory, never Overview |
| `#manage/<id>/update` | `#character/<id>/perks/update` | Focused perk reconciliation, never comprehensive Edit |
| `#manage/<id>/legacy` | `#character/<id>/perks/legacy` | Full legacy filters/table/correction access |
| `#experiment/<id>` | `#character/<id>/perks` | Same normal inventory alias as today |
| `#experiment/<id>/update` | `#character/<id>/perks/update` | Same reconciliation alias as today |

No currently recognized experiment legacy route exists; do not fabricate a historical mapping for it. Legacy view has a secondary link to canonical Perks. Its eventual retirement requires parity verification and a documented compatibility replacement; it is retained here. Old saved hashes and internal links keep working indefinitely through these mappings unless a later explicit decision supersedes them.

## Producers and entry points

| Producer/action | Target |
| --- | --- |
| Dashboard Current Focus, queue character, suggested P1 character, recent character, Favorite | `/overview` |
| Survivor/Killer collection identity and Prestige character action | `/overview` |
| Collection explicitly labeled Perks/Inventory shortcut | `/perks` (area-specific link, not generic identity action) |
| Overview Edit Character | `/edit` |
| Overview perk/item/Power summary | Appropriate named section |
| Explicit perk reconciliation | `/perks/update` |
| Setup notice/review or batch Run character setups | `/setup`, without popup |
| Existing global perk library/perk details | Existing routes/dialogs; do not rewrite domain tools into generic navigation |

Convert ordinary popup-opening character controls into real links with existing artwork/text; keep independent Favorite/Owned buttons. Setup/account flows can link directly to needed workspace tasks. Link building is authoritative here; Dashboard never invents parallel route names. Navigation alone never writes a save or timestamp.

## Direct loading, invalid routes and focus

Every canonical/compatibility hash loads directly under file or localhost; no server fallback needed. Known unowned characters still have browseable workspace pages. A recognized character prefix with unknown ID, malformed/extra path, or wrong-role area shows an accessible “Character/section unavailable” view with collection/Dashboard links rather than silently showing an unrelated character or Dashboard. Unknown IDs remain preserved state but have no editable fabricated catalog character. A read-only Edit/Setup deep link shows task context and the writer notice with disabled mutation controls; browsing/navigation stays available.

Route entry focuses main/h1 after rendering and scrolls to top consistently with current hash navigation. Workspace links expose current section; returning after Save/Cancel goes to the remembered in-memory caller when valid, otherwise Overview. Direct edit reload defaults to Overview return. No persistent origin tracking. Dirty edit navigation must use the approved draft guard in 05, including hash back/forward; do not let the current unconditional hashchange handler discard the draft. Parser alias normalization must not reset a running session when switching equivalent descriptors.

## Why this model

One explicit workspace prefix separates the newly approved control room from existing perk-only bookmarks. Reusing `manage/<id>` as Overview would silently change those bookmarks' meaning. A replacement router adds no necessary capability. Parser aliases reuse the current architecture without requiring redirects or a second renderer.

## Future routing verification

Cover each canonical route, `#character/<id>` alias, all five old mappings, equivalent session descriptors, direct file/localhost loading, blank hash Dashboard, unknown IDs, extra segments, wrong role, read-only Edit/Setup, browser back/forward and no last-tab behavior. Verify every approved Dashboard/collection identity action opens Overview and no character popup, while area shortcuts remain correctly labeled. Verify route focus and dirty-draft navigation protection. Tests/builds are deferred to implementation.
