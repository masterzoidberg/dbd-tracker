# Rev02 UX Audit Matrix

## Status and Evidence

**Historical audit 2026-10-21; Core planning consolidation 2026-10-25 · No implementation approval.** Read with [the strategy](00-ui-ux-redesign-strategy.md), [open questions](00b-open-design-questions.md), and the approved [Dashboard plan](01-dashboard.md).

Source baseline: repository HEAD `7a3380a` (`Flatten inventory add-on lists and add quantity steps`). Observed published app: [The Ledger](https://masterzoidberg.github.io/dbd-tracker/). No deployment SHA was exposed, so source/deployment equivalence is not assumed. Representative visible structures agree with inspected rendering code.

**R** = rendered observation; **S** = source; **H** = hypothesis needing later validation. Severity reflects user impact/frequency. No Critical blocker or demonstrated save loss was found. A High audit priority is not an instruction to implement before other screens are reviewed.

### Method and limits

- Primary audit used a temporary in-app browser tab, native UI navigation, accessibility trees, screenshots, and read-only DOM geometry. Reviewed 1920×1080, 1440×1000, 1366×768, 768×1024, 390×844, and a 320×800 quantity-width check. These are desktop-browser viewport overrides, not physical device/touch tests. Not every screen was reviewed at every width.
- Account shown had zero owned characters, zero saved quantities, three native effective perks per sampled character, and no recent edits or queue. No account fixture was imported and no progression, ownership, favorite, queue, quantity, tier or preference was edited. Data replacement/export/reset was not executed. Merely visiting uses the existing app initialization; no storage was inspected or manipulated through browser tooling.
- Selected Ace Visconti and The Animatronic as representative characters. Both rosters, both account perk libraries, character Overview/Perks, perk reconciliation, Character Edit, Survivor stock, Killer Power/Add-ons, Power Details, Data & backups and account setup step 1 were viewed. Owned-only character setup, populated saves, dirty drafts, recovery and failed saves were reviewed in source/tests, not exercised live.
- The browser zoom shortcut attempt did not change inner viewport or device-pixel ratio; native zoom/text enlargement was **not verified**. No CSS/evaluate mutation was used to simulate it. Later review must cover text resize/reflow and physical mobile keyboards/gestures.
- No tests, builds, releases or deployments ran. Existing tests were read for behavioral contracts. No measured task timings, representative user study, full screen-reader audit or performance benchmark is claimed.

## Application Structure and Shared Foundations

| Responsibility | Existing location / architecture | Design implication |
| --- | --- | --- |
| Entry / global shell | `index.html`: sidebar, top bar, main landmark, status regions, dialogs, import input; loads `dist/app.js` | Keep save/read-only/recovery status available across views. Mobile shell is a shared issue. |
| Rendering / events | `src/app.js`, about 1817 lines: HTML-string views, event delegation, routing and view-specific state | Shared helpers exist without a framework. New design need not imply React or a component library. |
| Routes | `src/character-workspace.js`; `src/app.js:540` and rendering/navigation handlers | Canonical character ID and section are already expressible. Persistent resume is separate missing state. |
| Shared presentation | `pageHeading`, `sectionTitle`, `empty`, `selectControl`, artwork helpers, dialogHeader, quantity markup, tier controls in `src/app.js` | Consolidate visual/interaction contracts later; preserve familiar links and native controls. |
| Styles | `styles.css`, about 2681 lines: global tokens/base rules, media queries, appended feature sections | Repeated selectors and hardcoded values can make global changes affect several screens. No cleanup/refactor authorized here. |
| Progression / persistence | `src/model.js`, `src/storage.js`, `src/editor.js` | Account access versus personal tiers, validation, schema compatibility, unknown records, backups and one-writer behavior constrain design. |
| Inventory interaction | `src/inventory-interaction.js`, `src/inventory-quantities.js`, `src/character-inventory.js`, `src/character-edit.js` | Quantity raw/pending/error state, focus retention, tier floors and draft behavior are real existing capabilities to preserve. |
| Filters | `src/perk-filters.js`: route-specific normalization, facet counts, quick views, runtime filter memory | Similar filter concepts operate at distinct scopes. A single visual style must not collapse those meanings. |
| Catalog and assets | `data/catalog.js`, `data/inventory-catalog.js`, `src/assets.js`, asset manifest and existing image directories | Reuse names, relationships, art and stable IDs; dataset changes are outside scope. |
| Build / distribution | esbuild; `scripts/build.mjs`, `scripts/release.mjs`; static bundle and asset packaging | Preserve existing choices. Build can regenerate catalogs/manifest, so it was not run for the audit. |

## Major Screen Inventory

The tables split task/interaction observations from visual/responsive observations to remain readable. Matching screen IDs refer to the same screen. They are an audit inventory, not additional approved screen plans.

### Tasks, hierarchy and interaction

| ID / screen | Primary job / route | Current strengths | Problems and hierarchy | Navigation / interaction friction | Priority |
| --- | --- | --- | --- | --- | --- |
| D — Dashboard | Orient, prioritize, resume; `#dashboard` | Real per-role ownership/access, manual Prestige goals, recent edits; existing empty states | R/S: queue/recent edits precede suggestions and several statistics groups. Approved three-section hierarchy addresses this. | S: one global Prestige queue; no Playing queue or separate pins. Continue opens Overview from edit times rather than a remembered section. | High; design direction already approved |
| SR — Survivor roster | Find/open a character; `#survivors` | Search, owned/locked, Favorites, Prestige and sort; recognizable portraits; optional page sizes | R: all 54 tall cards by default, with native perk trio plus multiple progress/stock measures; discovery competes with detail | R/S: helper promises edit but name and P badge open Overview. Neighbor navigation later follows full catalog rather than filtered result list. | High |
| SW — Survivor workspace / Overview | Understand/manage one character; `#character/<id>/overview` | Named context, portrait, role, progression, section-preserving catalog neighbors, native perks, stock links and separate setup | R/S: 80px portrait competes with broad neighbor boxes/global Edit; native effective tier versus explicit record is weakly explained; normal setup is prominent; stock summary mixes catalog and saved entries | S: setup is separate from Edit; Set P1 saves immediately, Finish saves additive Bloodweb/perk setup with backup. Notes/state currently need Edit. Contextual destinations and save boundaries proposed in plan 03, not implemented. | High |
| SP — Survivor character Perks / Update | Browse effective inventory and reconcile records; `/perks`, `/perks/update` | Effective/recorded/minimum facts, Update search/scopes, card size, inline quick picker and saved-session count | R/S: browse lacks search/filters and clicks enter Update; repeated heading/tools; Only unrecorded means effective zero, not absence of explicit record | S: Update tier selections autosave; normal historical acquisition cannot downgrade. Old Edit's deliberate correction capability must gain a Perks home. General availability may exist at global tier zero. Plan 03 records save/correction decisions SW01/SW02. | High |
| SI — Survivor Items & Add-ons | Enter quantities within family → Item → compatible Add-ons; `/items-addons` | Seven families, selected-Item dropdown, scoped name/effect search, filters, flat rarity-sorted compatible list, direct quantity/step controls, rich Details | R/S: tall media pushes inputs down; selection not on Item cards; filtered empty Add-on set can read like no catalog compatibility; selected Item can be hidden by filters | S: stock resets per character; pending input settles before family/Item/route changes; Add-on quantity is shared across compatible Items. Regroup can move entries; phone input width competes with four fixed step buttons. Plan 03 proposes clearer selection/context, stable entry and distinct empty states. | High |
| KR — Killer roster | Find/recognize/open a Killer, scan progression and native account value; `#killers` | Shared collection renderer/filter/sort/paging; 43 valid current Lore roster portraits; all 44 Power names available in deeper catalog | S: roster already uses Lore, while workspace uses separate square portraits; Slasher's null Lore mapping emits no image. All/5/10 paging and 250px auto-fill cards compete with recognition; Power identity absent; Add-on count is secondary | S: no maintained Killer alias-search field; current search is canonical name only. Plan 04 records settled six-per-page/Lore-first direction, optional Power icons (37 mapped: 32 EXACT/5 REVIEW; seven missing), semantic card navigation and neutral named fallback policy (KR01 resolved). No production changes. | High |
| KW — Killer workspace / Overview | Understand progress, perks, Power and stock; `#character/<id>/overview` | Shared progression/neighbor/tab behavior, Power ownership and Add-on count | R/S: visually resembles Survivor summary but role-specific Power context is less prominent than header/Edit action | S: shared navigation is beneficial; meaningful role difference is content/Power ownership rather than a new layout grammar. | High |
| KP — Killer character Perks / Update | Review/record personal Killer perk tiers; `/perks`, `/perks/update` | Same tier/quick-picker controls; historical constraints and provenance supported | R/S: same header/toolbar/candidate density issue as Survivor; distinct character-personal and account-global scopes | S: same browse-to-update transition and autosave versus explicit-draft distinction | High |
| KA — Killer Power & Add-ons | Read Power reference and enter Add-on quantities; `/power-addons` | Actual Power summary, on-demand rich reference, owner-specific list, rarity ordering; same quantity steps | R: Power summary and tall stock tiles push values down; Power Details repeats raw nested “name/type/description” keys | R/S: no stock search or In Stock controls, unlike Survivor; parity is a design question, not proof both need the same filters. Power reference should be skimmable without editing datasets. | High |
| GP — Account Survivor / Killer perk libraries | Compare account-wide access; `#survivor-perks`, `#killer-perks` | Search by perk/source, quick views, advanced facets; comparison table appropriate on desktop | R: repeated locked labels and 0/0 columns on an empty account; dense domain vocabulary and small labels | R/S: global library vs character Perks naming can confuse scope; active filters and zero states must explain what the user is comparing. | Medium–High |
| E — Character Edit | Explicitly save progression/state/notes/personal corrections; `/edit` | Draft safety, cancel, dirty-navigation guard, validation and underlying-save conflict detection | R: simple progression editing shares a long form with perks and Survivor stock. Save at the bottom only. | R/S: global Saved locally does not describe unsaved draft; Killer Edit reports verified inventory unavailable even though dedicated Power & Add-ons editing exists. Audit that copy/route distinction, not catalogs. | High |
| DB — Data / Backups | Export/import/restore safely; `#data` | Clear local-first warning; backups, recovery and explicit replacement confirmation in source | R: provenance, setup and display settings precede portable-data actions; technical build/research prose appears in product flow | S: do not remove protective confirmation or imply local snapshots are external backups. Normal/error/read-only presentation needs review. | Medium–High |
| AS — Account / character setup | Establish initial records; account overlay state; `/setup` for owned character | Three-step account setup, skip/leave, initial unlock explanation; batch character setup exists | R: two nested scrolling role lists, small Prestige labels; distinction between account setup and character setup requires learning | S: account setup autosaves; character setup has eligibility/session behavior. Review under workspace/Data plans rather than inventing a new screen now. | Medium |

### Visual, mobile, accessibility and dependencies

| ID | Visual issues | Mobile / tablet concern | Accessibility concern or positive evidence | Shared/global dependencies |
| --- | --- | --- | --- | --- |
| D | Similar boxes flatten primary/secondary distinction; zero charts and tall empty sections | R: at 768 sidebar remains and paired panels are narrow; at 390 many administrative layers precede orientation totals | S/R: tracks lack programmatic progress values; adjacent totals remain accessible. Preserve keyboard queue alternatives. | Width/density, hierarchy, queue/resume state, semantic progress |
| SR / KR | Tall peer cards are legitimate for recognition but display many low-priority facts; tiny native-perk label | R: one card nearly fills phone height; control toolbar wraps into several rows | R: Favorite 44px, ownership 34px high, native-perk buttons 36px; do not equate all under-44 targets with automatic WCAG failure. Repeated P0 links need context in audit. | Roster density, typography, links/actions, filters |
| SW / KW | Large character context and repeated panels; low-weight metadata competes with red Edit | R: identity/progress/Edit/tabs occupy much of phone view | Named role and links, `aria-current`, main-focus navigation are good; sticky nav can obscure top of focused content on mobile | Header hierarchy, local actions, route/focus behavior |
| SP / KP | Browsing artwork layout carries into editing; small tier/source badges; duplicate primary emphasis | R/S: detail editor moves before grid on mobile, so it is not simply appended after hundreds of cards. It still begins below stacked header/tools; large grid adds travel. At 768, source retains a 300px side editor beside a narrowed grid. | Quick picker exposes tier actions and focus; full keyboard/screen-reader sequence remains unverified. Tier must have text, not only color. | Editable object pattern, focus, local feedback, responsive pane strategy |
| SI | ~384px stock cards and 144px media regions prioritize imagery over values | R: first quantity document y≈1483 at 390; input only 31px wide at 320 while step buttons hold 44px | Labels and numeric input hint exist; visible 44px steppers are positive. Large valid values and virtual keyboard need later checks. | Quantity group, density, filters/context persistence, detail disclosure |
| KA | Rich Power description above repetitive large Add-on tiles; fallback image displayed | R desktop; mobile concern S/H from shared stock rules, not directly exercised on this role | Power missing-art label is truthful. Heading levels skip H2 in dedicated view (Power/Add-ons H3 to stock H5); review document hierarchy. | Stock controls, structured reference presentation, image fallback |
| GP | Tiny uppercase table labels; repeated locked text/badges; similar weights across fields | R: 941px table inside 333px scroll frame at 390. Data remains available but comparison requires horizontal travel. | Native tables and filter fields useful; verify header associations and scroll keyboard discoverability rather than assuming screen-reader conformance. | Scope terminology, table/list responsive policy, filters |
| E | Wide native fieldsets and repeated personal perk sections; Save not visually near progression | R desktop page 4084px; phone likely worsens travel (H) | Dirty-draft protection S; dedicated dialog padding/focus still needs live exercise. Do not add time/hold gestures to saving or discarding. | Save-mode vocabulary, form/action reachability, validation |
| DB | Many equal panels, large technical-provenance block | R desktop; mobile information order is same in source, increasing travel to backup actions (H) | Confirmation and raw recovery are functional strengths S; do not restyle failure warnings into subtle decorations. | Trust/status, action hierarchy, prose measure |
| AS | Small labels beside compact numeric controls; repeated boxed lists | R desktop; tablet columns and nested scroll region need dedicated review | Standard labels/checkboxes S/R; no completion or eligibility actions exercised. | Setup vocabulary, dense forms, focus/scroll |

## Survivor Workspace Deep Review — 2026-10-22

Additional source review and reinspection of existing screenshots support [plan 03](03-survivor-workspace.md). No new user data was edited, tests run, live populated flows exercised or visual approval granted. Earlier R evidence retains its original coverage limits; new observations below are S unless marked otherwise. Killer workspace planning is now covered in plan 05; standalone library information architecture remains outside Core redesign.

| Area | Deeper finding | Design consequence / preserved contract |
| --- | --- | --- |
| Shared shell | `characterWorkspaceView` dispatches Overview, character Perks, stock, Edit and Setup under the shared header. Neighbors retain supported section/mode in full catalog order. | Compact named neighbors, meaningful artwork and task-specific inner width can share one shell. Do not lose current deep links/section preservation or silently adopt filtered neighbors. |
| Edit Character transaction | `character-edit.js` retains raw invalid input, baseline, complete-save fingerprint and candidate validation. Save can commit all edited character fields atomically; no-op preserves timestamps. Unchanged recorded tiers remain records below later automatic floors. | Retiring the screen must preserve validation, stale-save protection, retry and final-state semantics. Cross-task atomic saving is a real capability; per-task replacement is the explicit consolidation decision (SW03 resolved), with intentional loss of cross-task cancellation and preservation of scoped safety. |
| Deliberate corrections | Ordinary personal tiers enforce minima; historical acquisition protects existing floors and explicit zero. Edit's separate correction path can lower/clear records without removing effective minima. | Perks needs an explicit correction home, not merely the current normal tier picker. Distinguish absent/unconfirmed from historical Not Owned; see SW02. |
| Save/persistence boundaries | `saveCharacterEdit` builds a candidate then commits the selected character. Shared `commit` normalizes aliases and saves through validated, writer-guarded storage. Migration/account-rule normalization is central model/storage behavior, not unique to Edit. | No evidence requires a monolithic screen for migration. Preserve central normalization, unknown IDs/stock, read-only/failure behavior, draft guards and conflict handling. Ordinary edits do not all create backups. |
| Setup | Separate setup route, additive/upgrading Finish, backup before commit, owned eligibility, P0/Bloodweb 1 skip; Set P1 already persists before Finish. General edit dirty guard does not cover every setup draft. | Quiet normal status, prominent actionable incomplete status, honest Cancel semantics and proposed dirty setup departure protection. Setup must not be misrepresented as a destructive reconciliation/correction editor. |
| Character Perks | Current browse is effective-positive/name-sorted. Search/categories/all-role candidates are in Update; Update changes autosave. Categories prioritize Native, then General, unlocked, retained. Only unrecorded uses effective zero. | Proposed browse controls and sort are additions, not current parity with legacy/account libraries. Preserve exceptions/provenance; do not attach Cancel to committed writes (SW01). |
| Account versus personal | `inventoryTier=max(recorded, automatic)`; native minimum exists without a record/owned flag. `isAvailable` includes General, while `globalTier` may be zero. Account reference can edit Shrine/Other unlocks across the role. | Effective character tier, explicit record and account availability/tier are separate labeled facts. Roster account-access proposal needs General qualification. Prevent account edits from silently conflicting with a local draft. |
| Stock compatibility | Adapter builds `compatibleItemIds` using family plus explicit Item restrictions; selected Item filters Add-ons after active search/filters. Stored Add-on stock is keyed by character/Add-on, not selected Item. | Preserve family segregation and shared stock across compatible Items. Direct card selection is a proposal; dropdown remains a useful alternate. No global Add-on collection or per-Item duplicated quantities. |
| Quantity/error/focus | Enter/blur and steps commit directly; shared parser validates safe whole numbers. Valid pending entries settle before route changes; errors/failures can block departure. In Stock retains pending/error rows; successful regroup can reorder positive stock. | Preserve raw text/retry, minimum zero and −1/+1/+5/+10. Review order stability, filter settlement and focus when zero removes a row. Give the input width before preserving columns. |
| Empty/reference states | Filtered compatible list emptiness currently shares no-compatible copy. Details includes effects, rarity/family, compatibility, qualifications and source links. | Distinguish catalog no-Add-ons from no matches. Keep quiet explicit Details with focus restoration; provenance is secondary but not discarded. |

Plan 03 now closes SW01–SW04; plan 05 audits corresponding Killer capabilities and plan 06 aligns the shared contracts. These are planning decisions, not authorization to change shared rendering. The original E row remains an observation of the current monolithic editor, whose retirement now has explicit contextual parity requirements.

## Killer Roster / Artwork Deep Review — 2026-10-22

Read with [04-killer-roster.md](04-killer-roster.md). This supplement is a repository asset-integrity review plus design proposal, not a fresh live deployment audit. Read-only manifest generators, exact-case filesystem checks, file signature/dimension/hash comparisons and Pillow decoding covered every canonical Killer's current roster/workspace/Power mapping. A temporary contact sheet of all Lore images was visually inspected on a neutral dark background. Source images, generated runtime assets, manifests and production code were not changed; no application tests/build/release ran.

| Check / deeper finding | Result / implication |
| --- | --- |
| Current roster source | `collectionArtwork` → `collectionPortraitPath` → `assetManifest.collectionPortraits`. **43/44** already reference `images/updated-images/Character Portraits/Killers/Lore`. A presumed replacement of old roster images is not supported by current source. Published bundle version remains unverified. |
| Separate workspace source | `characterArtwork` → `portraits`: **44/44** valid runtime portraits, 35 PNG/9 WebP, from the older square source pipeline. User's new Lore-first identity direction applies to future Killer header/source work without approving that workspace layout. |
| All-character mapping integrity | No local broken mapped path, case/extension/hash/dimension mismatch, duplicate path or duplicate byte hash within each mapped set. Read-only generated portrait maps agree with checked-in manifest. **124 mapped image references decoded**, zero errors. Nine older .png-named WebP sources already resolve through valid .webp runtime copies; not broken extensions at runtime. |
| Lore coverage/naming | **43 PNG files**, all assigned to current Killers; **41 normalized-title matches + 2 explicit aliases** (`Pinhead.png` → Cenobite; `Ghostface.png` → Ghost Face). Onryō normalizes correctly. No ambiguous/unassigned extra Lore file. |
| Slasher root cause | Canonical ID exists, but Lore source is absent and collection mapping is null. Helper returns empty markup: no roster image/request. A separate valid `images/killer-images/the_slasher.png` is not consulted by collection lookup. This accounts for blank artwork without a deployment/copy/case failure; test source explicitly expects null. |
| Lore display quality | All 43 have alpha transparency. Most are near 1:2; Good Guy **147×274** is low resolution, Singularity **1000×1039** is an aspect outlier. Contact sheet showed no obvious cross-character swap. Future card crop/high-DPI quality needs specific review; no batch crop/rename needed for integrity. |
| Power coverage | **44/44 names**, **37/44 mapped valid icons**: 32 EXACT and five REVIEW (Clown, Huntress, Nemesis, Slasher, Xenomorph). Missing: Animatronic, Dark Lord, First, Ghoul, Houndmaster, Judgment, Krasue. Name-first Power identity can work with optional accepted icons; Lore must not substitute for missing Power art. |
| Data versus filenames | Power/character display labels are not path generators: Slasher's Power is Omnipresent Evil while the mapped file is spelled `Omniprescent Evil.png`. Known explicit mappings are valid; do not normalize names into broken URLs. No maintained Myers/Vecna character alias field was found; perk/portrait aliases are different domains. |

Plan 04 recommends shared roster interaction grammar with a compact Killer-specific Power line, account-scoped native perk states (including General availability at global tier zero), no Add-on summaries, three/two/one columns at six results, accessible broad links and independent Favorite. Shared width/navigation, workspace ownership editing and perk semantics are now reconciled in plan 06. KR01 is resolved: neutral named fallback, including The Slasher, with no square exception. Routine missing assets remain recorded dependencies. The original Killer rows describe the current UI; plan 05 adds the full workspace direction.

## Core Planning Coverage — 2026-10-25

Re-read at local/GitHub `main` commit **351ca1c**, clean before edits; `git ls-remote` matched HEAD. Reconciliation merge and rebuilt effective-export bundle are in history. Current pass inspected source and all eight original Markdown documents, inventoried all 19 PNGs and reviewed their contact sheet, and checked the ZIP's Markdown against pre-edit originals. No fresh live-browser, crop certification or application test run is claimed. The ZIP is now a historical pre-consolidation snapshot and is not current authority.

| Core surface | Planning status / artifact | Closed decisions / remaining dependencies |
| --- | --- | --- |
| Dashboard | Complete direction + source-grounded state review, plan 01 | Three jobs, separate max-five manual role lanes; schema migration/validation/backup/import/export requirements identified. D01/D02 were gates at consolidation and were explicitly approved on 2026-10-27. Stable browser-local Continue recommended. |
| Survivor roster | Reconciled, plan 02 | Six per page; broad link/Favorite; Owned/Locked display with mutation in Overview; native Account access recommendation qualifies General at global zero; global compact shell. |
| Survivor workspace | Reconciled, plan 03 | Explicit Update/autosave/Done; separate correction, scoped atomic drafts, giant editor retirement after parity; safe session context; family→Item→compatible Add-ons and shared quantity controls. |
| Killer roster | Reconciled, plan 04 | Same roster contracts; Power-name identity; Lore source and neutral named Slasher fallback, no Add-ons or square exception. |
| Killer workspace | Complete full plan, plan 05 | Lore identity, Power-first Overview/reference, personal Perks contracts, flat owner-scoped Add-ons, contextual capability audit and structured large Power dialog recommendation. |
| Shared shell/system | Complete bounded plan, plan 06 | Archive/Tool, six labeled destinations, compact Menu recommended once content is constrained, initial ~1300px candidate, 3/2/1 useful widths, state ownership/save/focus/error/accessibility contracts. |
| Legacy libraries / Data & Backups | Core compatibility boundary defined | Existing IA can remain. Functional shell integration, shared vocabulary/type/accessibility and **schema-compatible import/export/recovery** required; no full redesign prerequisite. |

### Source Reality Checks Added

| Concern | Evidence / consequence |
| --- | --- |
| Effective export reconciliation | `model.js` exports raw `perks` plus derived `effectivePerks`/summary; validator reconstructs canonical fields and ignores derived extras. Never materialize effective data into personal records. General availability does not itself provide positive automatic tier. |
| Current schema and queue | Schema v2 has global ordered Prestige goals only. Role filter is runtime UI, not separate persisted rank. Future role queues/Playing/pins need explicit migration/versioning; old v2 validator would drop unknown extra state. |
| Correction limits | `correctPersonalPerkTier` accepts null/I–III, including lowering historical records. Historical setter accepts explicit zero but is non-downgrading. Absent and zero cannot be merged by a generic None control. |
| Scoped edit safeguards | Whole-save fingerprint, validation, raw/error retention, no-op/unknown protection in old editor must survive replacement. Migrations/account normalization are model/storage responsibilities; no giant UI dependency. |
| Killer editor discrepancy | Monolithic form only embeds Survivor quantities; dedicated Killer Add-ons already saves directly with owner validation. Preserve direct editing rather than recreate a composite Killer stock draft. |
| Context separation | Current Update session keyed to route resets search/selection/count; quantity session keyed to character resets values. Future safe session filters must be separated from per-character pending/error state. Density already persists browser-locally. |
| Reference structure | Power renderer currently recursively prints raw nested keys; runtime structured fields permit summary/sections/component headings without changing datasets. Large Power dialog and smaller Add-on reference can share focus rules without identical geometry. |

SW01–SW04, G01–G07, W01–W08 and KR01 are closed as explicit decisions or clearly labeled bounded recommendations. D03–D05 are closed recommendations. D01/D02 were the only unresolved product questions at consolidation; both were explicitly approved on 2026-10-27. Fit/tokens/target sizing, dirty-flow exercise and longest-reference/unknown-state checks are later verification work, not missing Core plans.

## Representative Workflow Costs and Existing Efficiencies

| Flow | Inspected cost / condition | Implication |
| --- | --- | --- |
| Visible character → its stock | Open character, then stock section: two route activations from roster | Could improve entry paths later, but count alone does not justify adding every destination to every card. |
| Stock visible quantity → +10 | One activation, saves directly in detail mode; in Edit it changes draft only | Preserve single action, explicit local save mode and validation. |
| Set an arbitrary stock total | Focus, enter digits, Enter/blur | Do not replace direct input with many step clicks. Four utility buttons between fields increase Tab traversal. |
| Reconcile next ordinary perk in update view | Select card → choose tier in quick picker or detail editor | Existing two-action repeated flow; no need to invent a new quick-picker subsystem. Historical perks remain a different supported case. |
| Open progression edit from roster | Character → Edit → change value → reach Save | The costly part includes vertical travel, not only click count. Empty Ace Save was ≈3874px below the viewport top in the sampled state. |
| Move to next character in same stock/perk section | One next-character link | Preserve; decide whether order should ever reflect the invoking roster filter. |
| Resume previous stock task from Dashboard | Current recent edit → Overview → stock tab | New Continue requires last-section state; styling the link does not solve it. |

## Rendered Evidence Index

Screenshots record the existing application, not design proposals. They include empty-account values, default missing-art fallbacks and incidental scroll positions. Navigation focuses main and sometimes scrolls the top bar out of view. Compare with the dimensions/method above; these are not automated visual goldens.

| Evidence | What it substantiates |
| --- | --- |
| [Dashboard 1440](evidence/dashboard-1440.png), [1920](evidence/dashboard-1920.png) | Framed empty states, current order, large-screen grouping |
| [Dashboard 768](evidence/dashboard-768.png), [390](evidence/dashboard-390.png) | Tablet sidebar pressure, mobile navigation and stacked hierarchy |
| [Survivor roster 1440](evidence/survivor-roster-1440.png), [390](evidence/survivor-roster-390.png) | Recognition strength, card density and wrapped control rows |
| [Survivor Overview](evidence/survivor-overview-1440.png), [Character Edit](evidence/character-edit-1440.png) | Context block, mixed summary treatments, composite form |
| [Stock opening](evidence/survivor-stock-top-1440.png), [stock controls](evidence/survivor-stock-controls-1440.png), [mobile stock](evidence/survivor-stock-390.png) | Header/tools versus values, large repeated cards, mobile task access |
| [Perk Update 1440](evidence/perk-update-1440.png), [390](evidence/perk-update-390.png) | Reconciliation header/tool density; populated candidate list on an empty account |
| [Killer Perks laptop](evidence/killer-perks-1366.png) | Shared character-perk structure and artwork |
| [Killer Power/Add-ons](evidence/killer-power-addons-1440.png), [Power Details](evidence/power-details-1440.png) | Reference/entry hierarchy, fallback Power art, raw nested keys |
| [Killer global library](evidence/killer-perk-library-1440.png), [mobile Survivor global library](evidence/perk-library-390.png) | Account-personal scope difference and narrow table containment |
| [Data & backups](evidence/data-backups-1440.png) | Provenance/setup/settings preceding portable-data actions |

## Independent Skill-Assisted Assessments

Impeccable critique was used as a reference within this requested Rev02 audit. Its two independent assessments ran without access to each other's findings; design assessment completed before detector findings were released into synthesis. Their temporary tabs saw read-only state because the primary audit tab held the normal editor lock. They did not press Enable editing or alter records. Their observed viewports were 1265×712 and 1280×720; the primary audit supplied the explicit responsive dimensions above.

Assessment A independently identified the same main themes: account/perk semantics, edit density, ambiguous roster navigation, Dashboard hierarchy, and tiny supporting text. Its approximate Nielsen review was 24/40; this is an expert impression under partial/empty-account coverage, not a benchmark or WCAG score. The final strategy uses concrete findings rather than treating that number as a release verdict.

### Deterministic detector and manual interpretation

Command used by Assessment B:

```powershell
& 'C:\Users\nicol\.agents\skills\impeccable\scripts\impeccable.cmd' detect --json src/app.js index.html
```

The usable JSON contained **18 findings: 14 warnings and 4 advisories**, attributed to `index.html`, line 0. The HTML scan exited **1**, with no diagnostic; the tool's help describes that as an unscannable-target status. Treat its output as operationally qualified, not a successful clean scan. A separate template-JS scan returned `[]`, exit 0. It does **not** validate generated UI markup: the static shell contains startup fallback content and the Dashboard/workspaces render from JS strings. Repeated diagnostic scans reproduced those results; no full-app clean result is claimed.

| Rule / count | Interpretation after source/render checks |
| --- | --- |
| `low-contrast` ×1 | Verified narrow defect: focused skip link has gold `#d5b174` background; global `a:hover` makes its text white, about 2.025:1. Do not generalize to all text. Common muted text `#aaa7a4` on `#19191b` measures about 7.33:1. |
| `undersized-ui-text` ×8 | Small type is real, but static analyzer appears to merge media declarations. Desktop topbar buttons render at 12px, not its reported 10px; source mobile rules reduce some to 8–10px. Native-perk roster label is actually 8px at runtime. |
| `tiny-text` ×2 | Readability concern; record location/context, not an automatic WCAG violation from size alone. |
| `wide-tracking` ×1 | Refers to uppercase microcopy; not ordinary body paragraphs. Design judgment, not broad paragraph failure. |
| `cramped-padding` ×1 | Main dialog content and confirmation form already have 28px padding. Dirty-navigation form lacks a dedicated matching padding rule; that specific state remains unverified. |
| `gpt-thin-border-wide-shadow` ×3 | False positives for three native dialogs sharing a neutral floating shadow; they are not a repeated row of resting cards. |
| `overused-font` ×1 | Inter declaration is real; popularity alone is not a design failure or evidence of which fallback glyphs render. |
| `dark-glow` ×1 | False positive in observed perk cards: shadow rule is on a pseudo-element whose computed content is `none`, so it does not generate a visible halo. |

No browser overlay was injected: the supported evaluate API is read-only, and this audit excludes page mutation. Static diagnostics were supplemented by screenshots, rendered computed styles/dimensions, accessible state and keyboard focus observations. No live detector server started. Browser presentation/overlay were not claimed. No `.impeccable` critique snapshot/config or root product/design file was created; this Rev02 matrix is the requested durable record. No critique ignore list was present. Per-target critique-storage slug/trend persistence was not used because a single-screen historical critique store is outside the requested site-wide Rev02 packet.

### Accessibility evidence and limits

- Positive R/S: navigation has `aria-current`, workspace/neighbor links are 44px high, quantity buttons are 44px, a Tab from role navigation reached search with a visible 2px gold outline, and field labels/error associations exist.
- Skip-link hover contrast defect is specific and verified; the document remains navigable by normal keyboard links. Fix later as a functional accessibility issue, not part of a cosmetic palette exercise.
- Four Dashboard progress tracks have no progress role/value/name; adjacent totals communicate the data. Decide whether tracks are decorative or semantic; do not duplicate confusing announcements.
- Do not force every touched element to be 44px merely because a native-mobile guideline says so, or classify every 34–38px desktop control as a WCAG failure. Protect practical mobile target size and spacing through context-sensitive review.
- Mobile sticky navigation can cover the top of the main heading after navigation/focus in captured routes. This is a focus/scroll design concern to recheck with keyboard and text enlargement.
- Console warnings/errors were absent on the independent sampled Perks view. That observation does not establish application-wide performance or error-free behavior.

## Verification Dependencies for Later Work

Current tests encode useful protections and some old layout expectations. Read but did not run: `tests/dashboard-selectors.test.js`, `tests/prestige-queue.test.js`, `tests/character-workspace.test.js`, `tests/character-edit.test.js`, `tests/inventory-interaction.test.js`, and representative browser files `dashboard.mjs`, `character-workspace.mjs`, `character-edit.mjs`, `inventory.mjs`, `character-inventory.mjs`, `killer-power-addons.mjs`, plus release/storage code.

Later roadmap work should reconcile approved designs with keyboard/focus order, queue/pin persistence, draft versus autosave, import/export and unknown-record preservation, editor lock/recovery, responsive geometry, quantity entry stability and asset packaging. The audit supplies concerns to investigate; it does not assign an implementation sequence or authorize new tests/features now.

## Consolidation Verification — 2026-10-25

After the document edits, the nine existing test files `model`, `storage`, `export-effective-perks`, `character-edit`, `character-inventory`, `character-workspace`, `inventory-quantities`, `inventory-interaction` and `prestige-queue` passed under `node --test --test-reporter=dot` (exit 0). This validates current source contracts used by the plans, not unimplemented Rev02 behavior. No new tests or source changes were added. Earlier statements that tests were not run describe the original dated audit only.

All ten Markdown documents were checked for structure, relative links and stale answered-decision wording. All 19 archived evidence image bytes match the live historical files. `git diff --check` passed. No build or live browser run was needed for planning-only changes; final geometry/accessibility still requires implementation-time rendered verification.
